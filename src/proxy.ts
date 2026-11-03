import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE, SESSION_MS, authSecret, signToken, verifyToken } from '@/lib/authToken'
import { canAccess, homeFor, isPublic } from '@/lib/access'
import { ROLE_HEADER } from '@/lib/requestRole'

// Porta de entrada de tudo: confere o crachá assinado (login com usuário e
// senha), aplica o que cada perfil pode abrir (src/lib/access.ts) e repassa
// o perfil para as rotas no cabeçalho x-erp-role. Sessão "deslizante": cada
// uso renova; vence depois de 10 h parado.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  // ninguém de fora escolhe o próprio perfil
  const headers = new Headers(request.headers)
  headers.delete(ROLE_HEADER)

  // sem segredo forte configurado ninguém entra (nunca um segredo fixo e adivinhável)
  let secret: string
  try {
    secret = await authSecret()
  } catch {
    const msg = 'Login não configurado neste servidor (falta AUTH_SECRET)'
    return isApi ? NextResponse.json({ success: false, error: msg }, { status: 503 }) : new NextResponse(msg, { status: 503 })
  }
  const session = await verifyToken(secret, request.cookies.get(COOKIE)?.value)

  if (isPublic(pathname)) {
    // já entrou e abriu a tela de login: vai para a tela inicial do perfil
    if (pathname === '/senha' && session) return NextResponse.redirect(new URL(homeFor(session.role), request.url))
    return NextResponse.next({ request: { headers } })
  }

  if (!session) {
    if (isApi) return NextResponse.json({ success: false, error: 'Entre com usuário e senha' }, { status: 401 })
    const url = request.nextUrl.clone()
    url.pathname = '/senha'
    url.search = pathname === '/' ? '' : `?redirect=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  if (pathname === '/') return NextResponse.redirect(new URL(homeFor(session.role), request.url))

  if (!canAccess(session.role, pathname, request.method)) {
    if (isApi) return NextResponse.json({ success: false, error: 'Sem permissão para este perfil' }, { status: 403 })
    return NextResponse.redirect(new URL(homeFor(session.role), request.url))
  }

  headers.set(ROLE_HEADER, session.role)
  const res = NextResponse.next({ request: { headers } })
  // renova a sessão (o robô usa crachá próprio, que não precisa de cookie novo)
  if (session.role !== 'ROBOT') {
    res.cookies.set(COOKIE, await signToken(secret, session.role, Date.now() + SESSION_MS), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: SESSION_MS / 1000,
      path: '/',
    })
  }
  return res
}

// Roda em tudo, menos assets do Next e arquivos estáticos (com extensão:
// .png, .ico, .css, .js, .woff2, etc.) — senão o proxy redireciona
// /logo.png para /senha e a imagem quebra.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
    // API sempre passa pelo login, mesmo com "." no caminho (ex.: e-mail)
    '/api/:path*',
  ],
}
