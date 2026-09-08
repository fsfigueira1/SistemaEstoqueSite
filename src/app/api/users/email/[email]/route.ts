import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"



export async function GET(request: Request, { params }: { params: Promise<{ email: string }> }) {
  try {


    const { email } = await params
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
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}