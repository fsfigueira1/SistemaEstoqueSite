import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { getSystemUserId } from "@/lib/systemUser"
import type { PaymentMethod } from "@/generated/prisma/enums"
import { friendlyError } from "@/lib/friendlyError"

// POST /api/sales/checkout
// Cria e conclui a venda numa única chamada. Ou tudo dá certo (venda COMPLETED,
// estoque baixado, pagamento registrado) ou nada fica pendente: se a conclusão
// falhar, a venda recém-criada é cancelada e o erro é devolvido. O operador
// nunca fica com estoque baixado sem venda, nem venda sem baixa de estoque.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      cashSessionId,
      items,
      surchargeAmount,
      discountAmount,
      customerId,
      notes,
      payment,
      // pagamento dividido: [{ method, amount, installments }]
      payments,
      // PDV offline: idempotência + venda que veio da fila local
      clientId,
      occurredAt,
      queued,
    } = body ?? {}

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "A venda precisa de ao menos um item" }, { status: 400 })
    }
    const METHODS = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"]
    const parts: Array<{ method: PaymentMethod; amount: number; installmentCount: number | null }> | null =
      Array.isArray(payments) && payments.length > 0
        ? payments.map((p: { method?: string; amount?: unknown; installments?: unknown }) => ({
            method: String(p?.method) as PaymentMethod,
            amount: Math.round(Number(p?.amount) * 100) / 100,
            installmentCount:
              p?.method === "CREDIT_CARD" && Number(p?.installments) > 1 ? Number(p.installments) : null,
          }))
        : null
    const method: PaymentMethod = parts ? parts[0].method : payment?.method
    if (!method || (parts && parts.some((p) => !METHODS.includes(p.method)))) {
      return NextResponse.json({ error: "Forma de pagamento é obrigatória" }, { status: 400 })
    }

    const userId = await getSystemUserId()

    // 0. Idempotência: se essa venda (clientId) já subiu antes, devolve a que existe.
    if (clientId) {
      const existing = await SaleService.findByClientId(String(clientId))
      if (existing) {
        return NextResponse.json(
          {
            success: true,
            idempotent: true,
            data: { ...existing, saleNumber: existing.saleNumber, items: existing.items },
          },
          { status: 200 },
        )
      }
    }

    // Resolve o caixa. Online: exige o cashSessionId. Fila offline: se a sessão
    // fechou nesse meio tempo, aponta pra sessão aberta atual (ou abre uma).
    let sessionId: string
    if (queued) {
      sessionId = await SaleService.ensureOpenCashSession(cashSessionId ?? null, userId)
    } else {
      if (!cashSessionId) {
        return NextResponse.json({ error: "cashSessionId é obrigatório" }, { status: 400 })
      }
      sessionId = cashSessionId
    }

    // 1. cria a venda (PENDING) — ainda não mexe no estoque
    const created = await SaleService.createSale({
      cashSessionId: sessionId,
      createdById: userId,
      items,
      surchargeAmount,
      discountAmount,
      customerId,
      notes,
      clientId: clientId ? String(clientId) : null,
      occurredAt: occurredAt ?? null,
      queued: Boolean(queued),
    })
    const sale = created.sale

    // 2. conclui — baixa estoque + registra pagamento, tudo numa transação
    try {
      // formato novo (`payments`, mesmo com uma forma só) → soma das partes =
      // total e o troco fica gravado; formato antigo (`payment`) → como antes
      const completed = parts
        ? await SaleService.completeSale(sale.id, {
            payments: parts,
            changeAmount: Number(body?.changeAmount) > 0 ? Number(body.changeAmount) : null,
            processedById: userId,
          }, { queued: Boolean(queued) })
        : await SaleService.completeSale(sale.id, {
            amount: sale.totalAmount,
            method,
            installmentCount:
              payment?.installments && Number(payment.installments) > 1 ? Number(payment.installments) : null,
            changeAmount: payment?.changeAmount ?? 0,
            processedById: userId,
          }, { queued: Boolean(queued) })

      // dados completos p/ o comprovante
      const full = await SaleService.getSale(sale.id)
      return NextResponse.json(
        { success: true, data: { ...completed, saleNumber: sale.saleNumber, items: full.items } },
        { status: 201 },
      )
    } catch (completeErr) {
      // desfaz a venda pendente para não deixar lixo
      await SaleService.cancelSale(sale.id).catch(() => {})
      return NextResponse.json({ error: friendlyError(completeErr).message }, { status: 409 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: friendlyError(error).message },
      { status: 500 },
    )
  }
}
