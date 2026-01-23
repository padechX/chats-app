export const config = { runtime: 'edge' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function kvGet(key: string): Promise<any | null> {
  const KV_URL = process.env.KV_REST_API_URL
  const KV_TOKEN = process.env.KV_REST_API_TOKEN
  if (!KV_URL || !KV_TOKEN) return null
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } })
  if (!r.ok) return null
  const js: any = await r.json().catch(() => null)
  try { return js?.result ? JSON.parse(js.result) : null } catch { return null }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: { ...CORS_HEADERS, 'Allow': 'POST, OPTIONS' } as any })
  try {
    const body = await req.json().catch(() => ({} as any))
    const to = String(body?.to || '').trim()
    // Accept either `text` as string or `{ text: string }` in body.message
    const text = String((typeof body?.text === 'string' ? body.text : body?.message) || '').trim()
    if (!to || !text) return new Response(JSON.stringify({ ok: false, error: 'invalid_params' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    const kvVersion = await kvGet('wa:graph_version')
    const version = kvVersion || process.env.WHATSAPP_GRAPH_VERSION || 'v24.0'
    const kvToken = await kvGet('wa:access_token')
    const kvPhone = await kvGet('wa:phone_number_id')
    const token = kvToken || process.env.WHATSAPP_TOKEN
    const phoneNumberId = kvPhone || process.env.WHATSAPP_PHONE_NUMBER_ID
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
