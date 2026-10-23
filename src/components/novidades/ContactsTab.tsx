'use client';

// Novidades → Contatos: quem recebe as novidades, de onde veio, quem saiu.

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Plus, Search, Trash2, UserCheck, UserMinus, Users } from 'lucide-react';
import ImportDialog from './ImportDialog';
import { errorText } from '@/lib/friendlyError';
import { norm } from '@/lib/schoolList';

export type Contact = { id: string; name: string | null; phone: string; source: string; status: 'ativo' | 'saiu' | 'pendente'; createdAt: string };

const SOURCE: Record<string, string> = { whatsapp: 'WhatsApp', cliente: 'Cliente', planilha: 'Planilha', manual: 'Manual' };
const STATUS: Record<Contact['status'], { label: string; cls: string }> = {
  ativo: { label: 'Recebe novidades', cls: 'pill pill-ok' },
  saiu: { label: 'Saiu', cls: 'pill pill-muted' },
  pendente: { label: 'Não respondeu SIM', cls: 'pill pill-warn' },
};
const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui salvar'));
  return data.data;
}

export default function ContactsTab({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<Contact[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/contacts');
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui carregar os contatos'));
      setList(data.data);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Não consegui carregar os contatos') });
      setList([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changed = (text?: string) => {
    if (text) setMsg({ ok: true, text });
    load();
    onChanged?.();
  };

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      changed(okText);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Não consegui salvar') });
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = { ativo: 0, saiu: 0, pendente: 0 };
    for (const x of list ?? []) c[x.status]++;
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const k = norm(q.trim());
    const digits = q.replace(/\D/g, '');
    return (list ?? []).filter((c) => !k || norm(c.name ?? '').includes(k) || (digits && c.phone.includes(digits)));
  }, [list, q]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(['ativo', 'pendente', 'saiu'] as const).map((s) => (
          <div key={s} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">{counts[s]}</p>
            <p className="text-xs text-muted-foreground">{STATUS[s].label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou telefone" className="w-64 rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4 text-primary" /> Importar planilha
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await send('/api/contacts/import-customers', 'POST', {});
                setMsg({ ok: true, text: `Clientes do sistema: ${r.criados} novos, ${r.atualizados} já estavam` });
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Users className="h-4 w-4 text-primary" /> Trazer clientes do sistema
          </button>
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Adicionar contato
          </button>
        </div>
      </div>

      {adding && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await send('/api/contacts', 'POST', { name: newName, phone: newPhone });
              setNewName('');
              setNewPhone('');
              setAdding(false);
            }, 'Contato adicionado');
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className="w-56 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(17) 99999-8888" inputMode="tel" className="w-48 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <button type="submit" disabled={busy || !newPhone.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Salvar
          </button>
        </form>
      )}

      {msg && <div className={`rounded-xl border p-3 text-sm font-medium ${msg.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>{msg.text}</div>}

      {list === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum contato ainda — importe a planilha do Excel ou traga os clientes do sistema.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Nome</th>
                  <th className="px-2 py-2.5 font-semibold">Telefone</th>
                  <th className="px-2 py-2.5 font-semibold">Origem</th>
                  <th className="px-2 py-2.5 font-semibold">Situação</th>
                  <th className="w-24 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium text-foreground">{c.name || <span className="text-muted-foreground">Sem nome</span>}</td>
                    <td className="px-2 py-2 tabular-nums">{fmtPhone(c.phone)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{SOURCE[c.source] ?? c.source}</td>
                    <td className="px-2 py-2">
                      <span className={STATUS[c.status].cls}>{STATUS[c.status].label}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status === 'ativo' ? (
                          <button type="button" title="Marcar que saiu" disabled={busy} onClick={() => run(() => send(`/api/contacts/${c.id}`, 'PATCH', { ativo: false }))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                            <UserMinus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button type="button" title="Voltar a receber" disabled={busy} onClick={() => run(() => send(`/api/contacts/${c.id}`, 'PATCH', { ativo: true }))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {c.status !== 'saiu' && (
                        <button
                          type="button"
                          title="Excluir"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Excluir ${c.name || fmtPhone(c.phone)} dos contatos?`)) run(() => send(`/api/contacts/${c.id}`, 'DELETE'));
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={(t) => changed(t)} />
    </div>
  );
}
