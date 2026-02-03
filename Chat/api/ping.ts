export const config = { runtime: 'nodejs' };

export default async function handler(req: Request): Promise<Response> {
  const CORS: any = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  return new Response(JSON.stringify({ ok: false, error: 'gone' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', ...CORS } as any,
  });
}
