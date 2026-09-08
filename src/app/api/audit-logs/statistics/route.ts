import { NextResponse } from "next/server"
import { AuditService } from "@/services/auditService"



export async function GET(request: Request) {
  try {


    const { searchParams } = new URL(request.url)
    const olderThanDateStr = searchParams.get("olderThanDate")

    if (!olderThanDateStr) {
      return NextResponse.json(
        { success: false, error: { message: "olderThanDate parameter is required" } },
        { status: 400 }
      )
    }

    const filters = {
      olderThanDate: new Date(olderThanDateStr),
      entity: searchParams.get("entity") || undefined,
      dryRun: searchParams.get("dryRun") === "true"
    }

    const result = await AuditService.getStatistics({
      entity: filters.entity
    })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}