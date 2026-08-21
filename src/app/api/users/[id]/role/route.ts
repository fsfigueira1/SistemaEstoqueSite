import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const { id } = params
    const { role } = await request.json()

    if (!role) {
      return NextResponse.json(
        { success: false, error: { message: "Role is required" } },
        { status: 400 }
      )
    }

    const result = await UserService.changeUserRole(id, role)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}