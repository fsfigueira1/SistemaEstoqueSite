/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
// Copia o leitor de foto (OCR, tesseract.js) para public/ocr, para a leitura
// da lista escolar funcionar sem internet e sem CDN:
//   public/ocr/worker.min.js
//   public/ocr/core/tesseract-core-*-lstm.wasm.js
//   public/ocr/lang/por.traineddata.gz   (português, modelo "best_int", 1,4 MB)
// Roda antes do build/dev. A pasta public/ocr fica fora do git.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const nm = path.join(root, "node_modules");
const out = path.join(root, "public", "ocr");

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz", "lang/por.traineddata.gz"],
];

let copied = 0;
for (const [from, to] of files) {
  const src = path.join(nm, from);
  const dst = path.join(out, to);
  if (!fs.existsSync(src)) {
    console.warn(`[ocr] não achei ${from} — rode npm install`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const same = fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size;
  if (!same) {
    fs.copyFileSync(src, dst);
    copied++;
  }
}
console.log(`[ocr] arquivos do leitor de foto prontos em public/ocr (${copied} copiado(s))`);
