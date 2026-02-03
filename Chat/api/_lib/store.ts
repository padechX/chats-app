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

function now() { return Date.now() }

export const store = {
  async putMessage(msg: Message) {
    mem.msgs.set(msg.id, msg)
    if (msg.status === 'pending') mem.idxPending.add(msg.id)
    else mem.idxProcessed.add(msg.id)
  },
  async listMessages(status: 'pending' | 'processed'): Promise<Message[]> {
    const ids = status === 'pending' ? mem.idxPending : mem.idxProcessed
    const out: Message[] = []
    ids.forEach((id) => {
      const v = mem.msgs.get(id)
      if (v) out.push(v)
    })
    return out.sort((a, b) => b.timestamp - a.timestamp)
  },
  async getMessage(id: string): Promise<Message | undefined> {
    return mem.msgs.get(id)
  },
  async markProcessed(id: string): Promise<boolean> {
    const v = mem.msgs.get(id)
    if (!v) return false
    v.status = 'processed'
    mem.msgs.set(id, v)
    mem.idxPending.delete(id)
    mem.idxProcessed.add(id)
    return true
  },
  async getState(): Promise<State> {
    return mem.state
  },
  async setState(s: Partial<State>) {
    mem.state = { ...mem.state, ...s }
  },
}
