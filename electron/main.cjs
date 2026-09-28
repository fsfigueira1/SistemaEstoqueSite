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
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");
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

// ---------------- configuração (DATABASE_URL etc.) ----------------
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

// Gravação segura: escreve num arquivo temporário e troca de uma vez, e
// guarda uma cópia (.bak). Uma queda de energia no meio da gravação não
// apaga mais a configuração do banco.
function readConfig() {
  for (const p of [CONFIG_PATH, CONFIG_PATH + ".bak"]) {
    try {
      const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
      if (cfg && typeof cfg === "object") return cfg;
    } catch {
      /* tenta a próxima */
    }
  }
  return {};
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const data = JSON.stringify(cfg, null, 2);
  const tmp = CONFIG_PATH + ".tmp";
  fs.writeFileSync(tmp, data);
  try {
    if (fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + ".bak");
  } catch {
    /* sem cópia, segue */
  }
  fs.renameSync(tmp, CONFIG_PATH);
}

// ---------------- log em arquivo (para suporte) ----------------
// %APPDATA%\Laçolaria\logs\app.log — erros do app e do servidor interno.
const LOG_DIR = path.join(app.getPath("userData"), "logs");
let logStream = null;
function logFile() {
  if (logStream) return logStream;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const p = path.join(LOG_DIR, "app.log");
    try {
      // não deixa crescer sem fim: passou de 5 MB, guarda o antigo e recomeça
      if (fs.statSync(p).size > 5 * 1024 * 1024) fs.renameSync(p, path.join(LOG_DIR, "app.old.log"));
    } catch {
      /* ainda não existe */
    }
    logStream = fs.createWriteStream(p, { flags: "a" });
    logStream.on("error", () => {
      logStream = null;
    });
  } catch {
    logStream = null;
  }
  return logStream;
}
function log(...args) {
  const text = (a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  };
  const line = `[${new Date().toISOString()}] ${args.map(text).join(" ")}\n`;
  try {
    process.stderr.write(line);
  } catch {
    /* sem console */
  }
  const s = logFile();
  if (s) s.write(line);
}

// Nenhum erro inesperado derruba o app do balcão: registra e segue.
process.on("uncaughtException", (err) => log("[main] erro inesperado:", err));
process.on("unhandledRejection", (err) => log("[main] promessa sem tratamento:", err));
// Pasta do backup automático diário (Configurações → Backup). Dá para trocar
// por uma pasta do Google Drive/OneDrive para ter cópia fora da loja.
function backupDir() {
  return readConfig().BACKUP_DIR || path.join(app.getPath("documents"), "Lacolaria Backups");
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
    LACOLARIA_BACKUP_DIR: backupDir(),
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
      env: { ...process.env, PORT: String(PORT), LACOLARIA_BACKUP_DIR: backupDir() },
    });
  } else {
    const entry = serverEntry();
    // lacolaria-server.cjs = server.js + "vigia": se este app fechar de
    // qualquer jeito (travou, Gerenciador de Tarefas), o servidor fecha junto
    // e não fica um Laçolaria.exe perdido segurando a porta e os arquivos.
    const wrapper = path.join(path.dirname(entry), "lacolaria-server.cjs");
    const script = fs.existsSync(wrapper) ? wrapper : entry;
    // roda como node puro usando o próprio Electron
    serverProc = spawn(process.execPath, [script], {
      cwd: path.dirname(entry),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...getEnvForServer(), ELECTRON_RUN_AS_NODE: "1", LACOLARIA_PARENT_PID: String(process.pid) },
    });
    const pipe = (stream) =>
      stream &&
      stream.on("data", (chunk) => {
        const s = logFile();
        if (s) s.write(chunk);
      });
    pipe(serverProc.stdout);
    pipe(serverProc.stderr);
  }
  serverStartedAt = Date.now();

  serverProc.on("exit", (code) => {
    log(`[servidor] saiu com código ${code}`);
    serverProc = null;
    if (quitting) return;
    // sobe de novo — o app não pode ficar parado. Se cair logo depois de
    // subir, espera mais a cada vez (até 30s) para não ficar em loop.
    serverFailures = Date.now() - serverStartedAt > 60_000 ? 1 : serverFailures + 1;
    const delay = Math.min(30_000, 1500 * 2 ** (serverFailures - 1));
    clearTimeout(serverRestartTimer);
    serverRestartTimer = setTimeout(() => {
      startServer();
      if (mainWindow) waitForServer().then(() => mainWindow.reload()).catch(() => {});
    }, delay);
  });
  serverProc.on("error", (err) => log("[servidor] erro:", err));
}
let serverStartedAt = 0;
let serverFailures = 0;

function stopServer() {
  quitting = true;
  clearTimeout(serverRestartTimer);
  if (serverProc) {
    const pid = serverProc.pid;
    try {
      if (process.platform === "win32" && pid) {
        // mata o servidor e tudo que ele abriu — senão sobra um Laçolaria.exe
        // segurando os arquivos e o instalador da atualização falha no meio
        // (desinstala a versão velha e não consegue pôr a nova)
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
      } else {
        serverProc.kill();
      }
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
  if (!mainWindow || mainWindow.isDestroyed()) return;
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

  // links externos (ex.: lojas da pesquisa de preço) abrem no navegador padrão,
  // não numa janela solta do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
      return { action: "deny" };
    }
    return { action: "allow" };
  });

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
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
  };
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    log("[janela] tela caiu:", details && details.reason);
    guardedReload();
  });
  // "Não respondendo" pode ser só uma tarefa pesada (leitura da lista escolar,
  // relatório grande). Só recarrega se continuar travada por 30s — antes,
  // recarregava na hora e apagava o carrinho no meio da venda.
  let hangTimer = null;
  mainWindow.webContents.on("unresponsive", () => {
    if (hangTimer) return;
    hangTimer = setTimeout(() => {
      hangTimer = null;
      log("[janela] travada por 30s — recarregando");
      guardedReload();
    }, 30_000);
  });
  mainWindow.webContents.on("responsive", () => {
    clearTimeout(hangTimer);
    hangTimer = null;
  });
  // Página do sistema não carregou (servidor reiniciando): espera e tenta de novo
  let failLoads = [];
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || quitting || code === -3 /* ABORTED */) return;
    if (!String(url || "").startsWith(BASE_URL)) return;
    log("[janela] falhou ao carregar:", code, desc);
    const now = Date.now();
    failLoads = failLoads.filter((t) => now - t < 60_000);
    failLoads.push(now);
    if (failLoads.length > 5) {
      setupErrorPage("O sistema não está respondendo. Use Recarregar na bandeja ou reinicie o app.");
      return;
    }
    waitForServer()
      .then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) return mainWindow.loadURL(url);
      })
      .catch((err) => {
        log("[janela] nova tentativa falhou:", err);
        // servidor não voltou em 90s: mostra a tela de ajuda em vez da página de erro do Chrome
        if (err && /não respondeu/.test(String(err.message))) setupErrorPage(err.message);
      });
  });

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
    {
      // volta para o sistema (a tela de erro é uma página à parte — recarregar
      // ela só mostraria o erro de novo)
      label: "Recarregar",
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return showWindow();
        if (quitting) return;
        if (!serverProc) {
          clearTimeout(serverRestartTimer);
          startServer();
        }
        waitForServer()
          .then(() => mainWindow.loadURL(BASE_URL))
          .catch((err) => setupErrorPage(err && err.message ? err.message : err));
        showWindow();
      },
    },
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
      label: `Instalar a versão ${updateReady.version}`,
      click: () => askInstall(),
    });
  } else if (updateDownloading) {
    items.push({ label: "Baixando atualização…", enabled: false });
  } else {
    items.push({ label: "Verificar atualizações", click: () => checkForUpdates() });
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

// ---------------- atualização (GitHub Releases) — só quando o usuário pede ----------------
// Nada é verificado, baixado ou instalado sozinho: só pelo "Verificar atualizações"
// da bandeja, e sempre perguntando antes.
let updateDownloading = false;

function installUpdateNow() {
  quitting = true;
  // derruba o servidor (e filhos) antes de chamar o instalador, e dá um tempo
  // para o Windows soltar os arquivos
  stopServer();
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      w.destroy();
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 2000);
}

function askInstall() {
  dialog
    .showMessageBox(mainWindow || null, {
      type: "info",
      buttons: ["Instalar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização pronta",
      message: `A versão ${updateReady.version} foi baixada.`,
      detail: "O Laçolaria fecha, instala e abre sozinho (leva menos de um minuto). Se escolher Depois, instale pela bandeja quando quiser.",
    })
    .then(({ response }) => {
      if (response === 0) installUpdateNow();
    })
    .catch(() => {});
}

function checkForUpdates() {
  if (isDev) {
    dialog.showMessageBox(mainWindow || null, {
      type: "info",
      message: "Atualização só funciona no app instalado.",
      buttons: ["OK"],
    });
    return;
  }
  if (updateReady) return askInstall();
  if (updateDownloading) {
    dialog.showMessageBox(mainWindow || null, { type: "info", message: "A atualização já está sendo baixada.", buttons: ["OK"] });
    return;
  }
  autoUpdater
    .checkForUpdates()
    .then((res) => {
      const info = res && res.updateInfo;
      const newer = info && res.isUpdateAvailable !== false && info.version !== app.getVersion();
      if (!newer) {
        return dialog.showMessageBox(mainWindow || null, {
          type: "info",
          title: "Atualização",
          message: `Você já está na última versão (${app.getVersion()}).`,
          buttons: ["OK"],
        });
      }
      return dialog
        .showMessageBox(mainWindow || null, {
          type: "question",
          title: "Atualização",
          buttons: ["Baixar", "Agora não"],
          defaultId: 0,
          cancelId: 1,
          message: `Versão ${info.version} disponível (você usa a ${app.getVersion()}).`,
          detail: "Baixa em segundo plano; você continua usando e escolhe quando instalar.",
        })
        .then(({ response }) => {
          if (response !== 0) return;
          updateDownloading = true;
          buildTrayMenu();
          return autoUpdater.downloadUpdate();
        });
    })
    .catch((err) => {
      updateDownloading = false;
      buildTrayMenu();
      log("[update] falha:", err);
      dialog.showMessageBox(mainWindow || null, {
        type: "error",
        title: "Atualização",
        message: "Não consegui atualizar agora.",
        detail: String((err && err.message) || err),
        buttons: ["OK"],
      });
    });
}

function setupAutoUpdate() {
  if (isDev) return;
  autoUpdater.autoDownload = false; // nunca baixa sem pedir
  autoUpdater.autoInstallOnAppQuit = false; // nunca instala escondido ao sair/desligar
  autoUpdater.on("error", (err) => log("[update] erro:", err));
  autoUpdater.on("update-downloaded", (info) => {
    updateDownloading = false;
    updateReady = { version: info && info.version };
    buildTrayMenu();
    if (tray) tray.setToolTip(`Laçolaria — versão ${updateReady.version} pronta para instalar`);
    askInstall();
  });
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

// ---------------- backup ----------------
ipcMain.handle("open-backup-folder", async () => {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  return { ok: !err, dir };
});

// Troca a pasta e reinicia o servidor interno (ele lê a pasta ao subir).
ipcMain.handle("choose-backup-folder", async () => {
  if (!mainWindow) return { ok: false };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: "Pasta do backup",
    defaultPath: backupDir(),
    properties: ["openDirectory", "createDirectory"],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const c = readConfig();
  c.BACKUP_DIR = r.filePaths[0];
  writeConfig(c);
  if (serverProc) {
    try {
      serverProc.kill(); // sobe de novo sozinho e recarrega a janela
    } catch {
      /* ignore */
    }
  }
  return { ok: true, dir: c.BACKUP_DIR };
});

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

// pageSize (opcional): { width, height } em microns, calculado no renderer a
// partir da largura configurada (58/80mm) e da altura real do comprovante
// renderizado. Sem isso, o Electron às vezes usa o tamanho de página padrão
// do driver da impressora em vez do @page do CSS — e o texto sai cortado na
// lateral (ou sobra papel em branco) quando o driver não bate com a bobina.
ipcMain.handle("print-receipt", async (_e, pageSize) => {
  if (!mainWindow) return { ok: false, reason: "sem janela" };
  const deviceName = readConfig().PRINTER_NAME || "";
  const printOptions = {
    // silencioso só se já escolheram a impressora; senão mostra o diálogo
    silent: Boolean(deviceName),
    deviceName: deviceName || undefined,
    margins: { marginType: "none" },
    printBackground: false,
  };
  if (pageSize && Number(pageSize.width) > 0 && Number(pageSize.height) > 0) {
    printOptions.pageSize = {
      width: Math.round(Number(pageSize.width)),
      height: Math.round(Number(pageSize.height)),
    };
  }
  return new Promise((resolve) => {
    mainWindow.webContents.print(printOptions, (ok, reason) => resolve({ ok, reason }));
  });
});
