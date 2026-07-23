import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Store } from './store.js';
import { createApiRouter } from './api.js';
import { setupMcp } from './mcp.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let expressApp: express.Express | null = null;
let expressServer: any = null;
const activeSseTransports = new Map<string, SSEServerTransport>();
const activeHttpTransports = new Map<string, StreamableHTTPServerTransport>();

const gotTheLock = app.requestSingleInstanceLock();
let isQuitting = false;

function createLinkweaverMcpServer(store: Store) {
  const server = new Server(
    { name: 'Linkweaver MCP TS', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  setupMcp(server, store);
  return server;
}

function getStringHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedLocalOrigin(origin: string | undefined, port: number) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    return allowedHosts.has(url.hostname) && (!url.port || url.port === String(port) || url.port === '5173');
  } catch {
    return false;
  }
}

async function closeActiveMcpTransports() {
  const transports = [
    ...Array.from(activeSseTransports.values()),
    ...Array.from(activeHttpTransports.values()),
  ];
  activeSseTransports.clear();
  activeHttpTransports.clear();

  await Promise.allSettled(transports.map(transport => transport.close()));
}

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

    expressApp.use(cors({
      origin: (origin, callback) => {
        callback(isAllowedLocalOrigin(origin, settings.mcpPort) ? null : new Error('Origin not allowed'), true);
      },
    }));
    expressApp.use(express.json({ limit: '10mb' }));

    // Enable verbose MCP request logging only when explicitly debugging locally.
    expressApp.use((req, res, next) => {
      if (process.env.LINKWEAVER_MCP_DEBUG === '1' && req.url.startsWith('/mcp')) {
        const bodyStr = req.body === undefined ? '' : JSON.stringify(req.body).slice(0, 2000);
        const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url}\nBody: ${bodyStr}\n`;
        fs.appendFileSync(path.join(userDataPath, 'mcp_debug.log'), logLine);
      }
      next();
    });

    const apiRouter = createApiRouter(store);

    expressApp.get('/mcp/health', (req, res) => {
      res.status(settings.mcpEnabled ? 200 : 503).json({
        ok: Boolean(settings.mcpEnabled),
        enabled: Boolean(settings.mcpEnabled),
        transports: ['streamable-http', 'legacy-sse'],
        endpoints: {
          streamableHttp: '/mcp',
          legacySse: '/mcp/sse',
          legacySseMessages: '/mcp/message'
        },
        activeSessions: {
          streamableHttp: activeHttpTransports.size,
          legacySse: activeSseTransports.size
        }
      });
    });
    
    // Setup MCP Server if enabled
    const setupMcpServer = () => {
      expressApp!.all('/mcp', async (req, res) => {
        if (!settings.mcpEnabled) {
          res.status(403).send('MCP HTTP/SSE service is disabled in Linkweaver Settings. Enable it before connecting.');
          return;
        }

        try {
          const sessionId = getStringHeader(req.headers['mcp-session-id']);
          let transport: StreamableHTTPServerTransport | undefined;

          if (sessionId) {
            transport = activeHttpTransports.get(sessionId);
            if (!transport) {
              res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'MCP Streamable HTTP session not found. Re-initialize with POST /mcp or reconnect the client.' },
                id: null,
              });
              return;
            }
          } else if (req.method === 'POST' && isInitializeRequest(req.body)) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: initializedSessionId => {
                if (transport) {
                  activeHttpTransports.set(initializedSessionId, transport);
                }
              },
            });

            transport.onclose = () => {
              const closedSessionId = transport?.sessionId;
              if (closedSessionId) {
                activeHttpTransports.delete(closedSessionId);
              }
            };

            const mcpServer = createLinkweaverMcpServer(store);
            await mcpServer.connect(transport);
          } else {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Bad Request: no valid MCP session. Use POST /mcp to initialize Streamable HTTP, or GET /mcp/sse for legacy SSE clients.' },
              id: null,
            });
            return;
          }

          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          console.error('Error handling MCP Streamable HTTP request:', error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal MCP server error while handling Streamable HTTP request.' },
              id: null,
            });
          }
        }
      });

      expressApp!.get('/mcp/sse', async (req, res) => {
        if (!settings.mcpEnabled) {
          res.status(403).send('MCP HTTP/SSE service is disabled in Linkweaver Settings. Enable it before connecting.');
          return;
        }
        
        // Use a robust connection-per-client model
        const sseTransport = new SSEServerTransport('/mcp/message', res);
        activeSseTransports.set(sseTransport.sessionId, sseTransport);

        const mcpServer = createLinkweaverMcpServer(store);

        res.on('close', () => {
          if (process.env.LINKWEAVER_MCP_DEBUG === '1') {
            fs.appendFileSync(path.join(userDataPath, 'mcp_debug.log'), `[DEBUG] GET connection closed for sessionId: ${sseTransport.sessionId}\n`);
          }
          activeSseTransports.delete(sseTransport.sessionId);
        });

        mcpServer.connect(sseTransport).catch(err => {
          console.error("MCP Server connect error:", err);
        });
      });

      const handlePostMessage = async (req: express.Request, res: express.Response) => {
        if (!settings.mcpEnabled) {
          res.status(403).send('MCP HTTP/SSE service is disabled in Linkweaver Settings. Enable it before connecting.');
          return;
        }
        
        const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
        if (!sessionId) {
          res.status(400).send('Missing legacy SSE sessionId. Open GET /mcp/sse first, then POST to /mcp/message?sessionId=...');
          return;
        }

        const transport = activeSseTransports.get(sessionId);

        if (transport) {
          if (process.env.LINKWEAVER_MCP_DEBUG === '1') {
            fs.appendFileSync(path.join(userDataPath, 'mcp_debug.log'), `[DEBUG] Transport found for POST. Handling message...\n`);
          }
          await transport.handlePostMessage(req, res, req.body);
        } else {
          const errStr = `No legacy SSE transport is active (active: ${activeSseTransports.size}, requested sessionId: ${sessionId}). Open GET /mcp/sse first, then POST to /mcp/message?sessionId=...; use /mcp for Streamable HTTP clients.`;
          if (process.env.LINKWEAVER_MCP_DEBUG === '1') {
            fs.appendFileSync(path.join(userDataPath, 'mcp_debug.log'), `[DEBUG] 400 ERROR: ${errStr}\n`);
          }
          res.status(400).send(errStr);
        }
      };

      expressApp!.post('/mcp/sse', handlePostMessage);
      expressApp!.post('/mcp/message', handlePostMessage);
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
    ipcMain.handle('get-mcp-config-info', () => {
      return {
        scriptPath: path.join(__dirname, 'index.js').replace(/\\/g, '\\\\'),
        dataDir: userDataPath.replace(/\\/g, '\\\\')
      };
    });
    ipcMain.handle('save-settings', (event, newSettings) => {
      const oldPort = settings.mcpPort;
      const wasMcpEnabled = settings.mcpEnabled;
      settings = { ...settings, ...newSettings };
      saveSettings(settings);
      if (wasMcpEnabled && !settings.mcpEnabled) {
        closeActiveMcpTransports().catch(err => {
          console.error('Failed to close active MCP transports:', err);
        });
      }
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
