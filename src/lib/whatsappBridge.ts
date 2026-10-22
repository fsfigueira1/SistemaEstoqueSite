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
  insert: (text: string) => Promise<boolean>;
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

export const WA_REASON: Record<string, string> = {
  'sem-conversa': 'Abra a conversa do cliente no WhatsApp ao lado e tente de novo.',
  'nao-conectado': 'O WhatsApp ainda não está conectado (ou está carregando): escaneie o QR code com o celular da loja em WhatsApp → Aparelhos conectados.',
  fechado: 'O WhatsApp ainda está abrindo — espere carregar e tente de novo.',
  erro: 'Não consegui ler a conversa. Use a aba "Colar mensagem" enquanto isso.',
};
