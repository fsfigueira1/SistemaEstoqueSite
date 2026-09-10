import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveRole } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    // PINs vêm do ambiente. OWNER/EMPLOYEE sempre; VIEWER só quando VIEWER_PIN
    // está definido (deploy público de leitura na Vercel).
    if (!process.env.OWNER_PASSWORD || !process.env.EMPLOYEE_PASSWORD) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const role = resolveRole(String(pin ?? ''), process.env)

    if (!role) {
      return NextResponse.json(
        { error: 'PIN incorreto' },
        { status: 401 }
      )
    }

    const cookieValue = `${role}:${Date.now()}`
    const response = NextResponse.json({ success: true, role })
    const cookieStore = await cookies()
    cookieStore.set('erp_auth', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
