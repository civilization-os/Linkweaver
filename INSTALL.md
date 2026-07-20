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
npm install
npm run build
```

The MCP entrypoint is generated at:

```powershell
D:\project\Workbench\server\dist\index.js
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

## Notes for Models

- Use `create_entity` and `update_entity` for entities.
- Field key semantics must be explicit:
  - `keyRole = "primary"` for PK
  - `keyRole = "foreign"` for FK
  - `keyRole = "unique"` for UK
  - `ref = "entityId.fieldName"` for confirmed FK targets
- Do not infer PK/FK/UK from field names such as `id`, `*_id`, or same-name fields.
