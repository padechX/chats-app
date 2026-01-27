import { store } from '../_lib/store.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function getPrisma() {
  try {
    const mod = await import('../_lib/prisma.js')
    return await mod.getPrisma()
  } catch {
    return null
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS as any })
  }
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const status = (url.searchParams.get('status') as 'pending' | 'processed' | 'received' | 'sent' | 'delivered' | 'read' | 'failed') || 'received'
    const prisma = await getPrisma()
    if (prisma) {
      const take = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)
      const data = await prisma.message.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take,
      })
      return new Response(JSON.stringify({ ok: true, data, source: 'db' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
    }
    const data = await store.listMessages('pending')
    return new Response(JSON.stringify({ ok: true, data, source: 'store' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
  } 
  if (req.method === 'POST') {
    // test helper to insert a message manually
    const b = await req.json().catch(() => ({} as any))
    const text = String(b?.text || 'test')
    const prisma = await getPrisma()
    if (prisma) {
      const created = await prisma.message.create({
        data: {
          wamid: b?.wamid || `local_${Date.now()}`,
          from: String(b?.from || ''),
          to: String(b?.to || ''),
          text,
          status: String(b?.status || 'received'),
        },
      })
      return new Response(JSON.stringify({ ok: true, id: created.id, wamid: created.wamid, source: 'db' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
    }
    const id = b?.id || crypto.randomUUID()
    await store.putMessage({ id, timestamp: Date.now(), from: b?.from, to: b?.to, type: 'text', text, status: 'pending', raw: b })
    return new Response(JSON.stringify({ ok: true, id, source: 'store' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } as any })
  }
  return new Response('method_not_allowed', { status: 405, headers: { ...CORS } as any })
}
// nudge: deployment trigger
