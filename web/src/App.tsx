import { useEffect, useRef } from 'react'
import Canvas from './components/Canvas/Canvas'
import CanvasSidePanel from './components/CanvasSidePanel/CanvasSidePanel'
import Sidebar from './components/Sidebar/Sidebar'
import Toolbar from './components/Toolbar/Toolbar'
import Overview from './components/Overview/Overview'
import { useStore } from './store/useStore'
import { ArrowRight, ArrowLeft, ArrowLeftRight, Trash2 } from 'lucide-react'

export default function App() {
  const page = useStore(s => s.page)
  const loading = useStore(s => s.loading)
  const init = useStore(s => s.init)
  const selectedEdgeIdx = useStore(s => s.selectedEdgeIdx)
  const project = useStore(s => s.currentProject())
  const setEdgeDir = useStore(s => s.setEdgeDir)
  const selectEdge = useStore(s => s.selectEdge)
  const deleteEdge = useStore(s => s.deleteEdge)

  const edges = project?.edges ?? []
  const selectedEdge = selectedEdgeIdx !== null ? edges[selectedEdgeIdx] : null

  useEffect(() => { init() }, [init])

  // Auto-sync: poll every 15s + on visibility change
  const syncRef = useRef(useStore.getState().syncCurrentProject)
  syncRef.current = useStore.getState().syncCurrentProject
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) syncRef.current() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => syncRef.current(), 15000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(interval) }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 text-zinc-500 font-medium text-sm animate-pulse">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans text-zinc-950">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {page === 'overview' ? (
          <Overview />
        ) : (
          <>
            {/* Top Toolbar */}
            <Toolbar />

            {/* Canvas Area with its side panel */}
            <div className="flex-1 flex min-h-0 relative">
              <Canvas />
              <CanvasSidePanel />
            </div>
          </>
        )}
      </div>

      {/* Direction & Action Panel for selected edge */}
      {selectedEdge && selectedEdgeIdx !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200 select-none">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              selectedEdge.dir === 'fwd'
                ? 'bg-zinc-950 text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            }`}
            onClick={() => setEdgeDir(selectedEdgeIdx, 'fwd')}
          >
            <ArrowRight size={13} />
            <span>正向</span>
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              selectedEdge.dir === 'rev'
                ? 'bg-zinc-950 text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            }`}
            onClick={() => setEdgeDir(selectedEdgeIdx, 'rev')}
          >
            <ArrowLeft size={13} />
            <span>反向</span>
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              selectedEdge.dir === 'both'
                ? 'bg-zinc-950 text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            }`}
            onClick={() => setEdgeDir(selectedEdgeIdx, 'both')}
          >
            <ArrowLeftRight size={13} />
            <span>双向</span>
          </button>
          
          <div className="w-px h-4 bg-zinc-200 mx-1.5" />
          
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
            onClick={() => { deleteEdge(selectedEdgeIdx); selectEdge(null); }}
          >
            <Trash2 size={13} />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  )
}
