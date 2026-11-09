// Pix dos livros do Ciranda (venda da APM): o cliente manda pelo WhatsApp o
// comprovante e o nome da criança, o ano escolar e o nome do responsável, em
// qualquer ordem. Cada conversa vai preenchendo a mesma linha até completar, e
// a tela /ciranda mostra quem pagou e enviou tudo. É o registro do que o
// cliente mandou: a confirmação do dinheiro é feita no banco.
// Testado em tests/cirandaPaymentService.test.ts.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { norm } from "@/lib/schoolList"

type Who = { name: string; phone: string }
export type CirandaDetails = { childName?: string; schoolGrade?: string; guardianName?: string }
type Filled = { childName: string; schoolGrade: string; guardianName: string; hasReceipt: boolean }

const keyOf = (w: Who) => w.phone.replace(/\D/g, "") || norm(w.name).trim()
const contact = (w: Who) => ({ contactKey: keyOf(w), contactName: w.name.slice(0, 120), phone: w.phone.replace(/\D/g, "").slice(0, 15) })
const clean = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, 160)

/** O recebedor do comprovante é a APM? (o CNPJ costuma vir com parte escondida) */
export function isCirandaReceipt(info: string): boolean {
  return /352\.?702/.test(info) || /associacao de pais|\bapm\b/.test(norm(info))
}

export function cirandaMissing(r: Filled): string[] {
  return [
    ...(r.hasReceipt ? [] : ["o comprovante do Pix"]),
    ...(r.childName ? [] : ["o nome da criança"]),
    ...(r.schoolGrade ? [] : ["o ano escolar"]),
    ...(r.guardianName ? [] : ["o nome do responsável"]),
  ]
}

const joinPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}` : xs[0])

/** Mensagem para o cliente, escrita pelo sistema a partir do que já foi recebido. */
export function cirandaReply(r: Filled): string {
  const missing = cirandaMissing(r)
  if (!missing.length) return `Prontinho! Recebemos o comprovante e os dados de ${r.childName} (${r.schoolGrade}). Muito obrigada! 😊\nOs livros serão entregues na escola.`
  return `${r.hasReceipt ? "Recebi o comprovante, obrigada!" : "Anotei, obrigada!"} 😊 Para concluir, me manda: ${joinPt(missing)}.`
}

export const CirandaPaymentService = {
  async addReceipt(who: Who, image: string, info: string) {
    await ensureSchema()
    const contactKey = keyOf(who)
    // o cliente reenviou a mesma foto: não vira outro pagamento
    const same = await prisma.cirandaPayment.findFirst({ where: { contactKey, receiptImage: image } })
    if (same) return same
    const open = await prisma.cirandaPayment.findFirst({ where: { contactKey, hasReceipt: false }, orderBy: { createdAt: "desc" } })
    const data = { hasReceipt: true, receiptImage: image, receiptInfo: info.slice(0, 1000) }
    return open ? prisma.cirandaPayment.update({ where: { id: open.id }, data }) : prisma.cirandaPayment.create({ data: { ...contact(who), ...data } })
  },

  async addDetails(who: Who, details: CirandaDetails) {
    await ensureSchema()
    const data = Object.fromEntries(
      Object.entries({ childName: clean(details.childName), schoolGrade: clean(details.schoolGrade), guardianName: clean(details.guardianName) }).filter(([, v]) => v),
    )
    const open = await prisma.cirandaPayment.findFirst({
      where: { contactKey: keyOf(who), OR: [{ childName: "" }, { schoolGrade: "" }, { guardianName: "" }] },
      orderBy: { createdAt: "desc" },
    })
    return open ? prisma.cirandaPayment.update({ where: { id: open.id }, data }) : prisma.cirandaPayment.create({ data: { ...contact(who), ...data } })
  },

  /** Relatório, do mais novo para o mais antigo (sem as fotos, que são pesadas). */
  async list() {
    await ensureSchema()
    const rows = await prisma.cirandaPayment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, contactName: true, phone: true, childName: true, schoolGrade: true, guardianName: true, hasReceipt: true, receiptInfo: true, createdAt: true, updatedAt: true },
    })
    return rows.map((r) => ({ ...r, missing: cirandaMissing(r), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))
  },

  async receipt(id: string): Promise<string | null> {
    await ensureSchema()
    const r = await prisma.cirandaPayment.findUnique({ where: { id }, select: { receiptImage: true } })
    return r?.receiptImage || null
  },
}
