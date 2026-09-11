import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths: password page and its API
  const publicPaths = ['/senha', '/api/senha']

  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('erp_auth')
  if (!authCookie) {
    // No cookie
    if (pathname.startsWith('/api/')) {
      // API route: return 401
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    // Non-API: redirect to password page
    const url = request.nextUrl.clone()
    url.pathname = '/senha'
    return NextResponse.redirect(url)
  }

  // Validate cookie format: we expect "role:timestamp"
  const cookieValue = authCookie.value
  if (!cookieValue) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/senha'
    return NextResponse.redirect(url)
  }

  // Optional: validate role and timestamp (not strictly necessary for now)
  // We'll just accept any non-empty cookie as valid.
  // In the future, we could check expiration, etc.

  return NextResponse.next()
}

// Roda em tudo, menos assets do Next e arquivos estáticos (com extensão:
// .png, .ico, .css, .js, .woff2, etc.) — senão o proxy redireciona
// /logo.png para /senha e a imagem quebra.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}