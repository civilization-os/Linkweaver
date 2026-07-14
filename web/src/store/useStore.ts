import { create } from 'zustand'
import dagre from 'dagre'
import type { FlowNode, DataFlow, Region, Project, ViewportState, BusinessFlow } from '../types'
import { api } from '../api'

function now() { return Date.now() }

function uid(prefix: string) { return prefix + Math.random().toString(36).slice(2, 8) }

interface AppState {
  projects: Project[]
  activeProjectId: string | null
  selectedNodeId: string | null
  viewport: ViewportState
  selectedEdgeId: string | null
  flowAnimation: boolean
  flowAnimationSpeed: number
  showGrid: boolean
  page: 'overview' | 'canvas'
  loading: boolean
  searchQuery: string
  currentProject: () => Project | undefined

  init: () => Promise<void>
  setSearchQuery: (q: string) => void
  setPage: (page: 'overview' | 'canvas') => void
  selectNode: (id: string | null) => void
  addProject: (name: string) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  switchProject: (id: string) => void
  setViewport: (vp: Partial<ViewportState>) => void
  moveNode: (id: string, x: number, y: number) => void
  setNodeRegion: (id: string, regionId: string | undefined) => void
  addNode: (node: FlowNode) => void
  selectEdge: (id: string | null) => void
  setEdgeDir: (id: string, dir: 'fwd' | 'rev' | 'both') => void
  addEdge: (edge: DataFlow) => void
  updateEdge: (edgeId: string, updates: Partial<DataFlow>) => Promise<void>
  deleteEdge: (edgeId: string) => Promise<void>
  toggleFlow: () => void
  setFlowAnimationSpeed: (speed: number) => void
  toggleGrid: () => void
  moveRegion: (id: string, dx: number, dy: number) => void
  resizeRegion: (id: string, w: number, h: number) => void
  addRegion: (region: Region) => void
  updateRegion: (id: string, updates: Partial<Region>) => void
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
  selectedNodeId: null,
  viewport: { x: 0, y: 0, scale: 1 },
  selectedEdgeId: null,
  flowAnimation: false,
  flowAnimationSpeed: 1000,
  showGrid: true,
  page: 'overview',
  loading: true,
  searchQuery: '',

  currentProject: () => get().projects.find(p => p.id === get().activeProjectId),

  setSearchQuery: (q) => set({ searchQuery: q }),

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

  selectNode: (id) => set({ selectedNodeId: id }),

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
    if (proj) api.addEdge(proj.id, { ...edge, id: undefined }).then(() => get().syncCurrentProject()).catch(() => {})
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId ? { ...p, edges: [...p.edges, edge], updatedAt: now() } : p
      ),
    }))
  },

  updateEdge: async (edgeId, updates) => {
    const p = get().currentProject()
    if (!p) return
    try {
      await api.updateEdge(p.id, edgeId, updates)
      await get().syncCurrentProject()
    } catch {}
  },

  deleteEdge: async (edgeId) => {
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

    const g = new dagre.graphlib.Graph({ compound: true })
    g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 80, ranksep: 150, edgesep: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    regions.forEach(r => {
      g.setNode(r.id, {})
    })

    nodes.forEach(n => {
      const fieldCount = n.fields ? n.fields.length : 0
      const actualHeight = 60 + fieldCount * 22
      g.setNode(n.id, { width: 180 + 40, height: actualHeight + 40 }) // Add virtual padding to node size to push apart
      if (n.regionId) {
        g.setParent(n.id, n.regionId)
      }
    })

    proj.edges.forEach(e => {
      g.setEdge(e.sourceId, e.targetId)
    })

    dagre.layout(g)

    nodes.forEach(n => {
      const dn = g.node(n.id)
      if (dn) {
        const fieldCount = n.fields ? n.fields.length : 0
        const actualHeight = 60 + fieldCount * 22
        n.x = dn.x - 90
        n.y = dn.y - actualHeight / 2
        api.updateNode(proj.id, n.id, { x: n.x, y: n.y }).catch(() => {})
      }
    })

    regions.forEach(r => {
      const dr = g.node(r.id)
      if (dr) {
        r.x = dr.x - dr.width / 2 + 10
        r.y = dr.y - dr.height / 2 - 20
        r.w = dr.width - 20
        r.h = dr.height + 20
        api.updateRegion(proj.id, r.id, { x: r.x, y: r.y, w: Math.max(r.w, 200), h: Math.max(r.h, 160) }).catch(() => {})
      }
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

  updateRegion: (id, updates) => {
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
