import { auth } from "@/lib/auth"
import type { Session } from "next-auth"
import { apiUnauthorizedError, apiForbiddenError } from "@/lib/apiResponse"


/**
 * Get the current authenticated session
 */
export async function getSession(): Promise<Session | null> {
  return await auth()
}


/**
 * Require authentication for API routes
 * Returns the session if authenticated, throws unauthorized error otherwise
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