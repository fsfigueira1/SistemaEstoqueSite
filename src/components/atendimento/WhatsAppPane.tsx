'use client';

// Área onde o WhatsApp Web (do aplicativo) aparece dentro do Atendimento. O
// WhatsApp é desenhado pelo Electron por cima deste espaço: a tela só informa
// a posição e o tamanho, e esconde ao sair.

import { useEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { visibleBounds, whatsappBridge } from '@/lib/whatsappBridge';

export default function WhatsAppPane() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wa = whatsappBridge();
    const el = ref.current;
    if (!wa || !el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      // só a parte visível (a página pode ter rolado); fora da tela, esconde
      const b = visibleBounds({ x: r.left, y: r.top, width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight });
      (b ? wa.show(b) : wa.hide()).catch(() => {});
    };
    place();
    const obs = new ResizeObserver(place);
    obs.observe(el);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      wa.hide().catch(() => {});
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">WhatsApp da loja — escaneie o QR code uma vez com o celular da loja.</p>
        <button type="button" onClick={() => whatsappBridge()?.reload()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <RotateCw className="h-3.5 w-3.5" /> Recarregar
        </button>
      </div>
      <div ref={ref} className="min-h-0 flex-1 rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}
