# Linkweaver Server

This package contains the Electron main process, Express API server, MCP server, and Windows packaging configuration.

## Current distribution policy

Do not use npm/npx as the recommended distribution path. Build from this repository and use:

- `dist/server.js` for standalone HTTP/SSE MCP service.
- `dist/index.js` for local stdio compatibility fallback.
- Electron installer from `dist-electron` for desktop usage.

## Build

```powershell
npm ci
npm run build
```

## Run

Desktop app:

```powershell
npm start
```

Standalone HTTP/SSE service:

```powershell
npm run serve
```

## Package

```powershell
npm run dist
```

Installer output:

```text
dist-electron/Linkweaver Setup <version>.exe
```

## MCP transports

- Streamable HTTP: `http://127.0.0.1:8081/mcp`
- Legacy SSE: `http://127.0.0.1:8081/mcp/sse`
- stdio fallback: `dist/index.js`

The desktop settings switch only controls the built-in HTTP/SSE MCP service. It does not control stdio fallback processes.
