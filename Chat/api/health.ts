export const runtime = 'edge'

export default async function handler(req: Request): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  } as any

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers: CORS })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: { ...CORS, 'Allow': 'GET, HEAD, OPTIONS' } as any })
  }
  return new Response(
    JSON.stringify({ ok: true, service: 'myspa-social-backend', time: new Date().toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any }
  )
}
