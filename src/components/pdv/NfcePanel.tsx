'use client';

// NFC-e de uma venda (PDV e Vendas): emitir com CPF opcional, imprimir o
// DANFE na térmica, consultar nota que ficou sem resposta e, para o dono,
// cancelar. Some quando a emissão de NFC-e está desligada.

import { useCallback, useEffect, useState } from 'react';
import { FileCheck2, Loader2, Printer, RefreshCw } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';
import { printThermal } from '@/lib/printClient';
import { getSettings } from '@/lib/settings';
import { useMe } from '@/lib/useMe';

type Nota = {
  id: string;
  status: 'PENDING' | 'AUTHORIZED' | 'REJECTED' | 'DENIED' | 'CANCELLED';
  numero: number;
  serie: number;
  chave: string;
  cStat: number | null;
  motivo: string;
  protocolo: string;
  ambiente: number;
};
type Painel = { enabled: boolean; ambiente: number; notas: Nota[] };

const inp = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(errorText(d, 'Não deu certo'));
  return d.data as T;
}

export async function imprimirDanfe(id: string, via?: string) {
  const width = getSettings().receiptWidth === '58mm' ? '58mm' : '80mm';
  const r = await fetch(`/api/nfce/notas/${id}/danfe?w=${width}${via ? `&via=${encodeURIComponent(via)}` : ''}`);
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(errorText(d, 'Não consegui montar o DANFE'));
  }
  const res = await printThermal(await r.text(), width);
  if (!res.ok && res.reason) throw new Error(`Não imprimiu: ${res.reason}`);
}

export default function NfcePanel({
  saleId,
  saleStatus,
  autoPrint = true,
  principal = false,
  onEnabled,
  onImpresso,
}: {
  saleId: string;
  /** status da venda (para avisar quando a venda foi estornada e a nota não). */
  saleStatus?: string;
  /** imprime o DANFE sozinho logo que a nota é autorizada */
  autoPrint?: boolean;
  /** fim da venda no PDV: a nota é a ação principal (foco e botão "Emitir NFC-e e imprimir") */
  principal?: boolean;
  /** avisa se a emissão está ligada, para a tela pôr o comprovante não fiscal em segundo plano */
  onEnabled?: (enabled: boolean) => void;
  /** nota autorizada e DANFE mandado para a impressora */
  onImpresso?: () => void;
}) {
  const me = useMe();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [cpf, setCpf] = useState('');
  const [busy, setBusy] = useState<'' | 'emitir' | 'imprimir' | 'consultar' | 'cancelar'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [just, setJust] = useState('');

  const carregar = useCallback(async () => {
    try {
      const p = await api<Painel>(`/api/nfce/notas?saleId=${encodeURIComponent(saleId)}`);
      setPainel(p);
      onEnabled?.(p.enabled);
    } catch {
      setPainel(null); // sem acesso / sem internet: não mostra nada
      onEnabled?.(false);
    }
  }, [saleId, onEnabled]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const run = async (kind: typeof busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Não deu certo') });
    } finally {
      setBusy('');
    }
  };

  if (!painel || (!painel.enabled && painel.notas.length === 0)) return null;

  const valida = painel.notas.find((n) => n.status === 'AUTHORIZED' || n.status === 'CANCELLED');
  const pendente = painel.notas.find((n) => n.status === 'PENDING');
  const ultima = painel.notas[0];
  const homolog = (valida ?? ultima)?.ambiente === 2 || (!valida && !ultima && painel.ambiente === 2);

  const emitir = () =>
    run('emitir', async () => {
      const n = await api<Nota>('/api/nfce/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, cpf: cpf || undefined }),
      });
      await carregar();
      if (n.status === 'AUTHORIZED') {
        setMsg({ ok: true, text: `NFC-e nº ${n.numero} autorizada.` });
        if (autoPrint) {
          await imprimirDanfe(n.id);
          onImpresso?.();
        }
      } else if (n.status === 'PENDING') {
        setMsg({ ok: false, text: `A SEFAZ não respondeu (${n.motivo || 'sem resposta'}). Clique em "Consultar" daqui a pouco.` });
      } else {
        setMsg({ ok: false, text: `Nota não autorizada: ${n.cStat ?? ''} ${n.motivo}`.trim() });
      }
    });

  const consultar = (id: string) =>
    run('consultar', async () => {
      const n = await api<Nota>(`/api/nfce/notas/${id}/consultar`, { method: 'POST' });
      await carregar();
      setMsg({
        ok: n.status === 'AUTHORIZED',
        text:
          n.status === 'AUTHORIZED'
            ? `NFC-e nº ${n.numero} autorizada.`
            : `${n.cStat ?? ''} ${n.motivo || 'Ainda sem resposta da SEFAZ'}`.trim(),
      });
    });

  const cancelar = (id: string) =>
    run('cancelar', async () => {
      await api<Nota>(`/api/nfce/notas/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: just }),
      });
      setCancelando(false);
      setJust('');
      await carregar();
      setMsg({ ok: true, text: 'NFC-e cancelada na SEFAZ.' });
    });

  return (
    <div className="rounded-lg border border-border p-3 text-left">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <FileCheck2 className="h-4 w-4 text-primary" /> Nota fiscal (NFC-e)
        {homolog && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">teste — sem valor fiscal</span>
        )}
      </p>

      {valida ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            NFC-e nº {valida.numero} série {valida.serie} —{' '}
            {valida.status === 'CANCELLED' ? (
              <span className="font-medium text-danger">cancelada</span>
            ) : (
              <span className="font-medium text-primary">autorizada</span>
            )}
          </p>
          {valida.status === 'AUTHORIZED' && (saleStatus === 'REFUNDED' || saleStatus === 'CANCELLED') && (
            <p className="text-xs text-danger">A venda foi estornada, mas a nota continua valendo. O dono precisa cancelar a NFC-e.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run('imprimir', () => imprimirDanfe(valida.id, '2ª via'))}
              disabled={busy !== ''}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              {busy === 'imprimir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Imprimir DANFE
            </button>
            {me?.role === 'OWNER' && valida.status === 'AUTHORIZED' && !cancelando && (
              <button
                onClick={() => setCancelando(true)}
                disabled={busy !== ''}
                className="rounded-full border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Cancelar NFC-e
              </button>
            )}
            {me?.role === 'OWNER' && (
              <a href={`/api/nfce/notas/${valida.id}/xml`} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Baixar XML
              </a>
            )}
          </div>
          {cancelando && (
            <div className="space-y-2 rounded-lg border border-danger/40 bg-danger/5 p-2">
              <input
                value={just}
                onChange={(e) => setJust(e.target.value)}
                className={inp}
                placeholder="Motivo do cancelamento (mín. 15 letras)"
                maxLength={255}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => cancelar(valida.id)}
                  disabled={busy !== '' || just.trim().length < 15}
                  className="inline-flex items-center gap-2 rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-danger-foreground disabled:opacity-60"
                >
                  {busy === 'cancelar' && <Loader2 className="h-4 w-4 animate-spin" />} Cancelar na SEFAZ
                </button>
                <button onClick={() => setCancelando(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : pendente ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            NFC-e nº {pendente.numero} enviada, sem resposta da SEFAZ ainda. {pendente.motivo}
          </p>
          <button
            onClick={() => consultar(pendente.id)}
            disabled={busy !== ''}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {busy === 'consultar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Consultar
          </button>
        </div>
      ) : painel.enabled ? (
        <div className="space-y-2">
          {ultima && (
            <p className="text-xs text-danger">
              Última tentativa recusada: {ultima.cStat ?? ''} {ultima.motivo}
            </p>
          )}
          <div className="flex gap-2">
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && busy === '') emitir(); }} className={inp} placeholder="CPF/CNPJ na nota (opcional)" inputMode="numeric" />
            <button
              onClick={emitir}
              autoFocus={principal}
              disabled={busy !== '' || saleStatus === 'REFUNDED' || saleStatus === 'CANCELLED'}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === 'emitir' && <Loader2 className="h-4 w-4 animate-spin" />} {principal && autoPrint ? 'Emitir NFC-e e imprimir' : 'Emitir NFC-e'}
            </button>
          </div>
        </div>
      ) : null}

      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-primary' : 'text-danger'}`}>{msg.text}</p>}
    </div>
  );
}
