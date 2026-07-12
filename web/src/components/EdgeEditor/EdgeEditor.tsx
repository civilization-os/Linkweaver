import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { DataFlow } from '../../types'
import { X, ArrowRight } from 'lucide-react'

interface Props {
  sourceId: string
  targetId: string
  onClose: () => void
}

export default function EdgeEditor({ sourceId, targetId, onClose }: Props) {
  const addEdge = useStore(s => s.addEdge)
  const project = useStore(s => s.currentProject())

  const sourceNode = project?.nodes.find(n => n.id === sourceId)
  const targetNode = project?.nodes.find(n => n.id === targetId)

  const [label, setLabel] = useState('')
  const [dir, setDir] = useState<'fwd' | 'rev' | 'both'>('fwd')
  const [mappings, setMappings] = useState<string>('')

  const handleSave = () => {
    const edge: DataFlow = {
      id: 'e' + Math.random().toString(36).slice(2, 6),
      sourceId,
      sourcePort: 'r',
      targetId,
      targetPort: 'l',
      label: label.trim() || `${sourceNode?.label ?? '?'} → ${targetNode?.label ?? '?'}`,
      dataMappings: mappings.trim() || undefined,
      dir,
    }
    addEdge(edge)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <span className="text-sm font-bold text-zinc-900">新建数据流</span>
          <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 cursor-pointer" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2.5 bg-zinc-50 p-3 rounded-xl border border-zinc-200/50 justify-center">
            <span className="text-xs font-bold text-zinc-800 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg">
              {sourceNode?.label}
            </span>
            <ArrowRight size={14} className="text-zinc-400" />
            <span className="text-xs font-bold text-zinc-800 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg">
              {targetNode?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-400 w-12 shrink-0">名称</label>
            <input
              className="flex-1 px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder-zinc-400"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`${sourceNode?.label ?? ''} → ${targetNode?.label ?? ''}`}
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-400 w-12 shrink-0">方向</label>
            <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/50">
              {(['fwd', 'rev', 'both'] as const).map(d => (
                <button
                  key={d}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    dir === d
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                  onClick={() => setDir(d)}
                >
                  {d === 'fwd' ? '→ 正向' : d === 'rev' ? '← 反向' : '↔ 双向'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 space-y-3">
            <div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">数据映射（可选）</div>
              <input
                className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder-zinc-400"
                value={mappings}
                onChange={e => setMappings(e.target.value)}
                placeholder="例: email, password → User"
              />
            </div>

            {sourceNode && sourceNode.fields && sourceNode.fields.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-400 mb-1.5 font-medium">来源字段参考（点击快速添加）：</div>
                <div className="flex flex-wrap gap-1.5">
                  {sourceNode.fields.map(f => (
                    <span
                      key={f.name}
                      className="text-[9px] bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md cursor-pointer transition-colors font-mono"
                      onClick={() => setMappings(m => m + (m ? ', ' : '') + f.name)}
                    >
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {targetNode && targetNode.fields && targetNode.fields.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-400 mb-1.5 font-medium">目标字段参考（点击快速添加）：</div>
                <div className="flex flex-wrap gap-1.5">
                  {targetNode.fields.map(f => (
                    <span
                      key={f.name}
                      className="text-[9px] bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md cursor-pointer transition-colors font-mono"
                      onClick={() => setMappings(m => m + ` → ${f.name}`)}
                    >
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 bg-zinc-50 border-t border-zinc-100">
          <button
            className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            onClick={handleSave}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  )
}
