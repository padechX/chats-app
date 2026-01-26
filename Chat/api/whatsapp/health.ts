export const config = { runtime: 'nodejs' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { 
      status: 405, 
      headers: { ...CORS_HEADERS, 'Allow': 'GET, OPTIONS', 'Content-Type': 'application/json' } as any 
    })
  }
  try {
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
