// Lista de material escolar: monta o orçamento com os produtos ativos da loja
// e, se houver chave da IA (NVIDIA ou Claude), lê a foto da lista (opcional —
// sem chave, a foto é lida no próprio computador, na tela).
import { prisma } from "@/lib/prisma"
import { getServerSettings } from "@/lib/serverSettings"
import { buildQuote, type CatalogProduct, type QuoteLine } from "@/lib/schoolList"
import { pickAiProvider } from "@/lib/aiProvider"
import { NVIDIA_DEFAULT_MODEL, nvidiaChat } from "@/lib/nvidia"

const API_URL = `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`

const num = (v: unknown) => {
  if (v == null) return 0
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber: () => number }).toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Campos de Product que o orçamento usa (ver toCatalogProduct). */
export const CATALOG_SELECT = {
  id: true,
  name: true,
  barcode: true,
  sku: true,
  salePrice: true,
  stockQuantity: true,
  category: { select: { name: true } },
} as const

export function toCatalogProduct(p: {
  id: string
  name: string
  barcode: string | null
  sku: string
  salePrice: unknown
  stockQuantity: number
  category?: { name: string } | null
}): CatalogProduct {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    salePrice: Math.round(num(p.salePrice) * 100) / 100,
    stock: p.stockQuantity,
    category: p.category?.name ?? null,
  }
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({ where: { status: "ACTIVE" }, select: CATALOG_SELECT })
  return rows.map(toCatalogProduct)
}

export async function quoteFromText(text: string): Promise<QuoteLine[]> {
  if (!text.trim()) throw new Error("Cole a lista ou tire uma foto")
  return buildQuote(text.slice(0, 20_000), await getCatalog())
}

const PROMPT = `Esta é a foto de uma lista de material escolar (pode ser impressa ou escrita à mão).
Transcreva só os itens de material, um por linha, começando pela quantidade em número.
Exemplo de linha: "2 cadernos universitários 10 matérias".
Ignore cabeçalho, nome da escola, série, observações, livros didáticos e uniformes.
Responda somente com as linhas, sem comentários.`

const cleanLines = (text: string) => text.replace(/```[a-z]*\n?|```/g, "").trim()

/** Lê a foto da lista com a IA escolhida em Configurações (NVIDIA ou Claude). */
export async function readListWithAI(dataUrl: string): Promise<string> {
  const settings = await getServerSettings()
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) throw new Error("Imagem inválida — use JPG ou PNG")
  if (m[2].length > 7_000_000) throw new Error("Foto grande demais — tire outra mais de perto")
  const provider = pickAiProvider(settings)
  if (!provider) throw new Error("Cadastre a chave da IA em Configurações para ler com IA")
  if (provider === "nvidia") {
    const text = await nvidiaChat({
      apiKey: settings.nvidiaApiKey.trim(),
      model: settings.nvidiaModel || NVIDIA_DEFAULT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    })
    return cleanLines(text)
  }
  return readWithClaude(m[1], m[2], settings.aiApiKey.trim(), settings.aiModel)
}

async function readWithClaude(mediaType: string, base64: string, apiKey: string, model: string | null): Promise<string> {

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: model || "claude-sonnet-5",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      content?: Array<{ type: string; text?: string }>
      error?: { type?: string; message?: string }
    }
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${data?.error?.type ?? ""} ${data?.error?.message ?? ""}`.trim())
    return cleanLines(
      (data.content ?? [])
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n"),
    )
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("A IA demorou demais — tente de novo")
    throw err
  } finally {
    clearTimeout(timer)
  }
}
