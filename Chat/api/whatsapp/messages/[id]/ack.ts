export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, 'Allow': 'POST, OPTIONS' } as any,
    })
  }

  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const id = parts.length >= 2 ? parts[parts.length - 2] : ''

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
      })
    }

    const { store } = await import('../../../_lib/store.js')
    const processed = await store.markProcessed(id)

    return new Response(JSON.stringify({ ok: true, id, processed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'ack_failed', message: String(e?.message || e || 'unknown') }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any,
    })
  }
}
