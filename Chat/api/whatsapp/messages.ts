export const config = { runtime: 'nodejs' }

declare const process: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function getPrisma() {
  try {
    const mod = await import('../_lib/prisma.js')
    return await mod.getPrisma()
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const prisma = await getPrisma()
    
    if (prisma) {
      const messages = await prisma.message.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      })
      return new Response(JSON.stringify({ messages }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
      })
    }
    
    // Fallback sin Prisma
    return new Response(JSON.stringify({ messages: [] }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } as any 
    })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS as any })
}
