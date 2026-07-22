# Install Linkweaver MCP in Codex

This guide installs Linkweaver as a global Codex MCP server.

## Prerequisites

- Node.js 18+
- Codex installed on this machine
- This repository cloned locally

The examples below use this repository path:

```powershell
D:\project\Workbench
```

If your path is different, replace it in the commands and config.

## Build

Run this from the repository root:

```powershell
cd D:\project\Workbench\server
npm ci
npm run build
```

The MCP entrypoint is generated at:

```powershell
D:\project\Workbench\server\dist\index.js
```

The HTTP/SSE service entrypoint is generated at:

```powershell
D:\project\Workbench\server\dist\server.js
```

## Configure Codex Globally

Open the Codex config file:

```powershell
C:\Users\<your-user>\.codex\config.toml
```

Add this MCP server block:

```toml
[mcp_servers.linkweaver]
command = "node"
args = ['D:\project\Workbench\server\dist\index.js']
```

Optional: set a dedicated data directory:

```toml
[mcp_servers.linkweaver.env]
LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
```

## Reload Codex

Restart Codex or open a new Codex task so the global MCP config is reloaded.

## Verify

In a new Codex task, ask Codex to use the Linkweaver MCP server, for example:

```text
List Linkweaver projects.
```

The MCP server exposes tools for projects, entities, data flows, regions, requirements, business flows, search, and canvas formatting.

## Optional: HTTP/SSE Mode

Use stdio for local Codex by default. Use HTTP/SSE only when your client requires a URL transport or when you want several MCP clients to connect to one already-running Linkweaver service.

Start the service:

```powershell
cd D:\project\Workbench\server
npm run serve
```

Default endpoints:

- Streamable HTTP, recommended for newer MCP clients: `http://127.0.0.1:8081/mcp`
- Legacy SSE, for older SSE clients: `http://127.0.0.1:8081/mcp/sse`

Optional environment variables:

```powershell
$env:LINKWEAVER_API_PORT = '8081'
$env:LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
npm run serve
```

Example SSE client configuration:

```json
{
  "mcpServers": {
    "linkweaver": {
      "type": "sse",
      "url": "http://127.0.0.1:8081/mcp/sse"
    }
  }
}
```

If your client supports Streamable HTTP, prefer:

```json
{
  "mcpServers": {
    "linkweaver": {
      "type": "http",
      "url": "http://127.0.0.1:8081/mcp"
    }
  }
}
```

## Notes for Models

- Use `create_entity` and `update_entity` for entities.
- Field key semantics must be explicit:
  - `keyRole = "primary"` for PK
  - `keyRole = "foreign"` for FK
  - `keyRole = "unique"` for UK
  - `ref = "entityId.fieldName"` for confirmed FK targets
- Do not infer PK/FK/UK from field names such as `id`, `*_id`, or same-name fields.
