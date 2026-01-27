import crypto from 'crypto'

export const config = { runtime: 'nodejs' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hub-Signature-256',
}

// Lazy Prisma loader (optional). If Prisma is not available or DATABASE_URL is not set,
// getPrisma() will resolve to null and we fallback to console logging only.
async function getPrisma() {
  try {
    // @ts-ignore - dynamic import to avoid bundling when not installed
    const mod = await import('../_lib/prisma.js')
    return await mod.getPrisma()
  } catch {
    return null
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  // If no app secret configured, do not block (allow processing without signature)
  if (!appSecret) return true
  // If secret configured but signature is missing, reject
  if (!signature) return false
  const hash = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex')
  const expectedSignature = `sha256=${hash}`
  return signature === expectedSignature
}

async function persistMessage(message: any): Promise<void> {
  const prisma = await getPrisma()
  if (prisma) {
    try {
      await prisma.message.upsert({
        where: { wamid: message.id },
        update: {
          from: String(message.from || ''),
          to: String(message.to || ''),
          text: String(message.text?.body || ''),
          status: 'received',
        },
        create: {
          wamid: String(message.id || ''),
          from: String(message.from || ''),
          to: String(message.to || ''),
          text: String(message.text?.body || ''),
          status: 'received',
        },
      })
      return
    } catch (e) {
      console.warn('[webhooks] prisma persist failed, falling back to log:', e)
    }
  }
  console.log(`[webhooks] Message received from ${message.from}: ${message.text?.body || ''}`)
}

async function handleStatusUpdate(status: any): Promise<void> {
  const prisma = await getPrisma()
  if (prisma) {
    try {
      await prisma.message.update({
        where: { wamid: String(status.id || '') },
        data: { status: String(status.status || 'unknown') },
      })
      return
    } catch (e) {
      // If not found, ignore and just log
      console.warn('[webhooks] prisma status update failed, falling back to log:', e)
    }
  }
  console.log(`[webhooks] Message ${status.id} status: ${status.status}`)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  
  if (token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: CORS_HEADERS as any })
  }
  return new Response('invalid', { status: 403, headers: CORS_HEADERS as any })
}

// ENDURECER: Validar firma realmente
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  
  // ✅ VALIDAR FIRMA
  if (!verifyWebhookSignature(body, signature)) {
    return new Response('invalid_signature', { status: 403, headers: CORS_HEADERS as any })
  }
  
  try {
    const payload = JSON.parse(body)
    
    // ✅ PARSEAR EVENTOS CORRECTAMENTE
    const entries = payload.entry || []
    for (const entry of entries) {
      const changes = entry.changes || []
      for (const change of changes) {
        const value = change.value || {}
        
        // Mensajes entrantes
        const messages = value.messages || []
        for (const msg of messages) {
          await persistMessage({
            id: msg.id,
            from: msg.from,
            to: value.metadata?.display_phone_number,
            text: msg.text,
            type: msg.type,
          })
        }
        
        // Estatus de entrega
        const statuses = value.statuses || []
        for (const status of statuses) {
          await handleStatusUpdate({
            id: status.id,
            status: status.status, // delivered, read, failed, etc
          })
        }
      }
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  } catch (e: any) {
    console.error('❌ Webhook error:', e)
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS as any })
}
