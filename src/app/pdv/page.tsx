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
    total: number;
    method: PaymentMethodUI;
    installments: number;
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
  const total = subtotal;
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
        subtotal: serverTotal,
        total: serverTotal,
        method: metodo,
        installments: metodo === 'cartao' ? parcelas : 1,
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
    ready: ['bg-emerald-100 text-emerald-800', 'Pronto para ler'],
    scanning: ['bg-amber-100 text-amber-800', 'Lendo…'],
    added: ['bg-emerald-100 text-emerald-800', 'Produto adicionado'],
    'not-found': ['bg-red-100 text-red-800', 'Não encontrado'],
  }[scanStatus];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">PDV — Ponto de Venda</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Sistema online
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna esquerda */}
          <div className="space-y-6 lg:col-span-2">
            {/* Leitor */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Barcode className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Leitor de Código de Barras</h2>
              </div>
              <div className="relative">
                <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
                  className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div className="mt-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill[0]}`}>{statusPill[1]}</span>
              </div>
            </section>

            {/* Busca */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Buscar Produto por Nome</h2>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Digite pelo menos 2 letras do nome ou SKU…"
                  className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-10 text-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">Nenhum produto encontrado.</p>
              )}

              {searchResults.length > 0 && (
                <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                  {searchResults.map((p, idx) => (
                    <li
                      key={p.id}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pickResult(p)}
                      className={`flex cursor-pointer items-center justify-between gap-3 p-3 ${
                        idx === highlight ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{p.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          SKU {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(p.salePrice)}</p>
                        <p className="text-xs text-gray-500">estoque {toNumber(p.stockQuantity)}</p>
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
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Carrinho ({carrinho.length})</h2>
              </div>

              {carrinho.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">Carrinho vazio</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrinho.map((i) => (
                    <div key={i.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{i.nome}</p>
                          <p className="text-xs text-gray-500">{i.codigo}</p>
                        </div>
                        <button
                          onClick={() => removeItem(i.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(i.id, -1)}
                            className="h-7 w-7 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{i.quantidade}</span>
                          <button
                            onClick={() => setQty(i.id, 1)}
                            disabled={i.quantidade >= i.estoque}
                            className="h-7 w-7 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(i.preco * i.quantidade)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pagamento */}
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Pagamento</h2>
              </div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Forma de pagamento</label>
              <select
                value={metodo}
                onChange={(e) => {
                  const v = e.target.value as PaymentMethodUI;
                  setMetodo(v);
                  if (v !== 'cartao') setParcelas(1);
                  if (v !== 'dinheiro') setValorRecebido('');
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão de crédito</option>
              </select>

              {metodo === 'cartao' && (
                <div className="mt-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Parcelas</label>
                  <select
                    value={parcelas}
                    onChange={(e) => setParcelas(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Valor recebido (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              )}

              <div className="mt-4 space-y-1 border-t border-gray-200 pt-4 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {troco > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Troco</span>
                    <span>{formatCurrency(troco)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <button
                onClick={finalizarVenda}
                disabled={isProcessing || carrinho.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {!printing ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                  <h2 className="text-xl font-bold text-gray-900">Venda finalizada</h2>
                </div>
                <p className="text-sm text-gray-600">
                  Venda <span className="font-medium">{finishedSale.saleNumber}</span> concluída.
                  O estoque dos produtos já foi atualizado.
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Total: <span className="font-semibold">{formatCurrency(finishedSale.total)}</span>
                  {finishedSale.change > 0 && <> · Troco: {formatCurrency(finishedSale.change)}</>}
                </p>

                <p className="mt-4 text-sm font-medium text-gray-800">Imprimir comprovante de compra?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => setPrinting(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <button
                    onClick={closePostSale}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Concluir sem imprimir
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Comprovante</h2>
                  <button onClick={closePostSale} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
                    <XCircle className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3">
                  <ReceiptPrint
                    data={{
                      saleId: finishedSale.saleNumber,
                      date: finishedSale.date,
                      items: finishedSale.items,
                      subtotal: finishedSale.subtotal,
                      paymentMethod: finishedSale.method,
                      interest: 0,
                      total: finishedSale.total,
                      installments: finishedSale.installments,
                      received: finishedSale.received,
                      change: finishedSale.change,
                    }}
                    onPrintComplete={closePostSale}
                  />
                </div>
                <button
                  onClick={closePostSale}
                  className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
