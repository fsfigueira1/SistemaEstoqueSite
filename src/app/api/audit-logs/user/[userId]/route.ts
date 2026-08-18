import { NextResponse } from "next/server"
import { AuditService } from "@/services/auditService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    await requireAuthAndRole(["ADMIN"])

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

    const result = await AuditService.getAuditLogsByUser({
      userId: params.userId,
      entity: filters.entity,
      page: 1,
      limit: 100
    })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}