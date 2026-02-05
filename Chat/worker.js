
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    
    if (path === '/api/whatsapp/webhooks' || path === '/api/whatsapp/webhook') {
      if (request.method === 'GET') return handleWebhookVerify(url, env)
      if (request.method === 'POST') return handleWebhookPost(request, env)
      return methodNotAllowed(['GET', 'POST'])
    }

    if (path === '/api/whatsapp/send' && request.method === 'POST') {
      return handleSend(request, env)
    }

    if (path === '/api/whatsapp/messages' && request.method === 'GET') {
      return handleMessagesList(url, env)
    }

    const ackMatch = path.match(/^\/api\/whatsapp\/messages\/([^/]+)\/ack$/)
    if (ackMatch && request.method === 'POST') {
      return handleAck(ackMatch[1], env)
    }

    const mediaMatch = path.match(/^\/api\/whatsapp\/media\/([^/]+)$/)
    if (mediaMatch && request.method === 'GET') {
      return handleMediaDownload(mediaMatch[1], env)
    }

    if (path === '/api/whatsapp/media/upload' && request.method === 'POST') {
      return handleMediaUpload(request, env)
    }

    return new Response('Not found', { status: 404 })
  }
}


export class MessageQueue {
  constructor(state, env) {
    this.state = state
    this.env = env
  }

  
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/add' && request.method === 'POST') {
      const msg = await request.json()
      await this.state.storage.put(msg.id, msg)
      return json({ ok: true })
    }

    if (path === '/list' && request.method === 'GET') {
      const status = url.searchParams.get('status') || 'pending'
      const list = []
      const { keys } = await this.state.storage.list()
      for (const k of keys) {
        const v = await this.state.storage.get(k.name)
        if (!v) continue
        if (!status || v.status === status) list.push(v)
      }
      
      list.sort((a,b)=> (a.timestamp||0) - (b.timestamp||0))
      return json(list.slice(-100))
    }

    const ackMatch = path.match(/^\/ack\/([^/]+)$/)
    if (ackMatch && request.method === 'POST') {
      const id = ackMatch[1]
      const v = await this.state.storage.get(id)
      if (!v) return json({ ok: false, error: 'not_found' }, 404)
      v.status = 'processed'
      await this.state.storage.put(id, v)
      return json({ ok: true })
    }

    return new Response('DO Not found', { status: 404 })
  }
}


function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

function methodNotAllowed(allow) {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: allow.join(', ') } })
}

function getGraphBase(env) {
  const v = env.WHATSAPP_GRAPH_VERSION || 'v20.0'
  return `https://graph.facebook.com/${v}`
}

function getQueueStub(env) {
  const id = env.MESSAGE_QUEUE.idFromName('global')
  return env.MESSAGE_QUEUE.get(id)
}

async function handleWebhookVerify(url, env) {
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && challenge && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
  }
  return new Response('Forbidden', { status: 403 })
}

async function handleWebhookPost(request, env) {
  
  if (env.WHATSAPP_APP_SECRET) {
    const ok = await verifyMetaSignature(request, env.WHATSAPP_APP_SECRET)
    if (!ok) return new Response('Invalid signature', { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const entries = body.entry || []
  const stub = getQueueStub(env)

  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      const value = change.value || {}
      const messages = value.messages || []
      for (const m of messages) {
        const normalized = normalizeIncoming(m, value)
        if (!normalized) continue
        await stub.fetch('https://do/add', { method: 'POST', body: JSON.stringify(normalized), headers: { 'content-type': 'application/json' } })
      }
    }
  }

  return new Response('EVENT_RECEIVED')
}

function normalizeIncoming(m, value) {
  const id = m.id || crypto.randomUUID()
  const from = m.from
  const timestamp = Number(m.timestamp || Date.now())
  const type = m.type
  let payload = {}
  if (type === 'text') {
    payload = { text: m.text?.body || '' }
  } else if (m.image) {
    payload = { mediaId: m.image.id, mime_type: 'image/jpeg', type: 'image' }
  } else if (m.document) {
    payload = { mediaId: m.document.id, mime_type: m.document.mime_type || 'application/octet-stream', filename: m.document.filename, type: 'document' }
  } else if (m.audio) {
    payload = { mediaId: m.audio.id, mime_type: 'audio/mpeg', type: 'audio' }
  } else if (m.video) {
    payload = { mediaId: m.video.id, mime_type: 'video/mp4', type: 'video' }
  } else {
    payload = { raw: m }
  }
  return { id, from, type, ...payload, status: 'pending', timestamp }
}

async function verifyMetaSignature(request, appSecret) {
  const sig = request.headers.get('x-hub-signature-256') || ''
  if (!sig.startsWith('sha256=')) return false
  const expected = sig.slice(7)
  const body = await request.clone().arrayBuffer()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, body)
  const macHex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(macHex, expected)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function handleMessagesList(url, env) {
  const status = url.searchParams.get('status') || 'pending'
  const stub = getQueueStub(env)
  const r = await stub.fetch(`https://do/list?status=${encodeURIComponent(status)}`)
  return new Response(r.body, r)
}

async function handleAck(id, env) {
  const stub = getQueueStub(env)
  const r = await stub.fetch(`https://do/ack/${encodeURIComponent(id)}`, { method: 'POST' })
  return new Response(r.body, r)
}

async function handleSend(request, env) {
  const { to, text, type, media_id, media_link, media_base64, filename, mime_type } = await request.json()
  let finalType = type || (text ? 'text' : 'image')
  let payload

  
  let mid = media_id
  if (!mid && media_base64) {
    const up = await handleMediaUpload(new Request('https://internal', { method: 'POST', body: JSON.stringify({ base64: media_base64, filename, mime_type }), headers: { 'content-type': 'application/json' } }), env)
    const data = await up.json()
    mid = data.id
  }

  if (finalType === 'text') {
    payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
  } else {
    
    const comp = mid ? { id: mid } : { link: media_link }
    payload = { messaging_product: 'whatsapp', to, type: finalType, [finalType]: comp }
    if (filename && finalType === 'document') payload.document.filename = filename
  }

  const res = await fetch(`${getGraphBase(env)}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const txt = await res.text()
  return new Response(txt, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } })
}

async function handleMediaDownload(mediaId, env) {

  const meta = await fetch(`${getGraphBase(env)}/${mediaId}`, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
  })
  if (!meta.ok) return new Response(await meta.text(), { status: meta.status })
  const j = await meta.json()
  const url = j.url
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` } })
  const h = new Headers()
  
  const ct = bin.headers.get('content-type')
  if (ct) h.set('content-type', ct)
  const cd = bin.headers.get('content-disposition')
  if (cd) h.set('content-disposition', cd)
  return new Response(await bin.arrayBuffer(), { status: 200, headers: h })
}

async function handleMediaUpload(request, env) {
  const { base64, filename = 'file', mime_type = 'application/octet-stream' } = await request.json()
  if (!base64) return json({ error: 'base64 required' }, 400)
  const form = new FormData()
  const binary = base64ToUint8Array(base64)
  form.append('file', new Blob([binary], { type: mime_type }), filename)
  form.append('messaging_product', 'whatsapp')

  const up = await fetch(`${getGraphBase(env)}/${env.WHATSAPP_PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    body: form
  })
  const txt = await up.text()
  try {
    const j = JSON.parse(txt)
    return json(j, up.status)
  } catch (_) {
    return new Response(txt, { status: up.status, headers: { 'content-type': 'text/plain' } })
  }
}

function base64ToUint8Array(b64) {
  
  const idx = b64.indexOf(',')
  const data = idx >= 0 ? b64.slice(idx + 1) : b64
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
