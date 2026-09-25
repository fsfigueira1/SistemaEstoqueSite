// Conserto automático: venda estornada com alguma parte do pagamento ainda
// "PAID". Acontece quando um PC ainda na versão antiga (antes da 0.3.0)
// estorna uma venda com pagamento dividido — o código antigo só estornava a
// primeira parte. Sem isto, o relatório contaria dinheiro que já foi devolvido.
import { prisma } from "@/lib/prisma"

const g = globalThis as unknown as { __lacolariaHealAt?: number }

export async function healRefundedPayments(): Promise<void> {
  const now = Date.now()
  if (g.__lacolariaHealAt && now - g.__lacolariaHealAt < 60_000) return // no máx. 1x por minuto
  g.__lacolariaHealAt = now
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "SalePayment" p
          SET "status" = 'REFUNDED', "refundedAt" = COALESCE(p."refundedAt", s."updatedAt"), "updatedAt" = now()
         FROM "Sale" s
        WHERE p."saleId" = s."id" AND s."status" = 'REFUNDED' AND p."status" = 'PAID'`,
    )
  } catch {
    /* não impede o relatório */
  }
}
