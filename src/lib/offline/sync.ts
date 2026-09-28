// Sobe a fila de vendas offline pro servidor. Idempotente: o checkout usa o
// clientId, então repetir um envio não duplica a venda.
import { listQueue, removeFromQueue, markFailed, queueCount } from './saleQueue';

let flushing = false;

export type FlushResult = { sent: number; failed: number; remaining: number };

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0, remaining: await queueCount() };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, failed: 0, remaining: await queueCount() };
  }

  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const items = await listQueue();
    for (const item of items) {
      try {
        // com prazo: uma requisição pendurada não pode travar a fila para sempre
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 60_000);
        const res = await fetch('/api/sales/checkout', {
          signal: ctrl.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item.payload,
            clientId: item.clientId,
            occurredAt: item.occurredAt,
            queued: true,
          }),
        }).finally(() => clearTimeout(timer));
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          await removeFromQueue(item.clientId);
          sent++;
          continue;
        }
        // banco fora do ar (503) / PIN expirado (401): não é culpa da venda —
        // para e tenta de novo no próximo ciclo. Qualquer outro erro marca só
        // esta venda e segue com as outras (uma venda com problema não pode
        // segurar a fila inteira; ela é tentada de novo no próximo ciclo).
        if (res.status === 401 || res.status === 503) break;
        // erro de verdade do servidor (dados inválidos etc.) — marca e segue
        const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
        await markFailed(item.clientId, String(msg));
        failed++;
      } catch {
        // erro de rede: para o loop e tenta de novo no próximo ciclo
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed, remaining: await queueCount() };
}
