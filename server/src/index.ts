#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { Store } from './store.js';
import { setupMcp } from './mcp.js';

dotenv.config();

async function main() {
  const store = new Store(process.env.LINKWEAVER_DATA_DIR);
  await store.init();

  // Setup MCP Server
  const server = new Server(
    { name: 'Linkweaver MCP TS', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  setupMcp(server, store);

  // Connect MCP via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
