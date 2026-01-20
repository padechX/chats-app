export const config = { runtime: 'edge' }

// Minimal admin endpoint to configure WhatsApp credentials on the backend.
// Protect with X-Admin-Secret header that must match process.env.ADMIN_SECRET.
// Persists to Vercel KV if KV_REST_API_URL and KV_REST_API_TOKEN are set.
// Keys used: wa:access_token, wa:phone_number_id

type Body = {
  access_token?: string
  phone_number_id?: string
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
  const sec = req.headers.get('X-Admin-Secret') || ''
  if (!ADMIN_SECRET || sec !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  if (method === 'GET') {
    const access_token = hasKV ? await kvGet<string>('wa:access_token') : mem['wa:access_token']
    const phone_number_id = hasKV ? await kvGet<string>('wa:phone_number_id') : mem['wa:phone_number_id']
    return new Response(JSON.stringify({
      access_token: access_token ? (access_token.slice(0, 6) + '...' + access_token.slice(-4)) : null,
      phone_number_id: phone_number_id || null,
      kv: hasKV,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (method === 'POST') {
    let body: Body
    try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
    const { access_token, phone_number_id } = body
    if (!access_token && !phone_number_id) {
      return new Response(JSON.stringify({ error: 'missing_fields', required: ['access_token', 'phone_number_id'] }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    if (access_token) {
      if (hasKV) await kvSet('wa:access_token', access_token)
      else mem['wa:access_token'] = access_token
    }
    if (phone_number_id) {
      if (hasKV) await kvSet('wa:phone_number_id', phone_number_id)
      else mem['wa:phone_number_id'] = phone_number_id
    }
    return new Response(JSON.stringify({ ok: true, kv: hasKV }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Allow': 'GET, POST', 'Content-Type': 'application/json' } })
}
