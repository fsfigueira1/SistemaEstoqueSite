/* eslint-disable @typescript-eslint/no-require-imports */
// WhatsApp Web dentro da tela Atendimento (PC do balcão). Uma "view" com
// sessão própria e persistente (o QR code é escaneado uma vez) fica por cima
// da área reservada da tela. A página do WhatsApp não recebe Node nem preload:
// o sistema só lê a conversa aberta e cola a resposta na caixa, e só quando o
// atendente clica. Nunca envia mensagem.
"use strict";

const { WebContentsView, BrowserWindow, ipcMain, session, shell } = require("electron");
const { readOpenChat, insertIntoCompose, toScript } = require("./whatsappDom.cjs");
const { validBounds, validText, isWhatsAppUrl } = require("./whatsappIpc.cjs");

const PARTITION = "persist:whatsapp";
const URL_WA = "https://web.whatsapp.com/";
// o WhatsApp Web só abre em navegadores que ele reconhece
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

let view = null;
let host = null;

function createView() {
  const ses = session.fromPartition(PARTITION);
  // notificações e área de transferência sim; câmera, microfone, localização não
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["notifications", "clipboard-sanitized-write", "clipboard-read"].includes(permission));
  });
  const v = new WebContentsView({
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
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
  wc.loadURL(URL_WA);
  return v;
}

function attach(win) {
  if (!view) view = createView();
  if (host !== win) {
    if (host && !host.isDestroyed()) host.contentView.removeChildView(view);
    win.contentView.addChildView(view);
    host = win;
    win.once("closed", () => {
      if (host === win) host = null;
    });
  }
  return view;
}

function registerWhatsApp() {
  ipcMain.handle("wa-show", (e, b) => {
    const bounds = validBounds(b);
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!bounds || !win) return false;
    const v = attach(win);
    v.setBounds(bounds);
    v.setVisible(true);
    return true;
  });

  ipcMain.handle("wa-hide", () => {
    if (view) view.setVisible(false);
    return true;
  });

  ipcMain.handle("wa-read-chat", async () => {
    if (!view) return { ok: false, reason: "fechado" };
    try {
      return await view.webContents.executeJavaScript(toScript(readOpenChat), true);
    } catch (_e) {
      return { ok: false, reason: "erro" };
    }
  });

  ipcMain.handle("wa-insert", async (_e, t) => {
    const text = validText(t);
    if (!view || text == null) return false;
    try {
      const ok = await view.webContents.executeJavaScript(toScript(insertIntoCompose, text), true);
      if (ok) view.webContents.focus();
      return Boolean(ok);
    } catch (_e) {
      return false;
    }
  });

  ipcMain.handle("wa-reload", () => {
    if (view) view.webContents.loadURL(URL_WA);
    return true;
  });
}

module.exports = { registerWhatsApp };
