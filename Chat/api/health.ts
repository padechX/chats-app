export const config = { runtime: 'nodejs' }

export default async function handler(): Promise<Response> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  return new Response(
    JSON.stringify({ ok: true, service: 'myspa-social-backend', time: new Date().toISOString() }),
    { status: 200, headers }
  )
}
// nudge: minor change for deployment trigger
