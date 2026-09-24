import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSettings, publicSettings, SETTINGS_ID } from "@/lib/serverSettings"
import { friendlyError } from "@/lib/friendlyError"

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
  "storeProfile",
  "storeCity",
  "aiModel",
  "priceAlertPercent",
  "reportReminderEnabled",
  "reportReminderTime",
  "cashFloatDefault",
  "priceProvider",
  "priceMarkupPercent",
] as const

const AI_MODELS = ["claude-sonnet-5", "claude-haiku-4-5-20251001", "claude-opus-5-5"]

// GET /api/settings — configurações da loja (cria com padrões se não existir).
// As chaves (IA e Google Shopping) nunca saem daqui: só se existem e o final delas.
export async function GET() {
  try {
    const settings = await getServerSettings()
    return NextResponse.json({ success: true, data: publicSettings(settings) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}

// PUT /api/settings — grava as configurações
export async function PUT(request: Request) {
  try {
    await getServerSettings()
    const body = await request.json()
    const data: Record<string, unknown> = {}
    for (const key of ALLOWED) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (typeof data.cardInterestPercent === "number" && data.cardInterestPercent < 0) {
      data.cardInterestPercent = 0
    }
    if (typeof data.priceAlertPercent === "number") {
      data.priceAlertPercent = Math.min(100, Math.max(1, data.priceAlertPercent))
    }
    if (typeof data.cashFloatDefault === "number" && data.cashFloatDefault < 0) {
      data.cashFloatDefault = 0
    }
    if (data.reportReminderTime !== undefined) {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(data.reportReminderTime))
      if (!m) delete data.reportReminderTime
    }
    if (typeof data.aiModel === "string" && !AI_MODELS.includes(data.aiModel)) {
      delete data.aiModel
    }
    if (data.priceProvider !== undefined && !["shopping", "claude"].includes(String(data.priceProvider))) {
      delete data.priceProvider
    }
    if (typeof data.priceMarkupPercent === "number") {
      data.priceMarkupPercent = Math.min(100, Math.max(0, data.priceMarkupPercent))
    }
    // Chave da IA: só grava quando vem preenchida (o formulário não recebe a
    // chave atual de volta, então campo vazio = "manter a que já está").
    if (typeof body.aiApiKey === "string" && body.aiApiKey.trim()) {
      data.aiApiKey = body.aiApiKey.trim()
    }
    if (body.aiApiKeyClear === true) data.aiApiKey = ""
    if (typeof body.shoppingApiKey === "string" && body.shoppingApiKey.trim()) {
      data.shoppingApiKey = body.shoppingApiKey.trim()
    }
    if (body.shoppingApiKeyClear === true) data.shoppingApiKey = ""

    const settings = await prisma.settings.update({ where: { id: SETTINGS_ID }, data })
    return NextResponse.json({ success: true, data: publicSettings(settings) })
  } catch (error) {
    return NextResponse.json({ success: false, error: friendlyError(error) }, { status: 500 })
  }
}
