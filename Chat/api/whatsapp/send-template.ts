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
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405, headers: { ...CORS_HEADERS, 'Allow': 'POST, OPTIONS' } as any })
  }
  try {
    // Parse JSON body
    const ct = (req.headers.get('Content-Type') || '').toLowerCase()
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ ok: false, error: 'unsupported_content_type' }), { status: 415, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }
    const body = await req.json().catch(() => ({} as any))
    const to = String(body?.to || '').trim()
    const inputLanguage = String(body?.language || '').trim()

    // Two modes:
    // 1) Full template provided by client (preferred)
    // 2) Convenience: text-only -> send using a generic approved template name from ENV
    let template: any = body?.template

    // If not provided, build a generic template with a single body parameter
    if (!template) {
      const tplMapRaw = process.env.WHATSAPP_DEFAULT_TEMPLATE_MAP
      let tplName = process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'business_intro_v1'
      const lang = ((): string => {
        const fallback = process.env.WHATSAPP_DEFAULT_TEMPLATE_LANG || 'en_US'
        if (!inputLanguage) return fallback
        return inputLanguage
      })()
      if (tplMapRaw) {
        try {
          const m = JSON.parse(tplMapRaw)
          if (m && typeof m === 'object' && m[lang]) tplName = String(m[lang])
        } catch {}
      }
      const text = String(body?.text || '').trim()
      if (!text) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_params', message: 'Either template or text is required.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
      }
      template = {
        name: tplName,
        language: { code: lang },
        components: [
          { type: 'body', parameters: [ { type: 'text', text } ] }
        ]
      }
    } else {
      // Normalize minimal fields
      if (!template?.name || !template?.language?.code) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_template' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
      }
    }

    if (!to) return new Response(JSON.stringify({ ok: false, error: 'invalid_params' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    // Resolve credentials (ENV has priority over KV)
    const kvVersion = await kvGet('wa:graph_version')
    const version = kvVersion || process.env.WHATSAPP_GRAPH_VERSION || 'v24.0'
    const kvToken = await kvGet('wa:access_token')
    const kvPhone = await kvGet('wa:phone_number_id')
    const token = process.env.WHATSAPP_TOKEN || kvToken
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || kvPhone
    if (!token || !phoneNumberId) return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    // Build Graph payload
    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template
    }

    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const resp = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))
    if (!r.ok) return new Response(JSON.stringify({ ok: false, status: r.status, response: resp }), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    return new Response(JSON.stringify({ ok: true, data: resp }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'send_template_failed', message: String(e?.message || e || 'unknown') }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  }
}
