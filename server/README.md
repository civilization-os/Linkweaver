# Linkweaver

> 智能需求与业务架构协同流图系统

Linkweaver 是一个融合了**需求梳理、拓扑业务流设计、微服务架构可视化、动态业务流演示以及 MCP 协议 AI 联动**的新一代可视化架构设计工具。

## ✨ 核心特性

### 🗺️ 可视化画布
- **实体节点**（数据表/服务/角色）拖拽布局，支持字段定义
- **区域分组**（Region），按服务领域划分，支持折叠/展开
- **连接线**，支持正向/反向/双向数据流
- **画布缩放**与视图重置

### 🔥 业务流（Business Flow）
- 创建并管理多个业务流程（如"用户登录到购买全链路"）
- 选中业务流后，相关节点和线段单独高亮，其余元素虚化降噪
- **粒子流向动画**：一枚发光能量球从起始节点出发，沿业务流路径飞越各节点和连接线
  - 节点被"触碰"时会产生霓虹脉冲闪光特效
  - 支持播放速度实时调节（200ms - 2000ms）

### 🤖 MCP 协议集成
通过 Model Context Protocol（MCP）暴露完整 API，大模型可直接操作项目：
- list_projects / get_project
- create_node / update_node / delete_node / duplicate_entity / align_entities
- create_edge / update_edge / delete_edge
- list_business_flows / create_business_flow / update_business_flow / delete_business_flow

### 📊 项目管理
- 多项目切换，需求文档管理
- 画布自动布局（Format）
- PNG / GIF 导出

## 🚀 快速开始

### 前置要求
- Node.js 18+

### 启动开发环境

```bash
# 1. 启动前端和后端（MCP Server 内置前端伺服）
cd server
npm install
npm run build
npm start
```

浏览器访问 http://localhost:8081

### MCP 接入配置

在 AI 工具（如 Claude Desktop、Cursor）的 MCP 配置中添加：

**方式一：使用 NPM 直接运行（推荐）**
```json
{
  "mcpServers": {
    "linkweaver": {
      "command": "npx",
      "args": ["-y", "linkweaver"],
      "env": {
        "LINKWEAVER_DATA_DIR": "你的本地数据存储路径（例如：D:\\LinkweaverData）"
      }
    }
  }
}
```

**方式二：本地源码运行**
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

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand |
| 后端 / MCP | Node.js + TypeScript + @modelcontextprotocol/sdk |
| 数据存储 | JSON 文件持久化 (带文件锁机制) |
| 协议 | REST API + MCP stdio |

## 📁 项目结构

```
Linkweaver/
├── web/          # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/       # 主画布
│   │   │   ├── Toolbar/      # 工具栏
│   │   │   ├── Sidebar/      # 项目侧边栏
│   │   │   └── CanvasSidePanel/  # 业务流面板
│   │   ├── store/            # Zustand 状态
│   │   └── types/            # TypeScript 类型
└── server/       # Node.js 后端 / MCP Server
    ├── src/
    │   ├── index.ts   # 主入口，端口侦测与服务挂载
    │   ├── api.ts     # REST API 路由
    │   ├── mcp.ts     # MCP 工具注册
    │   ├── store.ts   # JSON 读写与文件锁
    │   └── models.ts  # 数据模型
```

## 📝 许可证

MIT License
