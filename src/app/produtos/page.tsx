'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProductStatus } from '@/generated/prisma/enums';
import Layout from '@/components/Layout';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

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
const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// ---------- types ----------
interface Category {
  id: string;
  name: string;
}
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

const STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DISCONTINUED: 'Descontinuado',
};

type FormState = {
  nome: string;
  codigoBarras: string;
  sku: string;
  categoriaId: string;
  preco: string;
  custo: string;
  estoque: string;
  estoqueMinimo: string;
  status: ProductStatus;
};

const EMPTY_FORM: FormState = {
  nome: '',
  codigoBarras: '',
  sku: '',
  categoriaId: '',
  preco: '',
  custo: '',
  estoque: '0',
  estoqueMinimo: '5',
  status: ProductStatus.ACTIVE,
};

// ---------- page ----------
export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'base', string>>>({});
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch('/api/products?limit=1000');
    const data = await res.json();
    if (data.success) setProducts(data.data?.products ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch('/api/products?limit=1000').then((r) => r.json()),
          fetch('/api/categories').then((r) => r.json()),
        ]);
        if (p.success) setProducts(p.data?.products ?? []);
        if (c.success) setCategories(c.data?.categories ?? c.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- derived ----------
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !norm(`${p.name} ${p.sku} ${p.barcode ?? ''}`).includes(norm(search))) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (stockFilter !== 'all') {
        const stock = toNumber(p.stockQuantity);
        const min = toNumber(p.minStockLevel ?? 0);
        if (stockFilter === 'out' && stock !== 0) return false;
        if (stockFilter === 'low' && !(stock > 0 && stock <= min)) return false;
      }
      return true;
    });
  }, [products, search, statusFilter, stockFilter]);

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const p of products) {
      const stock = toNumber(p.stockQuantity);
      const min = toNumber(p.minStockLevel ?? 0);
      if (stock === 0) out++;
      else if (stock <= min) low++;
      value += stock * toNumber(p.costPrice);
    }
    return { total: products.length, low, out, value };
  }, [products]);

  // ---------- modal ----------
  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      nome: p.name,
      codigoBarras: p.barcode ?? '',
      sku: p.sku,
      categoriaId: p.categoryId,
      preco: String(toNumber(p.salePrice)),
      custo: String(toNumber(p.costPrice)),
      estoque: String(toNumber(p.stockQuantity)),
      estoqueMinimo: String(toNumber(p.minStockLevel ?? 0)),
      status: p.status,
    });
    setErrors({});
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, base: undefined }));
  };

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
        codigoBarras: form.codigoBarras.trim() || null,
        sku: form.sku.trim() || form.codigoBarras.trim(),
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

  const remove = async (p: Product) => {
    if (!window.confirm(`Excluir "${p.name}" em definitivo? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      window.alert(
        data?.error?.message ||
          'Não foi possível excluir o produto. Se ele tiver vendas, mude o status para "Descontinuado".',
      );
      return;
    }
    await reload();
  };

  // ---------- render ----------
  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Produtos</h1>
            <p className="text-sm text-muted-foreground">Catálogo, preços e estoque</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Package className="h-4 w-4" />} label="Produtos" value={String(stats.total)} />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Estoque baixo"
            value={String(stats.low)}
            tone={stats.low ? 'warn' : 'muted'}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4" />}
            label="Sem estoque"
            value={String(stats.out)}
            tone={stats.out ? 'danger' : 'muted'}
          />
          <StatCard icon={<Package className="h-4 w-4" />} label="Valor em estoque" value={brl(stats.value)} />
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card shadow-sm p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU ou código de barras"
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 focus:border-ring focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="all">Todos os status</option>
            <option value={ProductStatus.ACTIVE}>Ativos</option>
            <option value={ProductStatus.INACTIVE}>Inativos</option>
            <option value={ProductStatus.DISCONTINUED}>Descontinuados</option>
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            className="rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="all">Todo o estoque</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>

        {/* table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Carregando produtos…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Cód. barras</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Estoque</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stock = toNumber(p.stockQuantity);
                  const min = toNumber(p.minStockLevel ?? 0);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">SKU {p.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.barcode || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{brl(p.salePrice)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{brl(p.costPrice)}</td>
                      <td className="px-4 py-3 text-right">
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
                          className={`pill ${
                            p.status === ProductStatus.ACTIVE ? 'pill-ok' : 'pill-muted'
                          }`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(p)}
                            className="rounded p-1.5 text-danger hover:bg-danger/10"
                            aria-label="Excluir"
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

      {/* modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editingId ? 'Editar produto' : 'Novo produto'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 hover:bg-muted" aria-label="Fechar">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {errors.base && (
              <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
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
                  placeholder="Ex.: Caneta esferográfica azul"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Código de barras"
                  hint="O código escaneável no PDV"
                  error={errors.codigoBarras}
                >
                  <input
                    value={form.codigoBarras}
                    onChange={(e) => set('codigoBarras', e.target.value)}
                    className={inputCls(errors.codigoBarras)}
                    placeholder="Ex.: 7891234567890"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="SKU / código interno" hint="Opcional — usa o de barras se vazio">
                  <input
                    value={form.sku}
                    onChange={(e) => set('sku', e.target.value)}
                    className={inputCls()}
                    placeholder="Ex.: CAN-AZ-001"
                  />
                </Field>
              </div>

              <Field label="Categoria" required error={errors.categoriaId}>
                <select
                  value={form.categoriaId}
                  onChange={(e) => set('categoriaId', e.target.value)}
                  className={inputCls(errors.categoriaId)}
                >
                  <option value="">Selecione…</option>
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
                      Ajuste o estoque por compras/vendas, não aqui.
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
                onClick={closeModal}
                className="rounded-lg border border-border px-4 py-2 font-medium text-foreground/90 hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Salvar alterações' : 'Adicionar produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ---------- small components ----------
function inputCls(error?: string) {
  return `w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-ring/40 ${
    error ? 'border-red-400 focus:border-red-400' : 'border-border focus:border-ring'
  } disabled:bg-muted disabled:text-muted-foreground`;
}

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
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/90">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warn' | 'danger';
}) {
  const toneCls = {
    default: 'text-foreground',
    muted: 'text-foreground',
    warn: 'text-amber-600',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}
