import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { LayoutGrid, FolderKanban, FileCode, Plus, CircleDashed, Loader2, CheckCircle2, Settings } from 'lucide-react'
import SettingsModal from '../SettingsModal/SettingsModal'

export default function Sidebar() {
  const page = useStore(s => s.page)
  const setPage = useStore(s => s.setPage)
  const projects = useStore(s => s.projects)
  const activeProjectId = useStore(s => s.activeProjectId)
  const switchProject = useStore(s => s.switchProject)
  const addRequirement = useStore(s => s.addRequirement)
  const selectedRequirementId = useStore(s => s.selectedRequirementId)
  const selectRequirement = useStore(s => s.selectRequirement)

  const [showSettings, setShowSettings] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)

  return (
    <div className="w-64 bg-zinc-50 border-r border-zinc-200/80 p-6 flex flex-col h-full shrink-0 select-none">
      {/* Logo */}
      <div className="drag-region flex items-center gap-2.5 mb-8 mt-1">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)] shrink-0 ring-1 ring-zinc-200/50">
          <img src="/pwa-192x192.png" alt="Linkweaver Logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-lg font-bold tracking-tight text-zinc-900">
          Linkweaver<span className="text-zinc-400">.</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="space-y-1">
        <div
          className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150 ${
            page === 'overview'
              ? 'bg-zinc-900 text-zinc-50 shadow-sm'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          onClick={() => setPage('overview')}
        >
          <LayoutGrid size={16} />
          <span>项目概览</span>
        </div>
      </div>

      {/* Project list section */}
      <div className="mt-8">
        <div className="px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
          项目列表
        </div>
        <div className="space-y-1 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {projects.map(p => {
            const isActive = p.id === activeProjectId && page === 'canvas'
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-zinc-900 text-zinc-50 shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
                onClick={() => switchProject(p.id)}
              >
                <FolderKanban size={16} className={isActive ? 'text-zinc-400' : 'text-zinc-400 group-hover:text-zinc-600'} />
                <span className="truncate flex-1">{p.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200/60 text-zinc-500'
                  }`}
                >
                  {p.nodes.length}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Requirements List */}
      {activeProject && (
        <div className="mt-8 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
            <span>需求列表</span>
            <button 
              className="hover:text-zinc-900 transition-colors cursor-pointer"
              onClick={() => addRequirement({ title: '新需求', status: 'not_started' })}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto pr-1 flex-1">
            {(activeProject.requirements || []).length === 0 ? (
              <div className="text-xs text-zinc-400 py-3 text-center bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl mx-2">
                暂无需求
              </div>
            ) : (
              (activeProject.requirements || []).map(req => {
                const isSelected = selectedRequirementId === req.id
                let StatusIcon = CircleDashed
                let statusColor = 'text-zinc-400'
                if (req.status === 'in_progress') {
                  StatusIcon = Loader2
                  statusColor = 'text-blue-500'
                } else if (req.status === 'completed') {
                  StatusIcon = CheckCircle2
                  statusColor = 'text-emerald-500'
                }
                return (
                  <div
                    key={req.id}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-zinc-900 text-zinc-50 shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                    onClick={() => selectRequirement(req.id)}
                  >
                    <StatusIcon size={14} className={isSelected ? 'text-zinc-400' : statusColor} />
                    <span className="truncate flex-1">{req.title || '未命名需求'}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-zinc-200 flex justify-between items-center text-xs text-zinc-400 font-bold tracking-wide">
        <span>v{__APP_VERSION__}</span>
        <button 
          className="flex items-center gap-1.5 hover:text-zinc-800 transition-colors cursor-pointer"
          onClick={() => setShowSettings(true)}
        >
          <Settings size={14} />
          <span>设置</span>
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
