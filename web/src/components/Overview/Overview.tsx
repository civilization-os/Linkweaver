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
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ArrowRight,
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

  const activeProject = projects.find(p => p.id === activeProjectId) ?? projects[0]
  const activeStats = activeProject ? {
    entities: activeProject.nodes.filter(n => n.type === 'entity' || n.type === 'nested').length,
    flowNodes: activeProject.nodes.filter(n => isFlowNodeType(n.type)).length,
    edges: activeProject.edges.length,
    regions: activeProject.regions.length,
    requirements: activeProject.requirements.length,
    flows: activeProject.businessFlows?.length ?? 0,
    unplaced: activeProject.nodes.filter(n => !n.regionId).length,
    unlinkedRequirements: activeProject.requirements.filter(r =>
      !(r.nodeIds?.length || r.edgeIds?.length || r.regionIds?.length)
    ).length,
  } : null

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    addProject(name)
    setShowNew(false)
    setNewName('')
  }

  const projectHealth = !activeStats
    ? '暂无项目'
    : activeStats.unplaced > 0
      ? `${activeStats.unplaced} 个实体未归区`
      : activeStats.unlinkedRequirements > 0
        ? `${activeStats.unlinkedRequirements} 个需求未关联`
        : '结构可继续推进'

  return (
    <div className="flex h-full flex-1 flex-col bg-slate-100 select-none">
      <div className="drag-region shrink-0 border-b border-slate-200/80 bg-slate-50/95 px-8 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-950">项目工作台</h1>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">WORKBENCH</span>
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">{activeProject?.name ?? '创建项目后开始建模'}</div>
          </div>

          <div className="no-drag flex items-center gap-3 pr-[120px]">
            {activeProject && (
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                onClick={() => switchProject(activeProject.id)}
              >
                <FolderOpen size={15} />
                进入画布
              </button>
            )}
            <button
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
              onClick={() => setShowNew(true)}
            >
              <Plus size={15} />
              新建项目
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400">项目队列</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{projects.length}</span>
          </div>

          {showNew && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:border-slate-400"
                placeholder="项目名称"
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
              <div className="mt-2 flex gap-2">
                <button className="flex-1 rounded-md bg-slate-950 px-2 py-1.5 text-[11px] font-bold text-white" onClick={handleCreate}>创建</button>
                <button className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-500" onClick={() => setShowNew(false)}>取消</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {projects.map(p => {
              const isActive = p.id === activeProject?.id
              return (
                <button
                  key={p.id}
                  className={`group flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                    isActive ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  onClick={() => useStore.setState({ activeProjectId: p.id })}
                >
                  <FolderOpen size={14} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold" title={p.name}>{p.name}</div>
                    <div className={isActive ? 'mt-0.5 text-[10px] text-slate-300' : 'mt-0.5 text-[10px] text-slate-400'}>
                      {p.nodes.length} 节点 / {p.edges.length} 连线
                    </div>
                  </div>
                  {projects.length > 1 && (
                    <span
                      className={`rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 ${isActive ? 'hover:bg-white/10' : 'hover:bg-red-50 hover:text-red-600'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteProject(p.id)
                      }}
                      title="删除项目"
                    >
                      <Trash2 size={13} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {activeProject && activeStats ? (
            <div className="mx-auto flex max-w-5xl flex-col gap-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-bold text-slate-950">{activeProject.name}</h2>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{activeProject.version}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      {activeStats.unplaced || activeStats.unlinkedRequirements ? (
                        <AlertTriangle size={14} className="text-amber-500" />
                      ) : (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      )}
                      <span>{projectHealth}</span>
                    </div>
                  </div>
                  <button
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                    onClick={() => switchProject(activeProject.id)}
                  >
                    继续工作
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-5 gap-2">
                  {[
                    { label: '实体', value: activeStats.entities, icon: Database },
                    { label: '流程节点', value: activeStats.flowNodes, icon: Workflow },
                    { label: '连线', value: activeStats.edges, icon: ArrowRightLeft },
                    { label: '区域', value: activeStats.regions, icon: Layers },
                    { label: '需求', value: activeStats.requirements, icon: ClipboardList },
                  ].map(item => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                          <Icon size={12} />
                          {item.label}
                        </div>
                        <div className="mt-1 text-xl font-bold text-slate-950">{item.value}</div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-5">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-950">近期需求</h3>
                    <span className="text-[10px] font-bold text-slate-400">{activeProject.requirements.length}</span>
                  </div>
                  <div className="space-y-2">
                    {activeProject.requirements.slice(0, 5).map(req => (
                      <div key={req.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="truncate text-xs font-bold text-slate-800" title={req.title}>{req.title}</div>
                        <div className="mt-1 text-[10px] font-semibold text-slate-400">
                          {req.priority} / {req.status} / {(req.nodeIds?.length ?? 0) + (req.edgeIds?.length ?? 0) + (req.regionIds?.length ?? 0)} 关联
                        </div>
                      </div>
                    ))}
                    {activeProject.requirements.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">暂无需求</div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-950">业务流程</h3>
                    <span className="text-[10px] font-bold text-slate-400">{activeStats.flows}</span>
                  </div>
                  <div className="space-y-2">
                    {(activeProject.businessFlows ?? []).slice(0, 5).map(flow => (
                      <div key={flow.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="truncate text-xs font-bold text-slate-800" title={flow.name}>{flow.name}</div>
                        <div className="mt-1 text-[10px] font-semibold text-slate-400">{flow.nodeIds.length} 节点 / {flow.edgeIds.length} 连线</div>
                      </div>
                    ))}
                    {(activeProject.businessFlows ?? []).length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">暂无流程</div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">暂无项目</div>
          )}
        </main>

        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-slate-200/80 bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
            <Clock3 size={13} />
            工作队列
          </div>
          {activeStats && (
            <div className="space-y-2">
              <div className={`rounded-lg border px-3 py-3 ${activeStats.unplaced ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <div className="text-xs font-bold">结构归位</div>
                <div className="mt-1 text-[11px] font-semibold opacity-80">{activeStats.unplaced ? `${activeStats.unplaced} 个实体需要归区` : '全部实体已归区'}</div>
              </div>
              <div className={`rounded-lg border px-3 py-3 ${activeStats.unlinkedRequirements ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <div className="text-xs font-bold">需求追踪</div>
                <div className="mt-1 text-[11px] font-semibold opacity-80">{activeStats.unlinkedRequirements ? `${activeStats.unlinkedRequirements} 个需求未关联画布` : '需求已关联结构'}</div>
              </div>
              <button
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                onClick={() => activeProject && switchProject(activeProject.id)}
              >
                打开项目工作台
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </aside>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
