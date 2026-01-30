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

function pickLanguage(input?: string): string {
  const fallback = process.env.WHATSAPP_DEFAULT_TEMPLATE_LANG || 'en_US'
  if (!input || input === 'auto') return fallback
  return input
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: { ...CORS_HEADERS, 'Allow': 'POST, OPTIONS' } as any })
  try {
    const ct = (req.headers.get('Content-Type') || '').toLowerCase()
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ ok: false, error: 'unsupported_content_type' }), { status: 415, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }
    const body = await req.json().catch(() => ({} as any))
    const to = String(body?.to || '').trim()
    const text = String(body?.text || body?.message || '').trim()
    const language = pickLanguage(String(body?.language || 'auto'))

    if (!to || !text) return new Response(JSON.stringify({ ok: false, error: 'invalid_params' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    // Resolve credentials (ENV has priority)
    const kvVersion = await kvGet('wa:graph_version')
    const version = kvVersion || process.env.WHATSAPP_GRAPH_VERSION || 'v24.0'
    const kvToken = await kvGet('wa:access_token')
    const kvPhone = await kvGet('wa:phone_number_id')
    const token = process.env.WHATSAPP_TOKEN || kvToken
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || kvPhone
    if (!token || !phoneNumberId) return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`

    // 1) Intento de TEXTO LIBRE
    const textPayload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
    let r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(textPayload) })
    if (r.ok) {
      const okResp = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))
      return new Response(JSON.stringify({ ok: true, mode: 'text', data: okResp }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }

    // Si falla (p.ej. fuera de 24h), pasamos a PLANTILLA automática
    const err = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))

    // 2) Intento de PLANTILLA con envoltura automática
    const tplNameMapRaw = process.env.WHATSAPP_DEFAULT_TEMPLATE_MAP
    let tplName = process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'business_intro_v1'
    if (tplNameMapRaw) {
      try {
        const m = JSON.parse(tplNameMapRaw)
        if (m && typeof m === 'object' && m[language]) tplName = String(m[language])
      } catch {}
    }

    const templatePayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: tplName,
        language: { code: language },
        components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
      },
    }

    r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(templatePayload) })
    if (r.ok) {
      const okResp = await r.json().catch(async () => ({ raw: await r.text().catch(() => '') }))
      return new Response(JSON.stringify({ ok: true, mode: 'template', language, template: tplName, data: okResp, previous_error: err }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }

    // 3) Fallback final: reintentar con en_US si el idioma elegido no está aprobado
    const fallbackLang = 'en_US'
    if (language !== fallbackLang) {
      const fallbackTemplate = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: tplName,
          language: { code: fallbackLang },
          components: [{ type: 'body', parameters: [{ type: 'text', text }] }],
        },
      }
      const rf = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(fallbackTemplate) })
      if (rf.ok) {
        const okResp = await rf.json().catch(async () => ({ raw: await rf.text().catch(() => '') }))
        return new Response(JSON.stringify({ ok: true, mode: 'template', language: fallbackLang, template: tplName, data: okResp, previous_error: err }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
      }
      const fail = await rf.json().catch(async () => ({ raw: await rf.text().catch(() => '') }))
      return new Response(JSON.stringify({ ok: false, status: rf.status, response: fail, previous_error: err }), { status: rf.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
    }

    // Si ya era en_US y falló
    return new Response(JSON.stringify({ ok: false, status: r.status, response: err }), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'send_smart_failed', message: String(e?.message || e || 'unknown') }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  }
}
