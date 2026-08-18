import { NextResponse } from "next/server"
import { AuditService } from "@/services/auditService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function POST(request: Request) {
  try {
    await requireAuthAndRole(["ADMIN"])

    const { searchParams } = new URL(request.url)
    const filters = {
      olderThanDate: searchParams.get("olderThanDate")
        ? new Date(searchParams.get("olderThanDate"))
        : undefined,
      entity: searchParams.get("entity") || undefined,
      dryRun: searchParams.get("dryRun") === "true"
    }

    if (!filters.olderThanDate) {
      return NextResponse.json(
        { success: false, error: { message: "olderThanDate parameter is required" } },
        { status: 400 }
      )
    }

    const result = await AuditService.cleanupOldLogs(filters)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}