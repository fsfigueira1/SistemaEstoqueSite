import { NextResponse } from "next/server"
import { LabelService } from "@/services/labelService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/labels/barcodes — próximo código interno livre (botão "Gerar" do cadastro)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: { barcode: await LabelService.nextBarcode() } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/labels/barcodes — gera código para todos os produtos sem código
export async function POST() {
  try {
    return NextResponse.json({ success: true, data: { updated: await LabelService.generateMissingBarcodes() } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
