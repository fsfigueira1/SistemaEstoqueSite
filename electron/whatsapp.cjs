/* eslint-disable @typescript-eslint/no-require-imports */
// WhatsApp Web dentro da tela Atendimento (PC do balcão). Uma "view" com
// sessão própria e persistente (o QR code é escaneado uma vez) fica por cima
// da área reservada da tela. A página do WhatsApp não recebe Node nem preload:
// o sistema só lê a conversa aberta e cola a resposta na caixa, e só quando o
// atendente clica. Nunca envia mensagem.
/* global require, module, process */
"use strict";

const { WebContentsView, BrowserWindow, ipcMain, session, shell } = require("electron");
const { readOpenChat, insertIntoCompose, toScript } = require("./whatsappDom.cjs");
const { validBounds, validText, isWhatsAppUrl, isAppSender } = require("./whatsappIpc.cjs");

const PARTITION = "persist:whatsapp";
const URL_WA = "https://web.whatsapp.com/";
// o WhatsApp Web só abre em navegadores que ele reconhece: Chrome com a versão
// real do Chromium do Electron (igual à que o navegador informa nas client hints)
const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
// armazenamento persistente é obrigatório: sem ele o WhatsApp acusa "erro no banco
// de dados do navegador" e a sessão (QR code) não fica salva
const ALLOWED_PERMISSIONS = ["notifications", "clipboard-sanitized-write", "clipboard-read", "persistent-storage", "storage-access"];

let view = null;
let host = null;

function createView() {
  const ses = session.fromPartition(PARTITION);
  // notificações, área de transferência e armazenamento sim; câmera, microfone, localização não
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.includes(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.includes(permission));
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
      return await view.webContents.executeJavaScript(toScript(readOpenChat), true);
    } catch {
      return { ok: false, reason: "erro" };
    }
  });

  ipcMain.handle("wa-insert", async (e, t) => {
    if (!fromApp(e)) return false;
    const text = validText(t);
    if (!view || text == null) return false;
    try {
      const ok = await view.webContents.executeJavaScript(toScript(insertIntoCompose, text), true);
      if (ok) view.webContents.focus();
      return Boolean(ok);
    } catch {
      return false;
    }
  });

  ipcMain.handle("wa-reload", (e) => {
    if (!fromApp(e)) return false;
    if (view) view.webContents.loadURL(URL_WA);
    return true;
  });
}

module.exports = { registerWhatsApp };
