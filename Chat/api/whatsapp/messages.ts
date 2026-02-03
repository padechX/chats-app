export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, 'Allow': 'GET, OPTIONS' } as any,
    })
  }

  try {
    const url = new URL(req.url)
    const statusRaw = (url.searchParams.get('status') || 'pending').toLowerCase()
    const status = (statusRaw === 'processed' ? 'processed' : 'pending') as 'pending' | 'processed'

    const { store } = await import('../_lib/store.js')
    const messages = await store.listMessages(status)

    return new Response(JSON.stringify({ ok: true, status, messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'list_failed', message: String(e?.message || e || 'unknown') }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
    })
  }
}
