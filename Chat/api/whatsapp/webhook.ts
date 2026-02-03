// Note: Lazy import store only in POST handler to avoid side-effects during GET verification
declare const process: any

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const { default: webhooksHandler } = await import('./webhooks.js')
  const r = await webhooksHandler(req)
  if (req.method === 'GET') {
    const body = await r.text()
    return text(body, r.status)
  }
  return r
}
// nudge: deployment trigger
