// WhatsApp Web (dentro do Atendimento): ler a conversa aberta e colar a
// resposta na caixa de mensagem. Estas funções rodam DENTRO da página do
// WhatsApp via webContents.executeJavaScript (toScript) — por isso são
// autocontidas: nada de variáveis de fora; os seletores chegam por argumento.
// Nunca enviam mensagem: só leem e colam o texto (quem aperta Enter é o
// atendente). Testado com página simulada em src/lib/whatsappDom.test.ts.
//
// Quando o WhatsApp mudar a página e a leitura parar, ajuste SÓ os seletores.
/* global module */
"use strict";

const SELECTORS = {
  main: "#main",
  /** lista de conversas: só existe com o WhatsApp conectado */
  side: "#side",
  headerTitle: "#main header span[title]",
  row: '#main [role="row"]',
  incoming: ".message-in",
  outgoing: ".message-out",
  text: "[data-pre-plain-text] .selectable-text",
  idHolder: "[data-id]",
  compose: '#main footer div[contenteditable="true"]',
};

/** Conversa aberta: nome, telefone (se der) e mensagens na ordem. */
function readOpenChat(doc, S) {
  S = S || SELECTORS;
  const main = doc.querySelector(S.main);
  // sem a lista de conversas = QR code na tela ou ainda carregando
  if (!main) return { ok: false, reason: doc.querySelector(S.side) ? "sem-conversa" : "nao-conectado" };

  const textOf = (node) => {
    let out = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeName === "IMG") out += c.getAttribute("alt") || "";
      else if (c.nodeName === "BR") out += "\n";
      else out += textOf(c);
    });
    return out;
  };
  const digitsToPhone = (d) => (d.length === 10 || d.length === 11 ? "55" + d : d.length >= 12 && d.length <= 13 ? d : "");

  const titleEl = doc.querySelector(S.headerTitle);
  const name = ((titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) || "").trim();

  let phone = "";
  doc.querySelectorAll(S.main + " " + S.idHolder).forEach((el) => {
    if (phone) return;
    const m = /(?:true|false)_(\d{10,15})@c\.us/.exec(el.getAttribute("data-id") || "");
    if (m) phone = m[1]; // o id já vem com o código do país
  });
  if (!phone && /^\+?[\d\s().-]{10,}$/.test(name)) phone = digitsToPhone(name.replace(/\D/g, ""));

  const messages = [];
  doc.querySelectorAll(S.row).forEach((row) => {
    const from = row.querySelector(S.incoming) ? "cliente" : row.querySelector(S.outgoing) ? "loja" : null;
    if (!from) return;
    const t = row.querySelector(S.text);
    const text = t ? textOf(t).trim() : "";
    if (text) messages.push({ from, text });
  });
  return { ok: true, name: /^\+?[\d\s().-]{10,}$/.test(name) ? "" : name, phone, messages };
}

/** O que responder agora: o que o cliente mandou depois da última resposta da loja. */
function customerTurn(messages) {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.from === "loja") last = i;
  });
  const after = messages.slice(last + 1).filter((m) => m.from === "cliente");
  const pick = last >= 0 ? after : after.slice(-6);
  return pick.map((m) => m.text).join("\n");
}

/** A conversa aberta é do cliente esperado? Pelo telefone quando os dois têm; senão pelo nome. */
function sameChat(chat, expected) {
  const pa = String(chat.phone || "").replace(/\D/g, "");
  const pb = String(expected.phone || "").replace(/\D/g, "");
  if (pa && pb) return pa.slice(-10) === pb.slice(-10);
  const na = String(chat.name || "").trim().toLowerCase();
  return Boolean(na) && na === String(expected.name || "").trim().toLowerCase();
}

/** Cola o texto na caixa de mensagem da conversa aberta (não envia). */
function insertIntoCompose(doc, text, S) {
  S = S || SELECTORS;
  const box = doc.querySelector(S.compose);
  if (!box) return false;
  box.focus();
  const view = doc.defaultView || {};
  let data;
  try {
    data = new view.DataTransfer();
    data.setData("text/plain", text);
  } catch {
    data = { types: ["text/plain"], getData: (t) => (t === "text/plain" || t === "Text" ? text : "") };
  }
  let ev;
  try {
    ev = new view.ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
  } catch {
    ev = null;
  }
  if (!ev || !ev.clipboardData) {
    ev = new view.Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: data });
  }
  box.dispatchEvent(ev);
  return true;
}

/** Código para webContents.executeJavaScript: a função + argumentos (JSON) + seletores. */
function toScript(fn, ...args) {
  const params = ["document", ...args.map((a) => JSON.stringify(a)), JSON.stringify(SELECTORS)].join(", ");
  return `(${fn.toString()})(${params})`;
}

module.exports = { SELECTORS, readOpenChat, customerTurn, sameChat, insertIntoCompose, toScript };
