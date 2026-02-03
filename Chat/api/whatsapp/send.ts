export const config = { runtime: 'edge' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: { ...CORS_HEADERS, 'Allow': 'POST, OPTIONS' } as any })
  try {
    // Parse body supporting application/json, application/x-www-form-urlencoded and text/plain
    const ct = (req.headers.get('Content-Type') || '').toLowerCase()
    let to = ''
    let text = ''
    if (ct.includes('application/json')) {
      const body = await req.json().catch(() => ({} as any))
      to = String(body?.to || '').trim()
      text = String((typeof body?.text === 'string' ? body.text : body?.message) || '').trim()
    } else {
      const raw = await req.text().catch(() => '')
      if (raw && (ct.includes('application/x-www-form-urlencoded') || ct.includes('text/plain'))) {
        // Try URLSearchParams first (supports to=..&text=..)
        const sp = new URLSearchParams(raw)
        to = (sp.get('to') || '').trim()
        text = (sp.get('text') || sp.get('message') || '').trim()
        if (!to && !text) {
          // Fallback: if someone sent JSON as text/plain
          try {
            const j = JSON.parse(raw)
            to = String(j?.to || '').trim()
            text = String((typeof j?.text === 'string' ? j.text : j?.message) || '').trim()
          } catch {}
        }
      }
    }
    if (!to || !text) return new Response(JSON.stringify({ ok: false, error: 'invalid_params' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    const version = process.env.WHATSAPP_GRAPH_VERSION || 'v24.0'
    const token = process.env.WHATSAPP_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
    const payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const resp = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))
    if (!r.ok) return new Response(JSON.stringify({ ok: false, status: r.status, response: resp }), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    return new Response(JSON.stringify({ ok: true, data: resp }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'send_failed', message: String(e?.message || e || 'unknown') }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  }
}
// nudge: deployment trigger
