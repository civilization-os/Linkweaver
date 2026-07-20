import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { Region } from '../../types'
import EntityEditor from '../EntityEditor/EntityEditor'
import { domToBlob } from 'modern-screenshot'
// @ts-ignore
import gifshot from 'gifshot'
import {
  MousePointer,
  Database,
  Layers,
  Activity,
  Maximize2,
  RefreshCw,
  Plus,
  Minus,
  X,
  Play,
  Pause,
  Grid,
  Image,
  Film,
  Download,
  Sparkles,
  Search,
  Expand,
  List,
  GitMerge,
  LayoutTemplate,
  MoreHorizontal
} from 'lucide-react'

export default function Toolbar() {
  const page = useStore(s => s.page)
  const flowAnimation = useStore(s => s.flowAnimation)
  const flowAnimationSpeed = useStore(s => s.flowAnimationSpeed)
  const setFlowAnimationSpeed = useStore(s => s.setFlowAnimationSpeed)
  const toggleFlow = useStore(s => s.toggleFlow)
  const showGrid = useStore(s => s.showGrid)
  const toggleGrid = useStore(s => s.toggleGrid)
  const showThreeColumns = useStore(s => s.showThreeColumns)
  const toggleThreeColumns = useStore(s => s.toggleThreeColumns)
  const canvasDensity = useStore(s => s.canvasDensity)
  const setCanvasDensity = useStore(s => s.setCanvasDensity)
  const selectedEdgeId = useStore(s => s.selectedEdgeId)
  const project = useStore(s => s.currentProject())
  const resetView = useStore(s => s.resetView)
  const formatCanvas = useStore(s => s.formatCanvas)
  const toggleAllRegionsCollapse = useStore(s => s.toggleAllRegionsCollapse)
  const viewport = useStore(s => s.viewport)
  const setViewport = useStore(s => s.setViewport)
  const deleteNode = useStore(s => s.deleteNode)
  const addRegion = useStore(s => s.addRegion)
  const updateRegion = useStore(s => s.updateRegion)
  const deleteRegion = useStore(s => s.deleteRegion)
  const syncCurrentProject = useStore(s => s.syncCurrentProject)
  const focusMode = useStore(s => s.focusMode)
  const setFocusMode = useStore(s => s.setFocusMode)

  const [isExportingGIF, setIsExportingGIF] = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const formatMenuRef = useRef<HTMLDivElement>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  // Close format menu on outside click
  useEffect(() => {
    if (!showFormatMenu) return
    const onClick = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showFormatMenu])

  useEffect(() => {
    if (!showMoreMenu) return
    const onClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showMoreMenu])

  const handleExportPNG = async () => {
    console.log('[Linkweaver] handleExportPNG starting...')
    const layer = document.getElementById('canvas-layer')
    console.log('[Linkweaver] found canvas-layer:', layer)
    console.log('[Linkweaver] current project:', project)
    if (!layer || !project) {
      console.warn('[Linkweaver] Export aborted: layer or project is missing')
      return
    }

    const nodes = project.nodes
    const regions = project.regions
    console.log('[Linkweaver] nodes count:', nodes.length, 'regions count:', regions.length)
    if (nodes.length === 0 && regions.length === 0) {
      console.warn('[Linkweaver] Export aborted: no nodes or regions to export')
      return
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + 220)
      maxY = Math.max(maxY, n.y + 120)
    })

    regions.forEach(r => {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h)
    })

    const padding = 60
    const x = minX - padding
    const y = minY - padding
    const width = (maxX - minX) + 2 * padding
    const height = (maxY - minY) + 2 * padding
    console.log('[Linkweaver] crop box:', { x, y, width, height })

    // Hide grid and ports during export
    const gridEl = layer.querySelector('.grid-layer') as HTMLElement
    const ports = layer.querySelectorAll('.port')
    if (gridEl) gridEl.style.display = 'none'
    ports.forEach((p: any) => p.style.display = 'none')
    console.log('[Linkweaver] temporarily hid grid & ports, initiating domToBlob...')

    try {
      const blob = await domToBlob(layer, {
        width,
        height,
        scale: 2,
        backgroundColor: '#fafafa',
        style: {
          transform: `translate(${-x}px, ${-y}px) scale(1)`,
          left: '0px',
          top: '0px'
        }
      })
      console.log('[Linkweaver] domToBlob generated successfully')

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.style.display = 'none'
      link.download = `${project.name || 'project'}.png`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      console.log('[Linkweaver] PNG download link clicked and URL revoked')
    } catch (err) {
      console.error('[Linkweaver] Export PNG failed in catch block:', err)
    } finally {
      // Restore grid and ports
      if (gridEl) gridEl.style.display = ''
      ports.forEach((p: any) => p.style.display = '')
      console.log('[Linkweaver] grid & ports restored')
    }
  }

  const handleExportGIF = async () => {
    console.log('[Linkweaver] handleExportGIF starting...')
    const layer = document.getElementById('canvas-layer')
    if (!layer || !project) {
      console.warn('[Linkweaver] Export GIF aborted: layer or project is missing')
      return
    }

    const nodes = project.nodes
    const regions = project.regions
    if (nodes.length === 0 && regions.length === 0) {
      console.warn('[Linkweaver] Export GIF aborted: no nodes or regions to export')
      return
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + 220)
      maxY = Math.max(maxY, n.y + 120)
    })

    regions.forEach(r => {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h)
    })

    const padding = 60
    const x = minX - padding
    const y = minY - padding
    const width = (maxX - minX) + 2 * padding
    const height = (maxY - minY) + 2 * padding
    console.log('[Linkweaver] crop box:', { x, y, width, height })

    setIsExportingGIF(true)
    setGifProgress(0)

    // Hide grid and ports during export
    const gridEl = layer.querySelector('.grid-layer') as HTMLElement
    const ports = layer.querySelectorAll('.port')
    if (gridEl) gridEl.style.display = 'none'
    ports.forEach((p: any) => p.style.display = 'none')

    const wasAnimOn = useStore.getState().flowAnimation
    if (!wasAnimOn) {
      useStore.getState().toggleFlow()
    }

    try {
      const frames: string[] = []
      const frameCount = 8
      const delay = 100

      console.log('[Linkweaver] starting frame capture loop...')
      const edgePaths = layer.querySelectorAll('.edge-flow') as NodeListOf<SVGElement>

      for (let i = 0; i < frameCount; i++) {
        const progress = i / frameCount
        
        // Manually step CSS animations since domToBlob restarts them every clone
        edgePaths.forEach(path => {
          path.style.animation = 'none'
          if (path.classList.contains('fwd')) {
            path.style.strokeDashoffset = String(20 - (20 * progress))
          } else if (path.classList.contains('rev')) {
            path.style.strokeDashoffset = String(20 * progress)
          }
        })

        // We can capture as base64 and convert them to GIF directly, since gifshot supports base64 frames
        const blob = await domToBlob(layer, {
          width,
          height,
          scale: 1.2,
          backgroundColor: '#fafafa',
          style: {
            transform: `translate(${-x}px, ${-y}px) scale(1)`,
            left: '0px',
            top: '0px'
          }
        })
        
        // Convert Blob to dataURL so gifshot can read it
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        
        frames.push(dataUrl)
        setGifProgress(Math.round(((i + 1) / frameCount) * 100))
        console.log(`[Linkweaver] captured frame ${i + 1}/${frameCount}`)
        await new Promise(r => setTimeout(r, delay))
      }

      // Restore CSS animations
      edgePaths.forEach(path => {
        path.style.animation = ''
        path.style.strokeDashoffset = ''
      })

      if (!wasAnimOn) {
        useStore.getState().toggleFlow()
      }

      console.log('[Linkweaver] frames captured, initiating gifshot...')
      gifshot.createGIF({
        images: frames,
        interval: 0.1,
        gifWidth: width * 1.2,
        gifHeight: height * 1.2,
        numWorkers: 2
      }, async (obj: any) => {
        if (!obj.error) {
          try {
            // Convert base64 data URI output of gifshot to a Blob using fetch
            const res = await fetch(obj.image)
            const gifBlob = await res.blob()
            const gifUrl = URL.createObjectURL(gifBlob)
            
            const link = document.createElement('a')
            link.style.display = 'none'
            link.download = `${project.name || 'project'}.gif`
            link.href = gifUrl
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(gifUrl)
            console.log('[Linkweaver] GIF download link clicked and URL revoked')
          } catch (fetchErr) {
            console.error('[Linkweaver] Failed to convert GIF dataURL to Blob:', fetchErr)
          }
        } else {
          console.error('[Linkweaver] GIF encoding error:', obj.error)
        }
        setIsExportingGIF(false)
      })

    } catch (err) {
      console.error('[Linkweaver] Export GIF failed:', err)
      setIsExportingGIF(false)
    } finally {
      // Restore grid and ports
      if (gridEl) gridEl.style.display = ''
      ports.forEach((p: any) => p.style.display = '')
      console.log('[Linkweaver] grid & ports restored')
    }
  }

  const [panel, setPanel] = useState<'entity' | 'region' | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const nodes = project?.nodes ?? []
  const edges = project?.edges ?? []
  const regions = project?.regions ?? []
  const activeBusinessFlowId = useStore(s => s.activeBusinessFlowId)
  const activeBusinessFlow = project?.businessFlows?.find(f => f.id === activeBusinessFlowId)
  const allCollapsed = regions.length > 0 && regions.every(r => r.collapsed)
  const selectedLabel = selectedEdgeId !== null ? edges.find(e => e.id === selectedEdgeId)?.label : ''

  // Unplaced: entities not in any region
  const unplacedNodes = nodes.filter(n => !n.regionId)

  // Close panel on outside click
  useEffect(() => {
    if (!panel) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanel(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [panel])

  if (page !== 'canvas') return null

  const newRegionId = () => 'r' + Math.random().toString(36).slice(2, 8)

  const handleAddRegion = () => {
    const region: Region = {
      id: newRegionId(),
      title: '新区域',
      x: 300 + Math.random() * 200,
      y: 300 + Math.random() * 200,
      w: 300,
      h: 300,
      color: '#f4f4f5', // zinc-100
    }
    addRegion(region)
  }

  const handleResetView = () => {
    resetView()
    const l = document.getElementById('canvas-layer')
    if (l) {
      l.style.left = '0px'
      l.style.top = '0px'
    }
  }

  return (
    <div className="relative z-30">
      {/* Main Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-b border-zinc-200 bg-white/85 backdrop-blur-md select-none [&>*]:shrink-0">
        <span className="text-sm font-semibold text-zinc-900 truncate max-w-[200px]">
          {project?.name ?? ''} <span className="font-normal text-zinc-400">· 拓扑流图</span>
        </span>
        {activeBusinessFlow && (
          <span className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 max-w-[220px]">
            <GitMerge size={12} className="shrink-0" />
            <span className="truncate">{activeBusinessFlow.name}</span>
            <span className="shrink-0 text-indigo-400">{activeBusinessFlow.nodeIds.length}/{activeBusinessFlow.edgeIds.length}</span>
          </span>
        )}
        
        <div className="w-px h-4 bg-zinc-200 mx-1.5" />

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-zinc-50 shadow-sm transition-all duration-150 cursor-pointer">
          <MousePointer size={14} />
          <span>选择</span>
        </button>

        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 relative cursor-pointer ${
            panel === 'entity'
              ? 'bg-zinc-100 text-zinc-900 border border-zinc-200'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
          onClick={() => setPanel(panel === 'entity' ? null : 'entity')}
        >
          <Database size={14} />
          <span>实体</span>
          {unplacedNodes.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800" />
          )}
        </button>

        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            panel === 'region'
              ? 'bg-zinc-100 text-zinc-900 border border-zinc-200'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
          onClick={() => setPanel(panel === 'region' ? null : 'region')}
        >
          <Layers size={14} />
          <span>区域</span>
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 cursor-pointer">
          <Activity size={14} />
          <span>关联</span>
        </button>

        <div className="w-px h-4 bg-zinc-200 mx-1.5" />

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 cursor-pointer"
          onClick={handleResetView}
        >
          <Maximize2 size={14} />
          <span>重置视图</span>
        </button>

        <div className="w-px h-4 bg-zinc-200 mx-1.5" />

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="搜索节点或连线..." 
            className="pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200/60 rounded-lg text-xs font-semibold text-zinc-700 w-48 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:bg-white transition-all"
            value={useStore(s => s.searchQuery)}
            onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-0.5 bg-zinc-50 border border-zinc-200/60 rounded-lg p-0.5 ml-1">
          <button
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
            onClick={() => setViewport({ scale: Math.max(0.2, viewport.scale - 0.1) })}
            title="缩小"
          >
            <Minus size={11} />
          </button>
          <span className="text-[10px] font-bold text-zinc-600 w-10 text-center select-none">
            {Math.round(viewport.scale * 100)}%
          </span>
          <button
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
            onClick={() => setViewport({ scale: Math.min(3, viewport.scale + 0.1) })}
            title="放大"
          >
            <Plus size={11} />
          </button>
        </div>

        <div className="relative" ref={formatMenuRef}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 cursor-pointer"
            onClick={() => setShowFormatMenu(!showFormatMenu)}
          >
            <Sparkles size={14} />
            <span>格式化</span>
          </button>
          
          {showFormatMenu && (
            <div className="absolute right-0 top-[38px] z-50 w-44 bg-white/95 backdrop-blur-xl border border-zinc-200/60 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col p-1.5 gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5">
              <button
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-100/80 rounded-lg text-[13px] font-semibold text-zinc-700 hover:text-zinc-950 transition-all duration-150 cursor-pointer text-left w-full group relative overflow-hidden"
                onClick={() => {
                  setShowFormatMenu(false)
                  formatCanvas('default')
                }}
              >
                <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                <GitMerge size={15} className="relative z-10 text-zinc-400 group-hover:text-indigo-600 transition-colors duration-150" />
                <span className="relative z-10">默认分散排版</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-100/80 rounded-lg text-[13px] font-semibold text-zinc-700 hover:text-zinc-950 transition-all duration-150 cursor-pointer text-left w-full group relative overflow-hidden"
                onClick={() => {
                  setShowFormatMenu(false)
                  formatCanvas('rectangle')
                }}
              >
                <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                <LayoutTemplate size={15} className="relative z-10 text-zinc-400 group-hover:text-indigo-600 transition-colors duration-150" />
                <span className="relative z-10">长方形紧凑排版</span>
              </button>
            </div>
          )}
        </div>

        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            focusMode
              ? 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800'
              : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
          onClick={() => setFocusMode(!focusMode)}
          title="专注模式"
        >
          <Expand size={14} />
          <span>专注模式</span>
        </button>

        <div className="relative" ref={moreMenuRef}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-150 cursor-pointer"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
          >
            <MoreHorizontal size={14} />
            <span>更多</span>
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-[38px] z-50 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl flex flex-col p-1.5 gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 transition-colors cursor-pointer text-left w-full"
                onClick={() => toggleAllRegionsCollapse(!allCollapsed)}
              >
                <span className="flex items-center gap-2"><Layers size={14} className="text-zinc-500" />{allCollapsed ? '展开所有区域' : '折叠所有区域'}</span>
              </button>
              <button
                className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 transition-colors cursor-pointer text-left w-full"
                onClick={toggleFlow}
              >
                <span className="flex items-center gap-2">{flowAnimation ? <Play size={14} className="text-emerald-600" /> : <Pause size={14} className="text-zinc-500" />}流向动画</span>
                <span className="text-[10px] text-zinc-400">{flowAnimation ? '开' : '关'}</span>
              </button>
              {flowAnimation && (
                <div className="px-2.5 py-2 border-y border-zinc-100">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-zinc-400">
                    <span>播放间隔</span>
                    <span>{flowAnimationSpeed}ms</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    step="100"
                    value={flowAnimationSpeed}
                    onChange={(e) => setFlowAnimationSpeed(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              )}
              <button
                className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 transition-colors cursor-pointer text-left w-full"
                onClick={toggleGrid}
              >
                <span className="flex items-center gap-2"><Grid size={14} className="text-zinc-500" />显示网格</span>
                <span className="text-[10px] text-zinc-400">{showGrid ? '开' : '关'}</span>
              </button>
              <button
                className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 transition-colors cursor-pointer text-left w-full"
                onClick={toggleThreeColumns}
              >
                <span className="flex items-center gap-2"><List size={14} className="text-zinc-500" />字段列宽</span>
                <span className="text-[10px] text-zinc-400">{showThreeColumns ? '三列' : '两列'}</span>
              </button>
              <div className="px-2.5 py-2 border-y border-zinc-100">
                <div className="mb-1.5 text-[10px] font-bold text-zinc-400">画布密度</div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
                  {[
                    { value: 'compact', label: '简洁' },
                    { value: 'standard', label: '标准' },
                    { value: 'detail', label: '详细' },
                  ].map(item => (
                    <button
                      key={item.value}
                      className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                        canvasDensity === item.value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                      onClick={() => setCanvasDensity(item.value as 'compact' | 'standard' | 'detail')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 transition-colors cursor-pointer text-left w-full"
                onClick={() => syncCurrentProject()}
              >
                <RefreshCw size={14} className="text-zinc-500" />
                <span>同步</span>
              </button>
              <div className="h-px bg-zinc-100 my-1" />
              <button
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer text-left w-full group"
                onClick={() => {
                  setShowMoreMenu(false)
                  handleExportPNG()
                }}
              >
                <Image size={14} className="text-zinc-500 group-hover:text-zinc-800 transition-colors" />
                <span>导出 PNG 图片</span>
              </button>
              <button
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-100/80 rounded-lg text-xs font-bold text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer text-left w-full group"
                onClick={() => {
                  setShowMoreMenu(false)
                  handleExportGIF()
                }}
              >
                <Film size={14} className="text-zinc-500 group-hover:text-zinc-800 transition-colors" />
                <span>导出 GIF 动画</span>
              </button>
            </div>
          )}
        </div>

        {selectedLabel && (
          <span className="ml-auto text-xs font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200/60 px-2.5 py-1 rounded-full max-w-[160px] truncate">
            选定线: {selectedLabel}
          </span>
        )}
      </div>

      {/* Floating Entity Panel */}
      {panel === 'entity' && (
        <div
          className="absolute left-6 top-[52px] z-50 w-80 max-h-[420px] overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl flex flex-col"
          ref={panelRef}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="text-sm font-bold text-zinc-800">实体管理</span>
            <button
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 text-xs font-semibold rounded-md transition-all cursor-pointer"
              onClick={() => {
                setPanel(null)
                setShowEditor(true)
              }}
            >
              <Plus size={12} />
              <span>新建</span>
            </button>
          </div>

          <div className="overflow-y-auto divide-y divide-zinc-100">
            {unplacedNodes.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                  独立节点
                </div>
                <div className="space-y-1">
                  {unplacedNodes.map(n => (
                    <div
                      key={n.id}
                      className="group flex items-center justify-between px-2 py-1.5 hover:bg-zinc-50 rounded-lg transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-800 truncate">{n.label}</span>
                        <span className="text-[10px] text-zinc-400 truncate">{n.sublabel}</span>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity cursor-pointer"
                        onClick={() => deleteNode(n.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                全部实体 ({nodes.length})
              </div>
              <div className="space-y-1">
                {nodes.map(n => (
                  <div
                    key={n.id}
                    className="group flex items-center justify-between px-2 py-1.5 hover:bg-zinc-50 rounded-lg transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-800 truncate">{n.label}</span>
                        {n.regionId && (
                          <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200/50 max-w-[80px] truncate">
                            {regions.find(r => r.id === n.regionId)?.title ?? n.regionId}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 truncate">{n.sublabel}</span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity cursor-pointer animate-fade-in"
                      onClick={() => deleteNode(n.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Region Panel */}
      {panel === 'region' && (
        <div
          className="absolute left-32 top-[52px] z-50 w-80 max-h-[420px] overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl flex flex-col"
          ref={panelRef}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="text-sm font-bold text-zinc-800">区域管理</span>
            <button
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 text-xs font-semibold rounded-md transition-all cursor-pointer"
              onClick={handleAddRegion}
            >
              <Plus size={12} />
              <span>新建</span>
            </button>
          </div>

          <div className="p-3 overflow-y-auto">
            {regions.length === 0 ? (
              <div className="text-xs text-zinc-400 text-center py-6">暂无区域</div>
            ) : (
              <div className="space-y-1">
                {regions.map(r => {
                  const count = nodes.filter(n => n.regionId === r.id).length
                  return (
                    <div
                      key={r.id}
                      className="group flex items-center justify-between px-2 py-1.5 hover:bg-zinc-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <label className="shrink-0 cursor-pointer" title="点击修改颜色">
                          <input 
                            type="color" 
                            className="absolute opacity-0 pointer-events-none w-0 h-0" 
                            value={r.color || '#f0f0f0'}
                            onChange={(e) => updateRegion(r.id, { color: e.target.value })}
                          />
                          <div
                            className="w-3 h-3 rounded-full border border-zinc-300 shrink-0 shadow-sm transition-transform hover:scale-110"
                            style={{ backgroundColor: r.color }}
                          />
                        </label>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-zinc-800 truncate">{r.title}</span>
                          <span className="text-[10px] text-zinc-400">{count} 个实体</span>
                        </div>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity cursor-pointer"
                        onClick={() => deleteRegion(r.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showEditor && <EntityEditor onClose={() => setShowEditor(false)} />}

      {isExportingGIF && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/50 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <div className="bg-white px-6 py-5 rounded-2xl shadow-2xl border border-zinc-200 flex flex-col items-center gap-3 max-w-[240px]">
            <div className="w-10 h-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 animate-spin" />
            <div className="text-xs font-bold text-zinc-900">正在生成 GIF 动画...</div>
            <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-zinc-900 h-full transition-all duration-200" style={{ width: `${gifProgress}%` }} />
            </div>
            <div className="text-[10px] font-bold text-zinc-400">{gifProgress}%</div>
          </div>
        </div>
      )}
    </div>
  )
}
