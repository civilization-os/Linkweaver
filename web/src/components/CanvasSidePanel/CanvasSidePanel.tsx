import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { FlowNode } from '../../types'
import EntityEditor from '../EntityEditor/EntityEditor'
import {
  Plus,
  X,
  Box,
  Layers,
  GitMerge,
  Edit3,
  Check,
  Trash2,
  KeyRound,
  Link2,
  BadgeCheck,
  Crosshair,
  Database,
  Network,
  ListChecks,
  AlertTriangle,
  CircleDot,
} from 'lucide-react'

export default function CanvasSidePanel() {
  const project = useStore(s => s.currentProject())
  const deleteNode = useStore(s => s.deleteNode)
  const selectedNodeIds = useStore(s => s.selectedNodeIds)
  const selectNode = useStore(s => s.selectNode)
  const activeBusinessFlowId = useStore(s => s.activeBusinessFlowId)
  const editingBusinessFlowId = useStore(s => s.editingBusinessFlowId)
  const selectBusinessFlow = useStore(s => s.selectBusinessFlow)
  const setViewport = useStore(s => s.setViewport)
  const setHoveredRegion = useStore(s => s.setHoveredRegion)
  const addBusinessFlow = useStore(s => s.addBusinessFlow)
  const deleteBusinessFlow = useStore(s => s.deleteBusinessFlow)
  const setEditingBusinessFlow = useStore(s => s.setEditingBusinessFlow)
  const selectedRequirementId = useStore(s => s.selectedRequirementId)
  const selectRequirement = useStore(s => s.selectRequirement)
  const setLinkingRequirement = useStore(s => s.setLinkingRequirement)
  const [showEditor, setShowEditor] = useState(false)
  const [editorNode, setEditorNode] = useState<FlowNode | undefined>(undefined)
  const [showFlowCreateModal, setShowFlowCreateModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDesc, setNewFlowDesc] = useState('')
  const [activeTab, setActiveTab] = useState<'structure' | 'requirements' | 'flows' | 'diagnostics'>('structure')

  if (!project) return null

  const unplacedNodes = project.nodes.filter(n => !n.regionId)
  const regions = project.regions
  const flows = project.businessFlows ?? []
  const requirements = project.requirements ?? []
  const edgeCount = project.edges.length
  const selectedNode = selectedNodeIds.length === 1
    ? project.nodes.find(n => n.id === selectedNodeIds[0])
    : undefined
  const selectedFields = selectedNode?.fields ?? []
  const primaryCount = selectedFields.filter(f => f.keyRole === 'primary').length
  const foreignCount = selectedFields.filter(f => f.keyRole === 'foreign' || f.ref).length
  const uniqueCount = selectedFields.filter(f => f.keyRole === 'unique').length
  const resolveRef = (ref?: string) => {
    if (!ref) return ''
    const [nodeId, fieldName] = ref.split('.')
    const target = project.nodes.find(n => n.id === nodeId)
    return target ? `${target.label}.${fieldName ?? ''}` : ref
  }
  const refLinks = selectedNode ? {
    outgoing: selectedFields
      .filter(f => f.ref)
      .map(f => ({ from: `${selectedNode.label}.${f.name}`, to: resolveRef(f.ref) })),
    incoming: project.nodes.flatMap(n => (n.fields ?? [])
      .filter(f => f.ref?.startsWith(`${selectedNode.id}.`))
      .map(f => ({ from: `${n.label}.${f.name}`, to: resolveRef(f.ref) })))
  } : { outgoing: [], incoming: [] }
  const orphanEdges = project.edges.filter(e =>
    !project.nodes.some(n => n.id === e.sourceId) || !project.nodes.some(n => n.id === e.targetId)
  )
  const unlinkedRequirements = requirements.filter(r =>
    !(r.nodeIds?.length || r.edgeIds?.length || r.regionIds?.length)
  )
  const diagnosticItems = [
    ...unplacedNodes.map(n => ({
      id: `node-${n.id}`,
      label: n.label,
      meta: '未归入区域',
      action: () => focusNodes([n.id]),
    })),
    ...unlinkedRequirements.map(r => ({
      id: `req-${r.id}`,
      label: r.title,
      meta: '需求未关联结构',
      action: () => selectRequirement(r.id),
    })),
    ...orphanEdges.map(e => ({
      id: `edge-${e.id}`,
      label: e.label || e.id,
      meta: '连线端点缺失',
      action: () => undefined,
    })),
  ]
  const focusNodes = (nodeIds: string[]) => {
    const targetNodes = project.nodes.filter(n => nodeIds.includes(n.id))
    if (targetNodes.length === 0) return
    const container = document.querySelector('.canvas-container') as HTMLElement | null
    if (!container) return
    const minX = Math.min(...targetNodes.map(n => n.x))
    const minY = Math.min(...targetNodes.map(n => n.y))
    const maxX = Math.max(...targetNodes.map(n => n.x + 300))
    const maxY = Math.max(...targetNodes.map(n => n.y + 120 + (n.fields?.length ?? 0) * 22))
    const padding = 160
    const w = Math.max(maxX - minX + padding * 2, 320)
    const h = Math.max(maxY - minY + padding * 2, 240)
    const scale = Math.max(0.3, Math.min(1.35, container.clientWidth / w, container.clientHeight / h))
    setViewport({
      scale,
      x: -(minX - padding) * scale + (container.clientWidth - w * scale) / 2,
      y: -(minY - padding) * scale + (container.clientHeight - h * scale) / 2,
    })
  }
  const focusRegion = (regionId: string) => {
    const region = project.regions.find(r => r.id === regionId)
    if (!region) return
    const container = document.querySelector('.canvas-container') as HTMLElement | null
    if (!container) return
    const padding = 180
    const w = Math.max(region.w + padding * 2, 360)
    const h = Math.max(region.h + padding * 2, 260)
    const scale = Math.max(0.25, Math.min(1.35, container.clientWidth / w, container.clientHeight / h))
    setViewport({
      scale,
      x: -(region.x - padding) * scale + (container.clientWidth - w * scale) / 2,
      y: -(region.y - padding) * scale + (container.clientHeight - h * scale) / 2,
    })
  }

  return (
    <>
      <div className="w-72 shrink-0 select-none overflow-y-auto border-l border-slate-200/80 bg-slate-50/95 p-4 shadow-[-1px_0_0_rgba(15,23,42,0.02)] h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-950">结构检查器</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {selectedNode ? '当前实体' : selectedNodeIds.length > 1 ? `${selectedNodeIds.length} 个实体已选择` : '项目结构'}
              </div>
            </div>
            <button
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              onClick={() => {
                setEditorNode(undefined)
                setShowEditor(true)
              }}
            >
              <Plus size={14} />
              <span>实体</span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <Database size={11} />
                <span>实体</span>
              </div>
              <div className="text-sm font-bold text-slate-900">{project.nodes.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <Network size={11} />
                <span>连线</span>
              </div>
              <div className="text-sm font-bold text-slate-900">{edgeCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <Layers size={11} />
                <span>区域</span>
              </div>
              <div className="text-sm font-bold text-slate-900">{regions.length}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { id: 'structure', label: '结构', icon: Database },
              { id: 'requirements', label: '需求', icon: ListChecks },
              { id: 'flows', label: '流程', icon: GitMerge },
              { id: 'diagnostics', label: '诊断', icon: AlertTriangle },
            ].map(item => {
              const Icon = item.icon
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  className={`flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-bold transition-colors ${
                    active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  title={item.label}
                >
                  <Icon size={12} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {activeTab === 'structure' && (
            <>
          {selectedNode && (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">当前实体</div>
                <div className="mt-1 text-sm font-bold text-zinc-900 truncate" title={selectedNode.label}>
                  {selectedNode.label}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {regions.find(r => r.id === selectedNode.regionId)?.title ?? selectedNode.sublabel ?? selectedNode.type}
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                onClick={() => selectNode(null)}
                title="取消选择"
              >
                <X size={14} />
              </button>
            </div>

            {(refLinks.outgoing.length > 0 || refLinks.incoming.length > 0) && (
              <div className="rounded-lg border border-zinc-200 bg-white p-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <Link2 size={11} />
                  <span>显式引用链路</span>
                </div>
                <div className="space-y-1.5">
                  {[...refLinks.outgoing, ...refLinks.incoming].slice(0, 6).map((link, idx) => (
                    <div key={`${link.from}-${link.to}-${idx}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[10px]">
                      <span className="truncate text-zinc-600" title={link.from}>{link.from}</span>
                      <span className="text-indigo-400">→</span>
                      <span className="truncate font-semibold text-zinc-800" title={link.to}>{link.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                  <KeyRound size={11} />
                  <span>PK</span>
                </div>
                <div className="text-sm font-bold text-amber-900">{primaryCount}</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                  <Link2 size={11} />
                  <span>FK</span>
                </div>
                <div className="text-sm font-bold text-indigo-900">{foreignCount}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <BadgeCheck size={11} />
                  <span>UK</span>
                </div>
                <div className="text-sm font-bold text-emerald-900">{uniqueCount}</div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {selectedFields.length === 0 ? (
                <div className="text-xs text-zinc-400 py-2 text-center border border-dashed border-zinc-200 rounded-lg bg-white">
                  暂无字段
                </div>
              ) : selectedFields.map(f => (
                <div key={f.name} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] font-semibold text-zinc-800">{f.name}</span>
                    {(f.keyRole || f.ref) && (
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                        f.keyRole === 'primary' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                        f.keyRole === 'unique' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        'border-indigo-200 bg-indigo-50 text-indigo-700'
                      }`}>
                        {f.keyRole === 'primary' ? 'PK' : f.keyRole === 'unique' ? 'UK' : 'FK'}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <span>{f.type}</span>
                    {f.ref && (
                      <>
                        <span>→</span>
                        <span className="truncate" title={resolveRef(f.ref)}>{resolveRef(f.ref)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
              onClick={() => {
                setEditorNode(selectedNode)
                setShowEditor(true)
              }}
            >
              <Edit3 size={13} />
              <span>编辑字段与键</span>
            </button>
          </div>
          )}

        {/* Unplaced entities */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <Box size={12} />
            <span>独立节点</span>
            {unplacedNodes.length > 0 && (
              <span className="ml-auto text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200/50">
                {unplacedNodes.length}
              </span>
            )}
          </div>
          {unplacedNodes.length === 0 ? (
            <div className="text-xs text-zinc-400 py-3 text-center bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl">
              暂无独立节点
            </div>
          ) : (
            <div className="space-y-2">
              {unplacedNodes.map(n => (
                <div
                  key={n.id}
                  className="group relative flex flex-col p-3 border border-zinc-200 rounded-xl bg-zinc-50/40 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                  draggable
                >
                  <div className="flex flex-col min-w-0 pr-5">
                    <span className="text-xs font-bold text-zinc-800 truncate">{n.label}</span>
                    {n.sublabel && <span className="text-[10px] text-zinc-400 mt-0.5">{n.sublabel}</span>}
                  </div>
                  {n.fields && n.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {n.fields.map(f => (
                        <span
                          key={f.name}
                          className="text-[9px] bg-white border border-zinc-200/80 text-zinc-500 px-1.5 py-0.5 rounded font-mono"
                        >
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 absolute top-2.5 right-2.5 text-zinc-400 hover:text-red-500 transition-opacity cursor-pointer"
                    onClick={() => deleteNode(n.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regions summary */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <Layers size={12} />
            <span>区域概览 ({regions.length})</span>
          </div>
          <div className="space-y-1.5">
            {regions.map(r => {
              const count = project.nodes.filter(n => n.regionId === r.id).length
              return (
                <div
                  key={r.id}
                  className="group flex items-center justify-between p-2 border border-zinc-200/50 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer"
                  onMouseEnter={() => setHoveredRegion(r.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onClick={() => focusRegion(r.id)}
                  title="定位到该区域"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-zinc-300 shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-xs font-semibold text-zinc-700 truncate">{r.title}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200/40">
                    {count}
                  </span>
                  <Crosshair size={11} className="hidden text-zinc-400 group-hover:block" />
                </div>
              )
            })}
            {regions.length === 0 && (
              <div className="text-xs text-zinc-400 py-3 text-center bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl">
                暂无区域
              </div>
            )}
          </div>
        </div>
            </>
          )}

        {/* Business Flows */}
        {activeTab === 'flows' && (
        <div className="flex flex-col gap-2.5 border-t border-zinc-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <GitMerge size={12} />
              <span>业务流程 ({flows.length})</span>
            </div>
            <button
              className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              onClick={() => {
                setNewFlowName(`业务流程 ${flows.length + 1}`)
                setNewFlowDesc('')
                setShowFlowCreateModal(true)
              }}
            >
              <Plus size={12} />
              <span>流程</span>
            </button>
          </div>

          <div className="space-y-2">
            {flows.map(f => {
              const isActive = activeBusinessFlowId === f.id
              const isEditing = editingBusinessFlowId === f.id
              return (
                <div
                  key={f.id}
                  className={`group relative flex flex-col p-3 border rounded-xl transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50/30 border-indigo-200 shadow-sm ring-1 ring-indigo-100'
                      : 'bg-zinc-50/40 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                  }`}
                  onClick={() => {
                    if (isEditing) return
                    selectBusinessFlow(isActive ? null : f.id)
                    if (!isActive) focusNodes(f.nodeIds)
                  }}
                >
                  <div className="flex items-center justify-between min-w-0 pr-14">
                    <span className="text-xs font-bold text-zinc-800 truncate" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 flex gap-2">
                    <span>{f.nodeIds.length} 节点</span>
                    <span>•</span>
                    <span>{f.edgeIds.length} 连线</span>
                    {isActive && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-indigo-600">聚焦中</span>
                      </>
                    )}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <button
                        className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingBusinessFlow(null)
                        }}
                        title="完成编辑"
                      >
                        <Check size={10} />
                      </button>
                    ) : (
                      <button
                        className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectBusinessFlow(f.id)
                          setEditingBusinessFlow(f.id)
                        }}
                        title="编辑包含节点/线"
                      >
                        <Edit3 size={10} />
                      </button>
                    )}
                    <button
                      className="p-1 rounded bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-600 cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`确认删除业务流程 "${f.name}" 吗？`)) {
                          deleteBusinessFlow(f.id)
                        }
                      }}
                      title="删除"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {isEditing && (
                    <div className="mt-2.5 text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 py-1 rounded">
                      💡 请在画布上点击需要包含的节点与线段，点击 ✔ 完成。
                    </div>
                  )}
                </div>
              )
            })}

            {flows.length === 0 && (
              <div className="text-xs text-zinc-400 py-3 text-center bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl">
                暂无业务流程
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'requirements' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
              <ListChecks size={12} />
              <span>需求工作流 ({requirements.length})</span>
            </div>

            <div className="space-y-2">
              {requirements.map(req => {
                const selected = selectedRequirementId === req.id
                const linkedCount = (req.nodeIds?.length ?? 0) + (req.edgeIds?.length ?? 0) + (req.regionIds?.length ?? 0)
                return (
                  <div
                    key={req.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      selected ? 'border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      className="flex w-full items-start gap-2 text-left"
                      onClick={() => selectRequirement(selected ? null : req.id)}
                    >
                      <CircleDot size={13} className={selected ? 'mt-0.5 shrink-0 text-indigo-600' : 'mt-0.5 shrink-0 text-slate-400'} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-900" title={req.title}>{req.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                          <span>{req.priority}</span>
                          <span>/</span>
                          <span>{req.status}</span>
                          <span>/</span>
                          <span>{linkedCount} 关联</span>
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => selectRequirement(req.id)}
                      >
                        详情
                      </button>
                      <button
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                        onClick={() => {
                          selectRequirement(req.id)
                          setLinkingRequirement(req.id)
                        }}
                      >
                        关联画布
                      </button>
                    </div>
                  </div>
                )
              })}
              {requirements.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 py-8 text-center text-xs text-slate-400">
                  暂无需求
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
              <AlertTriangle size={12} />
              <span>诊断清单 ({diagnosticItems.length})</span>
            </div>
            {diagnosticItems.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-4 text-xs font-semibold text-emerald-700">
                暂无结构告警
              </div>
            ) : (
              <div className="space-y-2">
                {diagnosticItems.map(item => (
                  <button
                    key={item.id}
                    className="flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-left transition-colors hover:bg-amber-50"
                    onClick={item.action}
                  >
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-amber-950" title={item.label}>{item.label}</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-amber-700">{item.meta}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {showEditor && (
        <EntityEditor
          editNode={editorNode}
          onClose={() => {
            setShowEditor(false)
            setEditorNode(undefined)
          }}
        />
      )}

      {showFlowCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 shadow-xl rounded-2xl w-[380px] p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-sm font-bold text-zinc-900">新建业务流程</span>
              <button
                className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                onClick={() => setShowFlowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">流程名称</label>
                <input
                  type="text"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="e.g. 登录至购物链路"
                  className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-zinc-50/50"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">说明描述</label>
                <textarea
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  placeholder="请输入流程的详细业务场景描述..."
                  className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-zinc-50/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                onClick={() => setShowFlowCreateModal(false)}
              >
                取消
              </button>
              <button
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                disabled={!newFlowName.trim()}
                onClick={() => {
                  if (newFlowName.trim()) {
                    addBusinessFlow({
                      name: newFlowName.trim(),
                      description: newFlowDesc.trim() || '用户自定义业务场景流',
                      nodeIds: [],
                      edgeIds: []
                    })
                    setShowFlowCreateModal(false)
                    setNewFlowName('')
                    setNewFlowDesc('')
                  }
                }}
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
