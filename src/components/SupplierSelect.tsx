'use client';

// Escolher o fornecedor de um produto — com "Novo fornecedor…" ali mesmo,
// sem sair da tela. Usado no cadastro de produto e na Sugestão de compra.

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';

export type SupplierOption = { id: string; name: string; phone: string | null; contactName: string | null };

const NEW = '__new__';

// lista compartilhada entre os seletores da mesma tela
let cache: SupplierOption[] | null = null;
const listeners = new Set<(s: SupplierOption[]) => void>();

async function fetchSuppliers(): Promise<SupplierOption[]> {
  const r = await fetch('/api/suppliers?limit=500').then((x) => x.json());
  cache = (r?.data?.suppliers ?? []) as SupplierOption[];
  listeners.forEach((fn) => fn(cache ?? []));
  return cache;
}

export function useSuppliers() {
  const [list, setList] = useState<SupplierOption[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setList);
    if (!cache) fetchSuppliers().catch(() => {});
    return () => {
      listeners.delete(setList);
    };
  }, []);
  const create = useCallback(async (name: string, phone?: string): Promise<SupplierOption> => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: phone?.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(errorText(data, 'Fornecedor não salvo'));
    await fetchSuppliers();
    return data.data as SupplierOption;
  }, []);
  return { suppliers: list, create, reload: fetchSuppliers };
}

export default function SupplierSelect({
  value,
  onChange,
  className = '',
  placeholder = 'Sem fornecedor',
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const { suppliers, create } = useSuppliers();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr('Informe o nome');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = await create(name.trim(), phone);
      onChange(s.id);
      setAdding(false);
      setName('');
      setPhone('');
    } catch (e) {
      setErr(errorText(e, 'Fornecedor não salvo'));
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <div className="space-y-1.5">
        <div className={`flex gap-1.5 ${compact ? '' : 'flex-wrap'}`}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Nome do fornecedor"
            className={`min-w-0 flex-1 ${className}`}
          />
          {!compact && (
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="WhatsApp (opcional)"
              inputMode="tel"
              className={`w-44 ${className}`}
            />
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-label="Salvar fornecedor"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setErr(null);
            }}
            className="rounded-lg border border-border px-2.5 text-muted-foreground hover:bg-muted"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}
      className={className}
      aria-label="Fornecedor"
    >
      <option value="">{placeholder}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      <option value={NEW}>+ Novo fornecedor…</option>
    </select>
  );
}
