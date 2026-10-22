// Novidades enviadas pelo WhatsApp do celular. Criar o envio tira uma "foto"
// de quem está recebendo novidades naquele momento; a loja vai marcando quem
// já recebeu (um por um) ou baixa o .vcf para a lista de transmissão.
// Quando a API da Meta voltar, o envio automático usa estas mesmas tabelas.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"
import { withFooter } from "@/lib/contacts"

export type BroadcastSummary = { id: string; text: string; createdAt: string; total: number; sent: number }

export type BroadcastDetail = {
  id: string
  text: string
  /** texto com o rodapé de saída, pronto para enviar */
  message: string
  createdAt: string
  recipients: Array<{ contactId: string; name: string | null; phone: string; sentAt: string | null; saiu: boolean }>
}

export const BroadcastService = {
  async create(text: string): Promise<{ id: string; total: number }> {
    await ensureSchema()
    const body = String(text ?? "").trim()
    if (!body) throw new Error("Escreva a mensagem")
    const audience = await prisma.contact.findMany({
      where: { optInAt: { not: null }, optOutAt: null },
      select: { id: true },
    })
    if (!audience.length) throw new Error("Nenhum contato recebendo novidades")
    const b = await prisma.broadcast.create({
      data: { text: body, recipients: { create: audience.map((c) => ({ contactId: c.id })) } },
    })
    return { id: b.id, total: audience.length }
  },

  async list(): Promise<BroadcastSummary[]> {
    await ensureSchema()
    const rows = await prisma.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      include: { recipients: { select: { sentAt: true } } },
    })
    return rows.map((b) => ({
      id: b.id,
      text: b.text,
      createdAt: b.createdAt.toISOString(),
      total: b.recipients.length,
      sent: b.recipients.filter((r) => r.sentAt).length,
    }))
  },

  async get(id: string): Promise<BroadcastDetail | null> {
    await ensureSchema()
    const b = await prisma.broadcast.findUnique({
      where: { id },
      include: { recipients: { include: { contact: true } } },
    })
    if (!b) return null
    return {
      id: b.id,
      text: b.text,
      message: withFooter(b.text),
      createdAt: b.createdAt.toISOString(),
      recipients: b.recipients
        .map((r) => ({
          contactId: r.contactId,
          name: r.contact.name,
          phone: r.contact.phone,
          sentAt: r.sentAt?.toISOString() ?? null,
          saiu: Boolean(r.contact.optOutAt),
        }))
        .sort((a, z) => (a.name ?? a.phone).localeCompare(z.name ?? z.phone, "pt-BR")),
    }
  },

  async markSent(id: string, contactId: string, sent: boolean): Promise<void> {
    await ensureSchema()
    await prisma.broadcastRecipient.update({
      where: { broadcastId_contactId: { broadcastId: id, contactId } },
      data: { sentAt: sent ? new Date() : null },
    })
  },
}
