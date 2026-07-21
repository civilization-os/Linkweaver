import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';

interface Settings {
  mcpEnabled: boolean;
  mcpPort: number;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [portStr, setPortStr] = useState('8081');
  const [saving, setSaving] = useState(false);

  // @ts-ignore
  const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-settings').then((s: Settings) => {
        setSettings(s);
        setPortStr(s.mcpPort.toString());
      });
    } else {
      setSettings({ mcpEnabled: false, mcpPort: 8081 });
    }
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const newSettings = {
      mcpEnabled: settings.mcpEnabled,
      mcpPort: parseInt(portStr) || 8081
    };
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-settings', newSettings);
    }
    setSaving(false);
    onClose();
  };

  if (!settings) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} className="text-zinc-500" />
            <h2 className="text-[15px] font-bold text-zinc-800">系统设置</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {!ipcRenderer && (
            <div className="p-3 bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/50 rounded-lg">
              当前运行在浏览器环境，部分设置项（如 MCP）需要桌面客户端支持。
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">MCP 服务器设置</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-zinc-800">启用 MCP 协议</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">允许 AI Agent (如 Cursor) 接入并控制项目资源</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.mcpEnabled}
                  onChange={(e) => setSettings({ ...settings, mcpEnabled: e.target.checked })}
                  disabled={!ipcRenderer}
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 disabled:opacity-50"></div>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-800">端口号</label>
              <div className="text-[11px] text-zinc-500 mb-1">AI 接入的 SSE 地址将会是: <code className="bg-zinc-100 px-1 rounded">http://127.0.0.1:{portStr}/mcp/sse</code></div>
              <input
                type="number"
                value={portStr}
                onChange={(e) => setPortStr(e.target.value)}
                disabled={!settings.mcpEnabled || !ipcRenderer}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[13px] font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-bold text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-zinc-900 text-white text-[13px] font-bold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}
