// Novidades: regras puras dos contatos e da mensagem — ler a planilha colada
// do Excel (ou CSV), personalizar o texto, rodapé de saída, link do WhatsApp e
// o arquivo .vcf para importar os contatos no celular (lista de transmissão).
// Testado em contacts.test.ts.
import { parseCsv } from "@/lib/productImport"
import { whatsappNumber } from "@/lib/restock"
import { norm } from "@/lib/schoolList"

export type ContactRow = { name: string; phone: string }

const PHONE_HEADERS = new Set(["telefone", "celular", "whatsapp", "fone", "tel", "numero", "contato"])
const NAME_HEADERS = new Set(["nome", "cliente", "name", "responsavel"])
const headerKey = (c: string) => norm(c).replace(/[^a-z]/g, "")

/** Planilha colada (Excel copia com tab) ou CSV: acha nome e telefone sozinho. */
export function parseContacts(text: string): { rows: ContactRow[]; invalid: Array<{ line: number; raw: string }> } {
  const table = parseCsv(text)
  const rows: ContactRow[] = []
  const invalid: Array<{ line: number; raw: string }> = []
  const seen = new Set<string>()
  if (!table.length) return { rows, invalid }

  const head = table[0].map(headerKey)
  const hasHeader = head.some((h) => PHONE_HEADERS.has(h) || NAME_HEADERS.has(h)) && !table[0].some((c) => whatsappNumber(c))
  const phoneCol = hasHeader ? head.findIndex((h) => PHONE_HEADERS.has(h)) : -1
  const nameCol = hasHeader ? head.findIndex((h) => NAME_HEADERS.has(h)) : -1
  const rawLines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim())

  table.forEach((cells, i) => {
    if (hasHeader && i === 0) return
    // sem cabeçalho, a coluna do telefone é a que vira um número válido
    const phoneIdx = phoneCol >= 0 ? phoneCol : cells.findIndex((c) => whatsappNumber(c))
    const phone = phoneIdx >= 0 ? whatsappNumber(cells[phoneIdx]) : null
    if (!phone) {
      invalid.push({ line: i + 1, raw: rawLines[i] ?? cells.join("\t") })
      return
    }
    const name = (nameCol >= 0 ? cells[nameCol] : cells.find((c, j) => j !== phoneIdx && c.trim())) ?? ""
    if (seen.has(phone)) return
    seen.add(phone)
    rows.push({ name: name.trim().replace(/\s+/g, " "), phone })
  })
  return { rows, invalid }
}

export const OPT_OUT_FOOTER = "Para não receber mais, responda SAIR."

export function withFooter(text: string): string {
  const t = text.trim()
  return t.endsWith(OPT_OUT_FOOTER) ? t : `${t}\n\n${OPT_OUT_FOOTER}`
}

const firstName = (name: string) => {
  const w = name.trim().split(/\s+/)[0] ?? ""
  return w ? w[0].toLocaleUpperCase("pt-BR") + w.slice(1).toLocaleLowerCase("pt-BR") : ""
}

/** {nome} → primeiro nome; sem nome, tira o {nome} e arruma a pontuação. */
export function personalize(text: string, name: string | null): string {
  const n = firstName(name ?? "")
  if (n) return text.replace(/\{nome\}/gi, n)
  const out = text
    .replace(/,\s*\{nome\}/gi, "")
    .replace(/\{nome\}\s*,\s*/gi, "")
    .replace(/\{nome\}/gi, "")
    .replace(/[ \t]+([!?.,])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  return out ? out[0].toLocaleUpperCase("pt-BR") + out.slice(1) : out
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`

const vcfEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;")

/** Arquivo .vcf (vCard 3.0) para importar os contatos no celular. */
export function buildVcf(contacts: Array<{ name: string | null; phone: string }>): string {
  return contacts
    .map((c) =>
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${vcfEscape(c.name?.trim() || `Cliente ${c.phone.slice(-4)}`)}`,
        `TEL;TYPE=CELL:+${c.phone}`,
        "END:VCARD",
      ].join("\r\n"),
    )
    .join("\r\n")
}
