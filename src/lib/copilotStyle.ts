// Jeito de falar da atendente (copiloto do WhatsApp): a personalidade (tom de
// voz, editável em Configurações) e os exemplos aprendidos com as respostas que
// o atendente aprovou ou corrigiu. A IA aprende o TOM — nunca valores: dos
// exemplos sai o bloco do orçamento e toda linha com preço.
// Testado em copilotStyle.test.ts.

/** Preço escrito pela IA não vai para o cliente (o preço é sempre o do sistema). */
export const PRICE_RE = /R\s?\$|\d+[.,]\d{2}\b|\breais\b|\bcentavos\b/i

export const DEFAULT_PERSONA = `Você é a atendente da papelaria no WhatsApp: super carismática, calorosa e animada, como uma amiga que ama papelaria.
Chame o cliente pelo primeiro nome e mostre entusiasmo de verdade com o material, a volta às aulas e cada pedido.
Escreva frases curtas e leves, com 1 ou 2 emojis (🎀 ✨ 📚 😊), sem exagerar.
Agradeça o contato, ofereça ajuda e convide para passar na loja.
Nunca invente preço, prazo, estoque ou promoção. Se não souber, diga que vai conferir rapidinho e já responde.`

const MAX_SAMPLE = 400
const MAX_EXAMPLES = 6

/** Parte de "conversa" de uma resposta aprovada: sem o orçamento e sem preço. */
export function styleSample(finalReply: string): string | null {
  const beforeQuote = finalReply.split(/\n\s*Orçamento /)[0]
  if (/^\s*Orçamento /.test(finalReply)) return null
  const lines = beforeQuote
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !PRICE_RE.test(l))
  const text = lines.join("\n").slice(0, MAX_SAMPLE).trim()
  return text || null
}

/** Personalidade + exemplos de tom (os mais recentes primeiro, até 6). */
export function buildPersonaPrompt(persona: string, examples: Array<{ customerText: string; finalReply: string }>): string {
  const parts = [(persona || "").trim() || DEFAULT_PERSONA]
  const samples = examples
    .map((e) => ({ customer: e.customerText.trim().slice(0, 300), reply: styleSample(e.finalReply) }))
    .filter((e): e is { customer: string; reply: string } => Boolean(e.customer && e.reply))
    .slice(0, MAX_EXAMPLES)
  if (samples.length) {
    parts.push(
      "Exemplos de como a loja responde (imite o jeito e o tom, não copie o texto):",
      ...samples.map((s) => `Cliente: ${s.customer}\nVocê respondeu: ${s.reply}`),
    )
  }
  return parts.join("\n\n")
}
