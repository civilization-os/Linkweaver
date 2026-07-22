#!/usr/bin/env node
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Store } from './store.js';
import { createApiRouter } from './api.js';
import { setupMcp } from './mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function main() {
  const store = new Store(process.env.LINKWEAVER_DATA_DIR);
  await store.init();

  // Start Express API Server
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  const apiRouter = createApiRouter(store);
  app.use('/api', apiRouter);

  // MCP Streamable HTTP (recommended by current MCP SDK)
  const streamableTransports = new Map<string, StreamableHTTPServerTransport>();
  const sseTransports = new Map<string, SSEServerTransport>();

  app.get('/mcp/health', (req, res) => {
    res.json({
      ok: true,
      enabled: true,
      transports: ['streamable-http', 'legacy-sse'],
      endpoints: {
        streamableHttp: '/mcp',
        legacySse: '/mcp/sse',
        legacySseMessages: '/mcp/message'
      },
      activeSessions: {
        streamableHttp: streamableTransports.size,
        legacySse: sseTransports.size
      }
    });
  });

  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = getStringHeader(req.headers['mcp-session-id']);
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        transport = streamableTransports.get(sessionId);
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
              streamableTransports.set(initializedSessionId, transport);
            }
          },
        });

        transport.onclose = () => {
          const closedSessionId = transport?.sessionId;
          if (closedSessionId) {
            streamableTransports.delete(closedSessionId);
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

  // MCP legacy HTTP+SSE compatibility.
  app.get('/mcp/sse', async (req, res) => {
    try {
      const sseTransport = new SSEServerTransport('/mcp/message', res);
      sseTransports.set(sseTransport.sessionId, sseTransport);
      res.on('close', () => {
        sseTransports.delete(sseTransport.sessionId);
      });

      const mcpServer = createLinkweaverMcpServer(store);
      await mcpServer.connect(sseTransport);
    } catch (error) {
      console.error('Error opening MCP SSE transport:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to open MCP SSE transport');
      }
    }
  });

  const handleSsePostMessage = async (req: express.Request, res: express.Response) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const transport = sessionId
      ? sseTransports.get(sessionId)
      : Array.from(sseTransports.values()).at(-1);

    if (!transport) {
      res.status(400).send(`No legacy SSE transport is active (active: ${sseTransports.size}, requested sessionId: ${sessionId}). Open GET /mcp/sse first, then POST to /mcp/message?sessionId=...; use /mcp for Streamable HTTP clients.`);
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP SSE message:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to handle MCP SSE message');
      }
    }
  };

  app.post('/mcp/message', handleSsePostMessage);
  app.post('/mcp/sse', handleSsePostMessage);

  // Serve Frontend static files
  let frontendPath = path.join(__dirname, '../../web/dist');
  if (!fs.existsSync(frontendPath)) {
    frontendPath = path.join(__dirname, '../public');
  }
  app.use(express.static(frontendPath));

  // Catch-all to serve index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'), err => {
      if (err) res.status(404).send('Frontend not built yet. Run npm run build in web directory.');
    });
  });

  const port = process.env.LINKWEAVER_API_PORT || 8081;

  app.listen(port, () => {
    console.log(`Linkweaver Server running on port ${port}`);
    console.log(`Web UI: http://localhost:${port}`);
    console.log(`MCP Streamable HTTP: http://localhost:${port}/mcp`);
    console.log(`MCP legacy SSE: http://localhost:${port}/mcp/sse`);
  }).on('error', (err: any) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
