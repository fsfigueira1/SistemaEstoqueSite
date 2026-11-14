/* eslint-disable @typescript-eslint/no-require-imports */
// Impressão na térmica (Epson TM-T20X, bobina 80 mm) numa janela oculta.
//
// Recebe a página HTML pronta (comprovante ou DANFE NFC-e, ver src/lib/thermalPrint.ts),
// espera o DOM, as fontes e as imagens/QR Code carregarem, mede a altura real e
// imprime com:
//   - margens "none" e escala 100% (nada de "ajustar à página" do driver);
//   - largura da bobina e altura calculada em mícrons a partir do scrollHeight
//     (nunca A4/Carta): não corta cupom longo nem sobra papel no fim.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// CSS: 96 px = 1 polegada = 25,4 mm
const MICRONS_PER_PX = 25400 / 96;
const MAX_HTML = 5 * 1024 * 1024;

// Roda dentro da janela oculta: espera fontes e imagens e devolve a altura em px.
const MEDIR = `(async () => {
  if (document.readyState !== "complete") await new Promise((r) => window.addEventListener("load", r, { once: true }));
  try { await document.fonts.ready; } catch (e) {}
  await Promise.all(Array.from(document.images).map((img) =>
    img.complete
      ? (img.decode ? img.decode().catch(() => {}) : null)
      : new Promise((r) => { img.onload = r; img.onerror = r; })
  ));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // altura do conteúdo (body), não da janela: documentElement.scrollHeight
  // nunca fica menor que a janela e faria o cupom curto gastar papel à toa
  const b = document.body;
  const fundo = Math.max(0, ...Array.from(b.querySelectorAll("*"), (e) => e.getBoundingClientRect().bottom));
  return Math.ceil(Math.max(b.scrollHeight, fundo + window.scrollY));
})()`;

/**
 * @param {string} html página completa
 * @param {{ deviceName?: string, paperMm?: number, silent?: boolean }} opts
 * @returns {Promise<{ ok: boolean, reason?: string, heightMm?: number }>}
 */
async function printThermalHtml(html, opts = {}) {
  if (typeof html !== "string" || !html.trim()) return { ok: false, reason: "página vazia" };
  if (html.length > MAX_HTML) return { ok: false, reason: "página grande demais" };
  const paperMm = opts.paperMm === 58 ? 58 : 80;
  const silent = opts.silent !== false && Boolean(opts.deviceName);

  // arquivo temporário: data: URL tem limite de tamanho e o QR em SVG é grande
  const file = path.join(app.getPath("temp"), `koda-impressao-${crypto.randomUUID()}.html`);
  fs.writeFileSync(file, html, "utf8");

  const win = new BrowserWindow({
    show: false,
    width: Math.round((paperMm / 25.4) * 96),
    height: 200, // baixa de propósito: a altura do papel vem do conteúdo
    useContentSize: true,
    paintWhenInitiallyHidden: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  // a página é só para imprimir: nada de abrir links ou navegar
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());

  try {
    await win.loadFile(file); // resolve no did-finish-load
    const heightPx = Number(await win.webContents.executeJavaScript(MEDIR, true)) || 0;
    // +3 mm de folga para arredondamentos entre a tela e o motor de impressão
    const height = Math.max(30_000, Math.ceil(heightPx * MICRONS_PER_PX) + 3_000);
    const options = {
      silent,
      deviceName: opts.deviceName || undefined,
      printBackground: true,
      margins: { marginType: "none" },
      scaleFactor: 100,
      pageSize: { width: paperMm * 1000, height },
    };
    const result = await new Promise((resolve) => {
      win.webContents.print(options, (ok, reason) => resolve({ ok, reason: ok ? undefined : reason }));
    });
    return { ...result, heightMm: Math.round(height / 100) / 10 };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    // dá um respiro para o spooler pegar o trabalho antes de fechar a janela
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      fs.rm(file, { force: true }, () => {});
    }, 1500);
  }
}

module.exports = { printThermalHtml, MICRONS_PER_PX, MEDIR };
