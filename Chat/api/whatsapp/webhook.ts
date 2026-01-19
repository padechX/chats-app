import crypto from 'node:crypto'
import { store } from '../_lib/store'

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

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
    const raw = await req.text()
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (appSecret) {
      const sig = req.headers.get('x-hub-signature-256') || ''
      const h = crypto.createHmac('sha256', appSecret)
      h.update(raw, 'utf8')
      const expected = 'sha256=' + h.digest('hex')
      const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      if (!ok) return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), { status: 403 })
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
            const id = m.id || crypto.randomUUID()
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
