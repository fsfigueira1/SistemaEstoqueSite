'use client';

// Configurações → "Backup automático": um arquivo por dia neste computador,
// com botão para fazer agora, abrir a pasta e baixar.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, FolderOpen, FolderCog, Loader2, RefreshCw } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
import type { BackupStatus } from '@/services/backupService';
import { errorText } from '@/lib/friendlyError';

type BackupBridge = {
  openBackupFolder?: () => Promise<{ ok: boolean; dir: string }>;
  chooseBackupFolder?: () => Promise<{ ok: boolean; dir?: string }>;
};

const bridge = () =>
  typeof window === 'undefined' ? undefined : (window as unknown as { electronAPI?: BackupBridge }).electronAPI;

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `hoje às ${hm}`;
  if (d.toDateString() === y.toDateString()) return `ontem às ${hm}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')} às ${hm}`;
}

export default function BackupSettings({
  form,
  set,
}: {
  form: StoreSettings;
  set: <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => void;
}) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hasBridge, setHasBridge] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/backup');
      const data = await r.json();
      if (data.success) setStatus(data.data);
    } catch {
      /* sem status: a seção continua utilizável */
    }
  }, []);

  useEffect(() => {
    setHasBridge(Boolean(bridge()?.openBackupFolder));
    load();
  }, [load]);

  const runNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/backup', { method: 'POST' });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Backup não concluído'));
      setStatus(data.data.status);
      setMsg({ ok: true, text: `Backup feito (${size(data.data.file.size)})` });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Backup não concluído') });
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    const r = await bridge()?.chooseBackupFolder?.();
    if (r?.ok) setMsg({ ok: true, text: 'Pasta trocada. O app vai recarregar em instantes.' });
  };

  const files = status?.files ?? [];
  const shown = showAll ? files : files.slice(0, 3);

  return (
    <section id="backup" className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-lg bg-accent-soft p-2 text-primary">
          <Database className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg text-foreground">Backup automático</h2>
          <p className="text-xs text-muted-foreground">Uma cópia de todo o banco por dia, salva neste computador</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
          <input
            type="checkbox"
            checked={form.backupEnabled}
            onChange={(e) => set('backupEnabled', e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm text-foreground">Fazer backup todo dia sozinho</span>
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2">
          <span className="text-sm text-foreground">Guardar os últimos</span>
          <input
            type="number"
            min={3}
            max={365}
            value={form.backupKeep}
            onChange={(e) => set('backupKeep', Math.min(365, Math.max(3, Math.round(Number(e.target.value) || 30))))}
            className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right tabular-nums"
            aria-label="Quantos backups guardar"
          />
          <span className="text-sm text-muted-foreground">dias</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/60 p-4 text-sm">
        {status?.last ? (
          <p className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Último backup {when(status.last.createdAt)} · {size(status.last.size)}
          </p>
        ) : (
          <p className="text-muted-foreground">Nenhum backup ainda neste computador.</p>
        )}
        {status?.lastError && (
          <p className="mt-1 flex items-center gap-2 text-danger">
            <AlertTriangle className="h-4 w-4" /> Falhou {when(status.lastError.at)}: {status.lastError.message}
          </p>
        )}
        {status?.dir && <p className="mt-1 break-all text-xs text-muted-foreground">Pasta: {status.dir}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={busy || status?.running}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy || status?.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Fazer backup agora
          </button>
          {hasBridge && (
            <>
              <button
                type="button"
                onClick={() => bridge()?.openBackupFolder?.()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted"
              >
                <FolderOpen className="h-4 w-4" /> Abrir pasta
              </button>
              <button
                type="button"
                onClick={choose}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted"
              >
                <FolderCog className="h-4 w-4" /> Trocar pasta
              </button>
            </>
          )}
          {msg && <span className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>}
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
          {shown.map((f) => (
            <li key={f.name} className="flex items-center gap-3 px-4 py-2">
              <span className="flex-1 text-foreground">{when(f.createdAt)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{size(f.size)}</span>
              <a
                href={`/api/backup/file?name=${encodeURIComponent(f.name)}`}
                download={f.name}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Baixar
              </a>
            </li>
          ))}
          {files.length > 3 && (
            <li className="px-4 py-2 text-center">
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs text-primary hover:underline">
                {showAll ? 'Mostrar menos' : `Ver todos (${files.length})`}
              </button>
            </li>
          )}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Cada computador da loja guarda a sua cópia. Dica: escolha uma pasta do Google Drive ou OneDrive para ter uma cópia
        fora da loja. As chaves de API não vão no arquivo.
      </p>
    </section>
  );
}
