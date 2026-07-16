import { useState } from 'react'
import type { FlowNode, Field } from '../../types'
import { useStore } from '../../store/useStore'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  onClose: () => void
  editNode?: FlowNode
}

const FIELD_TYPES = ['string', 'int', 'float', 'bool', 'datetime', 'ref', 'array', 'enum']

type EditField = Field & { _id: string }

function SortableFieldItem({ 
  f, 
  i, 
  handleFieldChange, 
  handleRemoveField 
}: { 
  f: EditField, 
  i: number, 
  handleFieldChange: (idx: number, key: keyof Field, value: string | boolean) => void,
  handleRemoveField: (idx: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: f._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center gap-2 bg-zinc-50 p-2 rounded-lg border transition-all ${isDragging ? 'opacity-50 border-indigo-400 shadow-sm' : 'border-zinc-200/50'}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab hover:bg-zinc-200 p-0.5 rounded transition-colors text-zinc-400 active:cursor-grabbing outline-none"
      >
        <GripVertical size={14} />
      </div>
      <input
        className="w-24 px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md outline-none focus:border-zinc-900 transition-all"
        value={f.name}
        onChange={e => handleFieldChange(i, 'name', e.target.value)}
        placeholder="字段名"
      />
      <select
        className="w-20 px-1 py-1.5 text-[11px] bg-white border border-zinc-200 rounded-md outline-none focus:border-zinc-900 transition-all"
        value={f.type}
        onChange={e => handleFieldChange(i, 'type', e.target.value)}
      >
        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {f.type === 'ref' && (
        <select
          className="w-24 px-1 py-1.5 text-[11px] bg-white border border-zinc-200 rounded-md outline-none focus:border-zinc-900 transition-all"
          value={f.ref || ''}
          onChange={e => handleFieldChange(i, 'ref', e.target.value)}
        >
          <option value="">选择关联字段</option>
          {useStore.getState().currentProject()?.nodes.map(n => {
            if (!n.fields || n.fields.length === 0) return null;
            return (
              <optgroup key={n.id} label={n.label}>
                {n.fields.map(nf => (
                  <option key={`${n.id}.${nf.name}`} value={`${n.id}.${nf.name}`}>
                    {nf.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      )}
      <input
        className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white border border-zinc-200 rounded-md outline-none focus:border-zinc-900 transition-all"
        value={f.description ?? ''}
        onChange={e => handleFieldChange(i, 'description', e.target.value)}
        placeholder="描述（可选）"
      />
      <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 whitespace-nowrap cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          checked={!!f.required}
          onChange={e => handleFieldChange(i, 'required', e.target.checked)}
        />
        <span>必填</span>
      </label>
      <button
        className="text-zinc-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
        onClick={() => handleRemoveField(i)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function EntityEditor({ onClose, editNode }: Props) {
  const addNode = useStore(s => s.addNode)
  const updateNode = useStore(s => s.updateNode)

  const [name, setName] = useState(editNode?.label ?? '')
  const [type, setType] = useState<'entity' | 'actor' | 'process' | 'nested'>(editNode?.type ?? 'entity')
  const [sublabel] = useState(editNode?.sublabel ?? '实体')
  const [fields, setFields] = useState<EditField[]>(
    (editNode?.fields ?? []).map(f => ({ ...f, _id: Math.random().toString(36).slice(2) }))
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleAddField = () => {
    setFields([...fields, { _id: Math.random().toString(36).slice(2), name: '', type: 'string' }])
  }

  const handleRemoveField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx))
  }

  const handleFieldChange = (idx: number, key: keyof Field, value: string | boolean) => {
    setFields(fields.map((f, i) => i === idx ? { ...f, [key]: value } : f))
  }

  const handleSave = () => {
    if (!name.trim()) return
    const labelMap: Record<string, string> = { entity: '实体', actor: '外部', process: '流程', nested: '嵌套' }
    
    const finalFields = fields.map(({ _id, ...rest }) => rest).filter(f => f.name.trim())

    if (editNode) {
      updateNode(editNode.id, {
        type,
        label: name.trim(),
        sublabel: sublabel || labelMap[type],
        fields: finalFields,
      })
    } else {
      const node: FlowNode = {
        id: 'n' + Math.random().toString(36).slice(2, 8),
        type,
        label: name.trim(),
        sublabel: sublabel || labelMap[type],
        fields: finalFields,
        x: 300 + Math.random() * 200,
        y: 300 + Math.random() * 200,
      }
      addNode(node)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <span className="text-sm font-bold text-zinc-900">{editNode ? '编辑实体' : '新建实体'}</span>
          <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 cursor-pointer" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-400 w-12 shrink-0">名称</label>
            <input
              className="flex-1 px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder-zinc-400"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="实体名称"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-400 w-12 shrink-0">类型</label>
            <select
              className="flex-1 px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-zinc-900 transition-all"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="entity">实体</option>
              <option value="actor">外部</option>
              <option value="process">流程</option>
              <option value="nested">嵌套</option>
            </select>
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">字段配置</div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={fields.map(f => f._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((f, i) => (
                    <SortableFieldItem 
                      key={f._id} 
                      f={f} 
                      i={i} 
                      handleFieldChange={handleFieldChange} 
                      handleRemoveField={handleRemoveField} 
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <button
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 border border-dashed border-zinc-200 hover:border-zinc-900 hover:text-zinc-900 text-zinc-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              onClick={handleAddField}
            >
              <Plus size={14} />
              <span>添加字段</span>
            </button>
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
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

