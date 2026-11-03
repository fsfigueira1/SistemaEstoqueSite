import { NextResponse } from "next/server"
import { COOKIE } from "@/lib/authToken"

// POST /api/logout — sai (apaga o crachá); a tela volta para o login
export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" })
  return res
}
