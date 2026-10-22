// Validação do que a tela manda para o WhatsApp embutido (sem depender do
// Electron, para testar). Testado em src/lib/whatsappIpc.test.ts.
"use strict";

const MAX = 10000;

/** Retângulo da área do WhatsApp na janela: números ≥ 0, arredondados. */
function validBounds(b) {
  if (!b || typeof b !== "object") return null;
  const keys = ["x", "y", "width", "height"];
  if (!keys.every((k) => typeof b[k] === "number" && Number.isFinite(b[k]) && b[k] >= 0 && b[k] <= MAX)) return null;
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
}

/** Texto para colar na caixa de mensagem. */
function validText(t) {
  return typeof t === "string" && t.length <= 8000 ? t : null;
}

/** A visão do WhatsApp só navega dentro do próprio WhatsApp Web. */
function isWhatsAppUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "web.whatsapp.com";
  } catch (_e) {
    return false;
  }
}

module.exports = { validBounds, validText, isWhatsAppUrl };
