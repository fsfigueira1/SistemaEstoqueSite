'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart,
  Barcode,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Loader2,
  Printer,
  Trash2,
} from 'lucide-react';
import { ReceiptPrint } from '@/components/pdv/ReceiptPrint';
import Layout from '@/components/Layout';
import { getSettings } from '@/lib/settings';

// ----- Helpers -----
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const r = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(r) ? r : 0;
  }
  return 0;
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
}

// ----- Tipos -----
type ApiProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  stockQuantity: number;
};

type CartItem = {
  id: string;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  quantidade: number;
};

type PaymentMethodUI = 'dinheiro' | 'pix' | 'cartao';

const METHOD_MAP: Record<PaymentMethodUI, string> = {
  dinheiro: 'CASH',
  pix: 'PIX',
  cartao: 'CREDIT_CARD',
};

// ----- Componente -----
export default function PDVPage() {
  const [cfg] = useState(() => getSettings());
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'added' | 'not-found'>('ready');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ApiProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const [metodo, setMetodo] = useState<PaymentMethodUI>('dinheiro');
  const [parcelas, setParcelas] = useState(1);
  const [valorRecebido, setValorRecebido] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pós-venda
  const [finishedSale, setFinishedSale] = useState<null | {
    saleId: string;
    saleNumber: string;
    date: Date;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    interest: number;
    total: number;
    method: PaymentMethodUI;
    installments: number;
    installmentValue: number;
    received: number;
    change: number;
  }>(null);
  const [printing, setPrinting] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // ---------- Carrinho ----------
  const addToCart = useCallback((p: ApiProduct) => {
    setError(null);
    setCarrinho((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) {
        if (existing.quantidade >= toNumber(p.stockQuantity)) {
          setError(`Estoque insuficiente para ${p.name}`);
          return prev;
        }
        return prev.map((i) => (i.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      if (toNumber(p.stockQuantity) <= 0) {
        setError(`${p.name} está sem estoque`);
        return prev;
      }
      return [
        ...prev,
        {
          id: p.id,
          nome: p.name,
          codigo: p.barcode || p.sku,
          preco: toNumber(p.salePrice),
          estoque: toNumber(p.stockQuantity),
          quantidade: 1,
        },
      ];
    });
  }, []);

  const setQty = (id: string, delta: number) => {
    setCarrinho((prev) =>
      prev.flatMap((i) => {
        if (i.id !== id) return [i];
        const q = i.quantidade + delta;
        if (q <= 0) return [];
        if (q > i.estoque) {
          setError(`Só há ${i.estoque} em estoque de ${i.nome}`);
          return [i];
        }
        return [{ ...i, quantidade: q }];
      }),
    );
  };

  const removeItem = (id: string) => setCarrinho((prev) => prev.filter((i) => i.id !== id));

  // ---------- Leitor de código de barras ----------
  const scanBarcode = async () => {
    const code = barcode.trim();
    if (!code) return;
    setScanStatus('scanning');
    setError(null);
    try {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        addToCart(data.data);
        setScanStatus('added');
        setBarcode('');
      } else {
        setScanStatus('not-found');
        setError(data?.error?.message || data?.error || 'Produto não encontrado para esse código');
      }
    } catch {
      setScanStatus('not-found');
      setError('Erro ao consultar o produto');
    } finally {
      barcodeRef.current?.focus();
    }
  };

  // ---------- Busca por nome / SKU (ao vivo) ----------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setHighlight(-1);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&limit=8&status=ACTIVE`);
        const data = await res.json();
        const list: ApiProduct[] = data?.data?.products ?? [];
        setSearchResults(list);
        setHighlight(list.length > 0 ? 0 : -1);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  const pickResult = (p: ApiProduct) => {
    addToCart(p);
    setSearchTerm('');
    setSearchResults([]);
    setHighlight(-1);
    barcodeRef.current?.focus();
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && searchResults[highlight]) pickResult(searchResults[highlight]);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  // ---------- Totais ----------
  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const juros =
    metodo === 'cartao' && parcelas >= (cfg.cardInterestFromInstallments || 2)
      ? Math.round(subtotal * (cfg.cardInterestPercent || 0)) / 100
      : 0;
  const total = subtotal + juros;
  const valorParcela = metodo === 'cartao' && parcelas > 1 ? total / parcelas : 0;
  const recebido = toNumber(valorRecebido);
  const troco = metodo === 'dinheiro' && recebido > total ? recebido - total : 0;

  // ---------- Sessão de caixa ----------
  async function ensureCashSession(): Promise<string> {
    const cur = await fetch('/api/cash-session/current').then((r) => r.json());
    if (cur?.success && cur.data?.id) return cur.data.id;

    const regsRes = await fetch('/api/cash-session/open').then((r) => r.json());
    const registers: Array<{ id: string }> = regsRes?.data ?? [];
    if (registers.length === 0) throw new Error('Nenhum caixa cadastrado no sistema');

    const openRes = await fetch('/api/cash-session/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashRegisterId: registers[0].id, openingAmount: 0 }),
    }).then((r) => r.json());

    if (!openRes?.success || !openRes.data?.id) {
      throw new Error(openRes?.error?.message || openRes?.error || 'Falha ao abrir a sessão de caixa');
    }
    return openRes.data.id;
  }

  // ---------- Finalizar venda ----------
  const finalizarVenda = async () => {
    if (carrinho.length === 0) {
      setError('O carrinho está vazio');
      return;
    }
    if (metodo === 'dinheiro' && valorRecebido !== '' && recebido < total) {
      setError('Valor recebido menor que o total da venda');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const cashSessionId = await ensureCashSession();

      // 1. cria a venda (PENDING)
      const createRes = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashSessionId,
          items: carrinho.map((i) => ({ productId: i.id, quantity: i.quantidade, unitPrice: i.preco })),
          surchargeAmount: juros || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        throw new Error(createData?.error?.message || createData?.error || 'Falha ao registrar a venda');
      }
      const sale = createData.data.sale ?? createData.data;
      const serverTotal = toNumber(sale.totalAmount);

      // 2. conclui a venda -> baixa estoque + registra pagamento
      const completeRes = await fetch(`/api/sales/${sale.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: serverTotal,
          method: METHOD_MAP[metodo],
          installmentCount: metodo === 'cartao' && parcelas > 1 ? parcelas : undefined,
          changeAmount: 0,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.success) {
        throw new Error(
          completeData?.error?.message ||
            completeData?.error ||
            'Venda registrada mas não foi possível concluir. Verifique o caixa.',
        );
      }

      setFinishedSale({
        saleId: sale.id,
        saleNumber: sale.saleNumber ?? sale.id.slice(0, 8),
        date: new Date(),
        items: carrinho.map((i) => ({
          name: i.nome,
          quantity: i.quantidade,
          unitPrice: i.preco,
          total: i.preco * i.quantidade,
        })),
        subtotal: Math.max(0, serverTotal - juros),
        interest: juros,
        total: serverTotal,
        method: metodo,
        installments: metodo === 'cartao' ? parcelas : 1,
        installmentValue: metodo === 'cartao' && parcelas > 1 ? serverTotal / parcelas : 0,
        received: metodo === 'dinheiro' ? recebido || serverTotal : serverTotal,
        change: troco,
      });
      setCarrinho([]);
      setBarcode('');
      setValorRecebido('');
      setMetodo('dinheiro');
      setParcelas(1);
      setScanStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar a venda');
    } finally {
      setIsProcessing(false);
    }
  };

  const closePostSale = () => {
    setFinishedSale(null);
    setPrinting(false);
    barcodeRef.current?.focus();
  };

  const statusPill = {
    ready: ['pill-muted', 'Pronto para ler'],
    scanning: ['pill-warn', 'Lendo…'],
    added: ['pill-ok', 'Produto adicionado'],
    'not-found': ['pill-danger', 'Não encontrado'],
  }[scanStatus];

  return (
    <Layout>
      <div className="min-h-screen bg-background p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Ponto de Venda</h1>
            <span className="mt-1.5 block h-1 w-14 rounded-full bg-primary" />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="hidden sm:inline">Sistema online</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna esquerda */}
          <div className="space-y-6 lg:col-span-2">
            {/* Leitor */}
            <section className="rounded-xl border border-border bg-card shadow-sm p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Barcode className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Leitor de Código de Barras</h2>
              </div>
              <div className="relative">
                <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setScanStatus('ready');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      scanBarcode();
                    }
                  }}
                  placeholder="Aproxime o leitor ou digite o código e pressione Enter"
                  autoComplete="off"
                  className="w-full rounded-lg border border-border py-3 pl-10 pr-4 text-lg focus:border-ring focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="mt-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[0]}`}>{statusPill[1]}</span>
              </div>
            </section>

            {/* Busca */}
            <section className="rounded-xl border border-border bg-card shadow-sm p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Buscar Produto por Nome</h2>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Digite pelo menos 2 letras do nome ou SKU…"
                  className="w-full rounded-lg border border-border py-3 pl-10 pr-10 text-lg focus:border-ring focus:ring-2 focus:ring-ring/40"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              )}

              {searchResults.length > 0 && (
                <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {searchResults.map((p, idx) => (
                    <li
                      key={p.id}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pickResult(p)}
                      className={`flex cursor-pointer items-center justify-between gap-3 p-3 ${
                        idx === highlight ? 'bg-accent-soft' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          SKU {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-foreground">{formatCurrency(p.salePrice)}</p>
                        <p className="text-xs text-muted-foreground">estoque {toNumber(p.stockQuantity)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Coluna direita */}
          <div className="space-y-6">
            {/* Carrinho */}
            <section className="rounded-xl border border-border bg-card shadow-sm p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Carrinho ({carrinho.length})</h2>
              </div>

              {carrinho.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-muted-foreground">Carrinho vazio</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    Leia um código ou busque um produto
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrinho.map((i) => (
                    <div key={i.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{i.nome}</p>
                          <p className="text-xs text-muted-foreground">{i.codigo}</p>
                        </div>
                        <button
                          onClick={() => removeItem(i.id)}
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(i.id, -1)}
                            className="h-7 w-7 rounded bg-muted text-foreground/90 hover:bg-muted"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{i.quantidade}</span>
                          <button
                            onClick={() => setQty(i.id, 1)}
                            disabled={i.quantidade >= i.estoque}
                            className="h-7 w-7 rounded bg-muted text-foreground/90 hover:bg-muted disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(i.preco * i.quantidade)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pagamento */}
            <section className="rounded-xl border border-border bg-card shadow-sm p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Pagamento</h2>
              </div>
              <label className="mb-1 block text-sm font-medium text-foreground/90">Forma de pagamento</label>
              <select
                value={metodo}
                onChange={(e) => {
                  const v = e.target.value as PaymentMethodUI;
                  setMetodo(v);
                  if (v !== 'cartao') setParcelas(1);
                  if (v !== 'dinheiro') setValorRecebido('');
                }}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão de crédito</option>
              </select>

              {metodo === 'cartao' && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium text-foreground/90">Parcelas</label>
                  <select
                    value={parcelas}
                    onChange={(e) => setParcelas(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {metodo === 'dinheiro' && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium text-foreground/90">Valor recebido (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              )}

              <div className="mt-4 rounded-xl border-2 border-primary/30 bg-accent-soft/50 p-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  {juros > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Juros do cartão ({cfg.cardInterestPercent}%)</span>
                      <span className="tabular-nums">{formatCurrency(juros)}</span>
                    </div>
                  )}
                  {troco > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Troco</span>
                      <span className="tabular-nums">{formatCurrency(troco)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between border-t border-primary/20 pt-2">
                  <span className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <span className="font-heading text-2xl font-bold tabular-nums text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
                {valorParcela > 0 && (
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    {parcelas}× de {formatCurrency(valorParcela)}
                  </div>
                )}
              </div>

              <button
                onClick={finalizarVenda}
                disabled={isProcessing || carrinho.length === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-heading text-base font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finalizando…
                  </>
                ) : (
                  'Finalizar Venda'
                )}
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Pós-venda: imprimir comprovante ou não */}
      {finishedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            {!printing ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Venda finalizada</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Venda <span className="font-medium">{finishedSale.saleNumber}</span> concluída.
                  O estoque dos produtos já foi atualizado.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total: <span className="font-semibold">{formatCurrency(finishedSale.total)}</span>
                  {finishedSale.change > 0 && <> · Troco: {formatCurrency(finishedSale.change)}</>}
                </p>

                <p className="mt-4 text-sm font-medium text-foreground">Imprimir comprovante de compra?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => setPrinting(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <button
                    onClick={closePostSale}
                    className="flex-1 rounded-lg border border-border px-4 py-2.5 font-medium text-foreground/90 hover:bg-muted"
                  >
                    Concluir sem imprimir
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Comprovante</h2>
                  <button onClick={closePostSale} className="rounded p-1 hover:bg-muted" aria-label="Fechar">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto rounded border border-border bg-muted p-3">
                  <ReceiptPrint
                    data={{
                      saleId: finishedSale.saleNumber,
                      date: finishedSale.date,
                      items: finishedSale.items,
                      subtotal: finishedSale.subtotal,
                      paymentMethod: finishedSale.method,
                      interest: finishedSale.interest,
                      total: finishedSale.total,
                      installments: finishedSale.installments,
                      installmentValue: finishedSale.installmentValue,
                      received: finishedSale.received,
                      change: finishedSale.change,
                    }}
                    onPrintComplete={closePostSale}
                  />
                </div>
                <button
                  onClick={closePostSale}
                  className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/90 hover:bg-muted"
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
