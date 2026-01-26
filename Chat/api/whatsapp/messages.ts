import { store } from '../_lib/store.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS as any })
  }
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const status = (url.searchParams.get('status') as 'pending' | 'processed') || 'pending'
    const data = await store.listMessages(status)
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
  } 
  if (req.method === 'POST') {
    // test helper to insert a message manually
    const b = await req.json().catch(() => ({} as any))
    const id = b?.id || crypto.randomUUID()
    const text = String(b?.text || 'test')
    await store.putMessage({ id, timestamp: Date.now(), from: b?.from, to: b?.to, type: 'text', text, status: 'pending', raw: b })
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
  }
  return new Response('method_not_allowed', { status: 405, headers: { ...CORS } as any })
}
// nudge: deployment trigger
