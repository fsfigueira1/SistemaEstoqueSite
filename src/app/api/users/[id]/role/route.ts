import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}