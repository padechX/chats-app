import crypto from 'crypto'

export const config = { runtime: 'nodejs' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hub-Signature-256',
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) return false
  
  const hash = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex')
  
  const expectedSignature = `sha256=${hash}`
  return signature === expectedSignature
}

async function persistMessage(message: any): Promise<void> {
  // TODO: Implementar con Prisma ORM
  // await prisma.messages.create({
  //   data: {
  //     to: message.to,
  //     from: message.from,
  //     text: message.text?.body || '',
  //     wamid: message.id,
  //     status: 'received',
  //   }
  // })
  console.log(`[webhooks] Message received from ${message.from}: ${message.text?.body || ''}`)
}

async function handleStatusUpdate(status: any): Promise<void> {
  // TODO: Implementar con Prisma ORM
  // await prisma.messages.update({
  //   where: { wamid: status.id },
  //   data: { status: status.status }
  // })
  console.log(`[webhooks] Message ${status.id} status: ${status.status}`)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS as any })
  }

  if (req.method === 'GET') {
    // Webhook verification from WhatsApp
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = url.searchParams.get('hub.verify_token')
    
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    
    if (mode === 'subscribe' && verifyToken === expectedToken) {
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
    
    return new Response(JSON.stringify({ ok: false, error: 'invalid_verify_token' }), { 
      status: 403, 
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
    })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text()
      const signature = req.headers.get('x-hub-signature-256')
      
      // Verify webhook signature
      if (!verifyWebhookSignature(body, signature)) {
        console.warn('[webhooks] Invalid signature')
        return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
        })
      }

      const payload = JSON.parse(body)
      
      // Process webhook entries
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              const value = change.value
              
              // Handle incoming messages
              if (value.messages && Array.isArray(value.messages)) {
                for (const message of value.messages) {
                  await persistMessage({
                    id: message.id,
                    from: message.from,
                    to: value.metadata?.phone_number_id,
                    text: message.text,
                    timestamp: message.timestamp,
                  })
                }
              }
              
              // Handle message status updates
              if (value.statuses && Array.isArray(value.statuses)) {
                for (const status of value.statuses) {
                  await handleStatusUpdate({
                    id: status.id,
                    status: status.status,
                    timestamp: status.timestamp,
                  })
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
      })
    } catch (e: any) {
      console.error('[webhooks] Error processing webhook:', e)
      return new Response(JSON.stringify({ ok: false, error: 'webhook_processing_failed', message: String(e?.message || e || 'unknown') }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
      })
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { 
    status: 405, 
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
  })
}
