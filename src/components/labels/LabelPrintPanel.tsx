'use client';

import type { ReactNode } from 'react';
import { Barcode, Crosshair, Layers, Loader2, Package, Scissors, Tag } from 'lucide-react';
import { ShelfLabel, type ShelfLabelData } from './ShelfLabel';
import { MAX_OFFSET_MM, PAPERS, type PaperSize, type SheetOptions } from './LabelSheet';

const SMALL_BTN =
  'rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50';
const CARD = 'rounded-xl border border-border bg-card p-4 shadow-sm';
const CAPTION = 'mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground';

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function PaperPicker({ paper, onPaper }: { paper: PaperSize; onPaper: (p: PaperSize) => void }) {
  return (
    <div>
      <div className={CAPTION}>Folha</div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PAPERS) as PaperSize[]).map((k) => (
          <button
            key={k}
            onClick={() => onPaper(k)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              paper === k ? 'border-primary bg-accent-soft text-accent-soft-foreground' : 'border-border hover:bg-muted'
            }`}
          >
            <div className="font-semibold">{k}</div>
            <div className="text-xs text-muted-foreground">
              {PAPERS[k].cols} × {PAPERS[k].rows} = {PAPERS[k].cols * PAPERS[k].rows} por folha
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({ checked, onChange, icon, children }: { checked: boolean; onChange: (v: boolean) => void; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      {icon}
      {children}
    </label>
  );
}

function OffsetInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        step={0.5}
        min={-MAX_OFFSET_MM}
        max={MAX_OFFSET_MM}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-right text-sm tabular-nums text-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}

/** Ajuste fino da posição — compensa o deslocamento da impressora deste PC. */
function Calibration({ options, onChange }: { options: SheetOptions; onChange: (p: Partial<SheetOptions>) => void }) {
  return (
    <details className="rounded-lg border border-border px-3 py-2">
      <summary className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Crosshair className="h-4 w-4 text-muted-foreground" />
        Ajuste fino da posição
        {(options.offsetX !== 0 || options.offsetY !== 0) && (
          <span className="ml-auto text-xs text-muted-foreground">
            {options.offsetX} / {options.offsetY} mm
          </span>
        )}
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <OffsetInput label="Horizontal (mm, + = direita)" value={options.offsetX} onChange={(v) => onChange({ offsetX: v })} />
        <OffsetInput label="Vertical (mm, + = para baixo)" value={options.offsetY} onChange={(v) => onChange({ offsetY: v })} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Imprima uma folha, meça a distância das marcas de corte até a borda e corrija aqui. Fica salvo neste computador.
      </p>
    </details>
  );
}

export interface PanelCounts {
  products: number;
  labels: number;
  withoutBarcode: number;
}

export function LabelPrintPanel({
  options,
  onOptions,
  counts,
  preview,
  generating,
  onGenerateBarcodes,
  onQtyFromStock,
  onResetQty,
  onClear,
}: {
  options: SheetOptions;
  onOptions: (p: Partial<SheetOptions>) => void;
  counts: PanelCounts;
  preview: ShelfLabelData | null;
  generating: boolean;
  onGenerateBarcodes: () => void;
  onQtyFromStock: () => void;
  onResetQty: () => void;
  onClear: () => void;
}) {
  const perSheet = PAPERS[options.paper].cols * PAPERS[options.paper].rows;
  const none = counts.products === 0;
  return (
    <aside className="space-y-4">
      <div className={`space-y-4 ${CARD}`}>
        <PaperPicker paper={options.paper} onPaper={(paper) => onOptions({ paper })} />
        <div className="space-y-2">
          <Check checked={options.cutLines} onChange={(cutLines) => onOptions({ cutLines })} icon={<Scissors className="h-4 w-4 text-muted-foreground" />}>
            Contorno em cada etiqueta
          </Check>
          <Check checked={options.cropMarks} onChange={(cropMarks) => onOptions({ cropMarks })} icon={<Crosshair className="h-4 w-4 text-muted-foreground" />}>
            Marcas de corte na borda da folha
          </Check>
        </div>
        <Calibration options={options} onChange={onOptions} />

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
          <Summary icon={<Package className="h-3.5 w-3.5" />} label="Produtos" value={counts.products} />
          <Summary icon={<Tag className="h-3.5 w-3.5" />} label="Etiquetas" value={counts.labels} />
          <Summary icon={<Layers className="h-3.5 w-3.5" />} label={`Folhas ${options.paper}`} value={Math.ceil(counts.labels / perSheet)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onQtyFromStock} disabled={none} className={SMALL_BTN} title="Uma etiqueta por unidade em estoque">
            Qtd. = estoque
          </button>
          <button onClick={onResetQty} disabled={none} className={SMALL_BTN}>
            1 de cada
          </button>
          <button onClick={onClear} disabled={none} className={SMALL_BTN}>
            Limpar seleção
          </button>
        </div>
      </div>

      {counts.withoutBarcode > 0 && (
        <div className={CARD}>
          <div className="flex items-start gap-2 text-sm text-foreground">
            <Barcode className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <b>{counts.withoutBarcode}</b> produto{counts.withoutBarcode > 1 ? 's' : ''} sem código de barras (a etiqueta usa o SKU).
            </span>
          </div>
          <button onClick={onGenerateBarcodes} disabled={generating} className={`mt-3 flex items-center gap-2 ${SMALL_BTN}`}>
            {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Gerar códigos EAN-13 internos
          </button>
        </div>
      )}

      <div className={CARD}>
        <div className={CAPTION}>Prévia · 3 × 6,5 cm</div>
        {preview ? (
          <div className="flex justify-center overflow-hidden rounded-lg bg-white p-3">
            <ShelfLabel data={preview} cutLines />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um produto para ver a etiqueta.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Na janela de impressão escolha a impressora da folha (não a térmica), papel {options.paper} e escala 100% /
          &ldquo;Tamanho real&rdquo; — &ldquo;Ajustar à página&rdquo; muda o tamanho da etiqueta.
        </p>
      </div>
    </aside>
  );
}
