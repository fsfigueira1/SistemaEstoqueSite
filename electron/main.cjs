/* eslint-disable @typescript-eslint/no-require-imports */
// App de balcão da Laçolaria.
// Objetivo: instalar, abrir sozinho e NUNCA parar sem querer.
// - instância única (2º atalho só foca a janela)
// - roda o servidor Next embutido; se ele cair, sobe de novo
// - fechar o X esconde na bandeja; sair mesmo só pelo menu da bandeja
// - inicia junto com o Windows
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  powerSaveBlocker,
  nativeImage,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { autoUpdater } = require("electron-updater");

app.disableHardwareAcceleration();
process.env.ELECTRON_RUNNING = "true";

const isDev = !app.isPackaged;
const PORT = Number(process.env.PORT) || 4123;
// "localhost" (não 127.0.0.1): o next dev trata as duas como origens
// diferentes e bloquearia o JS/CSS.
const HOST = "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

// ---- instância única ----
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let serverProc = null;
let serverRestartTimer = null;
let quitting = false;
let updateReady = null; // { version } quando um update já foi baixado
let manualUpdateCheck = false;

// ---------------- configuração (DATABASE_URL etc.) ----------------
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
function getEnvForServer() {
  const cfg = readConfig();
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    DATABASE_URL: cfg.DATABASE_URL || process.env.DATABASE_URL || "",
    OWNER_PASSWORD: cfg.OWNER_PASSWORD || process.env.OWNER_PASSWORD || "owner123",
    EMPLOYEE_PASSWORD: cfg.EMPLOYEE_PASSWORD || process.env.EMPLOYEE_PASSWORD || "emp123",
  };
}

// ---------------- servidor Next embutido ----------------
function serverEntry() {
  if (isDev) return null;
  // extraResources: resources/next-server/server.js
  return path.join(process.resourcesPath, "next-server", "server.js");
}

function startServer() {
  if (serverProc) return;

  if (isDev) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
    // Args fixos ("run","dev"), sem input de usuário. shell só no Windows p/ resolver npm.cmd.
    serverProc = spawn(npm, ["run", "dev"], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, PORT: String(PORT) },
    });
  } else {
    const entry = serverEntry();
    // roda server.js como node puro usando o próprio Electron
    serverProc = spawn(process.execPath, [entry], {
      cwd: path.dirname(entry),
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...getEnvForServer(), ELECTRON_RUN_AS_NODE: "1" },
    });
  }

  serverProc.on("exit", (code) => {
    console.error(`[servidor] saiu com código ${code}`);
    serverProc = null;
    if (quitting) return;
    // sobe de novo (backoff curto) — o app não pode ficar parado
    clearTimeout(serverRestartTimer);
    serverRestartTimer = setTimeout(() => {
      startServer();
      if (mainWindow) waitForServer().then(() => mainWindow.reload()).catch(() => {});
    }, 1500);
  });
  serverProc.on("error", (err) => console.error("[servidor] erro:", err));
}

function stopServer() {
  quitting = true;
  clearTimeout(serverRestartTimer);
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* ignore */
    }
    serverProc = null;
  }
}

function waitForServer(timeoutMs = 90000) {
  const started = Date.now();
  let done = false;
  return new Promise((resolve, reject) => {
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      fn(arg);
    };
    const tick = () => {
      if (done) return;
      const req = http.get(`${BASE_URL}/senha`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) finish(resolve);
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(4000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (done) return;
      if (Date.now() - started > timeoutMs) return finish(reject, new Error("servidor não respondeu"));
      setTimeout(tick, 700);
    };
    tick();
  });
}

// ---------------- janela ----------------
function trayImage() {
  const p = path.join(__dirname, "icon.ico");
  try {
    const img = nativeImage.createFromPath(p);
    return img.isEmpty() ? nativeImage.createEmpty() : img;
  } catch {
    return nativeImage.createEmpty();
  }
}

function setupErrorPage(message) {
  const html = `<!doctype html><html><body style="font-family:system-ui;padding:48px;max-width:640px;margin:auto">
    <h1 style="color:#0aa">Laçolaria</h1>
    <p>Não consegui iniciar o sistema.</p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap">${String(message)}</pre>
    <p>Verifique a conexão com o banco (Supabase) em <b>Configurar banco</b> no menu da bandeja,
    e tente <b>Recarregar</b>.</p>
  </body></html>`;
  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // renderer travou/morreu -> recarrega, com trava anti-loop
  let reloads = [];
  const guardedReload = () => {
    if (quitting) return;
    const now = Date.now();
    reloads = reloads.filter((t) => now - t < 30000);
    if (reloads.length >= 3) {
      setupErrorPage("A tela reiniciou várias vezes seguidas. Verifique a conexão com o banco e use Recarregar na bandeja.");
      return;
    }
    reloads.push(now);
    mainWindow.reload();
  };
  mainWindow.webContents.on("render-process-gone", guardedReload);
  mainWindow.webContents.on("unresponsive", guardedReload);

  // fechar o X -> esconde na bandeja (não mata o servidor)
  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  try {
    startServer();
    await waitForServer();
    await mainWindow.loadURL(BASE_URL);
  } catch (err) {
    setupErrorPage(err && err.message ? err.message : err);
  }
  if (!mainWindow.isVisible()) mainWindow.show();
}

// ---------------- bandeja ----------------
function buildTray() {
  tray = new Tray(trayImage());
  tray.setToolTip("Laçolaria — Gestão & PDV");
  buildTrayMenu();
  tray.on("click", () => showWindow());
}

function buildTrayMenu() {
  if (!tray) return;
  const items = [
    { label: "Abrir", click: () => showWindow() },
    { label: "Recarregar", click: () => mainWindow && mainWindow.reload() },
    { type: "separator" },
    { label: "Configurar banco de dados…", click: () => promptDatabaseUrl() },
    {
      label: readConfig().PRINTER_NAME
        ? `Impressora do comprovante: ${readConfig().PRINTER_NAME}`
        : "Escolher impressora do comprovante…",
      click: () => promptReceiptPrinter(),
    },
    {
      label: "Iniciar com o Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: "separator" },
  ];

  if (updateReady) {
    items.push({
      label: `Reiniciar e instalar a versão ${updateReady.version}`,
      click: () => {
        quitting = true;
        autoUpdater.quitAndInstall(true, true);
      },
    });
  } else {
    items.push({ label: "Verificar atualizações", click: () => checkForUpdates(true) });
  }

  items.push({ type: "separator" });
  items.push({ label: `Versão ${app.getVersion()}`, enabled: false });
  items.push({
    label: "Sair",
    click: () => {
      quitting = true;
      app.quit();
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---------------- atualização automática (GitHub Releases) ----------------
function checkForUpdates(manual = false) {
  if (isDev) {
    if (manual) {
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        message: "Atualização automática só funciona no app instalado.",
        buttons: ["OK"],
      });
    }
    return;
  }
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("[update] falha ao verificar:", err && err.message);
    if (manual) {
      dialog.showMessageBox(mainWindow || null, {
        type: "error",
        title: "Atualização",
        message: "Não consegui verificar agora.",
        detail: String((err && err.message) || err),
        buttons: ["OK"],
      });
    }
    manualUpdateCheck = false;
  });
}

function setupAutoUpdate() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // aplica sozinho no próximo "Sair"

  autoUpdater.on("update-available", (info) => {
    console.log("[update] versão nova:", info && info.version, "— baixando…");
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Atualização",
        message: `Versão ${info && info.version} encontrada. Baixando em segundo plano.`,
        detail: "Você será avisado quando estiver pronta para instalar.",
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Atualização",
        message: "Você já está na última versão.",
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[update] erro:", err && err.message);
    manualUpdateCheck = false;
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateReady = { version: info && info.version };
    buildTrayMenu();
    if (tray) tray.setToolTip(`Laçolaria — versão ${updateReady.version} pronta (reinicie para aplicar)`);
    dialog
      .showMessageBox(mainWindow || null, {
        type: "info",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 1,
        cancelId: 1,
        title: "Atualização pronta",
        message: `A versão ${updateReady.version} foi baixada.`,
        detail:
          "Ela é aplicada ao reiniciar o Laçolaria. Reinicie agora, ou continue usando — " +
          "será instalada automaticamente da próxima vez que o app for fechado pela bandeja.",
      })
      .then(({ response }) => {
        if (response === 0) {
          quitting = true;
          autoUpdater.quitAndInstall(true, true);
        }
      })
      .catch(() => {});
  });

  checkForUpdates(false); // ao abrir
  setInterval(() => checkForUpdates(false), 6 * 60 * 60 * 1000); // e a cada 6h
}

function showWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function promptDatabaseUrl() {
  const cfg = readConfig();
  const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow || null, {
    type: "question",
    buttons: ["Colar nova URL", "Cancelar"],
    defaultId: 0,
    title: "Banco de dados",
    message: "Cole a connection string do Postgres (Supabase).",
    detail:
      "Supabase → botão Connect → Transaction pooler (porta 6543). " +
      "Termine a URL com ?pgbouncer=true e não deixe colchetes na senha.\n" +
      (cfg.DATABASE_URL ? "Atual: " + cfg.DATABASE_URL.replace(/:[^:@/]+@/, ":***@") : "Nenhuma configurada."),
  });
  if (response !== 0) return;
  // entrada de texto via prompt simples (janela dedicada)
  const input = new BrowserWindow({
    width: 620,
    height: 220,
    parent: mainWindow || undefined,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true },
  });
  const page = `<!doctype html><html><body style="font-family:system-ui;padding:20px">
    <p>DATABASE_URL:</p>
    <input id="u" style="width:100%;padding:8px" value="${(cfg.DATABASE_URL || "").replace(/"/g, "&quot;")}"/>
    <div style="margin-top:14px;text-align:right">
      <button onclick="window.close()">Cancelar</button>
      <button onclick="save()" style="padding:6px 14px">Salvar e reiniciar</button>
    </div>
    <script>
      function save(){ window.electronAPI.setDatabaseUrl(document.getElementById('u').value.trim()); }
    </script>
  </body></html>`;
  input.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(page));
  ipcMain.removeAllListeners("set-database-url");
  ipcMain.once("set-database-url", (_e, url) => {
    const c = readConfig();
    c.DATABASE_URL = url;
    writeConfig(c);
    input.close();
    relaunchApp();
  });
}

async function promptReceiptPrinter() {
  let printers = [];
  try {
    printers = (await (mainWindow && mainWindow.webContents.getPrintersAsync())) || [];
  } catch {
    printers = [];
  }
  if (printers.length === 0) {
    dialog.showMessageBox(mainWindow || null, {
      type: "warning",
      title: "Impressora",
      message: "Nenhuma impressora encontrada no Windows.",
      detail: "Instale/ligue a Epson TM-T20X e tente de novo.",
      buttons: ["OK"],
    });
    return;
  }

  const current = readConfig().PRINTER_NAME || "";
  const win = new BrowserWindow({
    width: 480,
    height: 260,
    parent: mainWindow || undefined,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true },
  });
  const options = printers
    .map(
      (p) =>
        `<option value="${p.name.replace(/"/g, "&quot;")}"${p.name === current ? " selected" : ""}>` +
        `${(p.displayName || p.name).replace(/</g, "&lt;")}${p.isDefault ? " (padrão)" : ""}</option>`,
    )
    .join("");
  const page = `<!doctype html><html><body style="font-family:system-ui;padding:20px">
    <p style="margin:0 0 8px">Impressora do comprovante (impressão direta, sem diálogo):</p>
    <select id="p" style="width:100%;padding:8px">${options}</select>
    <label style="display:block;margin-top:10px;font-size:13px;color:#555">
      <input type="checkbox" id="none"/> Sempre perguntar (mostrar o diálogo)
    </label>
    <div style="margin-top:16px;text-align:right">
      <button onclick="window.close()">Cancelar</button>
      <button onclick="save()" style="padding:6px 14px">Salvar</button>
    </div>
    <script>
      function save(){
        var v = document.getElementById('none').checked ? '' : document.getElementById('p').value;
        window.electronAPI.setReceiptPrinter(v).then(function(){ window.close(); });
      }
    </script>
  </body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(page));
}

function relaunchApp() {
  quitting = true;
  stopServer();
  app.relaunch();
  app.exit(0);
}

// ---------------- ciclo de vida ----------------
app.on("second-instance", () => showWindow());

app.whenReady().then(() => {
  powerSaveBlocker.start("prevent-display-sleep");
  buildTray();
  createWindow();
  setupAutoUpdate();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else showWindow();
});

// não sai quando fecha a janela — fica na bandeja
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
});

// ---------------- IPC ----------------
ipcMain.handle("ping", () => "pong");
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.on("set-database-url", () => {}); // registrado dinamicamente acima
ipcMain.on("minimize-window", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on("toggle-maximize-window", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on("close-window", (e) => BrowserWindow.fromWebContents(e.sender)?.close());

// ---------------- impressão do comprovante ----------------
ipcMain.handle("list-printers", async () => {
  if (!mainWindow) return [];
  try {
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
  } catch {
    return [];
  }
});

ipcMain.handle("get-receipt-printer", () => readConfig().PRINTER_NAME || "");

ipcMain.handle("set-receipt-printer", (_e, name) => {
  const c = readConfig();
  c.PRINTER_NAME = String(name || "");
  writeConfig(c);
  buildTrayMenu();
  return c.PRINTER_NAME;
});

ipcMain.handle("print-receipt", async () => {
  if (!mainWindow) return { ok: false, reason: "sem janela" };
  const deviceName = readConfig().PRINTER_NAME || "";
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        // silencioso só se já escolheram a impressora; senão mostra o diálogo
        silent: Boolean(deviceName),
        deviceName: deviceName || undefined,
        margins: { marginType: "none" },
        printBackground: false,
      },
      (ok, reason) => resolve({ ok, reason }),
    );
  });
});
