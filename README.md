# Linkweaver

[English](README.md) | [简体中文](README.zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-blue)
![React](https://img.shields.io/badge/react-19-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-blue)
![MCP](https://img.shields.io/badge/MCP-Integrated-orange)

> Intelligent requirement and business architecture collaborative flow system.

Linkweaver combines requirement management, topology-style business flow design, microservice architecture visualization, canvas animation, and Model Context Protocol integration.

## Recommended usage

Linkweaver is no longer distributed or recommended through npm/npx. Use one of these supported modes:

- Desktop app: install the Windows package generated from this repository.
- MCP clients: run the desktop app or `npm run serve`, then connect to Streamable HTTP or legacy SSE.
- Local stdio entrypoint: kept as a compatibility fallback, not the main recommendation.

## Features

- Visual canvas for entities, actors, processes, regions, and data flows.
- Explicit field semantics for PK/FK/UK through `keyRole`; no automatic key inference from field names.
- Business flow highlighting and animation.
- Requirement management with linked canvas elements.
- JSON file persistence with file locking.
- MCP tools for projects, entities, flows, regions, requirements, business flows, search, and canvas formatting.

## Build from source

Prerequisite: Node.js 18+.

```powershell
cd server
npm ci
npm run build
```

Run the desktop app from source:

```powershell
npm start
```

Run the HTTP/SSE service without Electron:

```powershell
npm run serve
```

## MCP configuration

Recommended URL endpoints:

- Streamable HTTP: `http://127.0.0.1:8081/mcp`
- Legacy SSE: `http://127.0.0.1:8081/mcp/sse`

The desktop Settings panel can copy client JSON for both modes.

The stdio entrypoint is still available for local compatibility:

```toml
[mcp_servers.linkweaver]
command = "node"
args = ['D:\project\Workbench\server\dist\index.js']

[mcp_servers.linkweaver.env]
LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
```

See [INSTALL.md](./INSTALL.md) for full installation details.

## Release package

Create a Windows installer:

```powershell
cd server
npm run dist
```

The installer is generated at:

```text
server/dist-electron/Linkweaver Setup <version>.exe
```

## Technology stack

| Layer | Technology |
| --- | --- |
| Desktop | Electron |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| State | Zustand |
| Backend / MCP | Node.js + Express + @modelcontextprotocol/sdk |
| Storage | JSON persistence with file locking |
| Protocols | REST API + MCP stdio + MCP Streamable HTTP + legacy MCP SSE |

## License

MIT License
