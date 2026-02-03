type PrismaClientAny = any

let prismaInstance: PrismaClientAny | null = null

export async function getPrisma(): Promise<PrismaClientAny | null> {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[prisma] DATABASE_URL not set, skipping')
      return null
    }
    
    if (!prismaInstance) {
      const mod: any = await import('@prisma/client')
      const PrismaClient = mod?.PrismaClient
      if (!PrismaClient) return null
      prismaInstance = new PrismaClient()
    }
    
    return prismaInstance
  } catch (e) {
    console.error('[prisma] Failed to initialize:', e)
    return null
  }
}
