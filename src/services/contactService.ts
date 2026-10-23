// Contatos para as novidades: quem veio do WhatsApp (robô), da planilha da
// dona, dos clientes do sistema ou foi digitado à mão. "Recebe novidades" =
// optInAt preenchido e optOutAt vazio. Importar de novo nunca reativa quem
// saiu (pediu para não receber).
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { whatsappNumber } from "@/lib/restock"
import type { ContactRow } from "@/lib/contacts"

export type ContactStatus = "ativo" | "saiu" | "pendente"

export type ContactDTO = {
  id: string
  name: string | null
  phone: string
  source: string
  status: ContactStatus
  createdAt: string
}

const statusOf = (c: { optInAt: Date | null; optOutAt: Date | null }): ContactStatus =>
  c.optOutAt ? "saiu" : c.optInAt ? "ativo" : "pendente"

type Source = "planilha" | "manual" | "cliente"

const CHUNK = 200

// Em lote: o banco da loja é o Supabase, longe — uma ida e volta por linha
// deixaria uma planilha de milhares de contatos levando minutos.
async function upsertRows(input: Array<ContactRow & { customerId?: string }>, source: Source) {
  const byPhone = new Map<string, ContactRow & { customerId?: string }>()
  for (const r of input) if (!byPhone.has(r.phone)) byPhone.set(r.phone, r)
  const rows = [...byPhone.values()]
  const now = new Date()
  let criados = 0
  let atualizados = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK)
    const existing = await prisma.contact.findMany({ where: { phone: { in: part.map((r) => r.phone) } } })
    const found = new Map(existing.map((c) => [c.phone, c]))
    const fresh = part.filter((r) => !found.has(r.phone))
    if (fresh.length) {
      // skipDuplicates: outro PC pode ter criado o mesmo telefone agora
      const created = await prisma.contact.createMany({
        data: fresh.map((r) => ({ phone: r.phone, name: r.name.trim() || null, source, optInAt: now, customerId: r.customerId ?? null })),
        skipDuplicates: true,
      })
      criados += created.count
    }
    const updates = part.flatMap((r) => {
      const c = found.get(r.phone)
      if (!c) return []
      const name = r.name.trim() || null
      const data = {
        // nome novo só preenche quando faltava
        ...(name && !c.name ? { name } : {}),
        // nunca reativa quem saiu
        ...(!c.optInAt && !c.optOutAt ? { optInAt: now } : {}),
        ...(r.customerId && !c.customerId ? { customerId: r.customerId } : {}),
      }
      return Object.keys(data).length ? [prisma.contact.update({ where: { id: c.id }, data })] : []
    })
    if (updates.length) await prisma.$transaction(updates)
    atualizados += part.length - fresh.length
  }
  return { criados, atualizados }
}

export const ContactService = {
  async list(): Promise<ContactDTO[]> {
    await ensureSchema()
    const rows = await prisma.contact.findMany({ orderBy: [{ name: "asc" }, { phone: "asc" }] })
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      source: c.source,
      status: statusOf(c),
      createdAt: c.createdAt.toISOString(),
    }))
  },

  async previewImport(rows: ContactRow[]): Promise<{ novos: number; existentes: number }> {
    await ensureSchema()
    const phones = [...new Set(rows.map((r) => r.phone))]
    const existentes = phones.length ? await prisma.contact.count({ where: { phone: { in: phones } } }) : 0
    return { novos: phones.length - existentes, existentes }
  },

  async importRows(rows: ContactRow[], source: "planilha" | "manual"): Promise<{ criados: number; atualizados: number }> {
    await ensureSchema()
    return upsertRows(rows, source)
  },

  /** Clientes do sistema com telefone válido viram contatos (origem "cliente"). */
  async importCustomers(): Promise<{ criados: number; atualizados: number }> {
    await ensureSchema()
    const customers = await prisma.customer.findMany({ where: { phone: { not: null } }, select: { id: true, name: true, phone: true } })
    const seen = new Set<string>()
    const rows: Array<ContactRow & { customerId: string }> = []
    for (const c of customers) {
      const phone = whatsappNumber(c.phone)
      if (!phone || seen.has(phone)) continue
      seen.add(phone)
      rows.push({ name: c.name, phone, customerId: c.id })
    }
    return upsertRows(rows, "cliente")
  },

  /** ativo=false: pediu para sair. ativo=true: voltou a receber. */
  async setStatus(id: string, ativo: boolean): Promise<void> {
    await ensureSchema()
    const c = await prisma.contact.findUniqueOrThrow({ where: { id } })
    await prisma.contact.update({
      where: { id },
      data: ativo ? { optOutAt: null, optInAt: c.optInAt ?? new Date() } : { optOutAt: new Date() },
    })
  },

  /** Quem saiu fica gravado: é o que impede a próxima planilha de cadastrar de novo. */
  async remove(id: string): Promise<void> {
    await ensureSchema()
    const c = await prisma.contact.findUniqueOrThrow({ where: { id } })
    if (c.optOutAt) throw new Error("Quem saiu fica na lista para não receber de novo")
    await prisma.contact.delete({ where: { id } })
  },
}
