import { NextResponse } from "next/server"
import { getSystemUser } from "@/lib/lib/systemUser"

// GET /api/session - Get current system user (for desktop app)
export async function GET() {
  try {
    const systemUser = await getSystemUser()

    return NextResponse.json({
      success: true,
      data: systemUser
    })
  } catch (error) {
    console.error('Session API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to retrieve system user',
          code: 'SESSION_FETCH_ERROR'
        }
      },
      { status: 500 }
    )
  }
}