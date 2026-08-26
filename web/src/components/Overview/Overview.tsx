import { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  Plus,
  Trash2,
  FolderOpen,
  Database,
  ArrowRightLeft,
  Layers,
  ClipboardList,
  Settings,
  Workflow
} from 'lucide-react'
import SettingsModal from '../SettingsModal/SettingsModal'
import { isFlowNodeType } from '../../types'

export default function Overview() {
  const projects = useStore(s => s.projects)
  const activeProjectId = useStore(s => s.activeProjectId)
  const addProject = useStore(s => s.addProject)
  const deleteProject = useStore(s => s.deleteProject)
  const switchProject = useStore(s => s.switchProject)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    addProject(name)
    setShowNew(false)
    setNewName('')
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-white via-zinc-50 to-indigo-50/50 select-none">
      {/* Title Header — 固定条:整行作为 Electron 窗口拖动区域。必须放在滚动容器外,
          否则拖动会被 overflow-y-auto 容器解释为滚动,窗口无法移动(与 Toolbar 同模式)。 */}
      <div className="drag-region shrink-0 flex justify-between items-center px-10 pt-9 pb-6 border-b border-zinc-200/60">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">项目概览</h1>
          <span className="text-[11px] font-semibold text-indigo-500 tracking-wide">OVERVIEW</span>
        </div>
        {/* pr-[120px]:右侧留出窗口控制按钮区(titleBarOverlay 高 48px、宽约 150px),
            避免按钮落在系统最小化/最大化/关闭按钮下方导致悬停/点击冲突 */}
        <div className="no-drag flex items-center gap-3 pr-[120px]">
          <button
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm shadow-indigo-200/60 transition-all duration-150 cursor-pointer"
            onClick={() => setShowNew(true)}
          >
            <Plus size={16} />
            <span>新建项目</span>
          </button>
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        {/* Inline Create Form */}
      {showNew && (
        <div className="flex items-center gap-3 p-4 mb-8 bg-white/90 backdrop-blur border border-indigo-100 rounded-xl shadow-lg shadow-indigo-100/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <input
            className="flex-1 max-w-sm px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-zinc-400"
            placeholder="输入新项目的名称..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') {
                setShowNew(false)
                setNewName('')
              }
            }}
            autoFocus
          />
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-200/60 transition-colors cursor-pointer"
            onClick={handleCreate}
          >
            创建
          </button>
          <button
            className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-500 border border-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            onClick={() => {
              setShowNew(false)
              setNewName('')
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => {
          const isActive = p.id === activeProjectId
          const entitiesCount = (p.nodes ?? []).filter((n: any) => n.type === 'entity' || n.type === 'nested').length
          const flowCount = (p.nodes ?? []).filter((n: any) => isFlowNodeType(n.type)).length
          const dataFlowCount = (p.edges ?? []).length
          const regionsCount = (p.regions ?? []).length
          const reqsCount = (p.requirements ?? []).length

          return (
            <div
              key={p.id}
              className={`flex flex-col bg-white border rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 relative group overflow-hidden ${
                isActive ? 'border-indigo-400 ring-2 ring-indigo-500/15' : 'border-zinc-200/80'
              }`}
            >
              {/* 顶部渐变细条 */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`} />
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 pr-4">
                  <h3 className="text-base font-bold text-zinc-800 truncate tracking-tight">{p.name}</h3>
                  <p className="text-[10px] text-indigo-400/80 font-semibold uppercase tracking-wider mt-0.5">LINKWEAVER · 数据模型</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {p.version}
                </span>
              </div>

              {/* Stats Block — 语义化配色 */}
              <div className="grid grid-cols-5 gap-1 py-4 my-4 bg-white/60 border-y border-zinc-100 rounded-lg px-1.5 text-center">
                <div className="flex flex-col items-center rounded-lg py-1 hover:bg-indigo-50/60 transition-colors duration-150">
                  <Database size={14} className="text-indigo-500 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{entitiesCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">实体</span>
                </div>
                <div className="flex flex-col items-center rounded-lg py-1 hover:bg-violet-50/60 transition-colors duration-150">
                  <Workflow size={14} className="text-violet-500 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{flowCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">流程</span>
                </div>
                <div className="flex flex-col items-center rounded-lg py-1 hover:bg-sky-50/60 transition-colors duration-150">
                  <ArrowRightLeft size={14} className="text-sky-500 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{dataFlowCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">连线</span>
                </div>
                <div className="flex flex-col items-center rounded-lg py-1 hover:bg-emerald-50/60 transition-colors duration-150">
                  <Layers size={14} className="text-emerald-500 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{regionsCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">区域</span>
                </div>
                <div className="flex flex-col items-center rounded-lg py-1 hover:bg-amber-50/60 transition-colors duration-150">
                  <ClipboardList size={14} className="text-amber-500 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{reqsCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">需求</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center gap-2 mt-auto">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-200/50 transition-all cursor-pointer"
                  onClick={() => switchProject(p.id)}
                >
                  <FolderOpen size={14} />
                  <span>打开项目</span>
                </button>
                {projects.length > 1 && (
                  <button
                    className="p-2 border border-zinc-200 text-zinc-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                    onClick={() => deleteProject(p.id)}
                    title="删除项目"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  )
}
