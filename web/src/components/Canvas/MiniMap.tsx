import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { Crosshair, Maximize2 } from 'lucide-react'

export default function MiniMap() {
  const store = useStore()
  const project = store.currentProject()
  const nodes = project?.nodes || []
  const regions = project?.regions || []
  const viewport = store.viewport
  const activeFlow = project?.businessFlows?.find(f => f.id === store.activeBusinessFlowId)

  const mapW = 200
  const mapH = 150
  
  // Calculate bounding box of all elements
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    if (nodes.length === 0 && regions.length === 0) {
      return { x: 0, y: 0, w: 2000, h: 1500 }
    }
    
    nodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + 160) // approx node width
      maxY = Math.max(maxY, n.y + (n.collapsedFields ? 40 : 60 + (n.fields?.length || 0) * 22)) // approx node height
    })
    
    regions.forEach(r => {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h)
    })
    
    // Add padding
    minX -= 500
    minY -= 500
    maxX += 500
    maxY += 500
    
    // Fallbacks if bounds are too small
    const w = Math.max(maxX - minX, 2000)
    const h = Math.max(maxY - minY, 1500)
    
    return { x: minX, y: minY, w, h }
  }, [nodes, regions])
  
  // Fit bounds to minimap size
  const scale = Math.min(mapW / bounds.w, mapH / bounds.h)
  
  // Helper to map canvas coords to minimap coords
  const mapCoord = (x: number, y: number) => {
    return {
      x: (x - bounds.x) * scale,
      y: (y - bounds.y) * scale
    }
  }

  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const el = document.querySelector('.canvas-container')
    if (!el) return
    const updateSize = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    
    // Initial update
    updateSize()
    
    // Observe resize events
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    window.addEventListener('resize', updateSize)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  // Calculate viewport rect on minimap
  const vpW = (containerSize.w / viewport.scale) * scale
  const vpH = (containerSize.h / viewport.scale) * scale
  const vpX = ((-viewport.x) / viewport.scale - bounds.x) * scale
  const vpY = ((-viewport.y) / viewport.scale - bounds.y) * scale

  // Drag interaction
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      // Calculate new viewport center based on mouse pos
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // Convert mouseX/Y on minimap to canvas coordinates
        const canvasX = (mouseX / scale) + bounds.x
        const canvasY = (mouseY / scale) + bounds.y
        
        // Target viewport x,y so that canvasX,canvasY is at center of screen
        const targetVpX = -(canvasX * viewport.scale - containerSize.w / 2)
        const targetVpY = -(canvasY * viewport.scale - containerSize.h / 2)
        
        store.setViewport({ x: targetVpX, y: targetVpY })
      }
    }
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, scale, bounds, viewport.scale, containerSize, store])
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    // Instant jump to click position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const canvasX = (mouseX / scale) + bounds.x
      const canvasY = (mouseY / scale) + bounds.y
      
      const targetVpX = -(canvasX * viewport.scale - containerSize.w / 2)
      const targetVpY = -(canvasY * viewport.scale - containerSize.h / 2)
      
      store.setViewport({ x: targetVpX, y: targetVpY })
    }
  }

  const focusBounds = (targetNodes = nodes, targetRegions = regions) => {
    if (targetNodes.length === 0 && targetRegions.length === 0) return
    const minX = Math.min(
      ...targetNodes.map(n => n.x),
      ...targetRegions.map(r => r.x)
    )
    const minY = Math.min(
      ...targetNodes.map(n => n.y),
      ...targetRegions.map(r => r.y)
    )
    const maxX = Math.max(
      ...targetNodes.map(n => n.x + 300),
      ...targetRegions.map(r => r.x + r.w)
    )
    const maxY = Math.max(
      ...targetNodes.map(n => n.y + 120 + (n.fields?.length ?? 0) * 22),
      ...targetRegions.map(r => r.y + r.h)
    )
    const padding = 180
    const w = Math.max(maxX - minX + padding * 2, 320)
    const h = Math.max(maxY - minY + padding * 2, 240)
    const nextScale = Math.max(0.25, Math.min(1.35, containerSize.w / w, containerSize.h / h))
    store.setViewport({
      scale: nextScale,
      x: -(minX - padding) * nextScale + (containerSize.w - w * nextScale) / 2,
      y: -(minY - padding) * nextScale + (containerSize.h - h * nextScale) / 2
    })
  }

  const focusActiveFlow = () => {
    if (!activeFlow) return
    const flowNodes = nodes.filter(n => activeFlow.nodeIds.includes(n.id))
    focusBounds(flowNodes, [])
  }

  return (
    <div 
      className="absolute bottom-4 left-4 z-50 bg-white/90 backdrop-blur border border-zinc-200 shadow-xl rounded-lg overflow-hidden group"
      style={{ width: mapW, height: mapH }}
    >
      <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 absolute top-1.5 left-2 pointer-events-none z-10 opacity-50 group-hover:opacity-100 transition-opacity">Map</div>
      <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-white/90 text-zinc-500 hover:text-zinc-900"
          title="适配全部"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => focusBounds()}
        >
          <Maximize2 size={11} />
        </button>
        <button
          className="flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-white/90 text-zinc-500 hover:text-indigo-700 disabled:opacity-40"
          title="定位当前业务流程"
          disabled={!activeFlow}
          onMouseDown={e => e.stopPropagation()}
          onClick={focusActiveFlow}
        >
          <Crosshair size={11} />
        </button>
      </div>
      
      <div 
        ref={containerRef}
        className="w-full h-full relative cursor-crosshair"
        onMouseDown={handleMouseDown}
      >
        {/* Regions */}
        {regions.map(r => {
          const pos = mapCoord(r.x, r.y)
          return (
            <div
              key={`r-${r.id}`}
              className="absolute border border-zinc-300 opacity-30 rounded-sm"
              style={{
                left: pos.x,
                top: pos.y,
                width: r.w * scale,
                height: r.h * scale,
                backgroundColor: r.color || '#e5e7eb'
              }}
            />
          )
        })}
        
        {/* Nodes */}
        {nodes.map(n => {
          const pos = mapCoord(n.x, n.y)
          // Approx dimensions based on expanded/collapsed state
          const nW = 160 * scale
          const nH = (n.collapsedFields ? 40 : (60 + (n.fields?.length || 0) * 22)) * scale
          
          let color = '#9ca3af' // zinc-400
          if (n.type === 'actor') color = '#fcd34d' // amber-300
          else if (n.type === 'process') color = '#93c5fd' // blue-300
          else if (n.type === 'nested') color = '#c4b5fd' // purple-300

          return (
            <div
              key={`n-${n.id}`}
              className="absolute rounded-sm shadow-sm opacity-80"
              style={{
                left: pos.x,
                top: pos.y,
                width: nW,
                height: Math.max(nH, 5),
                backgroundColor: color
              }}
            />
          )
        })}
        
        {/* Viewport Indicator */}
        <div
          className="absolute border-[1.5px] border-indigo-500 bg-indigo-500/10 pointer-events-none shadow-[0_0_15px_rgba(99,102,241,0.2)] rounded-sm transition-all duration-75"
          style={{
            left: vpX,
            top: vpY,
            width: vpW,
            height: vpH,
          }}
        />
      </div>
    </div>
  )
}
