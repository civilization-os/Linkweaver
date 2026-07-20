import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { X, Save, Edit3, Trash2, Eye, CircleDashed, Loader2, CheckCircle2, Copy, Check, Link, Maximize2, Minimize2, Crosshair, GitMerge } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import 'katex/dist/katex.min.css'
import { Mermaid } from './Mermaid'

export default function RequirementPanel() {
  const selectedRequirementId = useStore(s => s.selectedRequirementId)
  const selectRequirement = useStore(s => s.selectRequirement)
  const updateRequirement = useStore(s => s.updateRequirement)
  const deleteRequirement = useStore(s => s.deleteRequirement)
  const project = useStore(s => s.currentProject())
  const linkingRequirementId = useStore(s => s.linkingRequirementId)
  const setLinkingRequirement = useStore(s => s.setLinkingRequirement)
  const setViewport = useStore(s => s.setViewport)
  const addBusinessFlow = useStore(s => s.addBusinessFlow)
  
  const req = project?.requirements?.find(r => r.id === selectedRequirementId)

  const [isEditing, setIsEditing] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('not_started')
  const [copiedMd, setCopiedMd] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState(false)

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

  const handleCopyMd = () => {
    navigator.clipboard.writeText(description)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 2000)
  }

  const handleCopyPreview = async () => {
    const container = document.getElementById('markdown-preview-container')
    if (container) {
      try {
        const html = container.innerHTML
        const text = container.innerText
        const blobHtml = new Blob([html], { type: 'text/html' })
        const blobText = new Blob([text], { type: 'text/plain' })
        const data = [new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        })]
        await navigator.clipboard.write(data)
        setCopiedPreview(true)
        setTimeout(() => setCopiedPreview(false), 2000)
      } catch (err) {
        console.error('Failed to copy rich text: ', err)
        // Fallback to text if rich text fails
        navigator.clipboard.writeText(container.innerText)
        setCopiedPreview(true)
        setTimeout(() => setCopiedPreview(false), 2000)
      }
    }
  }

  const linkedNodeCount = req.nodeIds?.length ?? 0
  const linkedEdgeCount = req.edgeIds?.length ?? 0
  const linkedRegionCount = req.regionIds?.length ?? 0
  const linkedNodes = project?.nodes.filter(n => req.nodeIds?.includes(n.id)) ?? []
  const linkedRegions = project?.regions.filter(r => req.regionIds?.includes(r.id)) ?? []

  const focusLinkedCanvas = () => {
    const container = document.querySelector('.canvas-container') as HTMLElement | null
    if (!container || (!linkedNodes.length && !linkedRegions.length)) return
    const minX = Math.min(...linkedNodes.map(n => n.x), ...linkedRegions.map(r => r.x))
    const minY = Math.min(...linkedNodes.map(n => n.y), ...linkedRegions.map(r => r.y))
    const maxX = Math.max(...linkedNodes.map(n => n.x + 300), ...linkedRegions.map(r => r.x + r.w))
    const maxY = Math.max(...linkedNodes.map(n => n.y + 120 + (n.fields?.length ?? 0) * 22), ...linkedRegions.map(r => r.y + r.h))
    const padding = 180
    const w = Math.max(maxX - minX + padding * 2, 360)
    const h = Math.max(maxY - minY + padding * 2, 260)
    const scale = Math.max(0.25, Math.min(1.25, container.clientWidth / w, container.clientHeight / h))
    setViewport({
      scale,
      x: -(minX - padding) * scale + (container.clientWidth - w * scale) / 2,
      y: -(minY - padding) * scale + (container.clientHeight - h * scale) / 2,
    })
  }

  const createFlowFromRequirement = () => {
    if (!req.nodeIds?.length && !req.edgeIds?.length) return
    const existingCount = project?.businessFlows?.length ?? 0
    addBusinessFlow({
      name: req.title || `需求流程 ${existingCount + 1}`,
      description: `由需求「${req.title || '未命名需求'}」生成`,
      nodeIds: req.nodeIds ?? [],
      edgeIds: req.edgeIds ?? []
    })
  }

  return (
    <>
      {isFocusMode && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsFocusMode(false)}
        />
      )}
      <div className={`flex flex-col z-50 bg-white transition-all duration-300 ${
        isFocusMode 
          ? 'fixed inset-y-8 inset-x-8 md:inset-x-24 lg:inset-x-48 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.15)]' 
          : 'absolute inset-y-0 right-0 w-[500px] border-l border-zinc-200 shadow-2xl animate-in slide-in-from-right-8'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => selectRequirement(null)}
              className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors rounded-md hover:bg-zinc-100 cursor-pointer"
              title="关闭"
            >
              <X size={18} />
            </button>
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors rounded-md hover:bg-zinc-100 cursor-pointer"
              title={isFocusMode ? "退出专注模式" : "进入专注模式"}
            >
              {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleCopyMd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                title="复制原始 Markdown 文本"
              >
                {copiedMd ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedMd ? '已复制' : '复制 Markdown'}</span>
              </button>
              <button
                onClick={handleCopyPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors cursor-pointer"
                title="复制富文本预览内容，可直接粘贴到 Word 或 Notion"
              >
                {copiedPreview ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedPreview ? '已复制' : '复制预览'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="min-h-[300px]">
          <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">画布覆盖</div>
              <div className="flex items-center gap-1.5">
                <button
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-bold text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
                  disabled={!linkedNodeCount && !linkedRegionCount}
                  onClick={focusLinkedCanvas}
                >
                  <Crosshair size={12} />
                  定位
                </button>
                <button
                  className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
                  disabled={!linkedNodeCount && !linkedEdgeCount}
                  onClick={createFlowFromRequirement}
                >
                  <GitMerge size={12} />
                  生成流程
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                <div className="text-[10px] font-bold text-zinc-400">区域</div>
                <div className="text-base font-bold text-zinc-900">{linkedRegionCount}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                <div className="text-[10px] font-bold text-zinc-400">节点</div>
                <div className="text-base font-bold text-zinc-900">{linkedNodeCount}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                <div className="text-[10px] font-bold text-zinc-400">连线</div>
                <div className="text-base font-bold text-zinc-900">{linkedEdgeCount}</div>
              </div>
            </div>
          </div>

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
            <div id="markdown-preview-container" className="prose prose-zinc prose-sm max-w-none prose-img:rounded-xl prose-img:border prose-img:border-zinc-200 prose-headings:tracking-tight prose-a:text-blue-600 hover:prose-a:text-blue-500">
              {description ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      
                      if (!inline && match) {
                        const codeString = String(children).replace(/\n$/, '')
                        if (match[1] === 'mermaid') {
                          return <Mermaid chart={codeString} />
                        }
                        return (
                          <SyntaxHighlighter
                            style={vscDarkPlus as any}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        )
                      }
                      
                      return (
                        <code className={`inline-code ${className || ''}`} {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
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
    </>
  )
}
