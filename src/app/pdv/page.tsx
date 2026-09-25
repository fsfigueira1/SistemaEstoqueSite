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
  WifiOff,
  PlusCircle,
} from 'lucide-react';
import { ReceiptPrint } from '@/components/pdv/ReceiptPrint';
import Layout from '@/components/Layout';
import { getSettings, loadSettings, type StoreSettings } from '@/lib/settings';
import {
  findByBarcode,
  searchProducts,
  refreshProductCache,
  applyLocalStockDelta,
  type CachedProduct,
} from '@/lib/offline/productCache';
import { enqueueSale } from '@/lib/offline/saleQueue';
import { useOfflineStatus } from '@/components/OfflineSync';
import { errorText } from '@/lib/friendlyError';
import PaymentPanel from '@/components/pdv/PaymentPanel';
import { planPayments, toCheckoutPayments, type PartInput, type PlannedPart } from '@/lib/payments';

const CASH_KEY = 'lacolaria:lastCashSessionId';

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError')
  );
}

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
  /** true = produto avulso, não cadastrado no catálogo (não baixa estoque) */
  avulso?: boolean;
};

// Produto avulso: não vem do catálogo (ex.: laço sem código de barras).
// Usa um id determinístico (nome+preço) pra dois "adiciona" iguais virarem
// a mesma linha no carrinho, como já acontece com produto de catálogo.
const ADHOC_ID_PREFIX = 'avulso:';
const ADHOC_STOCK = 999999;
function adhocId(nome: string, preco: number): string {
  return `${ADHOC_ID_PREFIX}${nome.trim().toLowerCase()}::${preco}`;
}

type PaymentMethodUI = 'dinheiro' | 'pix' | 'cartao';

// forma no formato antigo do comprovante (o novo usa a lista `payments`)
const RECEIPT_METHOD: Record<string, PaymentMethodUI> = {
  CASH: 'dinheiro',
  PIX: 'pix',
  DEBIT_CARD: 'cartao',
  CREDIT_CARD: 'cartao',
};

function cachedToApi(p: CachedProduct): ApiProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    salePrice: p.salePrice,
    stockQuantity: p.stockQuantity,
  };
}

// ----- Componente -----
export default function PDVPage() {
  const [cfg, setCfg] = useState<StoreSettings>(() => getSettings());
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'added' | 'not-found'>('ready');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ApiProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const [avulsoOpen, setAvulsoOpen] = useState(false);
  const [avulsoNome, setAvulsoNome] = useState('');
  const [avulsoPreco, setAvulsoPreco] = useState('');

  const [parts, setParts] = useState<PartInput[]>([{ method: 'CASH' }]);
  const [valorRecebido, setValorRecebido] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const { online, pending } = useOfflineStatus();

  // Pós-venda
  const [finishedSale, setFinishedSale] = useState<null | {
    saleId: string;
    saleNumber: string;
    date: Date;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    interest: number;
    total: number;
    payments: PlannedPart[];
    received: number;
    change: number;
  }>(null);
  const [printing, setPrinting] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  // após uma falha de rede, assume offline por 60s (não espera o timeout de novo)
  const offlineUntilRef = useRef(0);

  useEffect(() => {
    barcodeRef.current?.focus();
    loadSettings().then(setCfg);
    // garante o catálogo em cache pro PDV funcionar se a internet cair
    refreshProductCache().catch(() => {});
  }, []);

  // Diálogo pós-venda: foco no botão principal e Esc para fechar.
  useEffect(() => {
    if (!finishedSale) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFinishedSale(null);
        setPrinting(false);
        barcodeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finishedSale]);

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
          avulso: p.id.startsWith(ADHOC_ID_PREFIX),
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
      let product: ApiProduct | null = null;
      let serverAnswered = false;
      try {
        const res = await fetchWithTimeout(`/api/products/barcode/${encodeURIComponent(code)}`, {}, 2500);
        if (res.status >= 500) throw new Error('server');
        const data = await res.json();
        serverAnswered = true;
        if (res.ok && data.success && data.data) product = data.data as ApiProduct;
      } catch {
        // servidor fora / sem internet: cai no cache local
        const c = await findByBarcode(code);
        product = c ? cachedToApi(c) : null;
      }
      if (product) {
        addToCart(product);
        setScanStatus('added');
        setBarcode('');
      } else {
        setScanStatus('not-found');
        setError(
          serverAnswered
            ? 'Produto não encontrado para esse código'
            : 'Produto não encontrado (sem internet, buscando no catálogo em cache)',
        );
      }
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
      setSearchError(false);
      return;
    }
    setSearching(true);
    setSearchError(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/products?search=${encodeURIComponent(term)}&limit=8&status=ACTIVE`,
          {},
          2500,
        );
        if (!res.ok) throw new Error('server');
        const data = await res.json();
        const list: ApiProduct[] = data?.data?.products ?? [];
        setSearchResults(list);
        setHighlight(list.length > 0 ? 0 : -1);
        setSearchError(false);
      } catch {
        // sem internet: busca no catálogo em cache
        const cached = await searchProducts(term, 8);
        setSearchResults(cached.map(cachedToApi));
        setHighlight(cached.length > 0 ? 0 : -1);
        setSearchError(cached.length === 0);
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

  // ---------- Produto avulso (sem cadastro, não baixa estoque) ----------
  const addAvulso = () => {
    const nome = avulsoNome.trim();
    const preco = toNumber(avulsoPreco);
    setError(null);
    if (!nome) {
      setError('Digite o nome do produto avulso');
      return;
    }
    if (!(preco > 0)) {
      setError('Digite um preço válido para o produto avulso');
      return;
    }
    addToCart({
      id: adhocId(nome, preco),
      name: nome,
      sku: 'AVULSO',
      barcode: null,
      salePrice: preco,
      stockQuantity: ADHOC_STOCK,
    });
    setAvulsoNome('');
    setAvulsoPreco('');
    setAvulsoOpen(false);
    barcodeRef.current?.focus();
  };

  // ---------- Totais ----------
  const subtotal = Math.round(carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
  const recebido = toNumber(valorRecebido);
  // pagamento: uma forma ou dividido (contas em src/lib/payments.ts)
  const plan = planPayments(
    subtotal,
    parts,
    {
      cardInterestPercent: cfg.cardInterestPercent || 0,
      cardInterestFromInstallments: cfg.cardInterestFromInstallments || 2,
    },
    recebido || null,
  );
  const juros = plan.interest;
  const total = plan.total;
  const troco = plan.change;

  // ---------- Sessão de caixa ----------
  // Online: resolve/abre a sessão e guarda o id. Offline: devolve o último id
  // conhecido (ou null) — o servidor reaponta pra sessão aberta no flush.
  async function ensureCashSession(): Promise<string | null> {
    const remember = (id: string) => {
      try {
        localStorage.setItem(CASH_KEY, id);
      } catch {
        /* ignora */
      }
      return id;
    };
    try {
      const cur = await fetchWithTimeout('/api/cash-session/current', {}, 3000).then((r) => r.json());
      if (cur?.success && cur.data?.id) return remember(cur.data.id);

      const regsRes = await fetchWithTimeout('/api/cash-session/open', {}, 3000).then((r) => r.json());
      const registers: Array<{ id: string }> = regsRes?.data ?? [];
      if (registers.length === 0) throw new Error('Nenhum caixa cadastrado no sistema');

      const openRes = await fetchWithTimeout('/api/cash-session/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashRegisterId: registers[0].id, openingAmount: 0 }),
      }).then((r) => r.json());

      if (!openRes?.success || !openRes.data?.id) {
        throw new Error(errorText(openRes, 'Falha ao abrir a sessão de caixa'));
      }
      return remember(openRes.data.id);
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          return localStorage.getItem(CASH_KEY);
        } catch {
          return null;
        }
      }
      throw err;
    }
  }

  const resetAfterSale = () => {
    setCarrinho([]);
    setBarcode('');
    setValorRecebido('');
    setParts([{ method: 'CASH' }]);
    setScanStatus('ready');
  };

  // ---------- Finalizar venda ----------
  const finalizarVenda = async () => {
    if (carrinho.length === 0) {
      setError('O carrinho está vazio');
      return;
    }
    if (plan.error) {
      setError(plan.error);
      return;
    }
    setIsProcessing(true);
    setError(null);
    setSavedOffline(false);

    // Item avulso: manda productId null + name (o backend não busca no
    // catálogo, não baixa estoque). Item de catálogo: manda productId normal.
    const items = carrinho.map((i) =>
      i.avulso
        ? { productId: null, name: i.nome, quantity: i.quantidade, unitPrice: i.preco }
        : { productId: i.id, quantity: i.quantidade, unitPrice: i.preco },
    );
    const receiptItems = carrinho.map((i) => ({
      name: i.nome,
      quantity: i.quantidade,
      unitPrice: i.preco,
      total: i.preco * i.quantidade,
    }));
    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const occurredAt = new Date().toISOString();
    const payments = toCheckoutPayments(plan);
    const changeAmount = troco > 0 ? troco : undefined;
    const received = plan.cashPart > 0 ? recebido || plan.cashPart : 0;

    // Salva na fila local e mostra o comprovante (dados 100% locais).
    const queueIt = async (cashSessionId: string | null) => {
      await enqueueSale({
        clientId,
        occurredAt,
        payload: { cashSessionId, items, surchargeAmount: juros || undefined, payments, changeAmount },
      });
      // Produto avulso não existe no cache de catálogo — nada a abater.
      await applyLocalStockDelta(
        carrinho.filter((i) => !i.avulso).map((i) => ({ productId: i.id, quantity: i.quantidade })),
      );
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      setFinishedSale({
        saleId: clientId.slice(0, 8),
        saleNumber: `V${ymd}-${clientId.replace(/-/g, '').slice(0, 5).toUpperCase()}`,
        date: now,
        items: receiptItems,
        subtotal,
        interest: juros,
        total,
        payments: plan.parts,
        received,
        change: troco,
      });
      setSavedOffline(true);
      resetAfterSale();
    };

    try {
      let cashSessionId: string | null = null;
      try {
        cashSessionId = await ensureCashSession();
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }

      // Já sem internet (ou falhou há pouco): vai direto pra fila, sem esperar.
      const assumeOffline =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        Date.now() < offlineUntilRef.current;
      if (assumeOffline) {
        await queueIt(cashSessionId);
        return;
      }

      let res: Response;
      try {
        res = await fetchWithTimeout(
          '/api/sales/checkout',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId,
              occurredAt,
              cashSessionId,
              items,
              surchargeAmount: juros || undefined,
              payments,
              changeAmount,
            }),
          },
          12000,
        );
      } catch (err) {
        // timeout / sem rede no meio: guarda na fila e assume offline por 60s
        if (isNetworkError(err)) {
          offlineUntilRef.current = Date.now() + 60_000;
          await queueIt(cashSessionId);
          return;
        }
        throw err;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          errorText(data, 'Venda não finalizada'),
        );
      }
      offlineUntilRef.current = 0; // deu certo — voltou a ter internet
      const sale = data.data;
      const serverTotal = toNumber(sale.totalAmount);

      setFinishedSale({
        saleId: sale.id,
        saleNumber: sale.saleNumber ?? sale.id.slice(0, 8),
        date: new Date(),
        items: receiptItems,
        subtotal: Math.max(0, serverTotal - juros),
        interest: juros,
        total: serverTotal,
        payments: plan.parts,
        received,
        change: troco,
      });
      resetAfterSale();
    } catch (err) {
      setError(errorText(err, 'Venda não finalizada'));
    } finally {
      setIsProcessing(false);
    }
  };

  const closePostSale = () => {
    setFinishedSale(null);
    setPrinting(false);
    setSavedOffline(false);
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
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Ponto de Venda</h1>
            <span className="mt-1.5 block h-1 w-14 rounded-full bg-primary" />
          </div>
          <div
            className={`flex shrink-0 items-center gap-2 text-sm ${
              online ? 'text-muted-foreground' : 'font-medium text-danger'
            }`}
          >
            {online ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
            ) : (
              <WifiOff className="h-4 w-4 shrink-0" />
            )}
            <span className={online && pending === 0 ? 'hidden sm:inline' : ''}>
              {online ? 'Sistema online' : 'Sem conexão'}
              {pending > 0 && (
                <span className={online ? 'text-warning-foreground' : ''}>
                  {' · '}
                  {pending} venda{pending > 1 ? 's' : ''} na fila
                </span>
              )}
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Carrinho — em cima, largura toda, letras maiores pro cliente ver o preço */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Carrinho ({carrinho.length})</h2>
            </div>

            {carrinho.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-14 text-center">
                <ShoppingCart className="mx-auto mb-2 h-9 w-9 text-muted-foreground/60" />
                <p className="text-base font-medium text-muted-foreground">Carrinho vazio</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Leia um código ou busque um produto
                </p>
              </div>
            ) : (
              <div className="grid max-h-[45vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {carrinho.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{i.nome}</p>
                        {i.avulso ? (
                          <span className="pill pill-warn mt-0.5 inline-block">Avulso</span>
                        ) : (
                          <p className="text-xs text-muted-foreground">{i.codigo}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i.id)}
                        className="rounded-md p-1 text-danger transition-colors hover:bg-danger/10"
                        aria-label={`Remover ${i.nome} do carrinho`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(i.id, -1)}
                          aria-label={`Diminuir a quantidade de ${i.nome}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-base leading-none text-foreground transition-colors hover:bg-border"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-base font-medium tabular-nums">{i.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => setQty(i.id, 1)}
                          disabled={i.quantidade >= i.estoque}
                          aria-label={`Aumentar a quantidade de ${i.nome}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-base leading-none text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-muted"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-lg font-bold tabular-nums text-foreground">
                        {formatCurrency(i.preco * i.quantidade)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Embaixo: leitor+busca (esquerda) e pagamento+finalizar (direita), lado a lado */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Leitor + busca */}
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Leitor de código de barras</h2>
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
                  <span className={`pill ${statusPill[0]}`}>{statusPill[1]}</span>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Buscar produto por nome</h2>
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

                {searchTerm.trim().length >= 2 && !searching && searchError && (
                  <p className="mt-3 text-sm text-danger">
                    Não foi possível buscar agora. Verifique a conexão e tente de novo.
                  </p>
                )}

                {searchTerm.trim().length >= 2 && !searching && !searchError && searchResults.length === 0 && (
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
                          <p className="font-semibold tabular-nums text-foreground">{formatCurrency(p.salePrice)}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">estoque {toNumber(p.stockQuantity)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <button
                  type="button"
                  onClick={() => setAvulsoOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Produto avulso</h2>
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {avulsoOpen ? 'Fechar' : 'Adicionar'}
                  </span>
                </button>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para item sem cadastro (ex.: laço variado, sem código de barras). Não baixa
                  estoque — só entra nessa venda e no comprovante.
                </p>

                {avulsoOpen && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Nome</label>
                      <input
                        type="text"
                        value={avulsoNome}
                        onChange={(e) => setAvulsoNome(e.target.value)}
                        placeholder="Ex.: Laço fita dupla rosa"
                        autoComplete="off"
                        className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-ring focus:ring-2 focus:ring-ring/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Preço</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={avulsoPreco}
                        onChange={(e) => setAvulsoPreco(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAvulso();
                          }
                        }}
                        placeholder="0,00"
                        autoComplete="off"
                        className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-ring focus:ring-2 focus:ring-ring/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addAvulso}
                      className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
                    >
                      Adicionar ao carrinho
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* Pagamento + finalizar */}
            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Pagamento</h2>
                </div>
                <PaymentPanel
                  parts={parts}
                  setParts={setParts}
                  received={valorRecebido}
                  setReceived={setValorRecebido}
                  plan={plan}
                  subtotal={subtotal}
                  interestPercent={cfg.cardInterestPercent || 0}
                />

                <button
                  type="button"
                  onClick={finalizarVenda}
                  disabled={isProcessing || carrinho.length === 0}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-heading text-base font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
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
      </div>

      {/* Pós-venda: imprimir comprovante ou não */}
      {finishedSale && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="postsale-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePostSale();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            {!printing ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-primary" />
                    <h2 id="postsale-title" className="text-xl font-bold text-foreground">
                      {savedOffline ? 'Venda salva (sem internet)' : 'Venda finalizada'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closePostSale}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Fechar"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                {savedOffline ? (
                  <p className="text-sm text-muted-foreground">
                    Sem internet agora. A venda entrou na <span className="font-medium">fila local</span> e
                    sobe pro sistema sozinha quando a conexão voltar. O estoque foi ajustado aqui no
                    balcão. Pode imprimir o comprovante normalmente.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Venda <span className="font-medium">{finishedSale.saleNumber}</span> concluída.
                    O estoque dos produtos já foi atualizado.
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  Total: <span className="font-semibold">{formatCurrency(finishedSale.total)}</span>
                  {finishedSale.change > 0 && <> · Troco: {formatCurrency(finishedSale.change)}</>}
                </p>

                <p className="mt-4 text-sm font-medium text-foreground">Imprimir comprovante de compra?</p>
                <div className="mt-3 flex gap-3">
                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={() => setPrinting(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={closePostSale}
                    className="flex-1 rounded-lg border border-border px-4 py-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Concluir sem imprimir
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-primary" />
                  <h2 id="postsale-title" className="text-lg font-semibold text-foreground">
                    Imprimindo comprovante…
                  </h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Se não sair nada, escolha a impressora na bandeja do Windows →
                  “Escolher impressora do comprovante…”.
                </p>
                {/* markup do comprovante para o CSS de impressão; some sozinho ao fechar */}
                <div className="h-0 overflow-hidden">
                  <ReceiptPrint
                    autoPrint
                    showButton={false}
                    data={{
                      saleId: finishedSale.saleNumber,
                      date: finishedSale.date,
                      items: finishedSale.items,
                      subtotal: finishedSale.subtotal,
                      paymentMethod: RECEIPT_METHOD[finishedSale.payments[0]?.method ?? 'CASH'] ?? 'dinheiro',
                      payments: finishedSale.payments.map((p) => ({
                        method: p.method,
                        amount: p.amount,
                        installments: p.installments,
                        installmentValue: p.installmentValue,
                      })),
                      interest: finishedSale.interest,
                      total: finishedSale.total,
                      received: finishedSale.received,
                      change: finishedSale.change,
                    }}
                    onPrintComplete={closePostSale}
                  />
                </div>
                <button
                  type="button"
                  onClick={closePostSale}
                  className="mt-4 w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
