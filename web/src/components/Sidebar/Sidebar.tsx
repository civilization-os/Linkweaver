import { useStore } from '../../store/useStore'
import { LayoutGrid, FolderKanban, FileCode } from 'lucide-react'

export default function Sidebar() {
  const page = useStore(s => s.page)
  const setPage = useStore(s => s.setPage)
  const projects = useStore(s => s.projects)
  const activeProjectId = useStore(s => s.activeProjectId)
  const switchProject = useStore(s => s.switchProject)

  const activeProject = projects.find(p => p.id === activeProjectId)

  return (
    <div className="w-64 bg-zinc-50 border-r border-zinc-200/80 p-6 flex flex-col h-full shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm">
          <FileCode size={18} className="stroke-[2.25]" />
        </div>
        <div className="text-lg font-bold tracking-tight text-zinc-900">
          ReqFlow<span className="text-zinc-400">.</span>
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

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-zinc-200 flex justify-center items-center text-xs text-zinc-300 font-bold tracking-wide">
        v1.0.0
      </div>
    </div>
  )
}
