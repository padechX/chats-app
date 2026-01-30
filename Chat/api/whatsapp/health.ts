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
      // ENV values
      const envToken = process.env.WHATSAPP_TOKEN || ''
      const envSuffix = envToken ? envToken.slice(-8) : null
      const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || null

      // KV values (if configured)
      let kvSuffix: string | null = null
      let kvPhoneId: string | null = null
      try {
        const KV_URL = process.env.KV_REST_API_URL
        const KV_TOKEN = process.env.KV_REST_API_TOKEN
        if (KV_URL && KV_TOKEN) {
          const hdrs = { Authorization: `Bearer ${KV_TOKEN}` }
          const [tokRes, phoneRes] = await Promise.all([
            fetch(`${KV_URL}/get/${encodeURIComponent('wa:access_token')}`, { headers: hdrs }),
            fetch(`${KV_URL}/get/${encodeURIComponent('wa:phone_number_id')}`, { headers: hdrs }),
          ])
          if (tokRes.ok) {
            const js: any = await tokRes.json().catch(() => null)
            const v = js?.result ? JSON.parse(js.result) : null
            if (v && typeof v === 'string') kvSuffix = v.slice(-8)
          }
          if (phoneRes.ok) {
            const js: any = await phoneRes.json().catch(() => null)
            const v = js?.result ? JSON.parse(js.result) : null
            if (v && typeof v === 'string') kvPhoneId = v
          }
        }
      } catch {}

      // Effective source matches current send.ts selection (KV first, then ENV)
      const effectiveSource = kvSuffix ? 'kv' : 'env'
      const effectiveSuffix = kvSuffix || envSuffix
      const effectivePhoneId = kvPhoneId || envPhoneId

      return new Response(
        JSON.stringify({ ok: true, debug: { env_token_suffix: envSuffix, kv_token_suffix: kvSuffix, effective_source: effectiveSource, effective_token_suffix: effectiveSuffix, phone_number_id: effectivePhoneId } }),
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
