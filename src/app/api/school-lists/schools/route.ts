import { NextResponse } from "next/server"
import { SavedListService } from "@/services/savedListService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/school-lists/schools — escolas já cadastradas (para sugerir no campo)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await SavedListService.listSchools() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
