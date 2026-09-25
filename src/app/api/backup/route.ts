import { NextResponse } from "next/server"
import { createBackup, getBackupStatus } from "@/services/backupService"
import { friendlyError } from "@/lib/friendlyError"

// GET /api/backup — situação do backup deste computador (pasta, último, lista)
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getBackupStatus() })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}

// POST /api/backup — faz um backup agora
export async function POST() {
  try {
    const file = await createBackup("manual")
    return NextResponse.json({ success: true, data: { file, status: await getBackupStatus() } })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
