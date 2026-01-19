export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  try {
    const body = await req.json().catch(() => ({} as any))
    const to = String(body?.to || '').trim()
    const text = String(body?.text || '').trim()
    if (!to || !text) return new Response(JSON.stringify({ ok: false, error: 'invalid_params' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const token = process.env.WHATSAPP_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const version = process.env.WHATSAPP_GRAPH_VERSION || 'v19.0'
    if (!token || !phoneNumberId) return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
    const payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const resp = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))
    if (!r.ok) return new Response(JSON.stringify({ ok: false, status: r.status, response: resp }), { status: r.status, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true, data: resp }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'send_failed', message: String(e?.message || e || 'unknown') }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
