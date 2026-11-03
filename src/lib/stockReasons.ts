// Motivos de saída de estoque (ajuste manual). Toda saída precisa de motivo e
// de uma explicação curta — é o que aparece no relatório do mês ("o que saiu
// sem ser vendido e por quê"). O motivo vai no começo da observação, entre
// colchetes: "[Perda / quebra / vencido] caiu da prateleira".
// Testado em src/lib/stockReasons.test.ts.

export type StockOutReason = 'perda' | 'furto' | 'uso' | 'brinde' | 'erro' | 'outro';
type MoveType = 'LOSS' | 'THEFT' | 'ADJUSTMENT_OUT';

export const OUT_REASONS: Array<{ id: StockOutReason; label: string; type: MoveType }> = [
  { id: 'perda', label: 'Perda / quebra / vencido', type: 'LOSS' },
  { id: 'furto', label: 'Furto', type: 'THEFT' },
  { id: 'uso', label: 'Uso da loja', type: 'ADJUSTMENT_OUT' },
  { id: 'brinde', label: 'Brinde / doação', type: 'ADJUSTMENT_OUT' },
  { id: 'erro', label: 'Erro de contagem / cadastro', type: 'ADJUSTMENT_OUT' },
  { id: 'outro', label: 'Outro', type: 'ADJUSTMENT_OUT' },
];

export const MIN_EXPLANATION = 3;

export const outReason = (id: unknown) => OUT_REASONS.find((r) => r.id === id) ?? null;

/** Observação gravada: "[Motivo] explicação". */
export const reasonNote = (id: StockOutReason, explanation: string) => `[${outReason(id)?.label ?? 'Outro'}] ${explanation.trim()}`;

/** Lê a observação de volta: motivo e explicação (sem colchetes = só explicação). */
export function parseReasonNote(notes: string | null | undefined): { reason: string | null; explanation: string } {
  const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec((notes ?? '').trim());
  return m ? { reason: m[1], explanation: m[2].trim() } : { reason: null, explanation: (notes ?? '').trim() };
}

/** Saída sem motivo ou sem explicação: mensagem para a tela (null = ok). */
export function outReasonError(reason: unknown, explanation: unknown): string | null {
  if (!outReason(reason)) return 'Escolha o motivo da saída';
  if (String(explanation ?? '').trim().length < MIN_EXPLANATION) return 'Explique por que o produto saiu do estoque';
  return null;
}
