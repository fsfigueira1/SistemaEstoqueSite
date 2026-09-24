'use client';

// Painel "Preço de mercado" do cadastro de produto.
// Bipou o código (ou digitou o nome) → a IA pesquisa o produto em papelarias e
// lojas do Brasil e devolve uma direção de preço para esta loja.
//
// - Produto novo com código de barras válido: pesquisa sozinho (uma vez por código).
// - Produto existente: mostra a última pesquisa salva (grátis) e o aviso de
//   "mercado em alta"; nova pesquisa só no botão.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, RotateCcw, ExternalLink, TrendingUp, Store, Globe, Check } from 'lucide-react';
import type { PriceAdvice } from '@/lib/priceAdvice';
import { isValidGtin } from '@/lib/priceAdvice';
import { getSettings, loadSettings } from '@/lib/settings';
import { errorText } from '@/lib/friendlyError';

const brl = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

const CONF: Record<PriceAdvice['confidence'], { label: string; cls: string }> = {
  alta: { label: 'Confiança alta', cls: 'pill-ok' },
  media: { label: 'Confiança média', cls: 'pill-warn' },
  baixa: { label: 'Confiança baixa', cls: 'pill-muted' },
};

export default function PriceAdvisor({
  barcode,
  name,
  costPrice,
  currentPrice,
  productId,
  onUsePrice,
  onUseName,
}: {
  barcode: string;
  name: string;
  costPrice: number;
  currentPrice: number;
  /** Produto já cadastrado (edição). */
  productId?: string | null;
  onUsePrice: (price: number) => void;
  onUseName: (name: string) => void;
}) {
  const [keySet, setKeySet] = useState<boolean>(() => Boolean(getSettings().aiKeySet));
  const [alertPct, setAlertPct] = useState<number>(() => getSettings().priceAlertPercent ?? 10);
  const [advice, setAdvice] = useState<PriceAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usedPrice, setUsedPrice] = useState(false);
  const autoDone = useRef<string | null>(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    loadSettings().then((s) => {
      setKeySet(Boolean(s.aiKeySet));
      setAlertPct(s.priceAlertPercent ?? 10);
    });
  }, []);

  const code = barcode.trim();
  const canSearch = Boolean(code || name.trim());

  const run = useCallback(
    async (force = false) => {
      if (!code && !nameRef.current.trim()) return;
      setLoading(true);
      setErr(null);
      setUsedPrice(false);
      try {
        const res = await fetch('/api/price-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: code || null,
            name: nameRef.current.trim() || null,
            productId: productId ?? null,
            costPrice: costPrice > 0 ? costPrice : null,
            currentPrice: currentPrice > 0 ? currentPrice : null,
            force,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(errorText(data, 'Pesquisa indisponível'));
        const a: PriceAdvice = data.data;
        setAdvice(a);
        // cadastro novo sem nome: já preenche com o nome achado
        if (a.productName && !nameRef.current.trim()) onUseName(a.productName);
      } catch (e) {
        setErr(errorText(e, 'Pesquisa indisponível'));
      } finally {
        setLoading(false);
      }
    },
    [code, productId, costPrice, currentPrice, onUseName],
  );

  // produto existente: mostra a última pesquisa salva (não gasta crédito)
  useEffect(() => {
    if (!productId) return;
    const q = new URLSearchParams({ productId });
    if (currentPrice > 0) q.set('currentPrice', String(currentPrice));
    if (costPrice > 0) q.set('costPrice', String(costPrice));
    fetch(`/api/price-suggestion?${q}`)
      .then((r) => r.json())
      .then((d) => d?.success && d.data && setAdvice(d.data))
      .catch(() => {});
    // só ao abrir o produto (preços mudam enquanto a pessoa digita)
  }, [productId]);

  // produto novo: bipou um código de barras comercial válido → pesquisa sozinho
  useEffect(() => {
    if (productId || !keySet || !isValidGtin(code) || code.startsWith('2')) return;
    if (autoDone.current === code) return;
    const t = setTimeout(() => {
      autoDone.current = code;
      run(false);
    }, 700);
    return () => clearTimeout(t);
  }, [code, productId, keySet, run]);

  const marketAbove =
    advice?.market.median && currentPrice > 0 ? Math.round((advice.market.median / currentPrice - 1) * 100) : null;
  const rising = marketAbove != null && marketAbove >= alertPct;
  // margem sempre com o custo que está no formulário agora
  const margin =
    advice?.suggested && costPrice > 0 ? Math.round(((advice.suggested - costPrice) / advice.suggested) * 100) : null;
  const showName = advice?.productName && advice.productName.trim().toLowerCase() !== name.trim().toLowerCase();

  return (
    <section className="overflow-hidden rounded-xl border border-bow/25 bg-bow-soft/40">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-bow p-1.5 text-bow-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Preço de mercado</p>
            <p className="text-[11px] text-muted-foreground">Pesquisa com IA em papelarias e lojas</p>
          </div>
        </div>
        {keySet && (
          <button
            type="button"
            onClick={() => run(Boolean(advice))}
            disabled={!canSearch || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bow/30 bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-bow/60 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : advice ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-bow" />
            )}
            {advice ? 'Pesquisar de novo' : 'Sugerir preço'}
          </button>
        )}
      </div>

      <div className="border-t border-bow/15 bg-card/70 px-4 py-3 text-sm">
        {!keySet ? (
          <p className="text-muted-foreground">
            Para a IA sugerir preços, cole a chave do Claude em{' '}
            <Link href="/configuracoes#ia" className="font-medium text-primary hover:underline">
              Configurações
            </Link>
            .
          </p>
        ) : loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-bow" />
            Pesquisando {code ? `o código ${code}` : `“${name.trim()}”`} no mercado… pode levar até 1 minuto.
          </p>
        ) : err ? (
          <p className="font-medium text-danger">{err}</p>
        ) : !advice ? (
          <p className="text-muted-foreground">
            {canSearch
              ? 'Toque em “Sugerir preço” para ver quanto as lojas cobram e um preço para a sua loja.'
              : 'Bipe o código de barras ou digite o nome do produto.'}
          </p>
        ) : (
          <div className="space-y-3">
            {showName && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                <p className="min-w-0 text-foreground">
                  <span className="text-xs text-muted-foreground">Produto encontrado: </span>
                  {advice.productName}
                  {advice.brand && <span className="text-muted-foreground"> · {advice.brand}</span>}
                </p>
                <button
                  type="button"
                  onClick={() => advice.productName && onUseName(advice.productName)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Usar este nome
                </button>
              </div>
            )}

            {advice.suggested ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Sugestão para a sua loja</p>
                  <p className="font-heading text-3xl font-semibold tabular-nums text-foreground">{brl(advice.suggested)}</p>
                  {advice.range.min && advice.range.max && (
                    <p className="text-xs text-muted-foreground">
                      Faixa boa: {brl(advice.range.min)} a {brl(advice.range.max)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (advice.suggested) onUsePrice(advice.suggested);
                    setUsedPrice(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {usedPrice ? <Check className="h-4 w-4" /> : null}
                  {usedPrice ? 'Preço aplicado' : `Usar ${brl(advice.suggested)}`}
                </button>
              </div>
            ) : (
              <p className="font-medium text-foreground">Não achei preço confiável para sugerir.</p>
            )}

            {advice.direction && <p className="text-foreground/90">{advice.direction}</p>}

            <div className="flex flex-wrap gap-1.5">
              {advice.market.min && advice.market.max && (
                <span className="pill pill-muted">
                  Mercado {brl(advice.market.min)} – {brl(advice.market.max)}
                </span>
              )}
              <span className={`pill ${CONF[advice.confidence].cls}`}>{CONF[advice.confidence].label}</span>
              {margin != null && (
                <span className={`pill ${margin < 25 ? 'pill-warn' : 'pill-ok'}`}>Margem {margin}%</span>
              )}
              {rising && (
                <span className="pill pill-bow">
                  <TrendingUp className="h-3 w-3" /> Mercado {marketAbove}% acima do seu preço
                </span>
              )}
            </div>

            {advice.sources.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Ver {advice.sources.length} {advice.sources.length === 1 ? 'fonte' : 'fontes'}
                </summary>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {advice.sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      {s.tipo === 'fisica' ? (
                        <Store className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Loja física" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Loja online" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-foreground">{s.loja}</span>
                      {s.preco > 0 && <span className="tabular-nums text-foreground">{brl(s.preco)}</span>}
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Abrir">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-[11px] text-muted-foreground">
              Pesquisado {ago(advice.checkedAt)}
              {advice.cached ? ' · resultado salvo, sem custo' : ''}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
