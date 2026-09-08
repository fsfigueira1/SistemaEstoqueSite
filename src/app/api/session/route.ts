import { NextResponse } from "next/server"
import { getSystemUser } from "@/lib/systemUser"

// GET /api/session - Get current system user (for desktop app)
export async function GET() {
  try {
    const systemUser = await getSystemUser()

    return NextResponse.json({
      success: true,
      data: systemUser
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}