// Pesquisa de preço com o Claude (IA paga) + pesquisa na web.
// Prioriza papelarias/lojas físicas e considera o perfil da loja.
import { extractJson, normalizeAdvice, type PriceSource } from "@/lib/priceAdvice"
import type { AdviceCore } from "@/lib/cosmosPricing"

// ANTHROPIC_BASE_URL permite apontar para um proxy da empresa (ou um simulador nos testes).
const API_URL = `${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`
const TIMEOUT_MS = 120_000

type PromptInput = {
  barcode: string | null
  name: string | null
  costPrice?: number | null
  currentPrice?: number | null
}

function buildPrompt(input: PromptInput, settings: { storeProfile: string; storeCity: string; companyAddress: string }) {
  const lines: string[] = []
  if (input.barcode) lines.push(`Código de barras (EAN/GTIN): ${input.barcode}`)
  if (input.name) lines.push(`Nome informado no cadastro: ${input.name}`)
  if (input.costPrice && input.costPrice > 0) lines.push(`Preço de custo da loja: R$ ${input.costPrice.toFixed(2)}`)
  if (input.currentPrice && input.currentPrice > 0) lines.push(`Preço de venda atual na loja: R$ ${input.currentPrice.toFixed(2)}`)
  const where = settings.storeCity || settings.companyAddress
  return `Preciso de uma direção de preço de venda para um produto que vou cadastrar na minha papelaria.

PRODUTO
${lines.join("\n")}

MINHA LOJA
${settings.storeProfile}
${where ? `Localização: ${where}` : "Localização: Brasil"}

O QUE FAZER
1. ${input.barcode ? `Pesquise o código de barras ${input.barcode} para confirmar exatamente qual produto é (nome, marca, tamanho/quantidade). Se o código não trouxer nada, use o nome informado.` : "Identifique o produto pelo nome (marca, tamanho/quantidade)."}
2. Pesquise o preço de venda atual desse mesmo produto (mesma embalagem/quantidade) em lojas do Brasil. Priorize papelarias e lojas físicas (preço de prateleira, ex.: Kalunga, papelarias de bairro, redes de varejo com loja física); use grandes lojas online como referência. Ignore usados, kits/atacado e anúncios com preço fora da curva.
3. Recomende o preço de prateleira para a MINHA loja, considerando o perfil acima (pode ficar um pouco acima da média quando o posicionamento justificar), com final ",90". Se houver custo, mantenha margem saudável para papelaria e nunca abaixo de custo + 30%.
4. Seja breve: a "direcao" tem no máximo 2 frases curtas, em português simples, falando direto com a dona da loja.

Responda SOMENTE com um bloco \`\`\`json neste formato (números em reais, com ponto decimal):
\`\`\`json
{
  "produto": { "nome": "nome completo do produto ou null", "marca": "marca ou null", "encontrado": true },
  "precos": [ { "loja": "nome da loja", "preco": 0.00, "tipo": "fisica ou online", "url": "link ou null" } ],
  "mercado": { "minimo": 0.00, "mediana": 0.00, "maximo": 0.00 },
  "sugestao": { "preco": 0.00, "faixaMin": 0.00, "faixaMax": 0.00 },
  "direcao": "frase curta",
  "confianca": "alta, media ou baixa"
}
\`\`\`
Se não achar preços confiáveis, use "encontrado": false, "precos": [] e "confianca": "baixa", e dê a melhor estimativa com base em produtos parecidos.`
}

type ContentBlock = { type: string; text?: string; content?: unknown }
type ApiResponse = { content?: ContentBlock[]; stop_reason?: string; error?: { type?: string; message?: string } }

async function callClaude(apiKey: string, model: string, prompt: string, city: string): Promise<{ text: string; searchSources: PriceSource[] }> {
  const location: Record<string, string> = { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" }
  const cityName = city.split(/[/,-]/)[0]?.trim()
  if (cityName) location.city = cityName

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: prompt }]
  const blocks: ContentBlock[] = []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // "pause_turn" = a pesquisa ainda está rodando; reenviamos para continuar.
    for (let round = 0; round < 4; round++) {
      const res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2500,
          system:
            "Você é consultor de precificação de varejo para papelarias no Brasil. Pesquisa preços reais na web, é objetivo e responde em português do Brasil.",
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: location }],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok) {
        const type = data?.error?.type ?? ""
        const msg = data?.error?.message ?? ""
        throw new Error(`Anthropic HTTP ${res.status}: ${type} ${msg}`.trim())
      }
      const content = data.content ?? []
      blocks.push(...content)
      if (data.stop_reason !== "pause_turn") break
      messages.push({ role: "assistant", content })
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("timeout na pesquisa de preço")
    throw err
  } finally {
    clearTimeout(timer)
  }

  const text = blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")

  // fontes das pesquisas (usadas se a IA não listar lojas)
  const searchSources: PriceSource[] = []
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as Array<{ url?: string; title?: string }>) {
        if (r.url) searchSources.push({ loja: (r.title ?? r.url).slice(0, 80), preco: 0, tipo: "online", url: r.url })
      }
    }
  }
  return { text, searchSources }
}

export async function claudeAdvice(
  input: PromptInput,
  settings: { aiApiKey: string; aiModel: string; storeProfile: string; storeCity: string; companyAddress: string },
): Promise<AdviceCore> {
  const apiKey = (settings.aiApiKey ?? "").trim()
  if (!apiKey) throw new Error("ai key missing")
  const prompt = buildPrompt(input, settings)
  const { text, searchSources } = await callClaude(apiKey, settings.aiModel || "claude-sonnet-5", prompt, settings.storeCity || "")
  const raw = extractJson(text)
  if (!raw) throw new Error("A IA respondeu num formato inesperado (invalid)")
  const advice = normalizeAdvice(raw, { costPrice: input.costPrice, currentPrice: input.currentPrice })
  if (!advice.sources.length && searchSources.length) {
    // sem preços estruturados: guarda ao menos os links consultados
    advice.sources = searchSources.slice(0, 6)
  }
  return advice
}
