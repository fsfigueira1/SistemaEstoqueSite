/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');

// Disable GPU acceleration to avoid cache errors on Windows
app.disableHardwareAcceleration();

// Set Electron running flag for auth bypass
process.env.ELECTRON_RUNNING = 'true';

let mainWindow = null;
let nextDevProcess = null;

const isDev = !app.isPackaged;
const DEFAULT_PORT = 3000;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const { spawn: spawnCmd } = require('node:child_process');
    if (process.platform === 'win32') {
      // Windows: find and kill process using the port
      spawnCmd('cmd', ['/c', `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /f /pid %a 2>nul`], { shell: true })
        .on('close', () => resolve());
    } else {
      // Linux/Mac: use lsof and kill
      spawnCmd('sh', ['-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], { shell: true })
        .on('close', () => resolve());
    }
  });
}

function waitForServer(url, retries = 1200, delay = 500) {
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

      request.setTimeout(2000, () => {
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

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  nextDevProcess = spawn(
    npmCommand,
    ['run', 'dev'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, PORT: String(DEFAULT_PORT) },
    }
  );

  nextDevProcess.on('error', (error) => {
    console.error('Erro ao iniciar Next.js:', error);
  });

  nextDevProcess.on('close', (code) => {
    console.log(`Next.js encerrado com código ${code}`);
    nextDevProcess = null;
  });

  return waitForServer(`http://localhost:${DEFAULT_PORT}`);
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
      sandbox: false,
    },
    show: false, // Don't show until ready
  });

  if (isDev) {
    try {
      // Kill any existing process on the default port
      console.log(`Verificando porta ${DEFAULT_PORT}...`);
      const portInUse = await isPortInUse(DEFAULT_PORT);
      if (portInUse) {
        console.log(`Porta ${DEFAULT_PORT} em uso, tentando liberar...`);
        await killProcessOnPort(DEFAULT_PORT);
        // Wait a bit for port to be freed
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await startNextDevServer();

      const devUrl = `http://localhost:${DEFAULT_PORT}`;
      console.log(`Carregando ${devUrl}`);
      await mainWindow.loadURL(devUrl);
      mainWindow.show();
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
      mainWindow.show();
    }
  } else {
    // Production: load from file
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    mainWindow.show();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
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