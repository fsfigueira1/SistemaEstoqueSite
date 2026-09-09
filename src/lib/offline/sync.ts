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
        const res = await fetch('/api/sales/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item.payload,
            clientId: item.clientId,
            occurredAt: item.occurredAt,
            queued: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          await removeFromQueue(item.clientId);
          sent++;
          continue;
        }
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
