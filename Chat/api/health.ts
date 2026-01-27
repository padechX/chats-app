export const runtime = 'edge';

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const data = {
    ok: true,
    service: 'myspa-social-backend',
    time: new Date().toISOString()
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: headers
  });
}