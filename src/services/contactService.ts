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

async function upsertRows(rows: Array<ContactRow & { customerId?: string }>, source: Source) {
  let criados = 0
  let atualizados = 0
  const now = new Date()
  for (const r of rows) {
    const name = r.name.trim() || null
    const existing = await prisma.contact.findUnique({ where: { phone: r.phone } })
    if (!existing) {
      await prisma.contact.create({
        data: { phone: r.phone, name, source, optInAt: now, customerId: r.customerId ?? null },
      })
      criados++
      continue
    }
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        // nome novo só preenche quando faltava
        ...(name && !existing.name ? { name } : {}),
        ...(!existing.optInAt && !existing.optOutAt ? { optInAt: now } : {}),
        ...(r.customerId && !existing.customerId ? { customerId: r.customerId } : {}),
      },
    })
    atualizados++
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

  async remove(id: string): Promise<void> {
    await ensureSchema()
    await prisma.contact.delete({ where: { id } })
  },
}
