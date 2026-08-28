import type { Session } from "next-auth"
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

// JWT secret for verifying NextAuth tokens
// In a real app, you'd get this from NextAuth config
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'

/**
 * Get the current authenticated session by verifying JWT token
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('next-auth.session-token')?.value
    
    if (!sessionToken) {
      return null
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(
      sessionToken,
      new TextEncoder().encode(JWT_SECRET)
    )

    // Return session with user data from token payload
    // Adjust these fields based on what's actually in your NextAuth JWT
    return {
      user: {
        id: typeof payload.sub === 'string' ? payload.sub : '',
        name: typeof payload.name === 'string' ? payload.name : null,
        email: typeof payload.email === 'string' ? payload.email : null,
        image: typeof payload.picture === 'string' ? payload.picture : null,
        role: (payload.role as "ADMIN" | "MANAGER" | "USER") || "USER"
      }
    } as Session
  } catch (error) {
    // Token verification failed (expired, invalid, etc.)
    return null
  }
}

/**
 * Require authentication for API routes
 * Returns the session if authenticated, throws error otherwise
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new Error('UNAUTHORIZED: Authentication required')
  }
  return session
}

/**
 * Require specific role for API routes
 * @param allowedRoles Array of roles that are allowed to access the route
 */
export function requireRole(session: Session, allowedRoles: string[]): void {
  const userRole = session.user.role
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error(`FORBIDDEN: Insufficient permissions. Required one of: ${allowedRoles.join(", ")}`)
  }
}

/**
 * Require authentication and specific role in one step
 */
export async function requireAuthAndRole(allowedRoles: string[]): Promise<Session> {
  const session = await requireAuth()
  requireRole(session, allowedRoles)
  return session
}
