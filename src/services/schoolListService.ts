// Lista de material escolar: monta o orçamento com os produtos ativos da loja
// e, se houver chave da IA (NVIDIA, Gemini ou Claude), lê a foto da lista (opcional —
// sem chave, a foto é lida no próprio computador, na tela).
import { prisma } from "@/lib/prisma"
import { getServerSettings } from "@/lib/serverSettings"
import { buildQuote, type CatalogProduct, type QuoteLine } from "@/lib/schoolList"
import { pickAiProvider } from "@/lib/aiProvider"
import { llmChat } from "@/lib/llm"

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

/** Resposta da IA quando a foto do WhatsApp não é uma lista de material. */
export const NOT_A_LIST = "NAO_E_LISTA"

/** Primeira palavra da resposta da IA quando a foto é um comprovante de pagamento. */
export const RECEIPT = "COMPROVANTE"

/** O que a IA leu no comprovante; null se a foto não for comprovante. */
export const receiptInfo = (text: string): string | null => (text.trim().startsWith(RECEIPT) ? text.trim().slice(RECEIPT.length).replace(/^[\s:|-]+/, "") : null)

/**
 * Lê a foto da lista com a IA escolhida em Configurações (NVIDIA, Gemini ou
 * Claude). rejectOther: a foto pode ser qualquer coisa (veio do WhatsApp), e a
 * IA responde NOT_A_LIST se não for uma lista.
 */
export async function readListWithAI(dataUrl: string, opts: { rejectOther?: boolean } = {}): Promise<string> {
  const prompt = opts.rejectOther
    ? `${PROMPT}\nSe a imagem for um comprovante de pagamento (Pix, transferência), responda na primeira linha somente ${RECEIPT} e, nas linhas seguintes: valor, data, nome de quem pagou, nome e CNPJ de quem recebeu.\nSe a imagem não for lista de material nem comprovante, responda somente: ${NOT_A_LIST}`
    : PROMPT
  const settings = await getServerSettings()
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) throw new Error("Imagem inválida — use JPG ou PNG")
  if (m[2].length > 7_000_000) throw new Error("Foto grande demais — tire outra mais de perto")
  const provider = pickAiProvider(settings)
  if (!provider) throw new Error("Cadastre a chave da IA em Configurações para ler com IA")
  if (provider === "llm") {
    const text = await llmChat(settings, {
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    })
    return cleanLines(text)
  }
  return readWithClaude(m[1], m[2], settings.aiApiKey.trim(), settings.aiModel, prompt)
}

async function readWithClaude(mediaType: string, base64: string, apiKey: string, model: string | null, prompt: string): Promise<string> {

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
              { type: "text", text: prompt },
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
