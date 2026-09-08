import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"
import { Role, UserStatus } from "@/generated/prisma/client"

export async function GET(request: Request) {
  try {
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

    // Default pagination
    const page = parseInt(typedFilters.page || "1")
    const limit = parseInt(typedFilters.limit || "10")
    // Ensure page and limit are valid numbers
    const safePage = isNaN(page) || page < 1 ? 1 : page
    const safeLimit = isNaN(limit) || limit < 1 ? 10 : limit

    const result = await UserService.getUsers({ ...typedFilters, page: safePage, limit: safeLimit })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await UserService.createUser(data)

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}