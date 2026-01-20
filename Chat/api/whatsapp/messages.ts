import { store } from '../_lib/store'

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const status = (url.searchParams.get('status') as 'pending' | 'processed') || 'pending'
    const data = await store.listMessages(status)
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  if (req.method === 'POST') {
    // test helper to insert a message manually
    const b = await req.json().catch(() => ({} as any))
    const id = b?.id || crypto.randomUUID()
    const text = String(b?.text || 'test')
    await store.putMessage({ id, timestamp: Date.now(), from: b?.from, to: b?.to, type: 'text', text, status: 'pending', raw: b })
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response('method_not_allowed', { status: 405 })
}
// nudge: deployment trigger
