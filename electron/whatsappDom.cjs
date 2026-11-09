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
  /** foto que o robô pode ler (o resto de mediaEl e as figurinhas vão para o atendente) */
  photo: 'img[src^="blob:"]',
  notPhoto: 'audio, video, [data-icon="audio-play"], [data-icon="ptt-play"]',
  stickerLabel: "figurinha|sticker",
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
  const sticker = new RegExp(S.stickerLabel, "i");
  const isPhoto = (m) => Boolean(m.querySelector(S.photo)) && !m.querySelector(S.notPhoto) && ![...m.querySelectorAll("[aria-label]")].some((e) => sticker.test(e.getAttribute("aria-label") || ""));
  doc.querySelectorAll(S.message).forEach((m) => {
    const own =
      Boolean(m.querySelector(S.outgoing)) ||
      [...m.querySelectorAll("[aria-label]")].some((e) => status.test((e.getAttribute("aria-label") || "").trim()));
    const body = m.querySelector(S.text);
    if (!body) {
      // foto o robô tenta ler; áudio, figurinha e documento ficam para o atendente
      const isMedia = m.querySelector(S.mediaEl) || [...m.querySelectorAll("[aria-label]")].some((e) => media.test(e.getAttribute("aria-label") || ""));
      if (isMedia) messages.push({ from: own ? "loja" : "cliente", text: "", media: true, ...(isPhoto(m) ? { image: true } : {}) });
      return; // senão: divisória de data, aviso do sistema
    }
    const parts = [...body.querySelectorAll(".selectable-text")].filter((p) => !p.parentElement.closest(".selectable-text"));
    const text = (parts.length ? parts.map(textOf).join("\n") : textOf(body)).trim();
    if (!text) return;
    if (!own) {
      const who = /\]\s*(.*?):\s*$/.exec(body.getAttribute("data-pre-plain-text") || "");
      if (who && who[1]) authors.add(who[1]);
    }
    messages.push({ from: own ? "loja" : "cliente", text, ...(isPhoto(m) ? { image: true } : {}) });
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

/** As últimas `limit` mensagens do cliente (as novas) que são foto, áudio etc. */
function newMediaMessages(messages, limit) {
  let last = -1;
  messages.forEach((m, i) => {
    if (m.from === "loja") last = i;
  });
  const after = messages.slice(last + 1).filter((m) => m.from === "cliente");
  return after.slice(-(limit > 0 ? limit : after.length)).filter((m) => m.media || m.image);
}

/** Entre as mensagens novas do cliente tem foto, áudio, figurinha? */
const newMedia = (messages, limit) => newMediaMessages(messages, limit).length > 0;

/** Toda mídia nova é foto (o robô sabe ler)? */
function onlyPhotos(messages, limit) {
  const news = newMediaMessages(messages, limit);
  return news.length > 0 && news.every((m) => m.image);
}

/**
 * Fotos das últimas `limit` mensagens do cliente, como JPEG em data URL (até 3,
 * lado maior 1600 px). Foto ainda sem baixar só tem miniatura: fica de fora e
 * a conversa vai para o atendente.
 */
function captureImages(doc, limit, S) {
  S = S || SELECTORS;
  const MAX_SIDE = 1600;
  const MIN_WIDTH = 200;
  const status = new RegExp(S.statusLabel, "i");
  const all = [...doc.querySelectorAll(S.message)];
  const out = [];
  let count = 0;
  for (let i = all.length - 1; i >= 0 && out.length < 3; i--) {
    const m = all[i];
    if (m.querySelector(S.outgoing) || [...m.querySelectorAll("[aria-label]")].some((e) => status.test((e.getAttribute("aria-label") || "").trim()))) break;
    if (!m.querySelector(S.text) && !m.querySelector(S.mediaEl)) continue; // divisória de data
    if (limit > 0 && ++count > limit) break;
    const img = m.querySelector(S.photo);
    if (!img || img.naturalWidth < MIN_WIDTH) continue;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = doc.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    out.unshift(canvas.toDataURL("image/jpeg", 0.85));
  }
  return out;
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

module.exports = { SELECTORS, readOpenChat, customerTurn, newMedia, onlyPhotos, captureImages, sameChat, listChats, openChat, expandReadMore, insertIntoCompose, sendCompose, toScript };
