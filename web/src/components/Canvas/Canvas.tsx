import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { FlowNode } from '../../types'
import EdgeEditor from '../EdgeEditor/EdgeEditor'
import EntityEditor from '../EntityEditor/EntityEditor'
import MiniMap from './MiniMap'
import { ChevronDown, ChevronUp, Table, User, Cog, Box, Key, Link2, AlignLeft, AlignCenter, AlignRight, LayoutGrid } from 'lucide-react'

const BASE_CANVAS_W = 6000
const BASE_CANVAS_H = 4000
const GRID_SIZE = 40

function getContrastColor(hexColor: string) {
  let color = hexColor || '#f0f0f0';
  if (color.startsWith('#')) color = color.substring(1);
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const yiq = (((isNaN(r) ? 240 : r) * 299) + ((isNaN(g) ? 240 : g) * 587) + ((isNaN(b) ? 240 : b) * 114)) / 1000;
  return (yiq >= 140) ? '#18181b' : '#ffffff';
}

function getNodeRect(node: FlowNode, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 160
  const h = el?.offsetHeight ?? 80
  return { x: node.x, y: node.y, w, h }
}

function portPos(rect: { x: number; y: number; w: number; h: number }, port: string) {
  switch (port) {
    case 't': return { x: rect.x + rect.w / 2, y: rect.y }
    case 'b': return { x: rect.x + rect.w / 2, y: rect.y + rect.h }
    case 'l': return { x: rect.x, y: rect.y + rect.h / 2 }
    case 'r': return { x: rect.x + rect.w, y: rect.y + rect.h / 2 }
    default: return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  }
}


function autoPort(from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }) {
  const dy = to.y - from.y
  const dx = to.x - from.x
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'r' : 'l'
  }
  return dy > 0 ? 'b' : 't'
}

function getDirVector(dir: string) {
  switch (dir) {
    case 't': return { x: 0, y: -1 }
    case 'b': return { x: 0, y: 1 }
    case 'l': return { x: -1, y: 0 }
    case 'r': return { x: 1, y: 0 }
    default: return { x: 1, y: 0 }
  }
}

function orthogonalEdgePath(from: {x: number, y: number}, dirFrom: string, to: {x: number, y: number}, dirTo: string, radius = 15) {
  const pad = 30
  const vf = getDirVector(dirFrom)
  const vt = getDirVector(dirTo)

  const pt1 = { x: from.x + vf.x * pad, y: from.y + vf.y * pad }
  const pt2 = { x: to.x + vt.x * pad, y: to.y + vt.y * pad }

  const isHorizSrc = dirFrom === 'l' || dirFrom === 'r'
  const isHorizTgt = dirTo === 'l' || dirTo === 'r'

  const points = [from, pt1]

  if (isHorizSrc && isHorizTgt) {
    if ((dirFrom === 'r' && pt1.x < pt2.x) || (dirFrom === 'l' && pt1.x > pt2.x)) {
      const midX = (pt1.x + pt2.x) / 2
      points.push({ x: midX, y: pt1.y })
      points.push({ x: midX, y: pt2.y })
    } else {
      const midY = (pt1.y + pt2.y) / 2
      points.push({ x: pt1.x, y: midY })
      points.push({ x: pt2.x, y: midY })
    }
  } else if (!isHorizSrc && !isHorizTgt) {
    if ((dirFrom === 'b' && pt1.y < pt2.y) || (dirFrom === 't' && pt1.y > pt2.y)) {
      const midY = (pt1.y + pt2.y) / 2
      points.push({ x: pt1.x, y: midY })
      points.push({ x: pt2.x, y: midY })
    } else {
      const midX = (pt1.x + pt2.x) / 2
      points.push({ x: midX, y: pt1.y })
      points.push({ x: midX, y: pt2.y })
    }
  } else if (isHorizSrc && !isHorizTgt) {
    const validX = (dirFrom === 'r' && pt1.x < pt2.x) || (dirFrom === 'l' && pt1.x > pt2.x)
    const validY = (dirTo === 'b' && pt1.y > pt2.y) || (dirTo === 't' && pt1.y < pt2.y)
    if (validX && validY) {
      points.push({ x: pt2.x, y: pt1.y })
    } else {
      if (!validX) {
        points.push({ x: pt1.x, y: (pt1.y + pt2.y)/2 })
        points.push({ x: pt2.x, y: (pt1.y + pt2.y)/2 })
      } else {
        points.push({ x: (pt1.x + pt2.x)/2, y: pt1.y })
        points.push({ x: (pt1.x + pt2.x)/2, y: pt2.y })
      }
    }
  } else {
    const validY = (dirFrom === 'b' && pt1.y < pt2.y) || (dirFrom === 't' && pt1.y > pt2.y)
    const validX = (dirTo === 'r' && pt1.x > pt2.x) || (dirTo === 'l' && pt1.x < pt2.x)
    if (validX && validY) {
      points.push({ x: pt1.x, y: pt2.y })
    } else {
      if (!validY) {
        points.push({ x: (pt1.x + pt2.x)/2, y: pt1.y })
        points.push({ x: (pt1.x + pt2.x)/2, y: pt2.y })
      } else {
        points.push({ x: pt1.x, y: (pt1.y + pt2.y)/2 })
        points.push({ x: pt2.x, y: (pt1.y + pt2.y)/2 })
      }
    }
  }

  points.push(pt2)
  points.push(to)

  const cleanPts = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const curr = points[i]
    const prev = cleanPts[cleanPts.length - 1]
    
    if (Math.abs(curr.x - prev.x) < 1 && Math.abs(curr.y - prev.y) < 1) continue
    
    if (cleanPts.length >= 2) {
      const prevPrev = cleanPts[cleanPts.length - 2]
      const isCollinearX = Math.abs(curr.x - prev.x) < 1 && Math.abs(prev.x - prevPrev.x) < 1
      const isCollinearY = Math.abs(curr.y - prev.y) < 1 && Math.abs(prev.y - prevPrev.y) < 1
      if (isCollinearX || isCollinearY) {
        cleanPts.pop()
      }
    }
    cleanPts.push(curr)
  }

  let d = `M ${cleanPts[0].x} ${cleanPts[0].y}`
  for (let i = 1; i < cleanPts.length - 1; i++) {
    const pPrev = cleanPts[i - 1]
    const pCurr = cleanPts[i]
    const pNext = cleanPts[i + 1]

    const dPrev = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y)
    const dNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y)

    const r = Math.min(radius, dPrev / 2, dNext / 2)

    const vPrev = { x: (pPrev.x - pCurr.x) / dPrev, y: (pPrev.y - pCurr.y) / dPrev }
    const vNext = { x: (pNext.x - pCurr.x) / dNext, y: (pNext.y - pCurr.y) / dNext }

    const arcStart = { x: pCurr.x + vPrev.x * r, y: pCurr.y + vPrev.y * r }
    const arcEnd = { x: pCurr.x + vNext.x * r, y: pCurr.y + vNext.y * r }

    d += ` L ${arcStart.x} ${arcStart.y}`
    d += ` Q ${pCurr.x} ${pCurr.y}, ${arcEnd.x} ${arcEnd.y}`
  }

  const lastP = cleanPts[cleanPts.length - 1]
  d += ` L ${lastP.x} ${lastP.y}`

  return { d, points: cleanPts }
}

function hitTestLineSegment(p1: {x:number,y:number}, p2: {x:number,y:number}, px: number, py: number, threshold = 10) {
  const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
  if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y) < threshold;
  let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = p1.x + t * (p2.x - p1.x);
  const projY = p1.y + t * (p2.y - p1.y);
  return Math.hypot(px - projX, py - projY) < threshold;
}

function hitTestPath(points: {x:number, y:number}[], px: number, py: number, threshold = 12) {
  for (let i = 0; i < points.length - 1; i++) {
    if (hitTestLineSegment(points[i], points[i+1], px, py, threshold)) return true;
  }
  return false;
}

// Grid is now rendered via CSS on the container

export default function Canvas() {
  const store = useStore()
  const project = store.currentProject()
  const nodes = project?.nodes ?? []
  const edges = project?.edges ?? []
  const regions = project?.regions ?? []
  const viewportRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Helper to resolve effective connection points if a node's region is collapsed
  const getEffectiveRectAndId = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return null
    if (node.regionId) {
      const r = regions.find(reg => reg.id === node.regionId)
      if (r?.collapsed) {
        // Line should attach to the region container!
        return {
          id: `r-${r.id}`, // prefix with r- to prevent clash
          rect: { x: r.x, y: r.y, w: 220, h: 56 }
        }
      }
    }
    const el = nodeRefs.current.get(node.id) ?? null
    return {
      id: node.id,
      rect: { x: node.x, y: node.y, w: el?.offsetWidth ?? 160, h: el?.offsetHeight ?? 80 }
    }
  }, [nodes, regions])

  const activeBusinessFlowId = store.activeBusinessFlowId
  const activeFlow = project?.businessFlows?.find(f => f.id === activeBusinessFlowId)
  const flowAnimationSpeed = store.flowAnimationSpeed
  const [hoveredFieldInfo, setHoveredFieldInfo] = useState<{ nodeId: string, name: string, ref?: string } | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const normalizeFieldName = useCallback((name: string) => name.toLowerCase().replace(/[\s_-]/g, ''), [])
  const selectedNodeIds = store.selectedNodeIds
  const selectedEdgeId = store.selectedEdgeId
  const searchQuery = store.searchQuery.toLowerCase()
  const activeRequirement = project?.requirements?.find(r => r.id === store.selectedRequirementId)
  const linkingRequirementId = store.linkingRequirementId
  const [editNodeId, setEditNodeId] = useState<string | null>(null)
  const [editEdgeId, setEditEdgeId] = useState<string | null>(null)
  const [inlineEditNodeId, setInlineEditNodeId] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = useStore.getState()
        if (s.selectedNodeIds.length > 0) {
          s.selectedNodeIds.forEach(id => s.deleteNode(id))
          s.selectNodes([])
        } else if (s.selectedEdgeId) {
          s.deleteEdge(s.selectedEdgeId)
          s.selectEdge(null)
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const s = useStore.getState()
        if (e.shiftKey) {
          s.redo()
        } else {
          s.undo()
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        useStore.getState().redo()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        const s = useStore.getState()
        const currentNodes = s.currentProject()?.nodes || []
        if (s.selectedNodeIds.length > 0) {
           s.selectedNodeIds.forEach(id => {
             const node = currentNodes.find(n => n.id === id)
             if (node) {
               s.addNode({ ...node, x: node.x + 30, y: node.y + 30 })
             }
           })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const [layoutTick, setLayoutTick] = useState(0)
  
  useEffect(() => {
    let ticking = false
    const ro = new ResizeObserver(() => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          setLayoutTick(t => t + 1)
          ticking = false
        })
      }
    })
    
    nodeRefs.current.forEach(el => {
      if (el) ro.observe(el)
    })
    
    return () => ro.disconnect()
  }, [nodes])

  const connectedEdgeIds = useMemo(() => {
    if (selectedNodeIds.length === 0) return new Set<string>()
    return new Set(edges.filter(e => selectedNodeIds.includes(e.sourceId) || selectedNodeIds.includes(e.targetId)).map(e => e.id))
  }, [selectedNodeIds, edges])

  const portLayouts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    
    edges.forEach(edge => {
      const effFrom = getEffectiveRectAndId(edge.sourceId)
      const effTo = getEffectiveRectAndId(edge.targetId)
      if (!effFrom || !effTo) return
      
      const p1Str = edge.sourcePort || autoPort(effFrom.rect, effTo.rect)
      const p2Str = edge.targetPort || autoPort(effTo.rect, effFrom.rect)
      
      if (!counts[effFrom.id]) counts[effFrom.id] = { t: 0, b: 0, l: 0, r: 0 }
      if (!counts[effTo.id]) counts[effTo.id] = { t: 0, b: 0, l: 0, r: 0 }
      
      counts[effFrom.id][p1Str]++
      counts[effTo.id][p2Str]++
    })
    
    const assigned: Record<string, Record<string, number>> = {}
    const getSpreadPort = (nodeId: string, rect: any, port: string) => {
      if (!assigned[nodeId]) assigned[nodeId] = { t: 0, b: 0, l: 0, r: 0 }
      const idx = assigned[nodeId][port]++
      const total = counts[nodeId]?.[port] || 1
      
      let x, y
      const padding = 20
      if (port === 't' || port === 'b') {
        const step = total > 1 ? (rect.w - 2 * padding) / (total - 1) : 0
        x = total === 1 ? rect.x + rect.w / 2 : rect.x + padding + step * idx
        y = port === 't' ? rect.y : rect.y + rect.h
      } else {
        const step = total > 1 ? (rect.h - 2 * padding) / (total - 1) : 0
        y = total === 1 ? rect.y + rect.h / 2 : rect.y + padding + step * idx
        x = port === 'l' ? rect.x : rect.x + rect.w
      }
      return { x, y, dir: port }
    }
    
    const layouts: Record<string, { p1: {x: number, y: number, dir: string}, p2: {x: number, y: number, dir: string}, d: string, points: {x:number, y:number}[] }> = {}
    edges.forEach(edge => {
      const effFrom = getEffectiveRectAndId(edge.sourceId)
      const effTo = getEffectiveRectAndId(edge.targetId)
      if (!effFrom || !effTo) return
      
      if (effFrom.id === effTo.id) return // hide self loop for now
      
      const p1Str = edge.sourcePort || autoPort(effFrom.rect, effTo.rect)
      const p2Str = edge.targetPort || autoPort(effTo.rect, effFrom.rect)
      
      const p1 = getSpreadPort(effFrom.id, effFrom.rect, p1Str)
      const p2 = getSpreadPort(effTo.id, effTo.rect, p2Str)
      const { d, points } = orthogonalEdgePath(p1, p1.dir, p2, p2.dir, 15)
      layouts[edge.id] = { p1, p2, d, points }
    })
    
    return layouts
  }, [edges, getEffectiveRectAndId, layoutTick])

  const connectedNodeIds = useMemo(() => {
    if (selectedNodeIds.length === 0) return new Set<string>()
    const s = new Set<string>(selectedNodeIds)
    edges.forEach(e => {
      if (selectedNodeIds.includes(e.sourceId)) s.add(e.targetId)
      if (selectedNodeIds.includes(e.targetId)) s.add(e.sourceId)
    })
    return s
  }, [selectedNodeIds, edges])

  const [pulsingNodeId, setPulsingNodeId] = useState<string | null>(null)
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null)

  // Trace steps of activeFlow in order from start to end
  const flowSteps = useMemo(() => {
    if (!activeFlow || activeFlow.nodeIds.length === 0) return []
    const flowNodeIds = new Set(activeFlow.nodeIds)
    const flowEdgeIds = new Set(activeFlow.edgeIds)

    const adj: Record<string, Array<{ edgeId: string; targetId: string }>> = {}
    const inDegree: Record<string, number> = {}

    flowNodeIds.forEach(id => {
      adj[id] = []
      inDegree[id] = 0
    })

    edges.forEach(edge => {
      if (flowEdgeIds.has(edge.id) && flowNodeIds.has(edge.sourceId) && flowNodeIds.has(edge.targetId)) {
        adj[edge.sourceId].push({ edgeId: edge.id, targetId: edge.targetId })
        inDegree[edge.targetId] = (inDegree[edge.targetId] || 0) + 1
      }
    })

    let queue = Array.from(flowNodeIds).filter(id => (inDegree[id] || 0) === 0)
    if (queue.length === 0 && flowNodeIds.size > 0) {
      queue = [Array.from(flowNodeIds)[0]]
    }

    const visited = new Set<string>()
    const res: Array<{
      type: 'node' | 'edge';
      id: string;
      sourceId?: string;
      targetId?: string;
    }> = []

    const visitedEdges = new Set<string>()
    let current = queue[0]

    while (current) {
      res.push({ type: 'node', id: current })
      visited.add(current)

      const next = adj[current]?.find(edge => !visitedEdges.has(edge.edgeId))
      if (next) {
        visitedEdges.add(next.edgeId)
        res.push({ type: 'edge', id: next.edgeId, sourceId: current, targetId: next.targetId })
        current = next.targetId
      } else {
        const unvisitedNode = Array.from(flowNodeIds).find(id => !visited.has(id))
        if (unvisitedNode) {
          current = unvisitedNode
        } else {
          break
        }
      }
    }
    return res
  }, [activeFlow, nodes, edges])

  // Mouse wheel zoom effect (Ctrl + Wheel)
  useEffect(() => {
    const viewEl = viewportRef.current
    if (!viewEl) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const scale = store.viewport.scale
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        const newScale = Math.max(0.2, Math.min(scale * factor, 3))
        store.setViewport({ scale: newScale })
      }
    }

    viewEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewEl.removeEventListener('wheel', handleWheel)
  }, [store])

  // Run sequential particle flow animation
  useEffect(() => {
    if (flowSteps.length === 0) {
      setBallPos(null)
      setPulsingNodeId(null)
      return
    }

    let active = true
    let timerId: any = null
    let stepIdx = 0

    const runNextStep = () => {
      if (!active) return
      const step = flowSteps[stepIdx]
      if (!step) return

      if (step.type === 'node') {
        setPulsingNodeId(step.id)
        setBallPos(null)
        timerId = setTimeout(() => {
          setPulsingNodeId(null)
          stepIdx = (stepIdx + 1) % flowSteps.length
          runNextStep()
        }, flowAnimationSpeed * 0.5) // Flash node for 50% of step duration
      } else if (step.type === 'edge') {
        setPulsingNodeId(null)
        const edge = edges.find(e => e.id === step.id)
        if (!edge) {
          stepIdx = (stepIdx + 1) % flowSteps.length
          runNextStep()
          return
        }

        const effFrom = getEffectiveRectAndId(edge.sourceId)
        const effTo = getEffectiveRectAndId(edge.targetId)
        if (!effFrom || !effTo) {
          stepIdx = (stepIdx + 1) % flowSteps.length
          runNextStep()
          return
        }

        const p1 = step.sourceId === edge.sourceId
          ? (edge.sourcePort ? portPos(effFrom.rect, edge.sourcePort) : portPos(effFrom.rect, autoPort(effFrom.rect, effTo.rect)))
          : (edge.targetPort ? portPos(effTo.rect, edge.targetPort) : portPos(effTo.rect, autoPort(effTo.rect, effFrom.rect)))

        const p2 = step.sourceId === edge.sourceId
          ? (edge.targetPort ? portPos(effTo.rect, edge.targetPort) : portPos(effTo.rect, autoPort(effTo.rect, effFrom.rect)))
          : (edge.sourcePort ? portPos(effFrom.rect, edge.sourcePort) : portPos(effFrom.rect, autoPort(effFrom.rect, effTo.rect)))

        
        const duration = flowAnimationSpeed * 0.5 // Flow through edge for 50% of step duration
        const start = performance.now()

        const animateBall = (nowTime: number) => {
          if (!active) return
          const elapsed = nowTime - start
          const p = Math.min(elapsed / duration, 1)

          // Compute position on bezier curve
          const pt = getBezierPoint(p1, p2, p)
          setBallPos(pt)

          if (p < 1) {
            requestAnimationFrame(animateBall)
          } else {
            setBallPos(null)
            stepIdx = (stepIdx + 1) % flowSteps.length
            runNextStep()
          }
        }
        requestAnimationFrame(animateBall)
      }
    }

    runNextStep()

    return () => {
      active = false
      if (timerId) clearTimeout(timerId)
    }
  }, [flowSteps, edges, flowAnimationSpeed])



  const drag = useRef<{ kind: 'node' | 'region' | 'resize' | 'pan' | 'connect'; id?: string; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const onLayerMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const l = layerRef.current
    if (!l) return

    const ox = l.offsetLeft || 0
    const oy = l.offsetTop || 0
    const s = store.viewport.scale
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const cx = (e.clientX - rect.left - ox) / s
    const cy = (e.clientY - rect.top - oy) / s

    // Port click → connection
    const port = target.closest('.port')
    if (port) {
      const nodeEl = port.closest('.node-el') as HTMLElement
      if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId
        const pclass = Array.from(port.classList).find(c => c.startsWith('port-'))?.replace('port-', '') ?? 'r'
        const node = nodes.find(n => n.id === nodeId)
        const el = nodeRefs.current.get(nodeId ?? '')
        if (node && el) {
          const r = getNodeRect(node, el)
          const p = portPos(r, pclass)
          drag.current = { kind: 'connect', id: nodeId ?? '', sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
          return
        }
      }
      return
    }

    // Node click → start drag
    const nodeEl = target.closest('.node-el') as HTMLElement
    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId
      if (nodeId) {
        if (store.editingBusinessFlowId) {
          e.stopPropagation()
          e.preventDefault()
          store.toggleNodeInBusinessFlow(store.editingBusinessFlowId, nodeId)
          return
        }
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          drag.current = { kind: 'node', id: nodeId, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y }
          return
        }
      }
    }

    // Resize handle → start region resize
    const resizeEl = target.closest('.region-resize') as HTMLElement
    if (resizeEl) {
      const regionEl = resizeEl.closest('.region') as HTMLElement
      if (regionEl) {
        const rid = regionEl.dataset.region
        const region = regions.find(r => r.id === rid)
        if (region) {
          drag.current = { kind: 'resize', id: rid ?? '', sx: e.clientX, sy: e.clientY, ox: region.w, oy: region.h }
          return
        }
      }
      return
    }

    // Region header → start region drag
    const header = target.closest('.region-header') as HTMLElement
    if (header) {
      const regionEl = header.closest('.region') as HTMLElement
      if (regionEl) {
        const rid = regionEl.dataset.region
        const region = regions.find(r => r.id === rid)
        if (region) {
          drag.current = { kind: 'region', id: rid ?? '', sx: e.clientX, sy: e.clientY, ox: region.x, oy: region.y }
          return
        }
      }
      return
    }

      // Edge hit test
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i]
        const layout = portLayouts[edge.id]
        if (!layout) continue
        
        if (hitTestPath(layout.points, cx, cy, 12)) {
          if (store.linkingRequirementId) {
            e.stopPropagation()
            e.preventDefault()
            store.toggleEdgeInRequirement(store.linkingRequirementId, edge.id)
            return
          }
          if (store.editingBusinessFlowId) {
            e.stopPropagation()
            e.preventDefault()
            store.toggleEdgeInBusinessFlow(store.editingBusinessFlowId, edge.id)
            return
          }
          store.selectEdge(edge.id)
          return
        }
      }

    // Blank area → deselect edge + node + start panning
    store.selectEdge(null)
    store.selectNode(null)
    if (e.shiftKey) {
      drag.current = { kind: 'select', sx: e.clientX, sy: e.clientY, ox, oy }
      setSelectionBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY })
    } else {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox, oy }
    }
  }, [store, nodes, edges, regions])

  const rafRef = useRef<number | null>(null)
  const highlightedRegionRef = useRef<string | null>(null)

  const getImperativeRect = (nodeId: string, dId: string, dKind: string, dNx: number, dNy: number, dDx: number, dDy: number) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return null
    if (node.regionId) {
      const r = regions.find(reg => reg.id === node.regionId)
      if (r?.collapsed) {
        const rx = dKind === 'region' && dId === r.id ? r.x + dDx : r.x
        const ry = dKind === 'region' && dId === r.id ? r.y + dDy : r.y
        return { id: `r-${r.id}`, rect: { x: rx, y: ry, w: 220, h: 56 } }
      }
    }
    const el = nodeRefs.current.get(node.id) ?? null
    let nx = node.x
    let ny = node.y
    if (dKind === 'node' && dId === node.id) {
      nx = dNx
      ny = dNy
    } else if (dKind === 'region' && dId === node.regionId) {
      nx += dDx
      ny += dDy
    }
    return { id: node.id, rect: { x: nx, y: ny, w: el?.offsetWidth ?? 160, h: el?.offsetHeight ?? 80 } }
  }

  const updateEdgesImperatively = (dId: string, dKind: string, dNx: number, dNy: number, dDx: number, dDy: number) => {
    const counts: Record<string, Record<string, number>> = {}
    edges.forEach(edge => {
      const effFrom = getImperativeRect(edge.sourceId, dId, dKind, dNx, dNy, dDx, dDy)
      const effTo = getImperativeRect(edge.targetId, dId, dKind, dNx, dNy, dDx, dDy)
      if (!effFrom || !effTo) return
      const p1Str = edge.sourcePort || autoPort(effFrom.rect, effTo.rect)
      const p2Str = edge.targetPort || autoPort(effTo.rect, effFrom.rect)
      if (!counts[effFrom.id]) counts[effFrom.id] = { t: 0, b: 0, l: 0, r: 0 }
      if (!counts[effTo.id]) counts[effTo.id] = { t: 0, b: 0, l: 0, r: 0 }
      counts[effFrom.id][p1Str]++
      counts[effTo.id][p2Str]++
    })
    
    const assigned: Record<string, Record<string, number>> = {}
    const getSpreadPort = (nodeId: string, rect: any, port: string) => {
      if (!assigned[nodeId]) assigned[nodeId] = { t: 0, b: 0, l: 0, r: 0 }
      const idx = assigned[nodeId][port]++
      const total = counts[nodeId]?.[port] || 1
      let x, y
      const padding = 20
      if (port === 't' || port === 'b') {
        const step = total > 1 ? (rect.w - 2 * padding) / (total - 1) : 0
        x = total === 1 ? rect.x + rect.w / 2 : rect.x + padding + step * idx
        y = port === 't' ? rect.y : rect.y + rect.h
      } else {
        const step = total > 1 ? (rect.h - 2 * padding) / (total - 1) : 0
        y = total === 1 ? rect.y + rect.h / 2 : rect.y + padding + step * idx
        x = port === 'l' ? rect.x : rect.x + rect.w
      }
      return { x, y, dir: port }
    }

    edges.forEach(edge => {
      const effFrom = getImperativeRect(edge.sourceId, dId, dKind, dNx, dNy, dDx, dDy)
      const effTo = getImperativeRect(edge.targetId, dId, dKind, dNx, dNy, dDx, dDy)
      if (!effFrom || !effTo || effFrom.id === effTo.id) return

      const p1Str = edge.sourcePort || autoPort(effFrom.rect, effTo.rect)
      const p2Str = edge.targetPort || autoPort(effTo.rect, effFrom.rect)
      
      const p1 = getSpreadPort(effFrom.id, effFrom.rect, p1Str)
      const p2 = getSpreadPort(effTo.id, effTo.rect, p2Str)
      
      const { d: pathData } = orthogonalEdgePath(p1, p1.dir, p2, p2.dir, 15)
      
      const edgeG = document.querySelector(`g[data-edge-id="${edge.id}"]`)
      if (edgeG) {
        edgeG.querySelectorAll('path').forEach(p => p.setAttribute('d', pathData))
      }
      const labelDiv = document.querySelector(`div[data-label-id="${edge.id}"]`) as HTMLElement
      if (labelDiv) {
        const mx = (p1.x + p2.x) / 2
        const my = (p1.y + p2.y) / 2
        labelDiv.style.left = (mx - (labelDiv.offsetWidth || (edge.label.length * 6 + 16)) / 2) + 'px'
        labelDiv.style.top = (my - 10) + 'px'
      }
    })
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current
      if (!d) return
      const s = store.viewport.scale
      const dx = (e.clientX - d.sx) / s
      const dy = (e.clientY - d.sy) / s

      if (d.kind === 'pan') {
        const l = layerRef.current
        if (l) {
          const newX = d.ox + e.clientX - d.sx
          const newY = d.oy + e.clientY - d.sy
          l.style.left = newX + 'px'
          l.style.top = newY + 'px'
          if (viewportRef.current && store.showGrid) {
            viewportRef.current.style.backgroundPosition = `${newX}px ${newY}px`
          }
        }
        return
      }

      if (d.kind === 'select') {
        setSelectionBox(s => s ? { ...s, currentX: e.clientX, currentY: e.clientY } : null)
        return
      }

      if (d.kind === 'node') {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          const nx = d.ox + dx
          const ny = d.oy + dy
          
          // Imperative DOM updates
          const el = nodeRefs.current.get(d.id!)
          if (el) {
            el.style.left = nx + 'px'
            el.style.top = ny + 'px'
          }
          updateEdgesImperatively(d.id!, 'node', nx, ny, dx, dy)
          
          // Region highlight optimization
          let foundRegion: string | null = null
          if (el) {
            const cx2 = nx + (el.offsetWidth || 0) / 2
            const cy2 = ny + (el.offsetHeight || 0) / 2
            for (const r of regions) {
              if (cx2 >= r.x + 16 && cx2 <= r.x + r.w - 16 && cy2 >= r.y + 38 && cy2 <= r.y + r.h - 16) {
                foundRegion = r.id
                break
              }
            }
          }
          
          if (highlightedRegionRef.current !== foundRegion) {
            if (highlightedRegionRef.current) {
              const oldEl = document.querySelector(`.region[data-region="${highlightedRegionRef.current}"]`)
              if (oldEl) oldEl.classList.remove('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2')
            }
            if (foundRegion) {
              const newEl = document.querySelector(`.region[data-region="${foundRegion}"]`)
              if (newEl) newEl.classList.add('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2')
            }
            highlightedRegionRef.current = foundRegion
          }
        })
        return
      }

      if (d.kind === 'region') {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          const rx = d.ox + dx
          const ry = d.oy + dy
          // Imperative DOM updates for region
          const regEl = document.querySelector(`.region[data-region="${d.id!}"]`) as HTMLElement
          if (regEl) {
            regEl.style.left = rx + 'px'
            regEl.style.top = ry + 'px'
          }
          // Imperative DOM updates for nodes inside region
          nodes.filter(n => n.regionId === d.id).forEach(n => {
            const el = nodeRefs.current.get(n.id)
            if (el) {
              el.style.left = (n.x + dx) + 'px'
              el.style.top = (n.y + dy) + 'px'
            }
          })
          updateEdgesImperatively(d.id!, 'region', 0, 0, dx, dy)
        })
        return
      }

      if (d.kind === 'resize') {
        const nw = Math.max(d.ox + dx, 200)
        const nh = Math.max(d.oy + dy, 160)
        store.resizeRegion(d.id!, nw, nh)
        return
      }

      if (d.kind === 'connect') {
        const l = layerRef.current
        if (l) {
          const lx = (l.offsetLeft || 0)
          const ly = (l.offsetTop || 0)
          const rect = viewportRef.current?.getBoundingClientRect()
          if (rect) {
            const mx = (e.clientX - rect.left - lx) / s
            const my = (e.clientY - rect.top - ly) / s
            setConnecting({ fromId: d.id!, fromPort: 'r', mouseX: mx, mouseY: my })
          }
        }
        return
      }
    }

    const onUp = (e: MouseEvent) => {
      const d = drag.current
      if (!d) return

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      if (d.kind === 'node') {
        const dx = (e.clientX - d.sx) / store.viewport.scale
        const dy = (e.clientY - d.sy) / store.viewport.scale

        if (highlightedRegionRef.current) {
          const oldEl = document.querySelector(`.region[data-region="${highlightedRegionRef.current}"]`)
          if (oldEl) oldEl.classList.remove('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2')
          
          const node = nodes.find(n => n.id === d.id)
          if (node && node.regionId !== highlightedRegionRef.current) {
            store.setNodeRegion(d.id!, highlightedRegionRef.current)
          }
          highlightedRegionRef.current = null
        }
        // Restore DOM positions because React is about to re-render them anyway based on store state
        // But store.moveNode will immediately set the right state.
        store.moveNode(d.id!, d.ox + dx, d.oy + dy)
        store.syncNodePos(d.id!)
      }

      if (d.kind === 'region') {
        const dx = (e.clientX - d.sx) / store.viewport.scale
        const dy = (e.clientY - d.sy) / store.viewport.scale
        store.moveRegion(d.id!, dx, dy)
        store.syncRegionPos(d.id!)
      }

      if (d.kind === 'resize') {
        const dx = (e.clientX - d.sx) / store.viewport.scale
        const dy = (e.clientY - d.sy) / store.viewport.scale
        const nw = Math.max(d.ox + dx, 200)
        const nh = Math.max(d.oy + dy, 160)
        store.resizeRegion(d.id!, nw, nh)
      }

      if (d.kind === 'connect') {
        const target = (e.target as HTMLElement).closest('.node-el') as HTMLElement
        if (target) {
          const targetId = target.dataset.nodeId
          if (targetId && targetId !== d.id) {
            setNewEdgeTarget({ sourceId: d.id!, targetId })
          }
        }
        setConnecting(null)
      }

      if (d.kind === 'pan') {
        const l = layerRef.current
        if (l) {
          store.setViewport({ x: l.offsetLeft, y: l.offsetTop })
        }
      }

      if (d.kind === 'select') {
        setSelectionBox(s => {
          if (s) {
            const minX = Math.min(s.startX, s.currentX)
            const maxX = Math.max(s.startX, s.currentX)
            const minY = Math.min(s.startY, s.currentY)
            const maxY = Math.max(s.startY, s.currentY)
            
            const l = layerRef.current
            const rect = viewportRef.current?.getBoundingClientRect()
            if (l && rect) {
               const scale = store.viewport.scale
               const lx = l.offsetLeft || 0
               const ly = l.offsetTop || 0
               
               const cMinX = (minX - rect.left - lx) / scale
               const cMaxX = (maxX - rect.left - lx) / scale
               const cMinY = (minY - rect.top - ly) / scale
               const cMaxY = (maxY - rect.top - ly) / scale

               const selected = nodes.filter(n => {
                 const el = nodeRefs.current.get(n.id)
                 const w = el?.offsetWidth || 160
                 const h = el?.offsetHeight || 80
                 return (n.x < cMaxX && n.x + w > cMinX && n.y < cMaxY && n.y + h > cMinY)
               }).map(n => n.id)
               store.selectNodes(selected)
            }
          }
          return null
        })
      }

      drag.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [store, nodes, regions])

  const [connecting, setConnecting] = useState<{ fromId: string; fromPort: string; mouseX: number; mouseY: number } | null>(null)
  const [newEdgeTarget, setNewEdgeTarget] = useState<{ sourceId: string; targetId: string } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null)




  return (
    <>
      <div 
        className="flex-1 relative overflow-hidden bg-zinc-50/60" 
        ref={viewportRef}
        style={{
          ...(store.showGrid ? {
            backgroundImage: `linear-gradient(to right, #e4e4e7 1px, transparent 1px), linear-gradient(to bottom, #e4e4e7 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE * store.viewport.scale}px ${GRID_SIZE * store.viewport.scale}px`,
            backgroundPosition: `${store.viewport.x}px ${store.viewport.y}px`,
          } : {})
        }}
        onMouseDown={onLayerMouseDown}
      >
        <div
          id="canvas-layer"
          className="absolute top-0 left-0 transform-origin-[0_0] select-none"
          ref={layerRef}
          style={{
            transform: `scale(${store.viewport.scale})`,
            transformOrigin: '0 0',
            left: store.viewport.x,
            top: store.viewport.y
          }}
        >
          {/* Grid is handled by CSS on the wrapper div */}

          {/* Render Regions */}
          {regions.map(r => {
            const bc = r.color.replace('fa', 'da').replace('e6', 'da').replace('ed', 'da')
            const isCollapsed = !!r.collapsed
            const regionWidth = isCollapsed ? 220 : r.w
            const regionHeight = isCollapsed ? 56 : r.h
            const insideNodesCount = nodes.filter(n => n.regionId === r.id).length
            const isRegionActive = searchQuery ? (
              r.title.toLowerCase().includes(searchQuery) ||
              nodes.filter(n => n.regionId === r.id).some(n => 
                n.label.toLowerCase().includes(searchQuery) ||
                (n.sublabel && n.sublabel.toLowerCase().includes(searchQuery)) ||
                (n.fields && n.fields.some(f => f.name.toLowerCase().includes(searchQuery)))
              )
            ) : activeRequirement ? (
              (activeRequirement.regionIds || []).includes(r.id)
            ) : selectedNodeIds.length > 0 ? (
              nodes.filter(n => n.regionId === r.id).some(n => connectedNodeIds.has(n.id))
            ) : (activeFlow ? (
              nodes.filter(n => n.regionId === r.id).some(n => activeFlow.nodeIds.includes(n.id))
            ) : true)

            const isRegionInLinkMode = linkingRequirementId && activeRequirement ? (
              (activeRequirement.regionIds || []).includes(r.id)
            ) : false

            const rx = r.x
            const ry = r.y

            return (
              <div
                key={r.id}
                onClick={(e) => {
                  if (linkingRequirementId) {
                    e.stopPropagation()
                    store.toggleRegionInRequirement(linkingRequirementId, r.id)
                  }
                }}
                className={`region group/region absolute rounded-2xl pointer-events-none p-4 flex flex-col transition-colors transition-shadow duration-200 z-0 hover:ring-2 hover:ring-zinc-400/50 hover:shadow-md ${
                  isCollapsed ? 'shadow-sm border-double border-4' : 'shadow-none'
                } ${linkingRequirementId ? 'pointer-events-auto cursor-pointer' : ''} ${
                  isRegionInLinkMode ? 'ring-2 ring-purple-500 bg-purple-50/10' : ''
                }`}
                data-region={r.id}
                style={{
                  left: rx,
                  top: ry,
                  width: regionWidth,
                  height: regionHeight,
                  backgroundColor: r.color,
                  borderStyle: isCollapsed ? 'double' : 'solid',
                  borderWidth: isCollapsed ? '4px' : '1px',
                  borderColor: bc.length > 7 ? bc : '#e4e4e7',
                  opacity: isRegionActive ? 1 : 0.2
                }}
              >
                <div className="region-header absolute top-0 left-0 right-0 h-9 rounded-t-2xl cursor-move pointer-events-auto hover:bg-zinc-950/[0.02] transition-colors" />
                
                <div 
                  className="region-title absolute top-3 left-4 text-[10px] font-bold uppercase tracking-wider select-none pointer-events-none flex flex-col transition-colors"
                  style={{ color: getContrastColor(r.color) }}
                >
                  <span>{r.title}</span>
                  {isCollapsed && (
                    <span className="text-[8px] font-normal lowercase tracking-normal normal-case mt-0.5 opacity-80">
                      ({insideNodesCount} 个节点)
                    </span>
                  )}
                </div>

                <button
                  className="absolute top-2 right-4 flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-900/10 cursor-pointer pointer-events-auto transition-colors"
                  style={{ color: getContrastColor(r.color), opacity: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    store.toggleRegionCollapse(r.id)
                  }}
                  title={isCollapsed ? "展开" : "折叠"}
                >
                  {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>

                {!isCollapsed && (
                  <div className="region-resize absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize pointer-events-auto bg-gradient-to-br from-transparent to-zinc-200 hover:to-zinc-300 rounded-br-2xl transition-colors" />
                )}
              </div>
            )
          })}

          {/* Render Connections SVG */}
          <svg className="absolute top-0 left-0 z-10 pointer-events-none overflow-visible" style={{ width: 1, height: 1 }}>
            <defs>
              <marker id="arr-f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#a1a1aa" />
              </marker>
              <marker id="arr-r" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#a1a1aa" />
              </marker>
              <marker id="arr-f-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#18181b" />
              </marker>
              <marker id="arr-r-sel" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#18181b" />
              </marker>
              <marker id="arr-f-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#4f46e5" />
              </marker>
              <marker id="arr-r-flow" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#4f46e5" />
              </marker>
              <marker id="arr-f-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#e4e4e7" />
              </marker>
              <marker id="arr-r-dim" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" fill="#e4e4e7" />
              </marker>
            </defs>
            {edges.map((edge, idx) => {
              const effFrom = getEffectiveRectAndId(edge.sourceId)
              const effTo = getEffectiveRectAndId(edge.targetId)
              if (!effFrom || !effTo) return null
              // If both ends are collapsed into the same region, hide it
              if (effFrom.id === effTo.id) return null

              const layout = portLayouts[edge.id]
              if (!layout) return null
              const { d, points } = layout
              const isSel = store.selectedEdgeId === edge.id
              
              const inFlow = activeFlow ? activeFlow.edgeIds.includes(edge.id) : false
              const inReq = activeRequirement ? (activeRequirement.edgeIds || []).includes(edge.id) : false
              const isEdgeActive = searchQuery ? (
                edge.label.toLowerCase().includes(searchQuery) || 
                nodes.find(n => n.id === edge.sourceId)?.label.toLowerCase().includes(searchQuery) ||
                nodes.find(n => n.id === edge.targetId)?.label.toLowerCase().includes(searchQuery)
              ) : activeRequirement ? inReq : selectedNodeIds.length > 0 ? connectedEdgeIds.has(edge.id) : (activeFlow ? inFlow : true)
              const edgeOpacity = isEdgeActive ? (store.editingBusinessFlowId && !inFlow ? 0.3 : linkingRequirementId && !inReq ? 0.3 : 1) : 0.15
              const isHovered = hoveredEdgeId === edge.id
              
              let startColor = '#e4e4e7' // zinc-200
              let endColor = '#71717a'   // zinc-500
              
              if (isHovered) {
                startColor = '#a5b4fc' // indigo-300
                endColor = '#4338ca'   // indigo-700
              } else if (activeRequirement) {
                if (inReq) {
                  startColor = '#d8b4fe' // purple-300
                  endColor = '#7e22ce'   // purple-700
                }
              } else if (activeFlow) {
                if (inFlow) {
                  startColor = '#a5b4fc'
                  endColor = '#4338ca'
                }
              } else if (isSel) {
                startColor = '#a1a1aa' // zinc-400
                endColor = '#18181b'   // zinc-900
              }

              const strokeWidth = isHovered ? '3' : activeRequirement ? (inReq ? '2.5' : '1') : activeFlow ? (inFlow ? '2.5' : '1') : (isSel ? '2' : '1.5')
              const opacity = isHovered ? 1 : activeRequirement ? (inReq ? 1 : 0.15) : activeFlow ? (inFlow ? 1 : 0.15) : edgeOpacity

              let x1 = points[0].x, y1 = points[0].y
              let x2 = points[points.length - 1].x, y2 = points[points.length - 1].y
              
              if (edge.dir === 'rev') {
                x1 = points[points.length - 1].x
                y1 = points[points.length - 1].y
                x2 = points[0].x
                y2 = points[0].y
              }
              
              const gradId = `grad-${edge.id}-${startColor.replace('#', '')}-${endColor.replace('#', '')}`

              return (
                <g 
                  key={edge.id} 
                  data-edge-id={edge.id} 
                  style={{ opacity, transition: 'opacity 0.2s, stroke-width 0.2s' }} 
                  className="cursor-pointer drop-shadow-sm"
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditEdgeId(edge.id)
                  }}
                >
                  <defs>
                    <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                      <stop offset="0%" stopColor={edge.dir === 'both' ? endColor : startColor} />
                      <stop offset="100%" stopColor={endColor} />
                    </linearGradient>
                  </defs>
                  {/* Invisible thicker path for easier hovering */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth="12" className="pointer-events-auto" />
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="transition-colors pointer-events-auto"
                  />
                  {store.flowAnimation && (!activeFlow || inFlow) && (
                    <>
                      <path
                        d={d}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9))' }}
                        className={`edge-flow ${edge.dir === 'rev' ? 'rev' : 'fwd'}`}
                      />
                      {edge.dir === 'both' && (
                        <path 
                          d={d} 
                          fill="none" 
                          stroke="#ffffff" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9))' }}
                          className="edge-flow rev" 
                        />
                      )}
                    </>
                  )}
                </g>
              )
            })}

            <style>{`
              @keyframes node-flash {
                0% {
                  transform: scale(1);
                  box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7);
                }
                50% {
                  transform: scale(1.06);
                  box-shadow: 0 0 25px 8px rgba(79, 70, 229, 0.8);
                }
                100% {
                  transform: scale(1);
                  box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
                }
              }
              .animate-node-flash {
                animation: node-flash 0.5s ease-in-out;
              }
            `}</style>
          </svg>

          {/* Render Connection Labels with Overlap Avoidance */}
          {(() => {
            const labelPositions = edges.map((edge) => {
              const effFrom = getEffectiveRectAndId(edge.sourceId)
              const effTo = getEffectiveRectAndId(edge.targetId)
              if (!effFrom || !effTo) return null
              if (effFrom.id === effTo.id) return null

              const p1 = edge.sourcePort ? portPos(effFrom.rect, edge.sourcePort) : portPos(effFrom.rect, autoPort(effFrom.rect, effTo.rect))
              const p2 = edge.targetPort ? portPos(effTo.rect, edge.targetPort) : portPos(effTo.rect, autoPort(effTo.rect, effFrom.rect))
              const mx = (p1.x + p2.x) / 2
              const my = (p1.y + p2.y) / 2
              const labelWidth = edge.label.length * 6 + 16
              return {
                id: edge.id,
                label: edge.label,
                x: mx,
                y: my,
                width: labelWidth,
                height: 20
              }
            }).filter((item): item is NonNullable<typeof item> => item !== null)

            // Dynamic collision resolution loop (always on since React only renders at rest)
            for (let i = 0; i < labelPositions.length; i++) {
              for (let j = i + 1; j < labelPositions.length; j++) {
                const a = labelPositions[i]
                const b = labelPositions[j]
                const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 10
                const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 6
                if (overlapX && overlapY) {
                  // Shift the second label downwards to avoid overlapping
                  b.y += 22
                }
              }
            }

            return labelPositions.map((pos) => {
              const inFlow = activeFlow ? activeFlow.edgeIds.includes(pos.id) : false
              const inReq = activeRequirement ? (activeRequirement.edgeIds || []).includes(pos.id) : false
              const isLabelActive = searchQuery ? (
                pos.label.toLowerCase().includes(searchQuery)
              ) : activeRequirement ? inReq : selectedNodeIds.length > 0 ? connectedEdgeIds.has(pos.id) : (activeFlow ? inFlow : true)
              const isHovered = hoveredEdgeId === pos.id
              const labelOpacity = isHovered ? 1 : (isLabelActive ? 1 : 0.15)
              return (
                <div
                  key={`lbl-${pos.id}`}
                  data-label-id={pos.id}
                  className={`absolute text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap transition-all duration-200 cursor-pointer pointer-events-auto ${
                    isHovered ? 'text-indigo-700 bg-indigo-50 border-indigo-300 shadow-md ring-1 ring-indigo-200 z-50' : 'text-zinc-500 bg-white border border-zinc-200/50 shadow-sm z-25'
                  }`}
                  style={{
                    left: pos.x - pos.width / 2,
                    top: pos.y - pos.height / 2,
                    width: pos.width,
                    opacity: labelOpacity
                  }}
                  onMouseEnter={() => setHoveredEdgeId(pos.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditEdgeId(pos.id)
                  }}
                >
                  {pos.label}
                </div>
              )
            })
          })()}

          {/* Render Nodes (Entities) */}
          {nodes.filter(node => {
            if (!node.regionId) return true
            const r = regions.find(reg => reg.id === node.regionId)
            return !r?.collapsed
          }).map(node => {
            const inReq = activeRequirement ? (activeRequirement.nodeIds || []).includes(node.id) : false
            const isNodeActive = searchQuery ? (
              node.label.toLowerCase().includes(searchQuery) ||
              (node.sublabel && node.sublabel.toLowerCase().includes(searchQuery)) ||
              (node.fields && node.fields.some(f => f.name.toLowerCase().includes(searchQuery)))
            ) : activeRequirement ? inReq : selectedNodeIds.length > 0 ? connectedNodeIds.has(node.id) : (activeFlow ? activeFlow.nodeIds.includes(node.id) : true)
            const isNodeInEditMode = store.editingBusinessFlowId ? (
              activeFlow?.nodeIds.includes(node.id)
            ) : linkingRequirementId ? (
              inReq
            ) : false
            let nx = node.x
            let ny = node.y

            return (
              <div
                key={node.id}
                ref={(el) => { if (el) nodeRefs.current.set(node.id, el) }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditNodeId(node.id)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (linkingRequirementId) {
                    store.toggleNodeInRequirement(linkingRequirementId, node.id)
                    return
                  }
                  if (e.shiftKey) {
                    store.selectNode(node.id, true)
                  } else {
                    store.selectNode(node.id)
                  }
                }}
                className={`node-el absolute z-20 cursor-move bg-white border transition-colors transition-shadow duration-200 rounded-xl p-3.5 min-w-40 flex flex-col group/node hover:ring-2 hover:ring-indigo-400 hover:shadow-lg hover:-translate-y-0.5 ${
                  !isNodeActive ? 'opacity-15 grayscale border-zinc-200 shadow-none' : (
                    activeRequirement ? 'ring-2 ring-purple-500 shadow-md shadow-purple-100/50 border-purple-200 z-30' :
                    activeFlow ? 'ring-2 ring-indigo-500 shadow-md shadow-indigo-100/50 border-indigo-200 z-30' : 'border-zinc-200 shadow-sm'
                  )
                } ${
                  (store.editingBusinessFlowId || linkingRequirementId) ? 'ring-2 border-zinc-300' : ''
                } ${
                  isNodeInEditMode && linkingRequirementId ? 'ring-purple-500 border-purple-500 bg-purple-50/10' :
                  isNodeInEditMode ? 'ring-indigo-500 border-indigo-500 bg-indigo-50/10' : ''
                } ${
                  node.id === pulsingNodeId ? 'animate-node-flash shadow-[0_0_25px_rgba(79,70,229,0.8)] border-indigo-500 scale-105 z-40' : ''
                }`}
                data-node-id={node.id}
                style={{ left: nx, top: ny }}
              >
              {/* Header & Fields */}
              {(() => {
                const nodeContainsHoveredField = hoveredFieldInfo && node.fields?.some(f => {
                  return (node.id === hoveredFieldInfo.nodeId && f.name === hoveredFieldInfo.name) || 
                         (f.ref === `${hoveredFieldInfo.nodeId}.${hoveredFieldInfo.name}`) ||
                         (hoveredFieldInfo.ref === `${node.id}.${f.name}`)
                })
                return (
                  <>
                    <div className={`flex items-center justify-between pb-2 border-b border-zinc-200/80 mb-1 ${
                      node.collapsedFields && nodeContainsHoveredField ? 'bg-blue-50 rounded-md px-2 -mx-2 ring-1 ring-blue-200 transition-all duration-300' : 'transition-all duration-300'
                    }`}>
                      <div 
                        className="flex items-center gap-1.5"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setInlineEditNodeId(node.id)
                        }}
                      >
                        {node.type === 'entity' ? <Table size={12} className="text-zinc-400" /> :
                         node.type === 'actor' ? <User size={12} className="text-zinc-400" /> :
                         node.type === 'process' ? <Cog size={12} className="text-zinc-400" /> :
                         <Box size={12} className="text-zinc-400" />}
                        {inlineEditNodeId === node.id ? (
                           <input
                             className="text-xs font-bold text-zinc-900 tracking-tight bg-white outline-none w-24 border-b-2 border-indigo-500 pb-0.5"
                             defaultValue={node.label}
                             autoFocus
                             onFocus={(e) => e.target.select()}
                             onBlur={(e) => {
                               const newLabel = e.target.value.trim()
                               if (newLabel && newLabel !== node.label) {
                                 store.updateNode(node.id, { label: newLabel })
                               }
                               setInlineEditNodeId(null)
                             }}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') e.currentTarget.blur()
                               if (e.key === 'Escape') setInlineEditNodeId(null)
                             }}
                             onClick={e => e.stopPropagation()}
                             onDoubleClick={e => e.stopPropagation()}
                           />
                        ) : (
                          <span className="text-xs font-bold text-zinc-900 tracking-tight">{node.label}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {node.sublabel && (
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 font-semibold px-1.5 py-0.5 rounded border border-zinc-200/30">
                            {node.sublabel}
                          </span>
                        )}
                        {node.fields && node.fields.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); store.toggleNodeFieldsCollapse(node.id) }}
                            className="p-0.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                            title={node.collapsedFields ? "展开字段" : "折叠字段"}
                          >
                            {node.collapsedFields ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    {!node.collapsedFields && node.fields && node.fields.length > 0 && (
                      <div className="flex flex-col rounded-md overflow-hidden border border-zinc-100">
                        {node.fields.map((f, i) => {
                          const isHoverMatched = hoveredFieldInfo && (
                            (node.id === hoveredFieldInfo.nodeId && f.name === hoveredFieldInfo.name) || 
                            (f.ref === `${hoveredFieldInfo.nodeId}.${hoveredFieldInfo.name}`) ||
                            (hoveredFieldInfo.ref === `${node.id}.${f.name}`)
                          )
                          return (
                            <div 
                              key={f.name} 
                              onMouseEnter={() => setHoveredFieldInfo({ nodeId: node.id, name: f.name, ref: f.ref })}
                              onMouseLeave={() => setHoveredFieldInfo(null)}
                              className={`flex items-center justify-between text-[11px] gap-4 px-2 py-1 transition-colors cursor-default ${
                                isHoverMatched ? 'bg-blue-100 text-blue-900 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]' : (i % 2 === 0 ? 'bg-zinc-50/50' : 'bg-white')
                              }`}
                              title={`${f.description || ''}${f.default ? `\n默认值: ${f.default}` : ''}`}
                            >
                              <div className="flex items-center gap-1.5">
                                {f.name === 'id' || f.name === '_id' ? (
                                  <Key size={10} className={isHoverMatched ? "text-blue-600" : "text-amber-500"} />
                                ) : f.ref ? (
                                  <Link2 size={10} className={isHoverMatched ? "text-blue-600" : "text-indigo-400"} />
                                ) : (
                                  <div className="w-[10px]" />
                                )}
                                <span className={`font-medium ${isHoverMatched ? 'text-blue-900' : (f.name === 'id' || f.name === '_id' || f.ref ? 'text-zinc-800' : 'text-zinc-600')}`}>
                                  {f.name}
                                </span>
                                {f.required && <span className={isHoverMatched ? "text-blue-500 text-[10px]" : "text-rose-500 text-[10px]"}>*</span>}
                              </div>
                              <span className={`${isHoverMatched ? 'text-blue-700' : 'text-zinc-400'} font-mono text-[9px] text-right truncate max-w-[80px]`} title={f.type}>
                                {f.type}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Port Connectors */}
              <div className="port port-t absolute w-2 h-2 rounded-full bg-zinc-300 border border-white top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-30 hover:bg-zinc-900 hover:scale-125 transition-transform duration-100" />
              <div className="port port-b absolute w-2 h-2 rounded-full bg-zinc-300 border border-white bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-crosshair z-30 hover:bg-zinc-900 hover:scale-125 transition-transform duration-100" />
              <div className="port port-l absolute w-2 h-2 rounded-full bg-zinc-300 border border-white left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-30 hover:bg-zinc-900 hover:scale-125 transition-transform duration-100" />
              <div className="port port-r absolute w-2 h-2 rounded-full bg-zinc-300 border border-white right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-crosshair z-30 hover:bg-zinc-900 hover:scale-125 transition-transform duration-100" />
            </div>
          )})}

          {/* Render Flowing Ball on Top */}
          {ballPos && (
            <div
              className="pointer-events-none absolute w-5 h-5 rounded-full bg-indigo-500 border-2 border-white"
              style={{
                left: ballPos.x - 10,
                top: ballPos.y - 10,
                zIndex: 100,
                boxShadow: '0 0 15px #6366f1, 0 0 30px #4f46e5, inset 0 0 5px #ffffff',
              }}
            />
          )}
        </div>
      </div>

      {editNodeId && (
        <EntityEditor
          editNode={nodes.find(n => n.id === editNodeId)}
          onClose={() => setEditNodeId(null)}
        />
      )}
      {selectionBox && (
        <div
          className="fixed border border-indigo-500 bg-indigo-500/10 pointer-events-none z-[100]"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}
        />
      )}
      {newEdgeTarget && (
        <EdgeEditor
          sourceId={newEdgeTarget.sourceId}
          targetId={newEdgeTarget.targetId}
          onClose={() => setNewEdgeTarget(null)}
        />
      )}
      {editEdgeId && (
        <EdgeEditor
          edgeId={editEdgeId}
          onClose={() => setEditEdgeId(null)}
        />
      )}
      {selectedNodeIds.length > 1 && !drag.current && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 flex items-center gap-1">
          <div className="text-[10px] font-bold text-zinc-400 px-2 uppercase tracking-wider">对齐</div>
          <div className="w-px h-4 bg-zinc-200 mx-1" />
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="左对齐" onClick={() => store.alignNodes(selectedNodeIds, 'left')}><AlignLeft size={16} /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="水平居中" onClick={() => store.alignNodes(selectedNodeIds, 'center')}><AlignCenter size={16} /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="右对齐" onClick={() => store.alignNodes(selectedNodeIds, 'right')}><AlignRight size={16} /></button>
          <div className="w-px h-4 bg-zinc-200 mx-1" />
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="上对齐" onClick={() => store.alignNodes(selectedNodeIds, 'top')}><AlignLeft size={16} className="rotate-90" /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="垂直居中" onClick={() => store.alignNodes(selectedNodeIds, 'middle')}><AlignCenter size={16} className="rotate-90" /></button>
          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="下对齐" onClick={() => store.alignNodes(selectedNodeIds, 'bottom')}><AlignRight size={16} className="rotate-90" /></button>
          {selectedNodeIds.length > 2 && (
            <>
              <div className="w-px h-4 bg-zinc-200 mx-1" />
              <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="水平等距" onClick={() => store.alignNodes(selectedNodeIds, 'distribute-h')}><LayoutGrid size={16} /></button>
              <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="垂直等距" onClick={() => store.alignNodes(selectedNodeIds, 'distribute-v')}><LayoutGrid size={16} className="rotate-90" /></button>
            </>
          )}
        </div>
      )}
      <MiniMap />
    </>
  )
}
