// Note: Lazy import store only in POST handler to avoid side-effects during GET verification
declare const process: any

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = process.env.WHATSAPP_VERIFY_TOKEN
    if (mode === 'subscribe' && token && challenge && expected && token === expected) {
      return text(challenge, 200)
    }
    return text('forbidden', 403)
  }

  if (req.method === 'POST') {
    const { store } = await import('../_lib/store.js')
    const raw = await req.text()
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (appSecret) {
      const sig = req.headers.get('x-hub-signature-256') || ''
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
      const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
      const expected = 'sha256=' + hex
      if (sig !== expected) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      }
    }

    let json: any = {}
    try { json = JSON.parse(raw) } catch {}

    // Normalize WhatsApp Cloud Webhook format
    try {
      const entries: any[] = json.entry || []
      for (const entry of entries) {
        const changes: any[] = entry.changes || []
        for (const ch of changes) {
          const value = ch.value || {}
          const messages: any[] = value.messages || []
          for (const m of messages) {
            const id = m.id || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()))
            const from = m.from
            const type = m.type || 'text'
            const text = type === 'text' ? (m.text?.body || '') : '[non-text message]'
            await store.putMessage({ id, timestamp: Date.now(), from, to: undefined, type: 'text', text, status: 'pending', raw: m })
          }
        }
      }
    } catch {}

    const st = await store.getState()
    // Optionally auto-reply when closed (future: template)
    return new Response(JSON.stringify({ ok: true, closed: st.closed }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response('method_not_allowed', { status: 405 })
}
// nudge: deployment trigger
