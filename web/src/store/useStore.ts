import { create } from 'zustand'
import dagre from 'dagre'
import type { FlowNode, DataFlow, Region, Project, ViewportState, BusinessFlow } from '../types'
import { api } from '../api'

function now() { return Date.now() }

function uid(prefix: string) { return prefix + Math.random().toString(36).slice(2, 8) }

interface AppState {
  projects: Project[]
  activeProjectId: string | null
  selectedNodeIds: string[]
  historyPast: Project[]
  historyFuture: Project[]
  viewport: ViewportState
  selectedEdgeId: string | null
  flowAnimation: boolean
  flowAnimationSpeed: number
  showGrid: boolean
  showThreeColumns: boolean
  canvasDensity: 'compact' | 'standard' | 'detail'
  hoveredRegionId: string | null
  page: 'overview' | 'canvas'
  loading: boolean
  searchQuery: string
  selectedRequirementId: string | null
  linkingRequirementId: string | null
  focusMode: boolean
  currentProject: () => Project | undefined

  init: () => Promise<void>
  setSearchQuery: (q: string) => void
  setPage: (page: 'overview' | 'canvas') => void
  setFocusMode: (focus: boolean) => void
  selectNode: (id: string | null, multi?: boolean) => void
  selectNodes: (ids: string[]) => void
  alignNodes: (ids: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => void
  undo: () => void
  redo: () => void
  recordHistory: () => void
  addProject: (name: string) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  switchProject: (id: string) => void
  setViewport: (vp: Partial<ViewportState>) => void
  moveNode: (id: string, x: number, y: number) => void
  setNodeRegion: (id: string, regionId: string | undefined) => void
  addNode: (node: FlowNode) => void
  updateNode: (id: string, updates: Partial<FlowNode>) => void
  selectEdge: (id: string | null) => void
  setEdgeDir: (id: string, dir: 'fwd' | 'rev' | 'both') => void
  addEdge: (edge: DataFlow) => void
  updateEdge: (edgeId: string, updates: Partial<DataFlow>) => Promise<void>
  deleteEdge: (edgeId: string) => Promise<void>
  toggleFlow: () => void
  setFlowAnimationSpeed: (speed: number) => void
  toggleGrid: () => void
  toggleThreeColumns: () => void
  setCanvasDensity: (density: 'compact' | 'standard' | 'detail') => void
  setHoveredRegion: (id: string | null) => void
  moveRegion: (id: string, dx: number, dy: number) => void
  syncNodePos: (id: string) => void
  syncRegionPos: (id: string) => void
  resizeRegion: (id: string, w: number, h: number) => void
  addRegion: (region: Region) => void
  updateRegion: (id: string, updates: Partial<Region>) => void
  deleteNode: (id: string) => void
  deleteRegion: (id: string) => void
  toggleNodeFieldsCollapse: (id: string) => void
  toggleRegionCollapse: (id: string) => void
  toggleAllRegionsCollapse: (collapsed: boolean) => void
  resetView: () => void
  focusNode: (nodeId: string) => void
  syncCurrentProject: () => Promise<void>
  formatCanvas: (mode?: 'default' | 'rectangle') => Promise<void>
  activeBusinessFlowId: string | null
  selectBusinessFlow: (id: string | null) => void
  addBusinessFlow: (flow: Omit<BusinessFlow, 'id'>) => void
  updateBusinessFlow: (id: string, updates: Partial<BusinessFlow>) => void
  deleteBusinessFlow: (id: string) => void
  editingBusinessFlowId: string | null
  setEditingBusinessFlow: (id: string | null) => void
  toggleNodeInBusinessFlow: (flowId: string, nodeId: string) => void
  toggleEdgeInBusinessFlow: (flowId: string, edgeId: string) => void

  selectRequirement: (id: string | null) => void
  setLinkingRequirement: (id: string | null) => void
  addRequirement: (req: any) => Promise<void>
  updateRequirement: (id: string, updates: any) => Promise<void>
  deleteRequirement: (id: string) => Promise<void>
  toggleNodeInRequirement: (reqId: string, nodeId: string) => void
  toggleEdgeInRequirement: (reqId: string, edgeId: string) => void
  toggleRegionInRequirement: (reqId: string, regionId: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeBusinessFlowId: null,
  editingBusinessFlowId: null,
  selectedNodeIds: [],
  historyPast: [],
  historyFuture: [],
  viewport: { x: 0, y: 0, scale: 1 },
  selectedEdgeId: null,
  flowAnimation: false,
  flowAnimationSpeed: 1000,
  showGrid: true,
  showThreeColumns: true,
  canvasDensity: 'detail',
  hoveredRegionId: null,
  page: 'overview',
  loading: true,
  searchQuery: '',
  selectedRequirementId: null,
  linkingRequirementId: null,
  focusMode: false,

  currentProject: () => get().projects.find(p => p.id === get().activeProjectId),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFocusMode: (focus) => set({ focusMode: focus }),

  init: async () => {
    try {
      const projects = (await api.listProjects()) as Project[]
      if (projects.length > 0) {
        set({ projects, activeProjectId: projects[0].id, loading: false })
      } else {
        // Create a default project via API
        const p = (await api.createProject('新项目')) as Project
        set({ projects: [p], activeProjectId: p.id, loading: false })
      }
    } catch {
      // Offline fallback: create local project
      const p: Project = { id: uid('proj-'), name: '新项目', version: 'v1.0', nodes: [], edges: [], regions: [], requirements: [], createdAt: now(), updatedAt: now() }
      set({ projects: [p], activeProjectId: p.id, loading: false })
    }
  },

  setPage: (page) => set({ page }),

  selectNode: (id, multi) => set((s) => {
    if (!id) return { selectedNodeIds: [] }
    if (multi) {
      if (s.selectedNodeIds.includes(id)) {
        return { selectedNodeIds: s.selectedNodeIds.filter(x => x !== id) }
      }
      return { selectedNodeIds: [...s.selectedNodeIds, id] }
    }
    return { selectedNodeIds: [id] }
  }),

  selectNodes: (ids) => set({ selectedNodeIds: ids }),

  alignNodes: (ids, alignment) => {
    get().recordHistory()
    set(state => {
      const proj = state.currentProject()
      if (!proj || ids.length < 2) return {}
      
      const targetNodes = proj.nodes.filter(n => ids.includes(n.id))
      if (targetNodes.length < 2) return {}

      // Calculate bounds
      const minX = Math.min(...targetNodes.map(n => n.x))
      const maxX = Math.max(...targetNodes.map(n => n.x + 160)) // assuming ~160 w
      const minY = Math.min(...targetNodes.map(n => n.y))
      const maxY = Math.max(...targetNodes.map(n => n.y + 80)) // assuming ~80 h
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      const newNodes = proj.nodes.map(node => {
        if (!ids.includes(node.id)) return node
        let nx = node.x
        let ny = node.y
        switch (alignment) {
          case 'left': nx = minX; break;
          case 'center': nx = centerX - 80; break;
          case 'right': nx = maxX - 160; break;
          case 'top': ny = minY; break;
          case 'middle': ny = centerY - 40; break;
          case 'bottom': ny = maxY - 80; break;
        }
        return { ...node, x: nx, y: ny }
      })

      if (alignment === 'distribute-h' && targetNodes.length > 2) {
        const sorted = [...targetNodes].sort((a, b) => a.x - b.x)
        const step = (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1)
        sorted.forEach((n, i) => {
          const idx = newNodes.findIndex(nn => nn.id === n.id)
          if (idx !== -1) newNodes[idx].x = sorted[0].x + step * i
        })
      } else if (alignment === 'distribute-v' && targetNodes.length > 2) {
        const sorted = [...targetNodes].sort((a, b) => a.y - b.y)
        const step = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1)
        sorted.forEach((n, i) => {
          const idx = newNodes.findIndex(nn => nn.id === n.id)
          if (idx !== -1) newNodes[idx].y = sorted[0].y + step * i
        })
      }

      return {
        projects: state.projects.map(p => 
          p.id === state.activeProjectId ? { ...p, nodes: newNodes } : p
        )
      }
    })
  },

  recordHistory: () => {
    const proj = get().currentProject()
    if (!proj) return
    set(s => {
      // Keep up to 50 history states
      const newPast = [...s.historyPast, JSON.parse(JSON.stringify(proj))]
      if (newPast.length > 50) newPast.shift()
      return { historyPast: newPast, historyFuture: [] }
    })
  },

  undo: () => {
    const s = get()
    const proj = s.currentProject()
    if (!proj || s.historyPast.length === 0) return
    const prev = s.historyPast[s.historyPast.length - 1]
    const newPast = s.historyPast.slice(0, -1)
    set({
      projects: s.projects.map(p => p.id === s.activeProjectId ? prev : p),
      historyPast: newPast,
      historyFuture: [JSON.parse(JSON.stringify(proj)), ...s.historyFuture]
    })
    api.updateProject(proj.id, prev).catch(() => {})
  },

  redo: () => {
    const s = get()
    const proj = s.currentProject()
    if (!proj || s.historyFuture.length === 0) return
    const next = s.historyFuture[0]
    const newFuture = s.historyFuture.slice(1)
    set({
      projects: s.projects.map(p => p.id === s.activeProjectId ? next : p),
      historyPast: [...s.historyPast, JSON.parse(JSON.stringify(proj))],
      historyFuture: newFuture
    })
    api.updateProject(proj.id, next).catch(() => {})
  },

  addProject: async (name) => {
    try {
      const p = (await api.createProject(name)) as Project
      set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, page: 'canvas' }))
    } catch {
      const p: Project = { id: uid('proj-'), name, version: 'v1.0', nodes: [], edges: [], regions: [], requirements: [], createdAt: now(), updatedAt: now() }
      if (p) {
        set({ projects: [...get().projects, p], activeProjectId: p.id })
      }
    }
  },

  updateProject: async (id, updates) => {
    try {
      await api.updateProject(id, updates)
      await get().syncCurrentProject()
    } catch {}
  },

  deleteProject: async (id) => {
    try {
      await api.deleteProject(id)
      set((s) => ({
        projects: s.projects.filter(p => p.id !== id),
        activeProjectId: s.activeProjectId === id ? (s.projects.find(p => p.id !== id)?.id ?? null) : s.activeProjectId,
        page: s.activeProjectId === id ? (s.projects.find(p => p.id !== id) ? 'canvas' : 'overview') : s.page
      }))
    } catch {}
  },

  switchProject: (id) => set({ activeProjectId: id, page: 'canvas', selectedEdgeId: null }),

  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),

  moveNode: (id, x, y) => {
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: p.nodes.map(n => n.id === id ? { ...n, x, y } : n), updatedAt: now() } : p
      ),
    }))
  },

  syncNodePos: (id) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const node = proj.nodes.find(n => n.id === id)
    if (node) {
      api.updateNode(proj.id, id, { x: node.x, y: node.y }).catch(() => {})
    }
  },

  setNodeRegion: (id, regionId) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.updateNode(proj.id, id, { regionId: regionId ?? null }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: p.nodes.map(n => n.id === id ? { ...n, regionId } : n), updatedAt: now() } : p
      ),
    }))
  },

  addNode: (node) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addNode(proj.id, { ...node, id: undefined }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: [...p.nodes, node], updatedAt: now() } : p
      ),
    }))
  },

  updateNode: (id, updates) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.updateNode(proj.id, id, updates).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? {
          ...p,
          nodes: p.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
          updatedAt: now()
        } : p
      ),
    }))
  },

  deleteNode: (id) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.deleteNode(proj.id, id).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, nodes: p.nodes.filter(n => n.id !== id), edges: p.edges.filter(e => e.sourceId !== id && e.targetId !== id), updatedAt: now() }
          : p
      ),
    }))
  },

  addEdge: (edge) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addEdge(proj.id, { ...edge, id: undefined }).then(() => get().syncCurrentProject()).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, edges: [...p.edges, edge], updatedAt: now() } : p
      ),
    }))
  },

  updateEdge: async (edgeId, updates) => {
    get().recordHistory()
    const p = get().currentProject()
    if (!p) return
    try {
      await api.updateEdge(p.id, edgeId, updates)
      await get().syncCurrentProject()
    } catch {}
  },

  deleteEdge: async (edgeId) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) {
      try {
        await api.deleteEdge(proj.id, edgeId)
        await get().syncCurrentProject()
      } catch {}
    }
  },

  selectEdge: (id) => set({ selectedEdgeId: id }),

  setEdgeDir: async (id, dir) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) {
      try {
        await api.updateEdge(proj.id, id, { dir })
        await get().syncCurrentProject()
      } catch {}
    }
  },

  toggleFlow: () => set((s) => ({ flowAnimation: !s.flowAnimation })),
  setFlowAnimationSpeed: (speed: number) => set({ flowAnimationSpeed: speed }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleThreeColumns: () => set((s) => ({ showThreeColumns: !s.showThreeColumns })),
  setCanvasDensity: (density) => set({ canvasDensity: density }),
  setHoveredRegion: (id) => set({ hoveredRegionId: id }),

  moveRegion: (id, dx, dy) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const region = proj.regions.find(r => r.id === id)
    if (region) {
      const rx = region.x + dx
      const ry = region.y + dy
      const adx = rx - region.x
      const ady = ry - region.y

      set((s) => ({
        projects: s.projects.map(p =>
          p.id === s.activeProjectId
            ? {
                ...p,
                regions: p.regions.map(r => r.id === id ? { ...r, x: rx, y: ry } : r),
                nodes: p.nodes.map(n => n.regionId === id ? { ...n, x: n.x + adx, y: n.y + ady } : n),
                updatedAt: now()
              }
            : p
        ),
      }))
    }
  },

  syncRegionPos: (id) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const region = proj.regions.find(r => r.id === id)
    if (region) {
      api.updateRegion(proj.id, id, { x: region.x, y: region.y }).catch(() => {})
      proj.nodes.filter(n => n.regionId === id).forEach(node => {
        api.updateNode(proj.id, node.id, { x: node.x, y: node.y }).catch(() => {})
      })
    }
  },

  resizeRegion: (id, w, h) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const nw = Math.max(w, 200)
    const nh = Math.max(h, 160)
    api.updateRegion(proj.id, id, { w: nw, h: nh }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, regions: p.regions.map(r => r.id === id ? { ...r, w: nw, h: nh } : r), updatedAt: now() }
          : p
      ),
    }))
  },

  formatCanvas: async (mode = 'default') => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return

    const nodes = [...proj.nodes]
    const regions = [...proj.regions]
    const edges = [...proj.edges]

    if (mode === 'rectangle') {
      let totalArea = 0
      const blocks: Array<{ type: 'region' | 'node'; id: string; width: number; height: number; nodes: Array<{ id: string; x: number; y: number }>; x?: number; y?: number }> = []
      
      // Process Regions
      regions.forEach(r => {
        const g = new dagre.graphlib.Graph()
        g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 80, ranksep: 100, edgesep: 40 })
        g.setDefaultEdgeLabel(() => ({}))
        const regionNodes = nodes.filter(n => n.regionId === r.id)
        
        if (regionNodes.length === 0) {
          blocks.push({ type: 'region', id: r.id, width: 300, height: 200, nodes: [] })
          totalArea += 300 * 200
          return
        }
        
        regionNodes.forEach(n => {
          const fieldCount = n.fields ? n.fields.length : 0
          const actualHeight = 60 + fieldCount * 22
          const nodeWidth = get().showThreeColumns ? 300 : 220
          g.setNode(n.id, { width: nodeWidth + 40, height: actualHeight + 40 })
        })
        
        edges.forEach(e => {
          if (regionNodes.some(n => n.id === e.sourceId) && regionNodes.some(n => n.id === e.targetId)) {
            g.setEdge(e.sourceId, e.targetId)
          }
        })
        
        dagre.layout(g)
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        regionNodes.forEach(n => {
          const dn = g.node(n.id)
          if (dn) {
             minX = Math.min(minX, dn.x - dn.width / 2)
             minY = Math.min(minY, dn.y - dn.height / 2)
             maxX = Math.max(maxX, dn.x + dn.width / 2)
             maxY = Math.max(maxY, dn.y + dn.height / 2)
          }
        })
        
        const width = Math.max(300, maxX - minX + 100)
        const height = Math.max(200, maxY - minY + 120)
        
        const placedNodes = regionNodes.map(n => {
          const dn = g.node(n.id)
          const fieldCount = n.fields ? n.fields.length : 0
          const actualHeight = 60 + fieldCount * 22
          const nodeWidth = get().showThreeColumns ? 300 : 220
          return {
             id: n.id,
             x: dn.x - minX + 50 - (nodeWidth / 2),
             y: dn.y - minY + 80 - actualHeight / 2
          }
        })
        
        blocks.push({ type: 'region', id: r.id, width, height, nodes: placedNodes })
        totalArea += width * height
      })

      // Process Unassigned Nodes
      const unassignedNodes = nodes.filter(n => !n.regionId)
      unassignedNodes.forEach(n => {
        const fieldCount = n.fields ? n.fields.length : 0
        const actualHeight = 60 + fieldCount * 22
        const nodeWidth = get().showThreeColumns ? 300 : 220
        const width = nodeWidth + 40
        const height = actualHeight + 40
        blocks.push({ type: 'node', id: n.id, width, height, nodes: [{ id: n.id, x: 20, y: 20 }] })
        totalArea += width * height
      })
      
      blocks.sort((a, b) => b.height - a.height)
      
      const targetWidth = Math.sqrt(totalArea * 1.77) * 1.2
      let currentX = 100, currentY = 100, rowHeight = 0
      
      blocks.forEach(b => {
        if (currentX + b.width > targetWidth && currentX > 100) {
          currentX = 100
          currentY += rowHeight + 100
          rowHeight = 0
        }
        b.x = currentX
        b.y = currentY
        currentX += b.width + 100
        rowHeight = Math.max(rowHeight, b.height)
      })
      
      blocks.forEach(b => {
        if (b.type === 'region') {
          const r = regions.find(reg => reg.id === b.id)
          if (r && b.x !== undefined && b.y !== undefined) {
            r.x = b.x
            r.y = b.y
            r.w = b.width
            r.h = b.height
          }
        } else {
          const n = nodes.find(nd => nd.id === b.id)
          if (n && b.x !== undefined && b.y !== undefined) {
            n.x = b.x + b.nodes[0].x
            n.y = b.y + b.nodes[0].y
          }
        }
        
        if (b.type === 'region') {
          b.nodes.forEach(bn => {
            const n = nodes.find(nd => nd.id === bn.id)
            if (n && b.x !== undefined && b.y !== undefined) {
              n.x = b.x + bn.x
              n.y = b.y + bn.y
            }
          })
        }
      })
    } else {
      // Default formatting
      const g = new dagre.graphlib.Graph({ compound: true })
      g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 80, ranksep: 150, edgesep: 40 })
      g.setDefaultEdgeLabel(() => ({}))

      regions.forEach(r => {
        g.setNode(r.id, {})
      })

      nodes.forEach(n => {
        const fieldCount = n.fields ? n.fields.length : 0
        const actualHeight = 60 + fieldCount * 22
        const nodeWidth = get().showThreeColumns ? 300 : 220
        g.setNode(n.id, { width: nodeWidth + 40, height: actualHeight + 40 }) 
        if (n.regionId) {
          g.setParent(n.id, n.regionId)
        }
      })

      edges.forEach(e => {
        g.setEdge(e.sourceId, e.targetId)
      })

      dagre.layout(g)

      nodes.forEach(n => {
        const dn = g.node(n.id)
        if (dn) {
          const fieldCount = n.fields ? n.fields.length : 0
          const actualHeight = 60 + fieldCount * 22
          const nodeWidth = get().showThreeColumns ? 300 : 220
          n.x = dn.x - (nodeWidth / 2)
          n.y = dn.y - actualHeight / 2
        }
      })

      regions.forEach(r => {
        const regionNodes = nodes.filter(nd => nd.regionId === r.id)
        if (regionNodes.length === 0) {
          r.w = Math.max(r.w || 300, 300)
          r.h = Math.max(r.h || 200, 200)
          return
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        regionNodes.forEach(n => {
          const fieldCount = n.fields ? n.fields.length : 0
          const actualHeight = 60 + fieldCount * 22
          const nodeWidth = get().showThreeColumns ? 300 : 220
          
          minX = Math.min(minX, n.x)
          minY = Math.min(minY, n.y)
          maxX = Math.max(maxX, n.x + nodeWidth)
          maxY = Math.max(maxY, n.y + actualHeight)
        })
        
        // Add robust padding around the enclosed nodes
        r.x = minX - 40
        r.y = minY - 60
        r.w = (maxX - minX) + 80
        r.h = (maxY - minY) + 100
      })
    }

    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, nodes, regions, updatedAt: now() }
          : p
      ),
    }))

    get().updateProject(proj.id, { nodes, regions })
    
    // Auto-fit to view after format
    setTimeout(() => get().resetView(), 100)
  },

  addRegion: (region) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addRegion(proj.id, { ...region, id: undefined }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, regions: [...p.regions, region], updatedAt: now() } : p
      ),
    }))
  },

  updateRegion: (id, updates) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.updateRegion(proj.id, id, updates).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, regions: p.regions.map(r => r.id === id ? { ...r, ...updates } : r), updatedAt: now() }
          : p
      ),
    }))
  },

  deleteRegion: (id) => {
    get().recordHistory()
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.deleteRegion(proj.id, id).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, regions: p.regions.filter(r => r.id !== id), nodes: p.nodes.map(n => n.regionId === id ? { ...n, regionId: undefined } : n), updatedAt: now() }
          : p
      ),
    }))
  },

  toggleRegionCollapse: (id) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const region = proj.regions.find(r => r.id === id)
    if (region) {
      const nextCollapsed = !region.collapsed
      api.updateRegion(proj.id, id, { collapsed: nextCollapsed }).catch(() => {})
      set((s) => ({
        projects: s.projects.map(p =>
          p.id === s.activeProjectId
            ? { ...p, regions: p.regions.map(r => r.id === id ? { ...r, collapsed: nextCollapsed } : r), updatedAt: now() }
            : p
        ),
      }))
    }
  },

  toggleAllRegionsCollapse: (collapsed) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    proj.regions.forEach(r => {
      api.updateRegion(proj.id, r.id, { collapsed }).catch(() => {})
    })
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, regions: p.regions.map(r => ({ ...r, collapsed })), updatedAt: now() }
          : p
      ),
    }))
  },

  resetView: () => {
    const proj = get().currentProject()
    if (!proj) return
    const nodes = proj.nodes
    if (nodes.length === 0) {
      set({ viewport: { x: 0, y: 0, scale: 1 } })
      return
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      const fieldCount = n.fields ? n.fields.length : 0
      const actualHeight = 60 + fieldCount * 22
      const nodeWidth = get().showThreeColumns ? 300 : 220
      maxX = Math.max(maxX, n.x + nodeWidth)
      maxY = Math.max(maxY, n.y + actualHeight)
    })
    
    minX -= 150
    minY -= 150
    maxX += 150
    maxY += 150
    
    const w = maxX - minX
    const h = maxY - minY
    
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800
    
    const scaleX = winW / w
    const scaleY = winH / h
    let scale = Math.min(scaleX, scaleY)
    scale = Math.max(0.1, Math.min(scale, 1))
    
    const cx = minX + w / 2
    const cy = minY + h / 2
    
    const viewX = (winW / 2) - (cx * scale)
    const viewY = (winH / 2) - (cy * scale)
    
    set({ viewport: { x: viewX, y: viewY, scale } })
  },

  focusNode: (nodeId: string) => {
    const proj = get().currentProject()
    if (!proj) return
    const n = proj.nodes.find(nd => nd.id === nodeId)
    if (!n) return
    
    const fieldCount = n.fields ? n.fields.length : 0
    const actualHeight = 60 + fieldCount * 22
    const nodeWidth = get().showThreeColumns ? 300 : 220
    
    const cx = n.x + nodeWidth / 2
    const cy = n.y + actualHeight / 2
    
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800
    
    const targetScale = 1.0
    
    const viewX = (winW / 2) - (cx * targetScale)
    const viewY = (winH / 2) - (cy * targetScale)
    
    set({ viewport: { x: viewX, y: viewY, scale: targetScale } })
  },

  selectBusinessFlow: (id) => set({ activeBusinessFlowId: id }),

  addBusinessFlow: (flow) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const tempId = 'flow-' + Math.random().toString(36).slice(2, 8)
    const newFlow = { ...flow, id: tempId }
    api.addBusinessFlow(proj.id, { ...flow, id: undefined }).then((res: any) => {
      if (res && res.id) {
        set((s) => ({
          projects: s.projects.map(p =>
            p.id === s.activeProjectId
              ? { ...p, businessFlows: (p.businessFlows || []).map(f => f.id === tempId ? res : f) }
              : p
          )
        }))
      }
    }).catch(() => {})

    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, businessFlows: [...(p.businessFlows || []), newFlow], updatedAt: now() }
          : p
      )
    }))
  },

  updateBusinessFlow: (id, updates) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    api.updateBusinessFlow(proj.id, id, updates).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? {
              ...p,
              businessFlows: (p.businessFlows || []).map(f =>
                f.id === id ? { ...f, ...updates } : f
              ),
              updatedAt: now()
            }
          : p
      )
    }))
  },
  toggleNodeFieldsCollapse: (id: string) => set(s => {
    if (!s.activeProjectId) return s
    const pIdx = s.projects.findIndex(p => p.id === s.activeProjectId)
    if (pIdx === -1) return s
    const newProjects = [...s.projects]
    newProjects[pIdx] = {
      ...newProjects[pIdx],
      nodes: newProjects[pIdx].nodes.map(n => n.id === id ? { ...n, collapsedFields: !n.collapsedFields } : n)
    }
    return { projects: newProjects }
  }),

  deleteBusinessFlow: (id) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    api.deleteBusinessFlow(proj.id, id).catch(() => {})
    set((s) => ({
      activeBusinessFlowId: s.activeBusinessFlowId === id ? null : s.activeBusinessFlowId,
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? {
              ...p,
              businessFlows: (p.businessFlows || []).filter(f => f.id !== id),
              updatedAt: now()
            }
          : p
      )
    }))
  },

  setEditingBusinessFlow: (id) => set({ editingBusinessFlowId: id }),

  toggleNodeInBusinessFlow: (flowId, nodeId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const flow = (proj.businessFlows || []).find(f => f.id === flowId)
    if (flow) {
      const nodeIds = flow.nodeIds.includes(nodeId)
        ? flow.nodeIds.filter(id => id !== nodeId)
        : [...flow.nodeIds, nodeId]
      get().updateBusinessFlow(flowId, { nodeIds })
    }
  },

  toggleEdgeInBusinessFlow: (flowId, edgeId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const flow = (proj.businessFlows || []).find(f => f.id === flowId)
    if (flow) {
      const edgeIds = flow.edgeIds.includes(edgeId)
        ? flow.edgeIds.filter(id => id !== edgeId)
        : [...flow.edgeIds, edgeId]
      get().updateBusinessFlow(flowId, { edgeIds })
    }
  },

  selectRequirement: (id) => set({ selectedRequirementId: id }),

  addRequirement: async (req) => {
    const p = get().currentProject()
    if (!p) return
    try {
      await api.addRequirement(p.id, req)
      await get().syncCurrentProject()
    } catch {}
  },

  updateRequirement: async (id, updates) => {
    const p = get().currentProject()
    if (!p) return
    try {
      await api.updateRequirement(p.id, id, updates)
      await get().syncCurrentProject()
    } catch {}
  },

  setLinkingRequirement: (id) => set({ linkingRequirementId: id }),

  toggleNodeInRequirement: (reqId, nodeId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const req = (proj.requirements || []).find(r => r.id === reqId)
    if (req) {
      const nodeIds = (req.nodeIds || []).includes(nodeId)
        ? (req.nodeIds || []).filter(id => id !== nodeId)
        : [...(req.nodeIds || []), nodeId]
      get().updateRequirement(reqId, { nodeIds })
    }
  },

  toggleEdgeInRequirement: (reqId, edgeId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const req = (proj.requirements || []).find(r => r.id === reqId)
    if (req) {
      const edgeIds = (req.edgeIds || []).includes(edgeId)
        ? (req.edgeIds || []).filter(id => id !== edgeId)
        : [...(req.edgeIds || []), edgeId]
      get().updateRequirement(reqId, { edgeIds })
    }
  },

  toggleRegionInRequirement: (reqId, regionId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const req = (proj.requirements || []).find(r => r.id === reqId)
    if (req) {
      const regionIds = (req.regionIds || []).includes(regionId)
        ? (req.regionIds || []).filter(id => id !== regionId)
        : [...(req.regionIds || []), regionId]
      get().updateRequirement(reqId, { regionIds })
    }
  },

  deleteRequirement: async (id) => {
    const p = get().currentProject()
    if (!p) return
    try {
      await api.deleteRequirement(p.id, id)
      await get().syncCurrentProject()
      if (get().selectedRequirementId === id) {
        set({ selectedRequirementId: null })
      }
    } catch {}
  },

  syncCurrentProject: async () => {
    const id = get().activeProjectId
    if (!id) return
    try {
      const p = (await api.getProject(id)) as Project
      if (p) {
        set((s) => ({
          projects: s.projects.map(proj => proj.id === id ? p : proj),
        }))
      }
    } catch { /* ignore */ }
  },
}))
