import fs from "node:fs/promises"
import { NextResponse } from "next/server"
import { backupPath } from "@/services/backupService"

// GET /api/backup/file?name=lacolaria-backup-AAAA-MM-DD-HHMM.json.gz — baixa o arquivo
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? ""
  const full = backupPath(name)
  if (!full) {
    return NextResponse.json({ success: false, error: { message: "Arquivo inválido", code: "INVALID" } }, { status: 400 })
  }
  try {
    const data = await fs.readFile(full)
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: { message: "Backup não encontrado", code: "NOT_FOUND" } }, { status: 404 })
  }
}
