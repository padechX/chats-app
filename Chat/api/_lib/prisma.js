// Lightweight dynamic Prisma client loader with global caching. Works even if @prisma/client
// is not installed or DATABASE_URL is not set (returns null in that case).

/**
 * Returns a Prisma client instance or null if not available.
 * - Avoids bundling Prisma in serverless unless present.
 * - Caches on globalThis to reuse connections across invocations.
 */
export async function getPrisma() {
  try {
    if (!process.env.DATABASE_URL) return null

    const g = globalThis
    if (!g.__prisma) {
      // Dynamic import so builds do not fail if @prisma/client is missing
      const mod = await import('@prisma/client')
      const { PrismaClient } = mod
      g.__prisma = new PrismaClient()
    }
    return g.__prisma
  } catch (e) {
    // If Prisma or dependencies are not available, just return null
    return null
  }
}
