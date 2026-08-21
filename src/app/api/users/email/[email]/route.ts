import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function GET(request: Request, { params }: { params: { email: string } }) {
  try {
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { email } = params
    const result = await UserService.getUserByEmail(email)

    if (!result) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}