# Linkweaver

[English](README.md) | [简体中文](README.zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-blue)
![React](https://img.shields.io/badge/react-19-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-blue)
![MCP](https://img.shields.io/badge/MCP-Integrated-orange)

> 面向需求、业务流程和架构设计的可视化协同工具。

Linkweaver 集成了需求管理、拓扑式业务流设计、微服务架构可视化、画布动画演示，以及 Model Context Protocol（MCP）接入能力。

## 推荐使用方式

Linkweaver 现在不再推荐 npm/npx 分发方式。请使用以下方式：

- 桌面端：使用本仓库构建出的 Windows 安装包。
- Codex 本地 MCP：从源码构建后，直接配置 stdio 入口。
- URL 型 MCP 客户端：运行桌面端或 `npm run serve`，再连接 Streamable HTTP 或旧版 SSE。

## 核心能力

- 可视化画布：实体、角色、流程、区域、数据流。
- 显式字段语义：通过 `keyRole` 标记 PK/FK/UK，不再根据 `id`、`*_id` 等字段名自动推断。
- 业务流程高亮和动画演示。
- 需求管理，并可关联画布节点、连线、区域。
- JSON 文件持久化，带文件锁。
- MCP 工具覆盖项目、实体、连线、区域、需求、业务流程、搜索、画布格式化。

## 源码构建

前置要求：Node.js 18+。

```powershell
cd server
npm ci
npm run build
```

从源码运行桌面端：

```powershell
npm start
```

仅运行 HTTP/SSE 服务，不启动 Electron：

```powershell
npm run serve
```

## MCP 配置

Codex 本地使用时，推荐直接配置构建后的 stdio 入口：

```toml
[mcp_servers.linkweaver]
command = "node"
args = ['D:\project\Workbench\server\dist\index.js']

[mcp_servers.linkweaver.env]
LINKWEAVER_DATA_DIR = 'D:\project\Workbench\data'
```

URL 型客户端可连接：

- Streamable HTTP：`http://127.0.0.1:8081/mcp`
- 旧版 SSE：`http://127.0.0.1:8081/mcp/sse`

完整安装说明见 [INSTALL.md](./INSTALL.md)。

## 发布安装包

生成 Windows 安装包：

```powershell
cd server
npm run dist
```

安装包输出位置：

```text
server/dist-electron/Linkweaver Setup <version>.exe
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面端 | Electron |
| 前端 | React + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 后端 / MCP | Node.js + Express + @modelcontextprotocol/sdk |
| 存储 | JSON 文件持久化 + 文件锁 |
| 协议 | REST API + MCP stdio + MCP Streamable HTTP + legacy MCP SSE |

## License

MIT License
