export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, service: 'myspa-social-backend', time: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
