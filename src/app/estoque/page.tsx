'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { ProductStatus } from '@/generated/prisma/enums';
import Layout from '@/components/Layout';
import {
  Plus,
  Barcode,
  Loader2,
  XCircle,
  AlertTriangle,
  Trash2,
  Pencil,
  PackagePlus,
  PackageMinus,
} from 'lucide-react';

// ---------- helpers ----------
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const brl = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(v));

// Leitor USB emite teclas cruas (NumLock, Shift, etc.). Fica só com o que é
// código de barras / SKU de verdade: dígitos, letras, hífen e ponto.
const cleanCode = (s: string) => s.replace(/[^A-Za-z0-9.-]/g, '').trim();

// ---------- types ----------
type Category = { id: string; name: string };

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string;
  category?: { id: string; name: string } | null;
  salePrice: number | string;
  costPrice: number | string;
  stockQuantity: number;
  minStockLevel: number | null;
  status: ProductStatus;
}

type FormState = {
  codigoBarras: string;
  sku: string;
  nome: string;
  categoriaId: string;
  preco: string;
  custo: string;
  estoque: string;
  estoqueMinimo: string;
  status: ProductStatus;
};

const EMPTY_FORM: FormState = {
  codigoBarras: '',
  sku: '',
  nome: '',
  categoriaId: '',
  preco: '',
  custo: '',
  estoque: '0',
  estoqueMinimo: '5',
  status: ProductStatus.ACTIVE,
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DISCONTINUED: 'Descontinuado',
};

function inputCls(error?: string) {
  return `w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-ring/40 ${
    error ? 'border-danger focus:border-danger' : 'border-border focus:border-ring'
  } disabled:bg-muted disabled:text-muted-foreground`;
}

// ---------- page ----------
export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [barcode, setBarcode] = useState('');
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'found' | 'not-found'>('ready');
  const scanRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'base', string>>>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteForce, setDeleteForce] = useState(false);

  // ---------- ajuste de estoque (entrada/saída num produto já cadastrado) ----------
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockType, setStockType] = useState<'add' | 'remove'>('add');
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockErr, setStockErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch('/api/products?limit=1000').then((x) => x.json());
    if (r.success) setProducts(r.data?.products ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch('/api/products?limit=1000').then((r) => r.json()),
          fetch('/api/categories?limit=200').then((r) => r.json()),
        ]);
        if (p.success) setProducts(p.data?.products ?? []);
        if (c.success) setCategories(c.data?.categories ?? c.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const anyModal = modalOpen || !!deleteTarget || !!stockTarget;

  useEffect(() => {
    if (!anyModal) scanRef.current?.focus();
  }, [anyModal]);

  // ---------- modal open ----------
  const openNew = useCallback((code?: string) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, codigoBarras: code ? cleanCode(code) : '' });
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((p: Product) => {
    setEditingId(p.id);
    setForm({
      codigoBarras: p.barcode ?? '',
      sku: p.sku ?? '',
      nome: p.name ?? '',
      categoriaId: p.categoryId ?? '',
      preco: String(toNumber(p.salePrice)),
      custo: String(toNumber(p.costPrice)),
      estoque: String(toNumber(p.stockQuantity)),
      estoqueMinimo: String(toNumber(p.minStockLevel ?? 5)),
      status: p.status ?? ProductStatus.ACTIVE,
    });
    setErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setScanStatus('ready');
  };

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, base: undefined }));
  };

  // ---------- scanner ----------
  const runScan = useCallback(
    async (raw: string) => {
      const code = cleanCode(raw);
      setBarcode('');
      if (!code) return;
      setScanStatus('scanning');
      try {
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (data.success && data.data) {
          openEdit(data.data);
          setScanStatus('found');
        } else {
          openNew(code);
          setScanStatus('not-found');
        }
      } catch {
        setScanStatus('not-found');
      }
    },
    [openEdit, openNew],
  );

  useEffect(() => {
    if (!barcode.trim() || anyModal) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runScan(barcode), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [barcode, anyModal, runScan]);

  // ---------- save ----------
  const submit = async () => {
    const e: typeof errors = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome do produto';
    if (!form.codigoBarras.trim() && !form.sku.trim())
      e.codigoBarras = 'Informe o código de barras (ou um SKU)';
    if (!form.categoriaId) e.categoriaId = 'Selecione uma categoria';
    if (form.preco === '' || toNumber(form.preco) < 0) e.preco = 'Preço de venda inválido';
    if (toNumber(form.custo) < 0) e.custo = 'Custo não pode ser negativo';
    if (toNumber(form.estoque) < 0) e.estoque = 'Estoque não pode ser negativo';
    if (toNumber(form.estoqueMinimo) < 0) e.estoqueMinimo = 'Valor não pode ser negativo';
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        codigoBarras: cleanCode(form.codigoBarras) || null,
        sku: cleanCode(form.sku) || cleanCode(form.codigoBarras),
        categoriaId: form.categoriaId,
        preco: toNumber(form.preco),
        custo: toNumber(form.custo),
        estoque: toNumber(form.estoque),
        estoqueMinimo: toNumber(form.estoqueMinimo),
        status: form.status,
      };
      const res = await fetch(editingId ? `/api/products/${editingId}` : '/api/products', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrors({ base: data?.error?.message || data?.error || 'Não foi possível salvar' });
        return;
      }
      await reload();
      closeModal();
    } catch {
      setErrors({ base: 'Erro de rede ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete ----------
  const askDelete = (p: Product) => {
    setDeleteTarget(p);
    setDeleteErr(null);
    setDeleteBlocked(false);
    setDeleteForce(false);
  };
  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteErr(null);
    setDeleteBlocked(false);
    setDeleteForce(false);
    setDeleting(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      const qs = deleteForce ? '?force=1' : '';
      const res = await fetch(`/api/products/${deleteTarget.id}${qs}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        await reload();
        closeDelete();
        return;
      }
      setDeleteErr(data?.error?.message || 'Não foi possível excluir o produto.');
      setDeleteBlocked(data?.error?.code === 'HAS_HISTORY');
    } catch {
      setDeleteErr('Erro de rede ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  const discontinue = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ProductStatus.DISCONTINUED }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        await reload();
        closeDelete();
        return;
      }
      setDeleteErr(data?.error?.message || 'Não foi possível descontinuar.');
    } catch {
      setDeleteErr('Erro de rede.');
    } finally {
      setDeleting(false);
    }
  };

  // ---------- ajuste de estoque ----------
  const openStockAdjust = (p: Product, type: 'add' | 'remove' = 'add') => {
    setStockTarget(p);
    setStockType(type);
    setStockQty('');
    setStockNote('');
    setStockErr(null);
  };
  const closeStockAdjust = () => {
    setStockTarget(null);
    setStockQty('');
    setStockNote('');
    setStockErr(null);
    setStockSaving(false);
  };

  const submitStockAdjust = async () => {
    if (!stockTarget) return;
    const qty = toNumber(stockQty);
    if (qty <= 0) {
      setStockErr('Informe uma quantidade maior que zero');
      return;
    }
    setStockSaving(true);
    setStockErr(null);
    try {
      const res = await fetch('/api/stock/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: stockType,
          productId: stockTarget.id,
          quantity: qty,
          notes: stockNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setStockErr(data?.error?.message || data?.error || 'Não foi possível ajustar o estoque');
        return;
      }
      await reload();
      closeStockAdjust();
    } catch {
      setStockErr('Erro de rede ao ajustar o estoque');
    } finally {
      setStockSaving(false);
    }
  };

  // ---------- derived ----------
  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id && m.get(id)) || '—';
  }, [categories]);

  const scanPill = {
    ready: ['pill-muted', 'Aguardando leitura'],
    scanning: ['pill-warn', 'Lendo…'],
    found: ['pill-ok', 'Produto encontrado'],
    'not-found': ['pill-warn', 'Novo — preencha os dados'],
  }[scanStatus];

  // ---------- render ----------
  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Estoque</h1>
            <span className="mt-1.5 block h-1 w-14 rounded-full bg-primary" />
          </div>
          <button
            type="button"
            onClick={() => openNew()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </button>
        </div>

        {/* leitor */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Barcode className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Leitor de código de barras (USB)</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={scanRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    runScan(barcode);
                  }
                }}
                onBlur={() => setBarcode('')}
                placeholder="Aproxime o leitor ou digite o código e pressione Enter"
                className="w-full rounded-lg border border-border py-3 pl-10 pr-4 text-lg focus:border-ring focus:ring-2 focus:ring-ring/40"
                autoFocus
              />
            </div>
            <span className={`pill shrink-0 ${scanPill[0]}`}>{scanPill[1]}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Código encontrado abre para editar; código novo abre o cadastro já preenchido.
          </p>
        </section>

        {/* tabela */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Carregando produtos…
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado. Clique em “Novo produto” ou use o leitor.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Cód. barras</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Estoque</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stock = toNumber(p.stockQuantity);
                  const min = toNumber(p.minStockLevel ?? 0);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.barcode || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">SKU {p.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.category?.name ?? catName(p.categoryId)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {brl(p.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {brl(p.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            stock === 0
                              ? 'font-semibold text-danger'
                              : stock <= min
                                ? 'font-semibold text-amber-600'
                                : 'text-foreground'
                          }
                        >
                          {stock}
                        </span>
                        <span className="text-xs text-muted-foreground"> / {min}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`pill ${p.status === ProductStatus.ACTIVE ? 'pill-ok' : 'pill-muted'}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openStockAdjust(p, 'add')}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground"
                            aria-label={`Ajustar estoque de ${p.name}`}
                            title="Ajustar estoque"
                          >
                            <PackagePlus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Editar ${p.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => askDelete(p)}
                            className="rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                            aria-label={`Excluir ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* modal add/edit */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="estoque-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="estoque-modal-title" className="text-xl font-bold text-foreground">
                {editingId ? 'Editar produto' : 'Novo produto'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Fechar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {errors.base && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                {errors.base}
              </div>
            )}

            <div className="space-y-4">
              <Field label="Nome do produto" required error={errors.nome}>
                <input
                  autoFocus
                  value={form.nome}
                  onChange={(e) => set('nome', e.target.value)}
                  className={inputCls(errors.nome)}
                  placeholder="Ex.: Caderno universitário 100 folhas"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Código de barras" hint="O código escaneável no PDV" error={errors.codigoBarras}>
                  <input
                    value={form.codigoBarras}
                    onChange={(e) => set('codigoBarras', e.target.value)}
                    className={inputCls(errors.codigoBarras)}
                    placeholder="Ex.: 7891234567890"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
                <Field label="SKU / código interno" hint="Opcional — usa o de barras se vazio">
                  <input
                    value={form.sku}
                    onChange={(e) => set('sku', e.target.value)}
                    className={inputCls()}
                    placeholder="Ex.: CAD-UNI-001"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <Field label="Categoria" required error={errors.categoriaId}>
                <select
                  value={form.categoriaId}
                  onChange={(e) => set('categoriaId', e.target.value)}
                  className={inputCls(errors.categoriaId)}
                >
                  <option value="">Selecione uma categoria…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Preço de venda" required error={errors.preco}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.preco}
                    onChange={(e) => set('preco', e.target.value)}
                    className={inputCls(errors.preco)}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Preço de custo" error={errors.custo}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.custo}
                    onChange={(e) => set('custo', e.target.value)}
                    className={inputCls(errors.custo)}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Estoque atual" error={errors.estoque}>
                  <input
                    type="number"
                    min="0"
                    value={form.estoque}
                    onChange={(e) => set('estoque', e.target.value)}
                    className={inputCls(errors.estoque)}
                    disabled={!!editingId}
                  />
                  {editingId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pra adicionar ou remover quantidade, use o botão{' '}
                      <PackagePlus className="inline h-3.5 w-3.5 align-text-bottom" /> "Ajustar estoque"
                      na lista.
                    </p>
                  )}
                </Field>
                <Field label="Estoque mínimo" error={errors.estoqueMinimo}>
                  <input
                    type="number"
                    min="0"
                    value={form.estoqueMinimo}
                    onChange={(e) => set('estoqueMinimo', e.target.value)}
                    className={inputCls(errors.estoqueMinimo)}
                  />
                </Field>
              </div>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className={inputCls()}
                >
                  <option value={ProductStatus.ACTIVE}>Ativo</option>
                  <option value={ProductStatus.INACTIVE}>Inativo</option>
                  <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
                </select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Salvar alterações' : 'Adicionar produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal excluir */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="estoque-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-danger" />
              <h2 id="estoque-delete-title" className="text-xl font-bold text-foreground">
                Excluir produto
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Excluir <span className="font-medium text-foreground">{deleteTarget.name}</span> em
              definitivo? Esta ação não pode ser desfeita.
            </p>

            <label className="mt-3 flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={deleteForce}
                onChange={(e) => setDeleteForce(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-foreground">
                Apagar também de vendas e movimentações antigas
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Deixa o histórico menos poluído. Os totais de vendas antigas com este produto
                  podem ficar desatualizados.
                </span>
              </span>
            </label>

            {deleteErr && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                {deleteErr}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              {deleteBlocked && !deleteForce && (
                <button
                  type="button"
                  onClick={discontinue}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Só descontinuar
                </button>
              )}
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 font-medium text-danger-foreground transition-colors hover:bg-danger/90 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleteForce ? 'Excluir com histórico' : 'Excluir de vez'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal ajustar estoque */}
      {stockTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="estoque-ajuste-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 id="estoque-ajuste-title" className="text-xl font-bold text-foreground">
                Ajustar estoque
              </h2>
              <button
                type="button"
                onClick={closeStockAdjust}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Fechar"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {stockTarget.name} · estoque atual{' '}
              <span className="font-semibold text-foreground">{toNumber(stockTarget.stockQuantity)}</span>
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStockType('add')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium transition-colors ${
                  stockType === 'add'
                    ? 'border-primary bg-accent-soft text-accent-soft-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <PackagePlus className="h-4 w-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setStockType('remove')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 font-medium transition-colors ${
                  stockType === 'remove'
                    ? 'border-primary bg-accent-soft text-accent-soft-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <PackageMinus className="h-4 w-4" />
                Saída
              </button>
            </div>

            <Field label={stockType === 'add' ? 'Quantidade a adicionar' : 'Quantidade a remover'} required>
              <input
                autoFocus
                type="number"
                min="1"
                step="1"
                value={stockQty}
                onChange={(e) => {
                  setStockQty(e.target.value);
                  setStockErr(null);
                }}
                className={inputCls()}
                placeholder="0"
              />
            </Field>

            <div className="mt-4">
              <Field label="Observação" hint="Opcional — ex.: nota fiscal, motivo do ajuste">
                <input
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  className={inputCls()}
                  placeholder="Ex.: compra NF 12345"
                />
              </Field>
            </div>

            {stockErr && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              >
                {stockErr}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeStockAdjust}
                className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitStockAdjust}
                disabled={stockSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {stockSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ---------- small component ----------
function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
