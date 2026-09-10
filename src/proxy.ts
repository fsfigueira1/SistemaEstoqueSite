import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readOnlyDecision } from '@/lib/readOnly'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths: password page and its API (o login precisa funcionar mesmo
  // sob READ_ONLY — é como o PIN de leitura entra).
  const publicPaths = ['/senha', '/api/senha']

  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Deploy público (Vercel) roda com READ_ONLY=1: nenhuma escrita, exceto o
  // cron autenticado pelo CRON_SECRET. No Electron a env não existe e isto é no-op.
  const ro = readOnlyDecision({
    method: request.method,
    pathname,
    headers: { authorization: request.headers.get('authorization') },
    env: process.env,
  })
  if (!ro.allow) {
    return NextResponse.json({ error: 'Somente leitura' }, { status: ro.status })
  }

  // O cron se autentica pelo secret; não passa pela verificação de cookie de PIN.
  if (pathname.startsWith('/api/cron/')) {
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