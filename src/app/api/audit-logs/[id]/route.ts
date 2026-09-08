import { NextResponse } from "next/server"
import { AuditService } from "@/services/auditService"



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {


    const { id } = await params
    const result = await AuditService.getAuditLogById(id)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}