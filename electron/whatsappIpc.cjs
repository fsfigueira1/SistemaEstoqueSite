// Validação do que a tela manda para o WhatsApp embutido (sem depender do
// Electron, para testar). Testado em src/lib/whatsappIpc.test.ts.
/* global module */
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
  } catch {
    return false;
  }
}

/**
 * Só a tela do próprio sistema (quadro principal, mesma origem do servidor
 * embutido) pode mostrar o WhatsApp, ler a conversa ou colar texto nele.
 */
function isAppSender(senderUrl, appOrigin, isMainFrame) {
  if (!isMainFrame) return false;
  try {
    return new URL(senderUrl).origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}

// armazenamento persistente é obrigatório: sem ele o WhatsApp acusa "erro no banco
// de dados do navegador" e a sessão (QR code) não fica salva. Ler a área de
// transferência não: o texto entra por um "colar" simulado.
const ALLOWED_PERMISSIONS = ["notifications", "clipboard-sanitized-write", "persistent-storage", "storage-access"];

/** Permissão pedida pela página: só as da lista e só vindas do próprio WhatsApp Web. */
function allowPermission(permission, origin) {
  return ALLOWED_PERMISSIONS.includes(permission) && isWhatsAppUrl(origin || "");
}

module.exports = { validBounds, validText, isWhatsAppUrl, isAppSender, allowPermission };
