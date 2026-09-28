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

  // Sessão "deslizante": cada uso renova as 8h. Sem isso o PIN vencia no meio
  // do expediente e o PDV passava a dizer "produto não encontrado"/"caixa
  // fechado" (na verdade era 401). Só vence depois de 8h sem usar.
  const res = NextResponse.next()
  res.cookies.set('erp_auth', cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}

// Roda em tudo, menos assets do Next e arquivos estáticos (com extensão:
// .png, .ico, .css, .js, .woff2, etc.) — senão o proxy redireciona
// /logo.png para /senha e a imagem quebra.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
    // API sempre passa pelo PIN, mesmo com "." no caminho (ex.: e-mail)
    '/api/:path*',
  ],
}