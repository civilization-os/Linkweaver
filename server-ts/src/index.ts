import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Store } from './store.js';
import { createApiRouter } from './api.js';
import { setupMcp } from './mcp.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const store = new Store(process.env.REQFLOW_DATA_DIR);
  await store.init();

  // Setup MCP Server
  const server = new Server(
    { name: 'ReqFlow MCP TS', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  setupMcp(server, store);

  // Start Express API Server
  const app = express();
  const apiRouter = createApiRouter(store);
  app.use('/api', apiRouter);

  // Serve Frontend static files
  const frontendPath = path.join(__dirname, '../../web/dist');
  app.use(express.static(frontendPath));

  // Catch-all to serve index.html for React Router (if needed)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'), err => {
      if (err) res.status(404).send('Frontend not built yet. Run npm run build in web directory.');
    });
  });

  const port = process.env.REQFLOW_API_PORT || 8081;

  app.listen(port, () => {
    // We only reach here if the port was successfully bound
    // This is the master process that serves the UI and API
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      // Port in use - skip starting frontend and API. 
      // The MCP Server will just operate as a proxy/client writing to the JSON file via locks.
      // Do nothing! This is the desired behavior for multi-agent process isolation.
    } else {
      console.error(err);
    }
  });

  // Finally, connect MCP via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
