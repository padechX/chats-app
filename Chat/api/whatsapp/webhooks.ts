export const config = { runtime: 'edge' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hub-Signature-256',
}

async function verifyWebhookSignature(body: string, signature: string | null): Promise<boolean> {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) return true
  if (!signature) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const expectedSignature = `sha256=${hex}`
  return signature === expectedSignature
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN
    if (token && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: CORS_HEADERS as any })
    }
    return new Response('invalid', { status: 403, headers: CORS_HEADERS as any })
  }

  if (req.method === 'POST') {
    const body = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!(await verifyWebhookSignature(body, signature))) {
      return new Response('invalid_signature', { status: 403, headers: CORS_HEADERS as any })
    }

    try {
      const { store } = await import('../_lib/store.js')
      const payload = JSON.parse(body)

      const entries = payload.entry || []
      for (const entry of entries) {
        const changes = entry.changes || []
        for (const change of changes) {
          const value = change.value || {}

          const messages = value.messages || []
          for (const msg of messages) {
            const id = String(msg.id || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`))
            const from = String(msg.from || '')
            const type = String(msg.type || 'text')
            const text = type === 'text' ? String(msg.text?.body || '') : '[non-text message]'
            await store.putMessage({ id, timestamp: Date.now(), from, to: undefined, type: 'text', text, status: 'pending', raw: msg })
          }

          const statuses = value.statuses || []
          for (const st of statuses) {
            console.log(`[webhooks] Message ${st.id} status: ${st.status}`)
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    } catch (e: any) {
      console.error('[webhooks] Webhook error:', e)
      return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }
  }

  return new Response('method_not_allowed', { status: 405, headers: { ...CORS_HEADERS, 'Allow': 'GET, POST, OPTIONS' } as any })
}
