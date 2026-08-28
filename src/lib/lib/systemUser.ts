import { prisma } from "./prisma"

/**
 * Default system user ID for the desktop application.
 * Since this is a single-user desktop app (Electron), we use a fixed system user
 * instead of authentication sessions.
 *
 * This ID is stored in the database and can be overridden via environment variable.
 */
export async function getSystemUserId(): Promise<string> {
  // Check if we have a custom system user ID from env
  const envUserId = process.env.DEFAULT_SYSTEM_USER_ID

  if (envUserId) {
    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: envUserId },
      select: { id: true }
    })
    if (user) {
      return user.id
    }
    // Fall through to create/get default if env user doesn't exist
  }

  // Find or create the default system user
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@lacolaria.local' },
    select: { id: true }
  })

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Sistema Laçolaria',
        email: 'system@lacolaria.local',
        password: 'system-user-no-login', // This user cannot log in
        role: 'ADMIN',
        status: 'ACTIVE'
      },
      select: { id: true }
    })
  }

  return systemUser.id
}

/**
 * Get the system user object (for display purposes)
 */
export async function getSystemUser() {
  const userId = await getSystemUserId()
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true }
  })
}

/**
 * Synchronous version - only works if user already exists
 * Use this in hot paths where you can't await (e.g., middleware)
 * Falls back to a hardcoded UUID if not found
 */
let cachedSystemUserId: string | null = null

export async function getSystemUserIdSync(): Promise<string> {
  if (cachedSystemUserId) {
    return cachedSystemUserId
  }

  const userId = await getSystemUserId()
  cachedSystemUserId = userId
  return userId
}

/**
 * Clear the cached system user ID (useful for testing)
 */
export function clearSystemUserCache(): void {
  cachedSystemUserId = null
}