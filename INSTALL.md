# Install Linkweaver MCP

This guide describes the supported local MCP setup for Linkweaver.

## Recommended transport

Use URL-based MCP as the main path:

- Streamable HTTP: `http://127.0.0.1:8081/mcp`
- Legacy SSE: `http://127.0.0.1:8081/mcp/sse`

Use Streamable HTTP when the client supports it. Use SSE only for clients that have not adopted Streamable HTTP yet.

The stdio entrypoint is still available as a local compatibility fallback, but it is not the recommended setup.

## Prerequisites

- Node.js 18+
- This repository cloned locally, or the Linkweaver desktop app installed

The examples below use this repository path:

```powershell
D:\project\Workbench
```

If your path is different, replace it in the commands and config.

## Build from source

```powershell
cd D:\project\Workbench\server
npm ci
npm run build
```

Generated entrypoints:

```powershell
D:\project\Workbench\server\dist\server.js
D:\project\Workbench\server\dist\index.js
```

## Start HTTP/SSE MCP service

Option A: run the desktop app and enable HTTP/SSE MCP service in Settings.

Option B: run the standalone service:

```powershell
cd D:\project\Workbench\server
npm run serve
```

Optional environment variables:

```powershell
$env:LINKWEAVER_API_PORT = '8081'
$env:LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
npm run serve
```

## Client configuration

Streamable HTTP:

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

Legacy SSE:

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

The desktop Settings panel also provides copyable JSON for both modes.

## Compatibility fallback: stdio

Use this only when a local client requires stdio or cannot connect to the URL transport.

```toml
[mcp_servers.linkweaver]
command = "node"
args = ['D:\project\Workbench\server\dist\index.js']

[mcp_servers.linkweaver.env]
LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
```

## Notes for models

- Use `create_entity` and `update_entity` for entities.
- Field key semantics must be explicit:
  - `keyRole = "primary"` for PK
  - `keyRole = "foreign"` for FK
  - `keyRole = "unique"` for UK
  - `ref = "entityId.fieldName"` for confirmed FK targets
- Do not infer PK/FK/UK from field names such as `id`, `*_id`, or same-name fields.
