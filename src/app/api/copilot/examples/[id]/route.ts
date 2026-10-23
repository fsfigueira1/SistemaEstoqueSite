import { NextResponse } from "next/server"
import { CopilotExampleService } from "@/services/copilotExampleService"
import { friendlyError } from "@/lib/friendlyError"

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/copilot/examples/[id] — esquecer um exemplo ruim
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await CopilotExampleService.remove((await params).id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json({ success: false, error: "Exemplo não encontrado" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
