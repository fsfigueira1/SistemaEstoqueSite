/* eslint-disable @typescript-eslint/no-require-imports */
// WhatsApp Web dentro da tela Atendimento (PC do balcão). Uma "view" com
// sessão própria e persistente (o QR code é escaneado uma vez) fica por cima
// da área reservada da tela. A página do WhatsApp não recebe Node nem preload:
// o sistema só lê a conversa aberta e cola a resposta na caixa, e só quando o
// atendente clica. Nunca envia mensagem.
/* global require, module */
"use strict";

const { WebContentsView, BrowserWindow, ipcMain, session, shell } = require("electron");
const { readOpenChat, sameChat, insertIntoCompose, expandReadMore, toScript } = require("./whatsappDom.cjs");
const { createAutoReply } = require("./whatsappAuto.cjs");
const { validBounds, validText, isWhatsAppUrl, isAppSender, allowPermission } = require("./whatsappIpc.cjs");

const PARTITION = "persist:whatsapp";
const URL_WA = "https://web.whatsapp.com/";
// o WhatsApp Web só abre em navegadores que ele reconhece: Chrome com a versão
// real do Chromium do Electron (igual à que o navegador informa nas client hints)
const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let view = null;
let host = null;
// última vez que o atendente mexeu no WhatsApp (o robô não tira a conversa da frente dele)
let lastUserInput = 0;

function createView() {
  const ses = session.fromPartition(PARTITION);
  // notificações e armazenamento sim (lista em whatsappIpc.cjs); câmera, microfone, localização não
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(allowPermission(permission, details && details.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowPermission(permission, origin));
  const v = new WebContentsView({
    // backgroundThrottling: false — escondido, o WhatsApp continua recebendo (resposta automática)
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  const wc = v.webContents;
  wc.setUserAgent(USER_AGENT);
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (isWhatsAppUrl(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
  });
  // sem tamanho o WhatsApp não desenha as mensagens novas (robô com a tela de Atendimento fechada)
  v.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  v.setVisible(false);
  wc.on("before-input-event", () => {
    lastUserInput = Date.now();
  });
  wc.loadURL(URL_WA);
  return v;
}

/** A visão do WhatsApp, criada na primeira vez (mesmo sem a tela de Atendimento aberta). */
function ensureView() {
  if (!view) view = createView();
  return view;
}

function attach(win) {
  ensureView();
  if (host !== win) {
    if (host && !host.isDestroyed()) host.contentView.removeChildView(view);
    win.contentView.addChildView(view);
    host = win;
    win.once("closed", () => {
      if (host === win) host = null;
    });
    // a tela do sistema trocou de página, recarregou ou caiu: o WhatsApp não
    // pode ficar desenhado por cima de outra tela (a do Atendimento mostra de novo)
    const hide = () => {
      if (host === win && view) view.setVisible(false);
    };
    win.webContents.on("did-start-navigation", (details) => {
      if (details && details.isMainFrame && !details.isSameDocument) hide();
    });
    win.webContents.on("render-process-gone", hide);
    win.webContents.on("did-fail-load", hide);
  }
  return view;
}

/** appOrigin: endereço do servidor embutido (ex.: http://localhost:4123). */
function registerWhatsApp(appOrigin) {
  // só a tela do próprio sistema (quadro principal) fala com o WhatsApp
  const fromApp = (e) => isAppSender(e.senderFrame ? e.senderFrame.url : "", appOrigin, Boolean(e.senderFrame && e.senderFrame === e.sender.mainFrame));

  ipcMain.handle("wa-show", (e, b) => {
    if (!fromApp(e)) return false;
    const bounds = validBounds(b);
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!bounds || !win) return false;
    const v = attach(win);
    v.setBounds(bounds);
    v.setVisible(true);
    return true;
  });

  ipcMain.handle("wa-hide", (e) => {
    if (!fromApp(e)) return false;
    if (view) view.setVisible(false);
    return true;
  });

  ipcMain.handle("wa-read-chat", async (e) => {
    if (!fromApp(e)) return { ok: false, reason: "erro" };
    if (!view) return { ok: false, reason: "fechado" };
    try {
      // mensagem longa (lista de material) vem cortada com "Ler mais"
      if (await view.webContents.executeJavaScript(toScript(expandReadMore), true)) await new Promise((r) => setTimeout(r, 800));
      return await view.webContents.executeJavaScript(toScript(readOpenChat), true);
    } catch {
      return { ok: false, reason: "erro" };
    }
  });

  // cola só se a conversa aberta ainda for a do cliente da resposta (o atendente
  // pode ter clicado em outra conversa depois de gerar)
  ipcMain.handle("wa-insert", async (e, t, expected) => {
    const fail = { ok: false, reason: "sem-caixa" };
    if (!fromApp(e)) return fail;
    const text = validText(t);
    if (!view || text == null || !expected || typeof expected !== "object") return fail;
    try {
      const chat = await view.webContents.executeJavaScript(toScript(readOpenChat), true);
      if (!chat || !chat.ok) return fail;
      if (!sameChat(chat, { name: String(expected.name || ""), phone: String(expected.phone || "") })) return { ok: false, reason: "outra-conversa" };
      const ok = await view.webContents.executeJavaScript(toScript(insertIntoCompose, text), true);
      if (ok) view.webContents.focus();
      return ok ? { ok: true } : fail;
    } catch {
      return fail;
    }
  });

  ipcMain.handle("wa-reload", (e) => {
    if (!fromApp(e)) return false;
    if (view) view.webContents.loadURL(URL_WA);
    return true;
  });

  // resposta automática: o robô roda sempre; só age quando ligada em Configurações
  const auto = createAutoReply({ appOrigin, ensureView, lastInputAt: () => lastUserInput });
  ipcMain.handle("wa-auto-status", (e) => (fromApp(e) ? auto.snapshot() : null));
  ipcMain.handle("wa-auto-refresh", async (e) => {
    if (!fromApp(e)) return null;
    await auto.refresh();
    return auto.snapshot();
  });
  ipcMain.handle("wa-auto-cancel", (e, name) => {
    if (fromApp(e) && typeof name === "string") auto.cancel(name.slice(0, 200));
    return true;
  });
  ipcMain.handle("wa-auto-dismiss", (e, name) => {
    if (fromApp(e) && typeof name === "string") auto.dismiss(name.slice(0, 200));
    return true;
  });
}

module.exports = { registerWhatsApp };
