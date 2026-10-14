'use client';

import { LABEL_H_MM, LABEL_W_MM, ShelfLabel, type ShelfLabelData } from './ShelfLabel';

/** Folhas suportadas: grade de etiquetas encostadas, centralizada na folha. */
export const PAPERS = {
  A4: { w: 210, h: 297, cols: 3, rows: 9 },
  A3: { w: 297, h: 420, cols: 4, rows: 13 },
} as const;
export type PaperSize = keyof typeof PAPERS;

export interface SheetOptions {
  paper: PaperSize;
  /** Contorno cinza em cada etiqueta. */
  cutLines: boolean;
  /** Marcas de corte na margem da folha, alinhadas às divisões da grade. */
  cropMarks: boolean;
  /** Ajuste fino da posição da grade, em mm (+ = direita / para baixo). */
  offsetX: number;
  offsetY: number;
}

/** Limite do ajuste fino: mais que isso empurra a grade para fora da folha. */
export const MAX_OFFSET_MM = 5;

const MARK_GAP = 1.5; // distância entre a grade e a marca
const MARK_LEN = 4;

export function gridOrigin(o: Pick<SheetOptions, 'paper' | 'offsetX' | 'offsetY'>) {
  const p = PAPERS[o.paper];
  return {
    x: (p.w - p.cols * LABEL_W_MM) / 2 + o.offsetX,
    y: (p.h - p.rows * LABEL_H_MM) / 2 + o.offsetY,
  };
}

function CropMarks({ options }: { options: SheetOptions }) {
  const p = PAPERS[options.paper];
  const { x, y } = gridOrigin(options);
  const gridW = p.cols * LABEL_W_MM;
  const gridH = p.rows * LABEL_H_MM;
  const lines: Array<[number, number, number, number]> = [];
  for (let c = 0; c <= p.cols; c++) {
    const lx = x + c * LABEL_W_MM;
    lines.push([lx, y - MARK_GAP - MARK_LEN, lx, y - MARK_GAP]);
    lines.push([lx, y + gridH + MARK_GAP, lx, y + gridH + MARK_GAP + MARK_LEN]);
  }
  for (let r = 0; r <= p.rows; r++) {
    const ly = y + r * LABEL_H_MM;
    lines.push([x - MARK_GAP - MARK_LEN, ly, x - MARK_GAP, ly]);
    lines.push([x + gridW + MARK_GAP, ly, x + gridW + MARK_GAP + MARK_LEN, ly]);
  }
  return (
    <svg
      width={`${p.w}mm`}
      height={`${p.h}mm`}
      viewBox={`0 0 ${p.w} ${p.h}`}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={0.2} />
      ))}
    </svg>
  );
}

/** Folha inteira (A4/A3) com as etiquetas encostadas, prontas para o corte. */
export function LabelSheet({
  labels,
  options,
  last = false,
}: {
  labels: ShelfLabelData[];
  options: SheetOptions;
  /** Última folha: sem quebra depois, senão sai uma página em branco. */
  last?: boolean;
}) {
  const p = PAPERS[options.paper];
  const { x, y } = gridOrigin(options);
  return (
    <div
      style={{
        position: 'relative',
        width: `${p.w}mm`,
        height: `${p.h}mm`,
        overflow: 'hidden',
        background: '#fff',
        breakAfter: last ? 'auto' : 'page',
      }}
    >
      {options.cropMarks && <CropMarks options={options} />}
      <div
        style={{
          position: 'absolute',
          left: `${x}mm`,
          top: `${y}mm`,
          display: 'grid',
          gridTemplateColumns: `repeat(${p.cols}, ${LABEL_W_MM}mm)`,
          gridAutoRows: `${LABEL_H_MM}mm`,
        }}
      >
        {labels.map((l, i) => (
          <ShelfLabel key={i} data={l} cutLines={options.cutLines} />
        ))}
      </div>
    </div>
  );
}
