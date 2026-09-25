// Lista de material escolar: monta o orçamento com os produtos ativos da loja
// e, se houver chave do Claude, lê a foto da lista com a IA (opcional — sem
// chave, a foto é lida no próprio computador, na tela).
import { prisma } from "@/lib/prisma"
import { getServerSettings } from "@/lib/serverSettings"
import { buildQuote, type CatalogProduct, type QuoteLine } from "@/lib/schoolList"

const API_URL = `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`

const num = (v: unknown) => {
  if (v == null) return 0
  if (typeof v === "object" && "toNumber" in (v as object)) return (v as { toNumber: () => number }).toNumber()
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      salePrice: true,
      stockQuantity: true,
      category: { select: { name: true } },
    },
  })
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    salePrice: Math.round(num(p.salePrice) * 100) / 100,
    stock: p.stockQuantity,
    category: p.category?.name ?? null,
  }))
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

/** Lê a foto da lista com o Claude (precisa da chave em Configurações). */
export async function readListWithClaude(dataUrl: string): Promise<string> {
  const settings = await getServerSettings()
  const apiKey = (settings.aiApiKey ?? "").trim()
  if (!apiKey) throw new Error("Cadastre a chave do Claude em Configurações para ler com IA")
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) throw new Error("Imagem inválida — use JPG ou PNG")
  if (m[2].length > 7_000_000) throw new Error("Foto grande demais — tire outra mais de perto")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: settings.aiModel || "claude-sonnet-5",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
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
    return (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .replace(/```[a-z]*\n?|```/g, "")
      .trim()
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("A IA demorou demais — tente de novo")
    throw err
  } finally {
    clearTimeout(timer)
  }
}
