import { NextResponse } from "next/server"
import { CatalogReviewService } from "@/services/catalogReviewService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/catalog-review — erros de digitação, espaços, duplicados e sem código
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await CatalogReviewService.report() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// POST /api/catalog-review
//   { action: "names", fixes: [{ wrong, right }], spacing: boolean } — corrige nomes
//   { action: "inactivate", ids: [...] } — desativa duplicados
export async function POST(request: Request) {
  try {
    // só JSON: formulário de outro site (CSRF) não consegue mandar
    // application/json sem preflight, que o servidor não libera. Compara o
    // tipo principal (antes do ";") — "text/plain; charset=application/json"
    // passa sem preflight e não pode ser aceito.
    const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (mime !== "application/json") {
      return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
    }
    const body = await request.json().catch(() => ({}))
    if (body?.action === "names") {
      const renamed = await CatalogReviewService.applyNames(body.fixes, Boolean(body.spacing))
      return NextResponse.json({ success: true, data: { renamed } })
    }
    if (body?.action === "inactivate") {
      const inactivated = await CatalogReviewService.inactivate(body.ids)
      return NextResponse.json({ success: true, data: { inactivated } })
    }
    return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
