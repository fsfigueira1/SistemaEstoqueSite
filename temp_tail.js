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

// Cria a janela principal
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
      // sandbox: false,  // removido para evitar bloqueios no preload
    },
  });

  // Abre DevTools automaticamente para debug (opcional)
  // mainWindow.webContents.openDevTools();

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
  } else {
    // Em produção, carregue o build estático (caso tenha configurado)
    // Exemplo: mainWindow.loadFile(path.join(__dirname, 'out', 'index.html'));
    // Para este exemplo, mantemos o comportamento de desenvolvimento
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Quando o app estiver pronto
app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Encerra o processo do Next.js ao fechar
app.on('before-quit', () => {
  if (nextDevProcess) {
    nextDevProcess.kill();
    nextDevProcess = null;
  }
});

// Fecha o app se todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
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
  if (win) win.close();
});