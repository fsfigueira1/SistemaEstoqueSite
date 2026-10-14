'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { ProductStatus } from '@/generated/prisma/enums';
import Layout from '@/components/Layout';
import { PAPERS } from '@/components/labels/LabelSheet';
import { LabelPrintArea } from '@/components/labels/LabelPrintArea';
import { LabelPrintPanel } from '@/components/labels/LabelPrintPanel';
import { LabelFiltersBar, LabelProductTable, type LabelFilters } from '@/components/labels/LabelProductTable';
import { useLabelSelection } from '@/components/labels/useLabelSelection';
import { useLabelCatalog } from '@/components/labels/useLabelCatalog';
import { useSheetOptions } from '@/components/labels/useSheetOptions';
import { buildSearchIndex, productSearchFields } from '@/lib/smartSearch';
import { expandLabels, toLabel, toNumber, type LabelInfoMap, type LabelProduct } from '@/components/labels/labelProducts';

const INITIAL_FILTERS: LabelFilters = {
  search: '',
  categoryId: 'all',
  status: ProductStatus.ACTIVE,
  inStockOnly: false,
  printState: 'all',
};

/** Acima disso pede confirmação — milhares de etiquetas travam a tela. */
const CONFIRM_SHEETS = 20;

function matches(p: LabelProduct, f: LabelFilters, info: LabelInfoMap): boolean {
  if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) return false;
  if (f.status !== 'all' && p.status !== f.status) return false;
  if (f.inStockOnly && toNumber(p.stockQuantity) <= 0) return false;
  const i = info.get(p.id);
  if (f.printState === 'changed' && i?.state !== 'changed') return false;
  if (f.printState === 'never' && i && i.state !== 'never') return false;
  return !(f.printState === 'promo' && !(i && i.activeCompareAt > 0));
}

/** ?produtos=id1,id2 (vindo do cadastro) e ?filtro=alterados (vindo do Painel). */
function useUrlPreselect(
  ready: boolean,
  info: LabelInfoMap,
  selectIds: (ids: string[]) => void,
  setFilters: (f: (prev: LabelFilters) => LabelFilters) => void,
) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    const ids = (q.get('produtos') ?? '').split(',').filter(Boolean);
    if (ids.length) {
      selectIds(ids);
      setFilters((f) => ({ ...f, status: 'all' }));
    }
    if (q.get('filtro') === 'alterados') {
      setFilters((f) => ({ ...f, printState: 'changed' }));
      selectIds([...info.values()].filter((i) => i.state === 'changed').map((i) => i.productId));
    }
  }, [ready, info, selectIds, setFilters]);
}

// Etiquetas de gôndola: escolhe os produtos (e quantas de cada), imprime em
// folha A4/A3 com as etiquetas de 3 x 6,5cm encostadas, para o corte depois.
export default function EtiquetasPage() {
  const { products, categories, info, loading, reloadInfo, reloadProducts } = useLabelCatalog();
  const [filters, setFilters] = useState<LabelFilters>(INITIAL_FILTERS);
  const sel = useLabelSelection();
  const { options, patch: patchOptions } = useSheetOptions();
  const [printing, setPrinting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useUrlPreselect(!loading, info, sel.selectIds, setFilters);

  const searchIndex = useMemo(() => buildSearchIndex(products, productSearchFields), [products]);
  const filtered = useMemo(
    () => searchIndex.search(filters.search).filter((p) => matches(p, filters, info)),
    [searchIndex, filters, info],
  );
  const labels = useMemo(() => expandLabels(products, sel.selection, info), [products, sel.selection, info]);
  const allSelected = filtered.length > 0 && filtered.every((p) => sel.selection.has(p.id));
  const previewProduct = products.find((p) => sel.selection.has(p.id)) ?? filtered[0];
  const withoutBarcode = products.filter((p) => !(p.barcode ?? '').trim()).length;
  const sheets = Math.ceil(labels.length / (PAPERS[options.paper].cols * PAPERS[options.paper].rows));

  const patchFilters = useCallback((patch: Partial<LabelFilters>) => setFilters((f) => ({ ...f, ...patch })), []);

  const startPrint = () => {
    if (sheets > CONFIRM_SHEETS && !window.confirm(`São ${labels.length} etiquetas (${sheets} folhas ${options.paper}). Imprimir mesmo assim?`)) return;
    setNotice(null);
    setPrinting(true);
  };

  const selectedIds = useMemo(() => [...sel.selection.keys()], [sel.selection]);
  const donePrinting = useCallback(
    async (printed: boolean) => {
      setPrinting(false);
      if (!printed) return;
      try {
        await fetch('/api/labels/printed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: selectedIds }),
        });
        await reloadInfo();
      } catch {
        /* sem registro, o aviso de "reimprimir" só fica desatualizado */
      }
    },
    [selectedIds, reloadInfo],
  );

  const generateBarcodes = async () => {
    if (!window.confirm(`Gerar um código de barras EAN-13 interno para ${withoutBarcode} produto(s) sem código? O SKU continua valendo no leitor.`)) return;
    setGenerating(true);
    try {
      const r = await fetch('/api/labels/barcodes', { method: 'POST' }).then((x) => x.json());
      setNotice(r?.success ? `${r.data.updated} código(s) gerado(s).` : r?.error || 'Não foi possível gerar os códigos.');
      await reloadProducts();
    } catch {
      setNotice('Sem conexão com o servidor.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Etiquetas de Gôndola</h1>
            <p className="text-sm text-muted-foreground">
              Preço, informações e código de barras · etiqueta de 3 × 6,5 cm em folha A4 ou A3
            </p>
          </div>
          <button
            onClick={startPrint}
            disabled={!labels.length || printing}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir {labels.length ? `${labels.length} etiqueta${labels.length > 1 ? 's' : ''}` : 'etiquetas'}
          </button>
        </div>

        {notice && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm">{notice}</div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <LabelFiltersBar filters={filters} categories={categories} onChange={patchFilters} />
            <LabelProductTable
              products={filtered}
              info={info}
              loading={loading}
              selection={sel.selection}
              allSelected={allSelected}
              onToggle={sel.toggle}
              onToggleAll={() => sel.toggleAll(filtered, allSelected)}
              onQty={sel.setQty}
            />
          </div>

          <LabelPrintPanel
            options={options}
            onOptions={patchOptions}
            counts={{ products: sel.selection.size, labels: labels.length, withoutBarcode }}
            preview={previewProduct ? toLabel(previewProduct, info.get(previewProduct.id)) : null}
            generating={generating}
            onGenerateBarcodes={generateBarcodes}
            onQtyFromStock={() => sel.qtyFromStock(products)}
            onResetQty={sel.resetQty}
            onClear={sel.clear}
          />
        </div>
      </div>

      {printing && <LabelPrintArea labels={labels} options={options} onDone={donePrinting} />}
    </Layout>
  );
}
