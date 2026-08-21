import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const { id } = params
    const result = await UserService.activateUser(id)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}