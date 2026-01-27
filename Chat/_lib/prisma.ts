import { PrismaClient } from '@prisma/client'

let prismaInstance: PrismaClient | null = null

export async function getPrisma(): Promise<PrismaClient | null> {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[prisma] DATABASE_URL not set, skipping')
      return null
    }
    
    if (!prismaInstance) {
      prismaInstance = new PrismaClient()
    }
    
    return prismaInstance
  } catch (e) {
    console.error('[prisma] Failed to initialize:', e)
    return null
  }
}
