// Simple storage adapter with in-memory fallback.
// In Vercel, set KV_REST_API_URL and KV_REST_API_TOKEN to enable persistence later.
declare const process: any

export type Message = {
  id: string
  timestamp: number
  from?: string
  to?: string
  type: 'text'
  text: string
  status: 'pending' | 'processed'
  raw?: any
}

type State = {
  closed: boolean
}

const mem = {
  msgs: new Map<string, Message>(),
  idxPending: new Set<string>(),
  idxProcessed: new Set<string>(),
  state: { closed: false } as State,
}

// Simple KV over Upstash REST (Vercel KV). Only if env vars exist.
const KV_URL = process.env?.KV_REST_API_URL
const KV_TOKEN = process.env?.KV_REST_API_TOKEN
const hasKV = Boolean(KV_URL && KV_TOKEN)

async function kvFetch(path: string, init?: RequestInit) {
  const url = `${KV_URL}${path}`
  const headers = { ...(init?.headers || {}), Authorization: `Bearer ${KV_TOKEN}` }
  const r = await fetch(url, { ...init, headers })
  return r
}

async function kvGet<T>(key: string): Promise<T | null> {
  const r = await kvFetch(`/get/${encodeURIComponent(key)}`)
  if (!r.ok) return null
  const js: any = await r.json().catch(() => null)
  if (!js) return null
  try { return js.result ? JSON.parse(js.result) as T : null } catch { return null }
}

async function kvSet<T>(key: string, val: T): Promise<void> {
  await kvFetch(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(val) })
}

const PENDING_KEY = 'wa:pending_ids'
const PROCESSED_KEY = 'wa:processed_ids'
function now() { return Date.now() }

export const store = {
  async putMessage(msg: Message) {
    if (hasKV) {
      await kvSet(`wa:msg:${msg.id}`, msg)
      if (msg.status === 'pending') {
        const arr = (await kvGet<string[]>(PENDING_KEY)) || []
        if (!arr.includes(msg.id)) arr.unshift(msg.id)
        await kvSet(PENDING_KEY, arr)
      } else {
        const arr = (await kvGet<string[]>(PROCESSED_KEY)) || []
        if (!arr.includes(msg.id)) arr.unshift(msg.id)
        await kvSet(PROCESSED_KEY, arr)
      }
      return
    }
    // memory fallback
    mem.msgs.set(msg.id, msg)
    if (msg.status === 'pending') mem.idxPending.add(msg.id)
    else mem.idxProcessed.add(msg.id)
  },
  async listMessages(status: 'pending' | 'processed'): Promise<Message[]> {
    if (hasKV) {
      const ids = (await kvGet<string[]>(status === 'pending' ? PENDING_KEY : PROCESSED_KEY)) || []
      const out: Message[] = []
      for (const id of ids) {
        const v = await kvGet<Message>(`wa:msg:${id}`)
        if (v) out.push(v)
      }
      return out
    }
    // memory fallback
    const ids = status === 'pending' ? mem.idxPending : mem.idxProcessed
    const out: Message[] = []
    ids.forEach((id) => {
      const v = mem.msgs.get(id)
      if (v) out.push(v)
    })
    return out.sort((a, b) => b.timestamp - a.timestamp)
  },
  async getMessage(id: string): Promise<Message | undefined> {
    if (hasKV) return (await kvGet<Message>(`wa:msg:${id}`)) || undefined
    return mem.msgs.get(id)
  },
  async markProcessed(id: string): Promise<boolean> {
    if (hasKV) {
      const v = await kvGet<Message>(`wa:msg:${id}`)
      if (!v) return false
      v.status = 'processed'
      v.timestamp = now()
      await kvSet(`wa:msg:${id}`, v)
      const p = (await kvGet<string[]>(PENDING_KEY)) || []
      const pr = (await kvGet<string[]>(PROCESSED_KEY)) || []
      await kvSet(PENDING_KEY, p.filter(x => x !== id))
      if (!pr.includes(id)) pr.unshift(id)
      await kvSet(PROCESSED_KEY, pr)
      return true
    }
    const v = mem.msgs.get(id)
    if (!v) return false
    v.status = 'processed'
    mem.msgs.set(id, v)
    mem.idxPending.delete(id)
    mem.idxProcessed.add(id)
    return true
  },
  async getState(): Promise<State> {
    if (hasKV) {
      const s = await kvGet<State>('wa:state')
      return s || { closed: false }
    }
    return mem.state
  },
  async setState(s: Partial<State>) {
    if (hasKV) {
      const cur = await (async () => (await kvGet<State>('wa:state')) || { closed: false })()
      const next = { ...cur, ...s }
      await kvSet('wa:state', next)
      return
    }
    mem.state = { ...mem.state, ...s }
  },
}
