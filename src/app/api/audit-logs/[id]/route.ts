import { NextResponse } from "next/server"
import { AuditService } from "@/services/auditService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { id } = params
    const result = await AuditService.getAuditLogById(id)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}