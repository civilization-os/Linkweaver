import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { X, Save, Edit3, Trash2, Eye, CircleDashed, Loader2, CheckCircle2, Copy, Check, Link } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function RequirementPanel() {
  const selectedRequirementId = useStore(s => s.selectedRequirementId)
  const selectRequirement = useStore(s => s.selectRequirement)
  const updateRequirement = useStore(s => s.updateRequirement)
  const deleteRequirement = useStore(s => s.deleteRequirement)
  const project = useStore(s => s.currentProject())
  const linkingRequirementId = useStore(s => s.linkingRequirementId)
  const setLinkingRequirement = useStore(s => s.setLinkingRequirement)
  
  const req = project?.requirements?.find(r => r.id === selectedRequirementId)

  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('not_started')
  const [copied, setCopied] = useState(false)

  // Sync state when requirement changes
  useEffect(() => {
    if (req) {
      setTitle(req.title || '')
      setDescription(req.description || '')
      setStatus(req.status || 'not_started')
      setIsEditing(false)
    }
  }, [req?.id])

  if (!req) return null

  const handleSave = () => {
    updateRequirement(req.id, { title, description, status })
    setIsEditing(false)
  }
  
  const handleDelete = () => {
    deleteRequirement(req.id)
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    updateRequirement(req.id, { status: newStatus })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(description)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="absolute inset-y-0 right-0 w-[500px] bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right-8 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectRequirement(null)}
            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors rounded-md hover:bg-zinc-100 cursor-pointer"
          >
            <X size={18} />
          </button>
          <div className="text-sm font-bold text-zinc-800">需求详情</div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status Dropdown / Buttons */}
          <div className="flex bg-zinc-100 rounded-lg p-1 text-xs">
            <button
              onClick={() => handleStatusChange('not_started')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                status === 'not_started' ? 'bg-white shadow-sm text-zinc-900 font-semibold' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <CircleDashed size={14} className={status === 'not_started' ? 'text-zinc-400' : ''} />
              未开始
            </button>
            <button
              onClick={() => handleStatusChange('in_progress')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                status === 'in_progress' ? 'bg-white shadow-sm text-blue-600 font-semibold' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Loader2 size={14} className={status === 'in_progress' ? 'animate-spin' : ''} />
              进行中
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                status === 'completed' ? 'bg-white shadow-sm text-emerald-600 font-semibold' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <CheckCircle2 size={14} />
              已完成
            </button>
          </div>
          
          <button
            onClick={handleDelete}
            className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 cursor-pointer ml-2"
            title="删除需求"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-2xl font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="需求标题"
            />
          ) : (
            <h2 className="text-2xl font-bold text-zinc-900">{title}</h2>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6 text-sm text-zinc-500">
          <div className="flex bg-zinc-100 rounded-lg p-1">
            <button
              onClick={() => setIsEditing(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                !isEditing ? 'bg-white shadow-sm text-zinc-900 font-semibold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Eye size={14} />
              阅读视图
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isEditing ? 'bg-white shadow-sm text-zinc-900 font-semibold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Edit3 size={14} />
              编辑模式
            </button>
            <div className="w-px h-4 bg-zinc-200 mx-1"></div>
            <button
              onClick={() => setLinkingRequirement(linkingRequirementId === req.id ? null : req.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                linkingRequirementId === req.id ? 'bg-purple-100 text-purple-700 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="在画布上点击实体/连线/区域以关联"
            >
              <Link size={14} />
              关联画布元素
            </button>
          </div>
          
          {!isEditing && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-auto rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
              title="复制 Markdown"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
          )}
        </div>

        <div className="min-h-[300px]">
          {isEditing ? (
            <div className="flex flex-col h-full gap-4">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full h-96 p-4 text-sm font-mono text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
                placeholder="支持 Markdown 语法。可以粘贴图片链接、插入表格或视频链接..."
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={16} />
                  保存更改
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-zinc prose-sm max-w-none prose-img:rounded-xl prose-img:border prose-img:border-zinc-200 prose-headings:tracking-tight prose-a:text-blue-600 hover:prose-a:text-blue-500">
              {description ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {description}
                </ReactMarkdown>
              ) : (
                <div className="text-zinc-400 italic text-center py-10 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
                  暂无详情描述，点击“编辑模式”添加内容
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
