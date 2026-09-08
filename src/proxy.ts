'use node';

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// Define public routes that don't require authentication
const publicRoutes = [
  "/auth/signin",
  "/auth/signup",
  "/api/auth/*",
  "/senha",
  "/api/senha/*",
  "/_next/*",
  "/favicon.ico",
  "/robots.txt"
]

export async function proxy(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => {
    if (route.endsWith("*")) {
      return pathname.startsWith(route.slice(0, -1))
    }
    return pathname === route
  })

  // Allow public routes to pass through
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // If not authenticated, redirect to sign-in
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/signin"
    return NextResponse.redirect(url)
  }

  // If authenticated, continue to the requested route
  return NextResponse.next()
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
