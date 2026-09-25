import { NextResponse } from "next/server"
import { previewImport, runImport, sanitizeRows } from "@/services/productImportService"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/products/import { rows, dryRun? }
//   dryRun = true → só mostra o que vai acontecer (novo / atualizar / erro)
//   dryRun = false → grava produtos e a entrada no estoque
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rows = sanitizeRows(body?.rows)
    const data = body?.dryRun ? await previewImport(rows) : await runImport(rows)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 400 })
  }
}
