// WhatsApp Web (dentro do Atendimento): ler a conversa aberta, colar a
// resposta na caixa e, no modo automático, listar/abrir conversas e enviar.
// Estas funções rodam DENTRO da página do WhatsApp via
// webContents.executeJavaScript (toScript) — por isso são autocontidas: nada
// de variáveis de fora; os seletores chegam por argumento. Testado com página
// simulada em src/lib/whatsappDom.test.ts.
//
// Quando o WhatsApp mudar a página e a leitura parar, ajuste SÓ os seletores
// (estrutura conferida na página real em out/2026).
/* global module */
"use strict";

const SELECTORS = {
  main: "#main",
  /** lista de conversas: só existe com o WhatsApp conectado */
  side: "#side",
  headerTitle: "#main header span[title]",
  /** o campo de digitar diz "Digite uma mensagem para <nome>" — melhor fonte do nome */
  compose: '#main footer div[contenteditable="true"]',
  composePrefix: "^(?:Digite uma mensagem para|Type a message to)\\s+",
  message: '#main [data-testid^="conv-msg"]',
  text: "[data-pre-plain-text]",
  readMore: '[data-testid="caption-read-more-button"]',
  /** sinais de mensagem da loja; o tracinho de status aparece em toda mensagem enviada */
  outgoing: '[data-icon="tail-out"], [aria-label="Você:"], [aria-label="You:"]',
  statusLabel: "^(?:Lida|Entregue|Enviada|Pendente|Read|Delivered|Sent|Pending)$",
  /** mensagem sem texto (foto, áudio, vídeo, figurinha, documento) */
  mediaEl: 'img[src^="blob:"], audio, video, [data-icon="audio-play"], [data-icon="ptt-play"]',
  mediaLabel: "imagem|foto|v[íi]deo|[áa]udio|mensagem de voz|figurinha|documento|image|photo|voice|sticker|document",
  send: '#main footer button[aria-label="Enviar"], #main footer button[aria-label="Send"]',
  row: '#pane-side [role="row"]',
  rowTitle: '[data-testid="cell-frame-title"] span[title]',
  rowUnread: '[aria-label*="não lida"], [aria-label*="unread"]',
  rowClick: '[data-testid="cell-frame-container"]',
};

/** Conversa aberta: nome, telefone (se der), se é grupo e mensagens na ordem. */
function readOpenChat(doc, S) {
  S = S || SELECTORS;
  const main = doc.querySelector(S.main);
  // sem a lista de conversas = QR code na tela ou ainda carregando
  if (!main) return { ok: false, reason: doc.querySelector(S.side) ? "sem-conversa" : "nao-conectado" };

  const textOf = (node) => {
    let out = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType !== 1) return;
      else if (c.matches && c.matches(S.readMore)) return;
      else if (c.nodeName === "IMG") out += c.getAttribute("alt") || "";
      else if (c.nodeName === "BR") out += "\n";
      else out += textOf(c);
    });
    return out;
  };
  const isPhone = (s) => /^\+?[\d\s().-]{10,}$/.test(s);
  const digitsToPhone = (d) => (d.length === 10 || d.length === 11 ? "55" + d : d.length >= 12 && d.length <= 13 ? d : "");
  const status = new RegExp(S.statusLabel, "i");

  const box = doc.querySelector(S.compose);
  const fromBox = ((box && box.getAttribute("aria-label")) || "").replace(new RegExp(S.composePrefix, "i"), "");
  const titleEl = doc.querySelector(S.headerTitle);
  const name = (fromBox && fromBox !== (box && box.getAttribute("aria-label")) ? fromBox : (titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) || "").trim();
  const phone = isPhone(name) ? digitsToPhone(name.replace(/\D/g, "")) : "";

  const messages = [];
  const authors = new Set();
  const media = new RegExp(S.mediaLabel, "i");
  doc.querySelectorAll(S.message).forEach((m) => {
    const own =
      Boolean(m.querySelector(S.outgoing)) ||
      [...m.querySelectorAll("[aria-label]")].some((e) => status.test((e.getAttribute("aria-label") || "").trim()));
    const body = m.querySelector(S.text);
    if (!body) {
      // foto, áudio, figurinha, documento: o robô não lê — fica para o atendente
      const isMedia = m.querySelector(S.mediaEl) || [...m.querySelectorAll("[aria-label]")].some((e) => media.test(e.getAttribute("aria-label") || ""));
      if (isMedia) messages.push({ from: own ? "loja" : "cliente", text: "", media: true });
      return; // senão: divisória de data, aviso do sistema
    }
    const parts = [...body.querySelectorAll(".selectable-text")].filter((p) => !p.parentElement.closest(".selectable-text"));
    const text = (parts.length ? parts.map(textOf).join("\n") : textOf(body)).trim();
    if (!text) return;
    if (!own) {
      const who = /\]\s*(.*?):\s*$/.exec(body.getAttribute("data-pre-plain-text") || "");
      if (who && who[1]) authors.add(who[1]);
    }
    messages.push({ from: own ? "loja" : "cliente", text });
  });
  return { ok: true, name: isPhone(name) ? "" : name, phone, group: authors.size > 1, messages };
}

/**
 * O que responder agora: o que o cliente mandou depois da última resposta da
 * loja. limit = quantas mensagens são novas (as não lidas da lista de
 * conversas): o robô não responde mensagem antiga junto com a nova.
 */
function customerTurn(messages, limit) {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.from === "loja") last = i;
  });
  const after = messages.slice(last + 1).filter((m) => m.from === "cliente");
  const max = limit > 0 ? limit : last >= 0 ? after.length : 6;
  // a foto/áudio conta como mensagem nova, mas não tem texto para responder
  return after.slice(-max).filter((m) => m.text).map((m) => m.text).join("\n");
}

/** Entre as últimas `limit` mensagens do cliente (as novas) tem foto/áudio sem texto? */
function newMedia(messages, limit) {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.from === "loja") last = i;
  });
  const after = messages.slice(last + 1).filter((m) => m.from === "cliente");
  return after.slice(-(limit > 0 ? limit : after.length)).some((m) => m.media);
}

/** A conversa aberta é do cliente esperado? Pelo telefone quando os dois têm; senão pelo nome. */
function sameChat(chat, expected) {
  const pa = String(chat.phone || "").replace(/\D/g, "");
  const pb = String(expected.phone || "").replace(/\D/g, "");
  if (pa && pb) return pa.slice(-10) === pb.slice(-10);
  const na = String(chat.name || "").trim().toLowerCase();
  return Boolean(na) && na === String(expected.name || "").trim().toLowerCase();
}

/** Conversas da lista (as que estão na tela) e quantas mensagens não lidas cada uma tem. */
function listChats(doc, S) {
  S = S || SELECTORS;
  const out = [];
  doc.querySelectorAll(S.row).forEach((row) => {
    const t = row.querySelector(S.rowTitle);
    if (!t) return;
    const u = row.querySelector(S.rowUnread);
    const n = u ? parseInt(((u.getAttribute("aria-label") || "").match(/\d+/) || ["1"])[0], 10) : 0;
    out.push({ name: (t.getAttribute("title") || t.textContent || "").trim(), unread: n });
  });
  return out;
}

/** Abre a conversa da lista pelo nome (o WhatsApp abre no "mousedown"). */
function openChat(doc, name, S) {
  S = S || SELECTORS;
  const view = doc.defaultView;
  for (const row of doc.querySelectorAll(S.row)) {
    const t = row.querySelector(S.rowTitle);
    if (!t || (t.getAttribute("title") || t.textContent || "").trim() !== name) continue;
    const target = row.querySelector(S.rowClick) || row;
    for (const type of ["mousedown", "mouseup", "click"]) target.dispatchEvent(new view.MouseEvent(type, { bubbles: true, cancelable: true, view }));
    return true;
  }
  return false;
}

/** Abre o "Ler mais" das mensagens longas (lista de material). Devolve quantos abriu. */
function expandReadMore(doc, S) {
  S = S || SELECTORS;
  let n = 0;
  doc.querySelectorAll(S.message + " " + S.readMore).forEach((b) => {
    b.click();
    n++;
  });
  return n;
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

/** Envia o que está na caixa (só o modo automático usa). */
function sendCompose(doc, S) {
  S = S || SELECTORS;
  const b = doc.querySelector(S.send);
  if (!b) return false;
  b.click();
  return true;
}

/** Código para webContents.executeJavaScript: a função + argumentos (JSON) + seletores. */
function toScript(fn, ...args) {
  const params = ["document", ...args.map((a) => JSON.stringify(a)), JSON.stringify(SELECTORS)].join(", ");
  return `(${fn.toString()})(${params})`;
}

module.exports = { SELECTORS, readOpenChat, customerTurn, newMedia, sameChat, listChats, openChat, expandReadMore, insertIntoCompose, sendCompose, toScript };
