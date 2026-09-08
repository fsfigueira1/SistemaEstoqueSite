import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    // Get PINs from environment variables
    const ownerPin = process.env.OWNER_PASSWORD
    const employeePin = process.env.EMPLOYEE_PASSWORD

    // Check if PINs are set (in a real app, you would use a proper auth system)
    if (!ownerPin || !employeePin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Simple PIN check (in production, use bcrypt or similar)
    let role: 'OWNER' | 'EMPLOYEE' | null = null
    if (pin === ownerPin) {
      role = 'OWNER'
    } else if (pin === employeePin) {
      role = 'EMPLOYEE'
    }

    if (!role) {
      return NextResponse.json(
        { error: 'PIN incorreto' },
        { status: 401 }
      )
    }

    // Set a cookie with the role and a timestamp (or just role for simplicity)
    // In a real app, you would use a signed JWT or session
    const cookieValue = `${role}:${Date.now()}`
    const response = NextResponse.json({ success: true, role })
    const cookieStore = await cookies()
    cookieStore.set('erp_auth', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // use secure in production
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}