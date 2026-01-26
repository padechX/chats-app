import { store } from '../../../_lib/store.js'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  const url = new URL(req.url)
  const m = url.pathname.match(/\/messages\/(.+?)\/ack$/)
  const id = m?.[1] || ''
  if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const ok = await store.markProcessed(id)
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
}
 