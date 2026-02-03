export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ ok: false, error: 'gone' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
  })
}
