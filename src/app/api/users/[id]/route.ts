import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { id } = params
    const result = await UserService.getUserById(id)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const { id } = params
    const data = await request.json()
    const result = await UserService.updateUser(id, data)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const { id } = params
    const result = await UserService.deactivateUser(id)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}