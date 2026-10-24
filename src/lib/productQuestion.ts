// "Vocês têm stabilo pastel azul?" → "stabilo pastel azul": o que o cliente
// procura, para buscar no estoque. null = não é pergunta de produto.
// Testado em productQuestion.test.ts.
import { norm } from "@/lib/schoolList"
import { stripGreetings } from "@/lib/quoteIntent"

const ASK = /\b(?:voces tem|vcs tem|vc tem|ainda tem|tem disponivel|tem|tens|teria|vendem|vende|trabalham com|chegou)\b(.*)$/
// palavras de enfeite em volta do produto
const LEAD = /^(?:\s|voces|vcs|vc|ainda|disponivel|ai|ate|hoje|o|a|os|as|um|uma|algum|alguma|aquele|aquela|aqueles|aquelas|esse|essa|esses|essas|este|esta|daquele|daquela|desse|dessa)+\b/
const TAIL = /\b(?:ai|ai na loja|na loja|ai na lojinha|por ai|hoje|ainda|disponivel|pra vender|a venda|por favor|pfv|pf)\s*$/
// "tem como…", "tem estacionamento" e afins não são produto
const NOT_PRODUCT = /^(?:como|jeito|horario|estacionamento|entrega|desconto|promocao|vaga|wifi|banheiro|alguem|gente|algum problema)\b/

export function productQuery(text: string): string | null {
  for (const sentence of stripGreetings(text).split(/[\n?!.]+(?!\d)/)) {
    const m = ASK.exec(norm(sentence).replace(/[^a-z0-9,\s]/g, " ").replace(/\s+/g, " ").trim())
    if (!m) continue
    let term = m[1].trim()
    for (let i = 0; i < 3; i++) term = term.replace(LEAD, "").replace(TAIL, "").trim()
    term = term.replace(/[\s,]+$/, "").replace(/\s+/g, " ")
    if (!term || NOT_PRODUCT.test(term) || !/[a-z]{3,}/.test(term) || term.length > 60) continue
    return term
  }
  return null
}
