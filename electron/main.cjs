/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

let mainWindow = null;
let nextDevProcess = null;

const isDev = !app.isPackaged;
const NEXT_DEV_URL = 'http://localhost:3000';

function waitForServer(url, retries = 60, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }

        retry();
      });

      request.on('error', retry);

      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      attempts++;

      if (attempts >= retries) {
        reject(
          new Error(`Next.js não iniciou em ${url}`)
        );
        return;
      }

      setTimeout(check, delay);
    };

    check();
  });
}

function startNextDevServer() {
  if (nextDevProcess) {
    return Promise.resolve();
  }

  console.log('Iniciando Next.js...');

  nextDevProcess = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'dev'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  }
);

  nextDevProcess.on('error', (error) => {
    console.error('Erro ao iniciar Next.js:', error);
  });

  nextDevProcess.on('close', (code) => {
    console.log(`Next.js encerrado com código ${code}`);
    nextDevProcess = null;
  });

  return waitForServer(NEXT_DEV_URL);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    try {
      await startNextDevServer();

      console.log(`Carregando ${NEXT_DEV_URL}`);
      await mainWindow.loadURL(NEXT_DEV_URL);
    } catch (error) {
      console.error('Falha ao iniciar/carregar Next.js:', error);

      await mainWindow.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1>Erro ao iniciar o sistema</h1>
                <pre>${String(error)}</pre>
              </body>
            </html>
          `)
      );
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (nextDevProcess) {
    nextDevProcess.kill();
    nextDevProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('ping', () => 'pong');

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.minimize();
  }
});

ipcMain.on('toggle-maximize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win) return;

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (win) {
    win.close();
  }
});