import { useEffect, useRef } from 'react'
import Canvas from './components/Canvas/Canvas'
import CanvasSidePanel from './components/CanvasSidePanel/CanvasSidePanel'
import Sidebar from './components/Sidebar/Sidebar'
import Toolbar from './components/Toolbar/Toolbar'
import Overview from './components/Overview/Overview'
import RequirementPanel from './components/RequirementPanel/RequirementPanel'
import { useStore } from './store/useStore'
import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Trash2,
  Database,
  GitMerge,
  Layers3,
  ListChecks,
  PanelRight,
  Target,
} from 'lucide-react'

export default function App() {
  const page = useStore(s => s.page)
  const loading = useStore(s => s.loading)
  const init = useStore(s => s.init)
  const focusMode = useStore(s => s.focusMode)
  const selectedEdgeId = useStore(s => s.selectedEdgeId)
  const project = useStore(s => s.currentProject())
  const setEdgeDir = useStore(s => s.setEdgeDir)
  const selectEdge = useStore(s => s.selectEdge)
  const deleteEdge = useStore(s => s.deleteEdge)
  const selectedNodeIds = useStore(s => s.selectedNodeIds)
  const activeBusinessFlowId = useStore(s => s.activeBusinessFlowId)
  const selectedRequirementId = useStore(s => s.selectedRequirementId)

  const nodes = project?.nodes ?? []
  const edges = project?.edges ?? []
  const regions = project?.regions ?? []
  const requirements = project?.requirements ?? []
  const flows = project?.businessFlows ?? []
  const selectedEdge = selectedEdgeId !== null ? edges.find(e => e.id === selectedEdgeId) : null
  const activeFlow = flows.find(f => f.id === activeBusinessFlowId)
  const selectedRequirement = requirements.find(r => r.id === selectedRequirementId)
  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find(n => n.id === selectedNodeIds[0])
    : undefined
  const unplacedCount = nodes.filter(n => !n.regionId).length

  useEffect(() => { init() }, [init])

  // Auto-sync: poll every 15s + on visibility change
  const syncRef = useRef(useStore.getState().syncCurrentProject)
  syncRef.current = useStore.getState().syncCurrentProject
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) syncRef.current() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => syncRef.current(), 15000)
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        syncRef.current();
        // @ts-ignore
        const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
        if (ipcRenderer) {
          ipcRenderer.invoke('show-notification', { title: '保存成功', body: '当前项目状态已同步到本地' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => { 
      document.removeEventListener('visibilitychange', onVisible); 
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 text-zinc-500 font-medium text-sm animate-pulse">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-zinc-950">
      {/* Sidebar Navigation */}
      {!focusMode && <Sidebar />}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {page === 'overview' ? (
          <Overview />
        ) : (
          <div className="flex h-full min-h-0 flex-col bg-slate-100/90">
            {!focusMode && (
              <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/95 px-5 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm">
                      <PanelRight size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="truncate text-sm font-bold text-slate-950">{project?.name ?? '未命名项目'}</h1>
                        <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          {project?.version ?? 'v1.0'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{selectedNode ? selectedNode.label : selectedEdge ? selectedEdge.label || '已选择连线' : '项目工作台'}</span>
                        {selectedRequirement && (
                          <>
                            <span className="text-slate-300">/</span>
                            <span className="truncate">{selectedRequirement.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                      <Database size={13} />
                      <span>{nodes.length} 实体</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                      <Layers3 size={13} />
                      <span>{regions.length} 区域</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                      <GitMerge size={13} />
                      <span>{flows.length} 流程</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                      <ListChecks size={13} />
                      <span>{requirements.length} 需求</span>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                      activeFlow
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : unplacedCount > 0
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      <Target size={13} />
                      <span className="max-w-[180px] truncate">
                        {activeFlow ? activeFlow.name : unplacedCount > 0 ? `${unplacedCount} 个独立实体` : '结构已归位'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Toolbar />

            <div className="flex-1 flex min-h-0 relative overflow-hidden">
              <Canvas />
              {!focusMode && <CanvasSidePanel />}
            </div>
          </div>
        )}
      </div>

      {!focusMode && <RequirementPanel />}

      {/* Direction & Action Panel for selected edge */}
      {selectedEdge && selectedEdgeId !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-zinc-200 shadow-xl rounded-xl p-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200 select-none">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              selectedEdge.dir === 'fwd'
                ? 'bg-zinc-950 text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            }`}
            onClick={() => setEdgeDir(selectedEdgeId, 'fwd')}
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
            onClick={() => setEdgeDir(selectedEdgeId, 'rev')}
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
            onClick={() => setEdgeDir(selectedEdgeId, 'both')}
          >
            <ArrowLeftRight size={13} />
            <span>双向</span>
          </button>
          
          <div className="w-px h-4 bg-zinc-200 mx-1.5" />
          
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
            onClick={() => { deleteEdge(selectedEdgeId); selectEdge(null); }}
          >
            <Trash2 size={13} />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  )
}
