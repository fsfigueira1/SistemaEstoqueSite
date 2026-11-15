// Regras de impressão para bobina térmica (Epson TM-T20X, 80 mm; também 58 mm).
// Usado pelo comprovante de compra e pelo DANFE NFC-e. A página inteira é
// mandada para o Electron, que imprime numa janela oculta (electron/thermalPrint.cjs).
//
// - Bobina de 80 mm, mas a cabeça da TM-T20X só imprime ~72 mm, começando
//   uns 4 mm para dentro. O cupom fica travado em 70 mm, com 5 mm de recuo
//   à esquerda (sem o recuo, "TOTAL" saía "TAL").
// - Só preto puro sobre branco: cinza claro some na impressão térmica.

export type ReceiptWidth = "58mm" | "80mm"

export const THERMAL = {
  "80mm": { paper: 80, content: 70, left: 5 },
  "58mm": { paper: 58, content: 48, left: 5 },
} as const

export function thermalCss(width: ReceiptWidth = "80mm"): string {
  const t = THERMAL[width] ?? THERMAL["80mm"]
  return `
@page { size: ${t.paper}mm auto; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: ${t.paper}mm;
  background: #fff;
  color: #000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body { padding: 2mm 0 0 ${t.left}mm; }
.cupom {
  width: ${t.content}mm;
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.3;
  color: #000;
  background: #fff;
}
.cupom * { color: #000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; }
.c { text-align: center; }
.r { text-align: right; }
.b { font-weight: bold; }
.g { font-size: 14px; }
.p { font-size: 10px; }
.sep { border-top: 1px dashed #000; margin: 1.5mm 0; height: 0; }
.linha { display: flex; justify-content: space-between; gap: 2mm; }
.linha > :last-child { text-align: right; white-space: nowrap; }
.quebra { word-break: break-word; overflow-wrap: anywhere; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
td, th { padding: 0.3mm 0; vertical-align: top; text-align: left; font-weight: normal; word-break: break-word; overflow-wrap: anywhere; }
th { font-weight: bold; }
.num { text-align: right; white-space: nowrap; }
.qr { display: block; margin: 1.5mm auto; }
.qr svg, .qr img { display: block; width: 100%; height: 100%; }
.fim { height: 6mm; }
`
}

/** Documento HTML completo pronto para a impressão térmica. */
export function thermalDocument(body: string, width: ReceiptWidth = "80mm", title = "Comprovante"): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>${thermalCss(width)}</style></head><body><div class="cupom">${body}</div></body></html>`
}

/** Escapa texto para colocar no HTML. */
export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
