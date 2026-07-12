import { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  Plus,
  Trash2,
  FolderOpen,
  Database,
  ArrowRightLeft,
  Layers,
  ClipboardList
} from 'lucide-react'

export default function Overview() {
  const projects = useStore(s => s.projects)
  const activeProjectId = useStore(s => s.activeProjectId)
  const addProject = useStore(s => s.addProject)
  const deleteProject = useStore(s => s.deleteProject)
  const switchProject = useStore(s => s.switchProject)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    addProject(name)
    setShowNew(false)
    setNewName('')
  }

  return (
    <div className="flex-1 p-10 overflow-y-auto bg-zinc-50/40 select-none h-full">
      {/* Title Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">项目概览</h1>
        <button
          className="flex items-center gap-2 bg-zinc-900 text-zinc-50 hover:bg-zinc-850 active:bg-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer"
          onClick={() => setShowNew(true)}
        >
          <Plus size={16} />
          <span>新建项目</span>
        </button>
      </div>

      {/* Inline Create Form */}
      {showNew && (
        <div className="flex items-center gap-3 p-4 mb-8 bg-white border border-zinc-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <input
            className="flex-1 max-w-sm px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder-zinc-400"
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
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
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
          const dataFlowCount = (p.edges ?? []).length
          const regionsCount = (p.regions ?? []).length
          const reqsCount = (p.requirements ?? []).length

          return (
            <div
              key={p.id}
              className={`flex flex-col bg-white border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200 relative group ${
                isActive ? 'border-zinc-950 ring-1 ring-zinc-950/20' : 'border-zinc-200/80'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 pr-4">
                  <h3 className="text-base font-bold text-zinc-800 truncate tracking-tight">{p.name}</h3>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">VITE REACT PROJECT</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200/50">
                  {p.version}
                </span>
              </div>

              {/* Stats Block */}
              <div className="grid grid-cols-4 gap-1.5 py-4 my-4 bg-zinc-50/50 border-y border-zinc-100 rounded-lg px-2 text-center">
                <div className="flex flex-col items-center">
                  <Database size={14} className="text-zinc-400 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{entitiesCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">实体</span>
                </div>
                <div className="flex flex-col items-center">
                  <ArrowRightLeft size={14} className="text-zinc-400 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{dataFlowCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">连线</span>
                </div>
                <div className="flex flex-col items-center">
                  <Layers size={14} className="text-zinc-400 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{regionsCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">区域</span>
                </div>
                <div className="flex flex-col items-center">
                  <ClipboardList size={14} className="text-zinc-400 mb-1" />
                  <span className="text-sm font-bold text-zinc-800">{reqsCount}</span>
                  <span className="text-[9px] text-zinc-400 font-medium tracking-wide">需求</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center gap-2 mt-auto">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-zinc-50 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
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
    </div>
  )
}
