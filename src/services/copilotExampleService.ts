// Aprendizado do copiloto: cada resposta que o atendente aprova (copia ou
// coloca no WhatsApp), com as correções dele, vira um exemplo de tom para as
// próximas. Testado em tests/copilotExampleService.test.ts.
import { prisma } from "@/lib/prisma"
import { ensureSchema } from "@/lib/schemaUpgrade"

export type CopilotExampleDTO = { id: string; customerText: string; aiReply: string; finalReply: string; createdAt: string }

export const CopilotExampleService = {
  async record(input: { customerText: string; aiReply: string; finalReply: string }): Promise<void> {
    await ensureSchema()
    const finalReply = String(input.finalReply ?? "").trim().slice(0, 8000)
    const customerText = String(input.customerText ?? "").trim().slice(0, 4000)
    if (!finalReply || !customerText) return
    // clicar Copiar duas vezes não vira dois exemplos iguais
    const last = await prisma.copilotExample.findFirst({ orderBy: { createdAt: "desc" }, select: { finalReply: true } })
    if (last?.finalReply === finalReply) return
    await prisma.copilotExample.create({
      data: { customerText, aiReply: String(input.aiReply ?? "").slice(0, 8000), finalReply },
    })
  },

  async list(limit = 30): Promise<CopilotExampleDTO[]> {
    await ensureSchema()
    const rows = await prisma.copilotExample.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit })
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  },

  async remove(id: string): Promise<void> {
    await ensureSchema()
    await prisma.copilotExample.delete({ where: { id } })
  },
}
