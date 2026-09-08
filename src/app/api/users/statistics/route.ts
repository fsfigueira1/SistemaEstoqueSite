import { NextResponse } from "next/server"
import { UserService } from "@/services/userService"



export async function GET(request: Request) {
  try {


    const result = await UserService.getUserStatistics()

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}