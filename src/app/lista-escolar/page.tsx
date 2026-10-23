'use client';

// Lista de material escolar: a escola ou o cliente manda a lista (texto ou
// foto) e o app monta o orçamento com o que tem em estoque — dá para mandar
// pelo WhatsApp ou levar direto para o PDV.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ClipboardCheck, Copy, GraduationCap, MessageCircle, Save, ShoppingCart } from 'lucide-react';
import Layout, { PageHeader } from '@/components/Layout';
import ListInput from '@/components/lista/ListInput';
import QuoteRow, { type Row } from '@/components/lista/QuoteRow';
import SaveListDialog from '@/components/lista/SaveListDialog';
import OpenSavedList, { type SavedListSummary } from '@/components/lista/OpenSavedList';
import { toSaveItems, type SavedQuoteLine } from '@/lib/savedLists';
import { allocate, quoteMessage, quoteTotals, type QuoteLine } from '@/lib/schoolList';
import { whatsappNumber } from '@/lib/restock';
import { errorText } from '@/lib/friendlyError';
import { loadSettings } from '@/lib/settings';
import { sendToPdv, type PrefillItem } from '@/lib/pdvPrefill';

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
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  // lista salva aberta agora (para o diálogo de salvar já vir preenchido)
  const [openedList, setOpenedList] = useState<{ schoolName: string; grade: string; schoolYear: number; sourceText: string } | null>(null);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setStore(s.companyName || 'loja');
        setAiAvailable(Boolean(s.aiKeySet || s.nvidiaKeySet));
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
    setQuoteSaved(null);
    setOpenedList(null);
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

  const openSaved = (list: SavedListSummary, lines: SavedQuoteLine[], sourceText: string) => {
    setErr(null);
    setRows(
      lines.map((l, i) => ({
        key: `${i}-${l.text}`,
        raw: l.raw,
        text: l.text,
        qty: l.qty,
        skip: false,
        product: l.product,
        options: l.product ? [l.product] : [],
        savedProductId: l.savedProductId,
      })),
    );
    setTitle(`${list.schoolName} — ${list.grade}`);
    setOpenedList({ schoolName: list.schoolName, grade: list.grade, schoolYear: list.schoolYear, sourceText });
  };

  const totals = useMemo(() => quoteTotals(rows), [rows]);
  const takes = useMemo(() => allocate(rows), [rows]);
  const message = () => quoteMessage(store, title.trim(), rows, brl);

  // salva em Orçamentos pedidos (para achar quando o cliente vier buscar)
  const [quoteSaved, setQuoteSaved] = useState<string | null>(null);
  const saveQuote = async () => {
    const name = window.prompt('Nome do cliente para salvar o orçamento:', title.split('—')[0].trim());
    if (!name || !name.trim()) return;
    setErr(null);
    try {
      const r = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          title: title.trim() || 'lista escolar',
          items: rows
            .map((row, i) => ({ qty: row.qty, text: row.text, productId: row.product?.id ?? null, price: row.product?.salePrice ?? null, take: takes[i] ?? 0, skip: row.skip }))
            .filter((i) => !i.skip && i.productId),
          toConfirm: rows.filter((row) => !row.skip && !row.product).map((row) => `${row.qty} × ${row.text}`),
          total: totals.total,
          message: message(),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(errorText(data, 'Não consegui salvar o orçamento'));
      setQuoteSaved(data.data.id);
    } catch (e) {
      setErr(errorText(e, 'Não consegui salvar o orçamento'));
    }
  };

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
    // junta linhas que caíram no mesmo produto (uma linha só no carrinho)
    const byId = new Map<string, PrefillItem>();
    rows.forEach((r, i) => {
      if (!r.product || takes[i] <= 0) return;
      const p = r.product;
      const cur = byId.get(p.id);
      if (cur) cur.qty += takes[i];
      else byId.set(p.id, { id: p.id, name: p.name, code: p.barcode || p.sku || '', price: p.salePrice, stock: p.stock, qty: takes[i] });
    });
    const items = [...byId.values()];
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

        <OpenSavedList onOpen={openSaved} refreshKey={savedCount} />

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
                      take={takes[i] ?? 0}
                      // trocar o produto na tela solta o produto salvo da lista reaberta
                      onChange={(patch) =>
                        setRows((list) =>
                          list.map((x, j) => (j === i ? { ...x, ...patch, ...('product' in patch ? { savedProductId: null } : {}) } : x)),
                        )
                      }
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
                  onClick={() => setSaveOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  <Save className="h-4 w-4 text-primary" /> Salvar como lista da escola
                </button>
                {quoteSaved ? (
                  <a href={`/orcamentos?id=${quoteSaved}`} className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success hover:underline">
                    <ClipboardCheck className="h-4 w-4" /> Orçamento salvo
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={saveQuote}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                  >
                    <ClipboardCheck className="h-4 w-4 text-primary" /> Salvar orçamento
                  </button>
                )}
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

        <SaveListDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          sourceText={openedList ? openedList.sourceText : text}
          items={toSaveItems(rows)}
          initial={openedList ?? undefined}
          onSaved={() => setSavedCount((n) => n + 1)}
        />
      </div>
    </Layout>
  );
}
