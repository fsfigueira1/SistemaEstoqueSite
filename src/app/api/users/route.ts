import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"
import { Role, UserStatus } from "@/generated/prisma/client"

export async function GET(request: Request) {
  try {
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)
    const filters = {
      role: searchParams.get("role"),
      status: searchParams.get("status"),
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page"),
      limit: searchParams.get("limit")
    }

    // Convert string parameters to proper enum types
    const typedFilters = {
      ...filters,
      role: filters.role ? (Object.values(Role) as string[]).includes(filters.role) ? filters.role as Role : undefined : undefined,
      status: filters.status ? (Object.values(UserStatus) as string[]).includes(filters.status) ? filters.status as UserStatus : undefined : undefined,
    }

    const { page, limit } = validatePaginationParams(typedFilters.page, typedFilters.limit)
    const result = await UserService.getUsers({ ...typedFilters, page, limit })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const data = await request.json()
    const result = await UserService.createUser(data)

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}