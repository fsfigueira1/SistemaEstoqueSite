import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const ID = "app"

const ALLOWED = [
  "companyName",
  "companyTagline",
  "companyDoc",
  "companyAddress",
  "companyPhone",
  "receiptFooter",
  "receiptShowCompany",
  "receiptWidth",
  "cardInterestPercent",
  "cardInterestFromInstallments",
] as const

// GET /api/settings — configurações da loja (cria com padrões se não existir)
export async function GET() {
  try {
    const settings = await prisma.settings.upsert({
      where: { id: ID },
      update: {},
      create: { id: ID },
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

// PUT /api/settings — grava as configurações
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    for (const key of ALLOWED) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (typeof data.cardInterestPercent === "number" && data.cardInterestPercent < 0) {
      data.cardInterestPercent = 0
    }

    const settings = await prisma.settings.upsert({
      where: { id: ID },
      update: data,
      create: { id: ID, ...data },
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
