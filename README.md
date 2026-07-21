# Linkweaver

[English](README.md) | [简体中文](README.zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-blue)
![MCP](https://img.shields.io/badge/MCP-Integrated-orange)

> Intelligent Requirement & Business Architecture Collaborative Flow System

Linkweaver is a next-generation visual architecture design tool that integrates **requirement management, topological business flow design, microservice architecture visualization, dynamic business flow demonstration, and Model Context Protocol (MCP) AI integration**.

## ✨ Core Features

### 🗺️ Visual Canvas
- **Entity Nodes** (Data Tables / Services / Roles) drag-and-drop layout with field definition support.
- **Regions**, partitioned by service domains, supporting collapse/expand.
- **Edges**, supporting forward, reverse, and bidirectional data flows.
- **Canvas Zoom** and view reset with zoom-to-fit capability.

### 🔥 Business Flows
- Create and manage multiple business flows (e.g., "User Login to Purchase Pipeline").
- When a business flow is selected, relevant nodes and edges are highlighted while others are faded out for noise reduction.
- **Particle Flow Animation**: A glowing energy ball travels from the start node across edges and nodes along the business flow path.
  - Nodes emit neon pulse flash effects when "touched" by the particle.
  - Real-time playback speed adjustment (200ms - 2000ms).

### 🤖 MCP Protocol Integration
Exposes a complete API via the Model Context Protocol (MCP), allowing Large Language Models (LLMs) to directly manipulate projects:
- `list_projects` / `query_project` / `get_project`
- `create_entity` / `update_entity` / `delete_entity` / `duplicate_entity` / `align_entities`
- `create_flow` / `update_flow` / `delete_flow` (`update_edge` / `delete_edge` as compatible aliases)
- `list_requirements` / `create_requirement` / `update_requirement` / `delete_requirement`
- `list_business_flows` / `create_business_flow` / `update_business_flow` / `delete_business_flow`

### 📊 Project Management
- Multi-project switching and requirement document management.
- Automatic canvas layout formatting (Format).
- PNG / GIF export.

## 🚀 Quick Start

For Codex global MCP installation instructions, see: [INSTALL.md](./INSTALL.md)

### Prerequisites
- Node.js 18+

### Starting the Development Environment

```bash
# 1. Start Frontend and Backend (MCP Server includes frontend serving)
cd server
npm install
npm run build
npm start
```

Visit http://localhost:8081 in your browser.

### MCP Configuration

Add the following to the MCP configuration of AI tools (like Claude Desktop, Cursor):

**Method 1: Run directly using NPM (Recommended)**
```json
{
  "mcpServers": {
    "linkweaver": {
      "command": "npx",
      "args": ["-y", "linkweaver"],
      "env": {
        "LINKWEAVER_DATA_DIR": "Your local data storage path (e.g., D:\\LinkweaverData)"
      }
    }
  }
}
```

**Method 2: Run from local source code**
```json
{
  "mcpServers": {
    "linkweaver": {
      "command": "node",
      "args": ["D:\\project\\Workbench\\server\\dist\\index.js"],
      "env": {
        "LINKWEAVER_DATA_DIR": "D:\\project\\Workbench\\data"
      }
    }
  }
}
```

## 🏗️ Technology Stack

| Layer | Technology |
|------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State Management | Zustand |
| Backend / MCP | Node.js + TypeScript + @modelcontextprotocol/sdk |
| Data Storage | JSON file persistence (with file locking mechanism) |
| Protocol | REST API + MCP stdio |

## 📁 Project Structure

```
Linkweaver/
├── web/          # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/       # Main Canvas
│   │   │   ├── Toolbar/      # Toolbar
│   │   │   ├── Sidebar/      # Project Sidebar
│   │   │   └── CanvasSidePanel/  # Business Flow Panel
│   │   ├── store/            # Zustand State
│   │   └── types/            # TypeScript Types
└── server/       # Node.js Backend / MCP Server
    ├── src/
    │   ├── index.ts   # Main entry, port detection and service mounting
    │   ├── api.ts     # REST API routes
    │   ├── mcp.ts     # MCP tool registration
    │   ├── store.ts   # JSON I/O and file locks
    │   └── models.ts  # Data models
```

## 📝 License

MIT License
