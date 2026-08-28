import path from 'node:path';

export function getDatabaseUrl(): string {
  const isDev = process.env.NODE_ENV === 'development';
  // Check if we're running in Electron
  const isElectron = typeof process !== 'undefined' && 
                     typeof process.versions !== 'undefined' && 
                     typeof process.versions.electron !== 'undefined';

  if (isDev && !isElectron) {
    return 'file:./dev.db';
  }

  // In Electron, use user data directory
  try {
    // Dynamic import to avoid breaking Next.js when electron is not available
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    return `file:${path.join(userDataPath, 'data.db')}`;
  } catch (error) {
    // Fallback for non-Electron production or if electron module not available
    return 'file:./data.db';
  }
}
