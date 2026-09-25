'use client';

// Lista de material escolar: a escola ou o cliente manda a lista (texto ou
// foto) e o app monta o orçamento com o que tem em estoque — dá para mandar
// pelo WhatsApp ou levar direto para o PDV.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, GraduationCap, MessageCircle, ShoppingCart } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import ListInput from '@/components/lista/ListInput';
import QuoteRow, { type Row } from '@/components/lista/QuoteRow';
import { quoteMessage, quoteTotals, type QuoteLine } from '@/lib/schoolList';
import { whatsappNumber } from '@/lib/restock';
import { errorText } from '@/lib/friendlyError';
import { loadSettings } from '@/lib/settings';
import { sendToPdv } from '@/lib/pdvPrefill';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const DRAFT_KEY = 'lacolaria:listaEscolar';

export default function ListaEscolarPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [store, setStore] = useState('loja');
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setStore(s.companyName || 'loja');
        setAiAvailable(Boolean(s.aiKeySet));
      })
      .catch(() => {});
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setText(d);
    } catch {
      /* sem rascunho */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text);
    } catch {
      /* ignora */
    }
  }, [text]);

  const build = async () => {
    setBuilding(true);
    setErr(null);
    try {
      const r = await fetch('/api/school-list/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui montar'));
      const lines: QuoteLine[] = data.data.lines;
      if (!lines.length) throw new Error('Não achei itens na lista — confira o texto');
      setRows(
        lines.map((l, i) => {
          const options = l.candidates.map((c) => c.product);
          return {
            key: `${i}-${l.text}`,
            raw: l.raw,
            text: l.text,
            qty: l.qty,
            skip: false,
            product: options.find((o) => o.id === l.productId) ?? null,
            options,
          };
        }),
      );
    } catch (e) {
      setErr(errorText(e, 'Não consegui montar'));
    } finally {
      setBuilding(false);
    }
  };

  const totals = useMemo(() => quoteTotals(rows), [rows]);
  const message = () => quoteMessage(store, title.trim(), rows, brl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o orçamento:', message());
    }
  };

  const toPdv = () => {
    const items = rows
      .filter((r) => !r.skip && r.product && r.product.stock > 0)
      .map((r) => {
        const p = r.product as NonNullable<Row['product']>;
        return {
          id: p.id,
          name: p.name,
          code: p.barcode || p.sku || '',
          price: p.salePrice,
          stock: p.stock,
          qty: Math.min(r.qty, p.stock),
        };
      });
    if (!items.length) {
      setErr('Nenhum item com estoque para levar ao PDV');
      return;
    }
    sendToPdv(items);
    router.push('/pdv');
  };

  const wa = whatsappNumber(phone);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          eyebrow="Balcão"
          title="Lista escolar"
          subtitle="Cole a lista ou tire uma foto — o orçamento sai com o que tem na loja"
        />

        <ListInput text={text} setText={setText} onBuild={build} building={building} aiAvailable={aiAvailable} />

        {err && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">{err}</div>}

        {rows.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg text-foreground">Orçamento</h2>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Para quem? (ex.: Ana — 3º ano)"
                className="ml-auto w-64 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-2 py-2.5 font-semibold">Qtd.</th>
                    <th className="px-2 py-2.5 font-semibold">Produto da loja</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Estoque</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Preço</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <QuoteRow
                      key={r.key}
                      row={r}
                      onChange={(patch) => setRows((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-accent-soft/40 px-5 py-4">
              <div>
                <p className="font-heading text-3xl font-semibold tabular-nums text-foreground">{brl(totals.total)}</p>
                <p className="text-xs text-muted-foreground">
                  {totals.items} {totals.items === 1 ? 'item' : 'itens'} com estoque
                  {totals.missing > 0 && ` · ${totals.missing} não temos`}
                  {totals.short > 0 && ` · ${totals.short} com estoque curto`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="WhatsApp do cliente (opcional)"
                  inputMode="tel"
                  className="w-56 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <a
                  href={`https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
                </a>
                <button
                  type="button"
                  onClick={toPdv}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ShoppingCart className="h-4 w-4" /> Levar para o PDV
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
