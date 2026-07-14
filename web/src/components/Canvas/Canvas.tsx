import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { FlowNode } from '../../types'
import EdgeEditor from '../EdgeEditor/EdgeEditor'
import { ChevronDown, ChevronUp } from 'lucide-react'

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

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dy = Math.abs(to.y - from.y)
  const dx = Math.abs(to.x - from.x)
  if (dx > dy * 1.5) {
    const cp = Math.max(dx * 0.5, 60)
    return { d: `M ${from.x} ${from.y} C ${from.x + cp} ${from.y}, ${to.x - cp} ${to.y}, ${to.x} ${to.y}`, cp }
  }
  const cp = Math.max(dy * 0.5, 60)
  return { d: `M ${from.x} ${from.y} C ${from.x} ${from.y + cp}, ${to.x} ${to.y - cp}, ${to.x} ${to.y}`, cp }
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function getBezierPoint(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  const dy = Math.abs(to.y - from.y)
  const dx = Math.abs(to.x - from.x)
  if (dx > dy * 1.5) {
    const cp = Math.max(dx * 0.5, 60)
    return {
      x: cubicBezier(from.x, from.x + cp, to.x - cp, to.x, t),
      y: cubicBezier(from.y, from.y, to.y, to.y, t)
    }
  }
  const cp = Math.max(dy * 0.5, 60)
  return {
    x: cubicBezier(from.x, from.x, to.x, to.x, t),
    y: cubicBezier(from.y, from.y + cp, to.y - cp, to.y, t)
  }
}

function hitTestBezier(from: { x: number; y: number }, to: { x: number; y: number }, cp: number, px: number, py: number, threshold = 10) {
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bbx = cubicBezier(from.x, from.x, to.x, to.x, t)
    const bby = cubicBezier(from.y, from.y + cp, to.y - cp, to.y, t)
    const dx = px - bbx
    const dy = py - bby
    if (dx * dx + dy * dy < threshold * threshold) return true
  }
  return false
}

function Grid({ width, height }: { width: number; height: number }) {
  const xLines: number[] = []
  for (let x = 0; x <= width; x += GRID_SIZE) xLines.push(x)
  const yLines: number[] = []
  for (let y = 0; y <= height; y += GRID_SIZE) yLines.push(y)

  return (
    <svg className="grid-layer absolute top-0 left-0 pointer-events-none opacity-30" viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {xLines.map((x) => <line key={`x-${x}`} x1={x} y1={0} x2={x} y2={height} />)}
      {yLines.map((y) => <line key={`y-${y}`} x1={0} y1={y} x2={width} y2={y} />)}
    </svg>
  )
}

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
      rect: getNodeRect(node, el)
    }
  }, [nodes, regions])

  const activeBusinessFlowId = store.activeBusinessFlowId
  const activeFlow = project?.businessFlows?.find(f => f.id === activeBusinessFlowId)
  const flowAnimationSpeed = store.flowAnimationSpeed
  const selectedNodeId = store.selectedNodeId
  const searchQuery = store.searchQuery.toLowerCase()

  const connectedEdgeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    return new Set(edges.filter(e => e.sourceId === selectedNodeId || e.targetId === selectedNodeId).map(e => e.id))
  }, [selectedNodeId, edges])

  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const s = new Set<string>([selectedNodeId])
    edges.forEach(e => {
      if (e.sourceId === selectedNodeId) s.add(e.targetId)
      if (e.targetId === selectedNodeId) s.add(e.sourceId)
    })
    return s
  }, [selectedNodeId, edges])

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
      const from = nodes.find(n => n.id === edge.sourceId)
      const to = nodes.find(n => n.id === edge.targetId)
      if (!from || !to) continue
      const rFrom = getNodeRect(from, nodeRefs.current.get(from.id) ?? null)
      const rTo = getNodeRect(to, nodeRefs.current.get(to.id) ?? null)
      const p1 = edge.sourcePort ? portPos(rFrom, edge.sourcePort) : portPos(rFrom, autoPort(rFrom, rTo))
      const p2 = edge.targetPort ? portPos(rTo, edge.targetPort) : portPos(rTo, autoPort(rTo, rFrom))
      const { cp } = edgePath(p1, p2)
      if (hitTestBezier(p1, p2, cp, cx, cy, 12)) {
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
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox, oy }
  }, [store, nodes, edges, regions])

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
          l.style.left = (d.ox + e.clientX - d.sx) + 'px'
          l.style.top = (d.oy + e.clientY - d.sy) + 'px'
        }
        return
      }

      if (d.kind === 'node') {
        const nx = Math.max(20, d.ox + dx)
        const ny = Math.max(20, d.oy + dy)
        store.moveNode(d.id!, nx, ny)
        // Region highlight
        document.querySelectorAll('.region-highlight').forEach(el => el.classList.remove('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2'))
        const el = nodeRefs.current.get(d.id!)
        if (el) {
          const cx2 = nx + (el.offsetWidth || 0) / 2
          const cy2 = ny + (el.offsetHeight || 0) / 2
          for (const r of regions) {
            if (cx2 >= r.x + 16 && cx2 <= r.x + r.w - 16 && cy2 >= r.y + 38 && cy2 <= r.y + r.h - 16) {
              const regEl = document.querySelector(`.region[data-region="${r.id}"]`)
              if (regEl) {
                regEl.classList.add('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2')
              }
              break
            }
          }
        }
        return
      }

      if (d.kind === 'region') {
        store.moveRegion(d.id!, dx, dy)
        drag.current = { ...d, ox: d.ox + dx, oy: d.oy + dy, sx: e.clientX, sy: e.clientY }
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

      if (d.kind === 'node') {
        document.querySelectorAll('.region-highlight').forEach(el => el.classList.remove('region-highlight', 'ring-2', 'ring-zinc-900', 'ring-offset-2'))
        const node = nodes.find(n => n.id === d.id)
        if (node) {
          const el = nodeRefs.current.get(d.id!)
          const cx = node.x + (el?.offsetWidth || 0) / 2
          const cy = node.y + (el?.offsetHeight || 0) / 2
          let foundRegion: string | undefined
          for (const r of regions) {
            if (cx >= r.x + 16 && cx <= r.x + r.w - 16 && cy >= r.y + 38 && cy <= r.y + r.h - 16) {
              foundRegion = r.id
              break
            }
          }
          if (node.regionId !== foundRegion) {
            store.setNodeRegion(d.id!, foundRegion)
          }
        }
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

      drag.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [store, nodes, regions])

  const [connecting, setConnecting] = useState<{ fromId: string; fromPort: string; mouseX: number; mouseY: number } | null>(null)
  const [newEdgeTarget, setNewEdgeTarget] = useState<{ sourceId: string; targetId: string } | null>(null)



  const maxNodeX = nodes.reduce((max, n) => Math.max(max, n.x + 400), 0)
  const maxRegionX = regions.reduce((max, r) => Math.max(max, r.x + (r.collapsed ? 220 : r.w) + 400), 0)
  const canvasW = Math.max(BASE_CANVAS_W, maxNodeX, maxRegionX)

  const maxNodeY = nodes.reduce((max, n) => Math.max(max, n.y + 300), 0)
  const maxRegionY = regions.reduce((max, r) => Math.max(max, r.y + (r.collapsed ? 56 : r.h) + 300), 0)
  const canvasH = Math.max(BASE_CANVAS_H, maxNodeY, maxRegionY)



  return (
    <>
      <div className="flex-1 relative overflow-hidden bg-zinc-50/60" ref={viewportRef}>
        <div
          id="canvas-layer"
          className="absolute top-0 left-0 transform-origin-[0_0] select-none"
          ref={layerRef}
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${store.viewport.scale})`,
            transformOrigin: '0 0'
          }}
          onMouseDown={onLayerMouseDown}
        >
          {store.showGrid && <Grid width={canvasW} height={canvasH} />}

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
            ) : selectedNodeId ? (
              nodes.filter(n => n.regionId === r.id).some(n => connectedNodeIds.has(n.id))
            ) : (activeFlow ? (
              nodes.filter(n => n.regionId === r.id).some(n => activeFlow.nodeIds.includes(n.id))
            ) : true)

            return (
              <div
                key={r.id}
                className={`region group/region absolute rounded-2xl pointer-events-none p-4 flex flex-col transition-all duration-200 z-0 hover:ring-2 hover:ring-zinc-400/50 hover:shadow-md ${
                  isCollapsed ? 'shadow-sm border-double border-4' : 'shadow-none'
                }`}
                data-region={r.id}
                style={{
                  left: r.x,
                  top: r.y,
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
          <svg className="absolute top-0 left-0 z-10 pointer-events-none" style={{ width: canvasW, height: canvasH }}>
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

              const p1 = edge.sourcePort ? portPos(effFrom.rect, edge.sourcePort) : portPos(effFrom.rect, autoPort(effFrom.rect, effTo.rect))
              const p2 = edge.targetPort ? portPos(effTo.rect, edge.targetPort) : portPos(effTo.rect, autoPort(effTo.rect, effFrom.rect))
              const { d } = edgePath(p1, p2)
              const isSel = store.selectedEdgeId === edge.id
              
              const inFlow = activeFlow ? activeFlow.edgeIds.includes(edge.id) : false
              const isEdgeActive = searchQuery ? (
                edge.label.toLowerCase().includes(searchQuery) || 
                nodes.find(n => n.id === edge.sourceId)?.label.toLowerCase().includes(searchQuery) ||
                nodes.find(n => n.id === edge.targetId)?.label.toLowerCase().includes(searchQuery)
              ) : selectedNodeId ? connectedEdgeIds.has(edge.id) : (activeFlow ? inFlow : true)
              const edgeOpacity = isEdgeActive ? (store.editingBusinessFlowId && !inFlow ? 0.3 : 1) : 0.15
              const strokeColor = activeFlow ? (inFlow ? '#4f46e5' : '#e4e4e7') : (isSel ? '#18181b' : '#d4d4d8')
              const strokeWidth = activeFlow ? (inFlow ? '2.5' : '1') : (isSel ? '2' : '1.5')
              const opacity = activeFlow ? (inFlow ? 1 : 0.15) : edgeOpacity

              let markerSuffix = ''
              if (activeFlow) {
                markerSuffix = inFlow ? '-flow' : '-dim'
              } else {
                markerSuffix = isSel ? '-sel' : ''
              }
              let markerStart = '', markerEnd = ''
              if (edge.dir === 'fwd') markerEnd = `url(#arr-f${markerSuffix})`
              else if (edge.dir === 'rev') markerStart = `url(#arr-r${markerSuffix})`
              else { markerStart = `url(#arr-r${markerSuffix})`; markerEnd = `url(#arr-f${markerSuffix})` }

              return (
                <g key={edge.id} style={{ opacity, transition: 'opacity 0.2s' }} className="group/edge cursor-pointer hover:drop-shadow-sm">
                  {/* Invisible thicker path for easier hovering */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth="12" className="pointer-events-auto" />
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    markerStart={markerStart}
                    markerEnd={markerEnd}
                    className="group-hover/edge:stroke-indigo-500 group-hover/edge:stroke-[3px] transition-all pointer-events-auto"
                  />
                  {store.flowAnimation && (!activeFlow || inFlow) && (
                    <>
                      <path
                        d={d}
                        fill="none"
                        stroke={activeFlow ? '#6366f1' : '#18181b'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        className={`edge-flow ${edge.dir === 'rev' ? 'rev' : 'fwd'}`}
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke="#fafafa"
                        strokeWidth="1"
                        strokeLinecap="round"
                        className={`edge-flow ${edge.dir === 'rev' ? 'rev' : 'fwd'}`}
                      />
                      {edge.dir === 'both' && (
                        <>
                          <path d={d} fill="none" stroke={activeFlow ? '#6366f1' : '#18181b'} strokeWidth="3" strokeLinecap="round" className="edge-flow rev" />
                          <path d={d} fill="none" stroke="#fafafa" strokeWidth="1" strokeLinecap="round" className="edge-flow rev" />
                        </>
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

            // Dynamic collision resolution loop
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
              const isLabelActive = searchQuery ? (
                pos.label.toLowerCase().includes(searchQuery)
              ) : selectedNodeId ? connectedEdgeIds.has(pos.id) : (activeFlow ? inFlow : true)
              const labelOpacity = isLabelActive ? 1 : 0.15
              return (
                <div
                  key={`lbl-${pos.id}`}
                  className="absolute z-25 text-[10px] font-semibold text-zinc-500 bg-white border border-zinc-200/50 shadow-sm px-2 py-0.5 rounded pointer-events-none whitespace-nowrap transition-all duration-200"
                  style={{
                    left: pos.x - pos.width / 2,
                    top: pos.y - pos.height / 2,
                    opacity: labelOpacity
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
            const isNodeActive = searchQuery ? (
              node.label.toLowerCase().includes(searchQuery) ||
              (node.sublabel && node.sublabel.toLowerCase().includes(searchQuery)) ||
              (node.fields && node.fields.some(f => f.name.toLowerCase().includes(searchQuery)))
            ) : selectedNodeId ? connectedNodeIds.has(node.id) : (activeFlow ? activeFlow.nodeIds.includes(node.id) : true)
            const isNodeInEditMode = store.editingBusinessFlowId ? (
              activeFlow?.nodeIds.includes(node.id)
            ) : false
            return (
              <div
                key={node.id}
                ref={(el) => { if (el) nodeRefs.current.set(node.id, el) }}
                onClick={(e) => { e.stopPropagation(); store.selectNode(node.id) }}
                className={`node-el absolute z-20 cursor-move bg-white border transition-all duration-200 rounded-xl p-3.5 min-w-40 flex flex-col group/node hover:ring-2 hover:ring-indigo-400 hover:shadow-lg hover:-translate-y-0.5 ${
                  !isNodeActive ? 'opacity-15 grayscale border-zinc-200 shadow-none' : (
                    activeFlow ? 'ring-2 ring-indigo-500 shadow-md shadow-indigo-100/50 border-indigo-200 z-30' : 'border-zinc-200 shadow-sm'
                  )
                } ${
                  store.editingBusinessFlowId ? 'ring-2 border-zinc-300' : ''
                } ${
                  isNodeInEditMode ? 'ring-indigo-500 border-indigo-500 bg-indigo-50/10' : ''
                } ${
                  node.id === pulsingNodeId ? 'animate-node-flash shadow-[0_0_25px_rgba(79,70,229,0.8)] border-indigo-500 scale-105 z-40' : ''
                }`}
                data-node-id={node.id}
                style={{ left: node.x, top: node.y }}
              >
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 mb-2">
                <span className="text-xs font-bold text-zinc-900 tracking-tight">{node.label}</span>
                {node.sublabel && (
                  <span className="text-[9px] bg-zinc-100 text-zinc-500 font-semibold px-1.5 py-0.5 rounded border border-zinc-200/30">
                    {node.sublabel}
                  </span>
                )}
              </div>

              {/* Fields */}
              {node.fields && node.fields.length > 0 && (
                <div className="space-y-1">
                  {node.fields.map(f => (
                    <div key={f.name} className="flex items-center justify-between text-[11px] gap-4">
                      <span className="text-zinc-600 font-medium underline decoration-zinc-200 decoration-1 underline-offset-2">
                        {f.name}
                      </span>
                      <span className="text-zinc-400 font-mono text-[9px]">
                        {f.type}{f.ref ? `→${f.ref}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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

      {newEdgeTarget && (
        <EdgeEditor
          sourceId={newEdgeTarget.sourceId}
          targetId={newEdgeTarget.targetId}
          onClose={() => setNewEdgeTarget(null)}
        />
      )}
    </>
  )
}
