import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Store } from './store.js';
import { createApiRouter } from './api.js';
import { setupMcp } from './mcp.js';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let mcpServer: Server | null = null;
let expressApp: express.Express | null = null;
let expressServer: any = null;
let sseTransport: SSEServerTransport | null = null;

const gotTheLock = app.requestSingleInstanceLock();
let isQuitting = false;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const userDataPath = app.getPath('userData');
    
    // Migration Logic
    const oldDataPath = path.join(os.homedir(), '.linkweaver');
    if (fs.existsSync(oldDataPath) && !fs.existsSync(path.join(userDataPath, 'projects.json'))) {
      try {
        fs.cpSync(oldDataPath, userDataPath, { recursive: true });
        console.log('Data migrated successfully to', userDataPath);
      } catch (e) {
        console.error('Failed to migrate data', e);
      }
    }

    const store = new Store(userDataPath);
    await store.init();

    // Start Express API Server
    expressApp = express();
    
    // Config settings
    const settingsPath = path.join(userDataPath, 'config.json');
    const getSettings = () => {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch {
        return { mcpEnabled: true, mcpPort: 8081 };
      }
    };
    const saveSettings = (settings: any) => {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    };

    let settings = getSettings();

    const apiRouter = createApiRouter(store);
    
    // Setup MCP Server if enabled
    const setupMcpServer = () => {
      if (!mcpServer) {
        mcpServer = new Server(
          { name: 'Linkweaver MCP TS', version: '1.0.0' },
          { capabilities: { tools: {} } }
        );
        setupMcp(mcpServer, store);
      }

      expressApp!.get('/mcp/sse', async (req, res) => {
        if (!settings.mcpEnabled) {
          res.status(403).send('MCP Disabled');
          return;
        }
        sseTransport = new SSEServerTransport('/mcp/message', res);
        await mcpServer!.connect(sseTransport);
      });

      expressApp!.post('/mcp/message', async (req, res) => {
        if (!settings.mcpEnabled) {
          res.status(403).send('MCP Disabled');
          return;
        }
        if (sseTransport) {
          await sseTransport.handlePostMessage(req, res);
        } else {
          res.status(400).send('No SSE transport');
        }
      });
    };

    setupMcpServer();

    expressApp.use('/api', apiRouter);

    // Serve Frontend static files
    let frontendPath = path.join(__dirname, '../../web/dist');
    if (!fs.existsSync(frontendPath)) {
      frontendPath = path.join(__dirname, '../public');
    }
    expressApp.use(express.static(frontendPath));

    // Catch-all to serve index.html for React Router
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'), err => {
        if (err) res.status(404).send('Frontend not built yet.');
      });
    });

    const startServer = () => {
      if (expressServer) {
        expressServer.close();
      }
      expressServer = expressApp!.listen(settings.mcpPort, () => {
        console.log(`Server running on port ${settings.mcpPort}`);
      }).on('error', (err: any) => {
        console.error('Failed to start server:', err);
      });
    };

    startServer();

    // IPC Handlers for Settings
    ipcMain.handle('get-settings', () => getSettings());
    ipcMain.handle('save-settings', (event, newSettings) => {
      const oldPort = settings.mcpPort;
      settings = { ...settings, ...newSettings };
      saveSettings(settings);
      if (oldPort !== settings.mcpPort) {
        startServer(); // restart if port changed
      }
      return settings;
    });

    ipcMain.handle('save-file', async (event, { defaultPath, data }) => {
      if (!mainWindow) return null;
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath });
      if (!canceled && filePath && data) {
        const buffer = Buffer.from(data, 'base64');
        fs.writeFileSync(filePath, buffer);
        return filePath;
      }
      return null;
    });

    ipcMain.handle('show-notification', (event, { title, body }) => {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    });

    
    // Create Tray
    const iconPath = path.join(frontendPath, 'pwa-192x192.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { label: 'Quit', click: () => {
          isQuitting = true;
          app.quit();
        } }
      ]);
      tray.setToolTip('Linkweaver');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      });
    }

    // Create Window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: iconPath,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: 'rgba(255, 255, 255, 0)',
        symbolColor: '#52525b',
        height: 48
      },
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Disable default menu to avoid accidental refresh
    if (process.env.NODE_ENV !== 'development') {
      Menu.setApplicationMenu(null);
    }

    try {
      mainWindow.setBackgroundMaterial('mica');
    } catch (e) {
      // mica not supported on all platforms
    }

    const loadApp = () => {
      if (process.env.NODE_ENV === 'development') {
        mainWindow?.loadURL('http://localhost:5173');
      } else {
        mainWindow?.loadURL(`http://localhost:${settings.mcpPort}`);
      }
    };
    
    loadApp();

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  });

  app.on('window-all-closed', () => {
    // Override default behavior to keep app running in tray
  });
}
