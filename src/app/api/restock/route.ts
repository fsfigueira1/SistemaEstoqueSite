import { NextResponse } from "next/server"
import { getRestockPlan } from "@/services/restockService"
import { friendlyError } from "@/lib/friendlyError"

const clamp = (v: string | null, def: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? Math.min(180, Math.max(7, n)) : def
}

// GET /api/restock?days=30&cover=30 — lista do que repor, por fornecedor
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const plan = await getRestockPlan(clamp(q.get("days"), 30), clamp(q.get("cover"), 30))
    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
