// Preload scripts run in a renderer process before it loads.
// They have access to Node.js APIs but are isolated from the main renderer
// for security reasons. Only expose specific, safe APIs to the renderer.

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected IPC channels to the renderer
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Example safe IPC methods - add more as needed for your application
    ping: () => ipcRenderer.invoke('ping'),

    // Add your application-specific IPC methods here
    // Always validate and sanitize inputs before processing in main process
    // Example: Safe barcode scanning result handler
    // handleBarcodeScan: (callback) => ipcRenderer.on('barcode-scan-result', callback),

    // Example: Safe method to get app version
    getAppVersion: () => app.getVersion(),

    // Example: Safe method to minimize window
    minimizeWindow: () => ipcRenderer.send('minimize-window'),

    // Example: Safe method to maximize/restore window
    toggleMaximizeWindow: () => ipcRenderer.send('toggle-maximize-window'),

    // Example: Safe method to close window
    closeWindow: () => ipcRenderer.send('close-window'),
  }
);

// Listen for messages from main process (if needed)
ipcRenderer.on('message-from-main', (event, message) => {
  console.log('Received message from main process:', message);
  // Handle message safely here
});

// Add more secure IPC listeners as needed for your application