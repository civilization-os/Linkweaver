import { create } from 'zustand'
import type { FlowNode, DataFlow, Region, Project, ViewportState } from '../types'
import { api } from '../api'

function now() { return Date.now() }

function uid(prefix: string) { return prefix + Math.random().toString(36).slice(2, 8) }

interface AppState {
  projects: Project[]
  activeProjectId: string | null
  viewport: ViewportState
  selectedEdgeIdx: number | null
  flowAnimation: boolean
  flowAnimationSpeed: number
  showGrid: boolean
  page: 'overview' | 'canvas'
  loading: boolean

  currentProject: () => Project | undefined

  init: () => Promise<void>
  setPage: (page: 'overview' | 'canvas') => void
  addProject: (name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  switchProject: (id: string) => void
  setViewport: (vp: Partial<ViewportState>) => void
  moveNode: (id: string, x: number, y: number) => void
  setNodeRegion: (id: string, regionId: string | undefined) => void
  addNode: (node: FlowNode) => void
  selectEdge: (idx: number | null) => void
  setEdgeDir: (idx: number, dir: 'fwd' | 'rev' | 'both') => void
  addEdge: (edge: DataFlow) => void
  deleteEdge: (idx: number) => void
  toggleFlow: () => void
  setFlowAnimationSpeed: (speed: number) => void
  toggleGrid: () => void
  moveRegion: (id: string, dx: number, dy: number) => void
  resizeRegion: (id: string, w: number, h: number) => void
  addRegion: (region: Region) => void
  deleteNode: (id: string) => void
  deleteRegion: (id: string) => void
  toggleRegionCollapse: (id: string) => void
  toggleAllRegionsCollapse: (collapsed: boolean) => void
  resetView: () => void
  syncCurrentProject: () => Promise<void>
  formatCanvas: () => Promise<void>
  activeBusinessFlowId: string | null
  selectBusinessFlow: (id: string | null) => void
  addBusinessFlow: (flow: Omit<BusinessFlow, 'id'>) => void
  updateBusinessFlow: (id: string, updates: Partial<BusinessFlow>) => void
  deleteBusinessFlow: (id: string) => void
  editingBusinessFlowId: string | null
  setEditingBusinessFlow: (id: string | null) => void
  toggleNodeInBusinessFlow: (flowId: string, nodeId: string) => void
  toggleEdgeInBusinessFlow: (flowId: string, edgeId: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeBusinessFlowId: null,
  editingBusinessFlowId: null,
  viewport: { x: 0, y: 0, scale: 1 },
  selectedEdgeIdx: null,
  flowAnimation: false,
  flowAnimationSpeed: 1000,
  showGrid: true,
  page: 'overview',
  loading: true,

  currentProject: () => get().projects.find(p => p.id === get().activeProjectId),

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

  addProject: async (name) => {
    try {
      const p = (await api.createProject(name)) as Project
      set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, page: 'canvas' }))
    } catch {
      const p: Project = { id: uid('proj-'), name, version: 'v1.0', nodes: [], edges: [], regions: [], requirements: [], createdAt: now(), updatedAt: now() }
      set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id, page: 'canvas' }))
    }
  },

  deleteProject: async (id) => {
    try { await api.deleteProject(id) } catch {}
    set((s) => {
      const remaining = s.projects.filter(p => p.id !== id)
      if (remaining.length === 0) return s
      return { projects: remaining, activeProjectId: s.activeProjectId === id ? remaining[0].id : s.activeProjectId }
    })
  },

  switchProject: (id) => set({ activeProjectId: id, page: 'canvas', selectedEdgeIdx: null }),

  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),

  moveNode: (id, x, y) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.updateNode(proj.id, id, { x, y }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: p.nodes.map(n => n.id === id ? { ...n, x, y } : n), updatedAt: now() } : p
      ),
    }))
  },

  setNodeRegion: (id, regionId) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.updateNode(proj.id, id, { regionId: regionId ?? null }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: p.nodes.map(n => n.id === id ? { ...n, regionId } : n), updatedAt: now() } : p
      ),
    }))
  },

  addNode: (node) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addNode(proj.id, { ...node, id: undefined }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, nodes: [...p.nodes, node], updatedAt: now() } : p
      ),
    }))
  },

  deleteNode: (id) => {
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
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addEdge(proj.id, { ...edge, id: undefined }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, edges: [...p.edges, edge], updatedAt: now() } : p
      ),
    }))
  },

  deleteEdge: (idx) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.deleteEdge(proj.id, idx).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, edges: p.edges.filter((_, i) => i !== idx), selectedEdgeIdx: s.selectedEdgeIdx === idx ? null : s.selectedEdgeIdx, updatedAt: now() }
          : p
      ),
    }))
  },

  selectEdge: (idx) => set({ selectedEdgeIdx: idx }),

  setEdgeDir: (idx, dir) => set((s) => {
    const proj = s.projects.find(p => p.id === s.activeProjectId)
    if (!proj || !proj.edges[idx]) return s
    const edges = [...proj.edges]
    edges[idx] = { ...edges[idx], dir }
    return { projects: s.projects.map(p => p.id === s.activeProjectId ? { ...p, edges, updatedAt: now() } : p) }
  }),

  toggleFlow: () => set((s) => ({ flowAnimation: !s.flowAnimation })),
  setFlowAnimationSpeed: (speed: number) => set({ flowAnimationSpeed: speed }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  moveRegion: (id, dx, dy) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return
    const region = proj.regions.find(r => r.id === id)
    if (region) {
      const rx = Math.max(20, region.x + dx)
      const ry = Math.max(20, region.y + dy)
      const adx = rx - region.x
      const ady = ry - region.y

      api.updateRegion(proj.id, id, { x: rx, y: ry }).catch(() => {})
      
      // Sync moved nodes in region to backend using actual delta
      proj.nodes.filter(n => n.regionId === id).forEach(node => {
        api.updateNode(proj.id, node.id, { x: node.x + adx, y: node.y + ady }).catch(() => {})
      })

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

  formatCanvas: async () => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (!proj) return

    const nodes = [...proj.nodes]
    const regions = [...proj.regions]

    // 1. Layout independent nodes (no regionId)
    const independentNodes = nodes.filter(n => !n.regionId)
    independentNodes.forEach((node, idx) => {
      const targetX = 150 + idx * 300
      const targetY = 20
      node.x = targetX
      node.y = targetY
      api.updateNode(proj.id, node.id, { x: targetX, y: targetY }).catch(() => {})
    })

    // 2. Layout regions and their nodes
    const regionGap = 60
    const startX = 100
    const startY = 150
    const regionWidth = 360
    const nodeWidth = 180
    const nodeHeight = 85
    const nodeGap = 40
    const headerHeight = 60

    regions.forEach((region, rIdx) => {
      const rx = startX + rIdx * (regionWidth + regionGap)
      const ry = startY
      region.x = rx
      region.y = ry
      
      const regionNodes = nodes.filter(n => n.regionId === region.id)
      const computedHeight = Math.max(360, headerHeight + regionNodes.length * (nodeHeight + nodeGap) + 20)
      region.w = regionWidth
      region.h = computedHeight

      // Sync region geometry to backend
      api.updateRegion(proj.id, region.id, { x: rx, y: ry, w: regionWidth, h: computedHeight }).catch(() => {})

      // Position nodes inside this region
      regionNodes.forEach((node, nIdx) => {
        const nx = rx + (regionWidth - nodeWidth) / 2
        const ny = ry + headerHeight + nIdx * (nodeHeight + nodeGap)
        node.x = nx
        node.y = ny
        api.updateNode(proj.id, node.id, { x: nx, y: ny }).catch(() => {})
      })
    })

    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, nodes, regions, updatedAt: now() }
          : p
      ),
    }))
  },

  addRegion: (region) => {
    const proj = get().projects.find(p => p.id === get().activeProjectId)
    if (proj) api.addRegion(proj.id, { ...region, id: undefined }).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, regions: [...p.regions, region], updatedAt: now() } : p
      ),
    }))
  },

  deleteRegion: (id) => {
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

  resetView: () => set({ viewport: { x: 0, y: 0, scale: 1 } }),

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
