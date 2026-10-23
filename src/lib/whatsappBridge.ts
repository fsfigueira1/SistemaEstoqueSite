'use client';

// Ponte com o WhatsApp Web embutido (só existe no aplicativo — electron/preload.cjs).
// No navegador comum devolve undefined e a tela usa o modo colar.

export type WaChat =
  | { ok: true; name: string; phone: string; messages: Array<{ from: 'cliente' | 'loja'; text: string }> }
  | { ok: false; reason: 'sem-conversa' | 'nao-conectado' | 'fechado' | 'erro' };

export type WhatsAppBridge = {
  show: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>;
  hide: () => Promise<boolean>;
  read: () => Promise<WaChat>;
  /** cola só se a conversa aberta ainda for a do cliente esperado */
  insert: (text: string, expected: { name: string; phone: string }) => Promise<{ ok: boolean; reason?: 'outra-conversa' | 'sem-caixa' }>;
  reload: () => Promise<boolean>;
};

export function whatsappBridge(): WhatsAppBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: { whatsapp?: WhatsAppBridge } }).electronAPI?.whatsapp;
}

/** O que o cliente mandou depois da última resposta da loja (igual a electron/whatsappDom.cjs). */
export function customerTurn(messages: Array<{ from: 'cliente' | 'loja'; text: string }>): string {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.from === 'loja') last = i;
  });
  const after = messages.slice(last + 1).filter((m) => m.from === 'cliente');
  return (last >= 0 ? after : after.slice(-6)).map((m) => m.text).join('\n');
}

type Box = { x: number; y: number; width: number; height: number };

/** Parte visível da área do WhatsApp (a página rolou); null se quase nada aparece. */
export function visibleBounds(b: Box, win: { width: number; height: number }): Box | null {
  const x = Math.max(0, b.x);
  const y = Math.max(0, b.y);
  const width = Math.min(b.x + b.width, win.width) - x;
  const height = Math.min(b.y + b.height, win.height) - y;
  return width >= 50 && height >= 50 ? { x, y, width, height } : null;
}

/** Mesmo cliente? Pelo telefone quando os dois têm; senão pelo nome (igual a sameChat em electron/whatsappDom.cjs). */
export function sameCustomer(a: { name: string; phone: string }, b: { name: string; phone: string }): boolean {
  const pa = a.phone.replace(/\D/g, '');
  const pb = b.phone.replace(/\D/g, '');
  if (pa && pb) return pa.slice(-10) === pb.slice(-10);
  const na = a.name.trim().toLowerCase();
  return Boolean(na) && na === b.name.trim().toLowerCase();
}

export const WA_REASON: Record<string, string> = {
  'sem-conversa': 'Abra a conversa do cliente no WhatsApp ao lado e tente de novo.',
  'nao-conectado': 'O WhatsApp ainda não está conectado (ou está carregando): escaneie o QR code com o celular da loja em WhatsApp → Aparelhos conectados.',
  fechado: 'O WhatsApp ainda está abrindo — espere carregar e tente de novo.',
  erro: 'Não consegui ler a conversa. Use a aba "Colar mensagem" enquanto isso.',
};
