import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { FlowNode } from '../../types'
import EntityEditor from '../EntityEditor/EntityEditor'
import { Plus, X, Box, Layers, GitMerge, Edit3, Check, Trash2, KeyRound, Link2, BadgeCheck } from 'lucide-react'

export default function CanvasSidePanel() {
  const project = useStore(s => s.currentProject())
  const deleteNode = useStore(s => s.deleteNode)
  const selectedNodeIds = useStore(s => s.selectedNodeIds)
  const selectNode = useStore(s => s.selectNode)
  const activeBusinessFlowId = useStore(s => s.activeBusinessFlowId)
  const editingBusinessFlowId = useStore(s => s.editingBusinessFlowId)
  const selectBusinessFlow = useStore(s => s.selectBusinessFlow)
  const setViewport = useStore(s => s.setViewport)
  const addBusinessFlow = useStore(s => s.addBusinessFlow)
  const deleteBusinessFlow = useStore(s => s.deleteBusinessFlow)
  const setEditingBusinessFlow = useStore(s => s.setEditingBusinessFlow)
  const [showEditor, setShowEditor] = useState(false)
  const [editorNode, setEditorNode] = useState<FlowNode | undefined>(undefined)
  const [showFlowCreateModal, setShowFlowCreateModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDesc, setNewFlowDesc] = useState('')

  if (!project) return null

  const unplacedNodes = project.nodes.filter(n => !n.regionId)
  const regions = project.regions
  const flows = project.businessFlows ?? []
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

  return (
    <>
      <div className="w-64 bg-white border-l border-zinc-200 p-5 flex flex-col gap-6 overflow-y-auto shrink-0 select-none h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-900 tracking-tight">工具箱</span>
          <button
            className="flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
            onClick={() => {
              setEditorNode(undefined)
              setShowEditor(true)
            }}
          >
            <Plus size={14} />
            <span>实体</span>
          </button>
        </div>

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
                  className="flex items-center justify-between p-2 border border-zinc-200/50 rounded-xl hover:bg-zinc-50 transition-colors"
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

        {/* Business Flows */}
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
