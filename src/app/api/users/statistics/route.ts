import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function GET(request: Request) {
  try {
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await UserService.getUserStatistics()

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}