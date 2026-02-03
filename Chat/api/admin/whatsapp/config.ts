export const config = { runtime: 'edge' }
declare const process: any

// Minimal admin endpoint to configure WhatsApp credentials on the backend.
// Protect with X-Admin-Secret header that must match process.env.ADMIN_SECRET.
// Persists to Vercel KV if KV_REST_API_URL and KV_REST_API_TOKEN are set.
// Keys used: wa:access_token, wa:phone_number_id

type Body = {
  access_token?: string
  phone_number_id?: string
  graph_version?: string
}

const KV_URL = (process as any)?.env?.KV_REST_API_URL
const KV_TOKEN = (process as any)?.env?.KV_REST_API_TOKEN
const ADMIN_SECRET = (process as any)?.env?.ADMIN_SECRET
const hasKV = Boolean(KV_URL && KV_TOKEN)

async function kvFetch(path: string, init?: RequestInit) {
  const url = `${KV_URL}${path}`
  const headers = { ...(init?.headers || {}), Authorization: `Bearer ${KV_TOKEN}` }
  return fetch(url, { ...init, headers })
}

async function kvSet<T>(key: string, val: T): Promise<void> {
  await kvFetch(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(val) })
}

async function kvGet<T>(key: string): Promise<T | null> {
  const r = await kvFetch(`/get/${encodeURIComponent(key)}`)
  if (!r.ok) return null
  const js: any = await r.json().catch(() => null)
  if (!js) return null
  try { return js.result ? JSON.parse(js.result) as T : null } catch { return null }
}

// In-memory fallback for local/dev without KV
let mem: Record<string, any> = {}

export default async function handler(req: Request): Promise<Response> {
  const method = req.method
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
  }

  return new Response(JSON.stringify({ ok: false, error: 'gone' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', ...CORS } as any,
  })
}
