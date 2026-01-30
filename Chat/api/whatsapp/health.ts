export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { 
      status: 405, 
      headers: { ...CORS_HEADERS, 'Allow': 'GET, HEAD, OPTIONS', 'Content-Type': 'application/json' } as any 
    })
  }
  try {
    const url = new URL(req.url)
    const debug = url.searchParams.get('debug')
    if (debug === '1') {
      const token = (process.env.WHATSAPP_TOKEN || '')
      const suffix = token ? token.slice(-8) : null
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || null
      return new Response(
        JSON.stringify({ ok: true, debug: { token_suffix: suffix, phone_number_id: phoneId } }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any }
      )
    }
    return new Response(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'health_check_failed', message: String(e?.message || e || 'unknown') }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
    })
  }
}
