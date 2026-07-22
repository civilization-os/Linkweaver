import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, X, Settings as SettingsIcon, WifiOff } from 'lucide-react';

interface Settings {
  mcpEnabled: boolean;
  mcpPort: number;
}

type TransportMode = 'http' | 'sse';
type ServiceStatusState = 'idle' | 'checking' | 'online' | 'disabled' | 'offline';

interface ServiceStatus {
  state: ServiceStatusState;
  message: string;
  activeHttp?: number;
  activeSse?: number;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [portStr, setPortStr] = useState('8081');
  const [saving, setSaving] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('http');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    state: 'idle',
    message: '尚未检测',
  });

  // @ts-ignore
  const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

  const httpUrl = `http://127.0.0.1:${portStr}/mcp`;
  const sseUrl = `http://127.0.0.1:${portStr}/mcp/sse`;
  const healthUrl = `http://127.0.0.1:${portStr}/mcp/health`;

  const clientConfig = useMemo(() => {
    const isHttp = transportMode === 'http';
    return {
      mcpServers: {
        linkweaver: {
          type: isHttp ? 'http' : 'sse',
          url: isHttp ? httpUrl : sseUrl,
        },
      },
    };
  }, [httpUrl, sseUrl, transportMode]);

  const checkServiceStatus = useCallback(async () => {
    setServiceStatus({ state: 'checking', message: '正在检测 MCP 服务...' });

    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      const data = await response.json().catch(() => null);

      if (response.status === 503 || data?.enabled === false) {
        setServiceStatus({
          state: 'disabled',
          message: '服务进程可访问，但 MCP 已在设置中关闭。',
          activeHttp: data?.activeSessions?.streamableHttp,
          activeSse: data?.activeSessions?.legacySse,
        });
        return;
      }

      if (!response.ok || !data?.ok) {
        setServiceStatus({
          state: 'offline',
          message: `检测失败：HTTP ${response.status}`,
        });
        return;
      }

      setServiceStatus({
        state: 'online',
        message: 'MCP 服务在线，客户端可以使用下方 URL 接入。',
        activeHttp: data.activeSessions?.streamableHttp ?? 0,
        activeSse: data.activeSessions?.legacySse ?? 0,
      });
    } catch {
      setServiceStatus({
        state: 'offline',
        message: '未检测到本机 MCP 服务。请确认桌面端已运行且端口未被占用。',
      });
    }
  }, [healthUrl]);

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

  useEffect(() => {
    if (settings?.mcpEnabled) {
      checkServiceStatus();
    } else if (settings) {
      setServiceStatus({ state: 'disabled', message: 'MCP 当前未启用。' });
    }
  }, [settings?.mcpEnabled, checkServiceStatus]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const newSettings = {
      mcpEnabled: settings.mcpEnabled,
      mcpPort: parseInt(portStr, 10) || 8081,
    };
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-settings', newSettings);
    }
    setSaving(false);
    onClose();
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(clientConfig, null, 2));
  };

  const statusTone = {
    online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    disabled: 'bg-amber-50 text-amber-700 border-amber-200',
    offline: 'bg-rose-50 text-rose-700 border-rose-200',
    checking: 'bg-blue-50 text-blue-700 border-blue-200',
    idle: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  }[serviceStatus.state];

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
              当前运行在浏览器环境，HTTP/SSE MCP 服务设置需要桌面客户端支持。
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">HTTP/SSE MCP 服务</h3>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-zinc-800">启用 HTTP/SSE MCP 服务</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  允许本机 AI Agent 通过 URL 接入并控制项目资源
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.mcpEnabled}
                  onChange={(e) => setSettings({ ...settings, mcpEnabled: e.target.checked })}
                  disabled={!ipcRenderer}
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 disabled:opacity-50" />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-zinc-800">端口号</label>
              <div className="text-[11px] text-zinc-500 mb-1">
                推荐：
                <code className="bg-zinc-100 px-1 rounded">{httpUrl}</code>
                ，SSE 兼容：
                <code className="bg-zinc-100 px-1 rounded">{sseUrl}</code>
              </div>
              <input
                type="number"
                value={portStr}
                onChange={(e) => setPortStr(e.target.value)}
                disabled={!settings.mcpEnabled || !ipcRenderer}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[13px] font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>

            <div className={`rounded-lg border p-3 ${statusTone}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {serviceStatus.state === 'online' ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  ) : serviceStatus.state === 'checking' ? (
                    <RefreshCw size={15} className="mt-0.5 shrink-0 animate-spin" />
                  ) : (
                    <WifiOff size={15} className="mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold">MCP 状态</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed">{serviceStatus.message}</div>
                    {serviceStatus.state === 'online' && (
                      <div className="mt-1 text-[10px] opacity-80">
                        活跃连接：HTTP {serviceStatus.activeHttp ?? 0} / SSE {serviceStatus.activeSse ?? 0}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={checkServiceStatus}
                  disabled={serviceStatus.state === 'checking'}
                  className="shrink-0 px-2 py-1 text-[10px] font-bold rounded-md bg-white/70 hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  检测
                </button>
              </div>
            </div>

            {settings.mcpEnabled && (
              <div className="pt-4 border-t border-zinc-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-800">客户端配置参考</h3>
                  <div className="bg-zinc-100 rounded-lg p-0.5 flex text-[11px] font-bold">
                    <button
                      onClick={() => setTransportMode('http')}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                        transportMode === 'http' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                      }`}
                    >
                      HTTP 推荐
                    </button>
                    <button
                      onClick={() => setTransportMode('sse')}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                        transportMode === 'sse' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                      }`}
                    >
                      SSE 兼容
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="text-[11px] bg-zinc-900 text-zinc-300 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(clientConfig, null, 2)}
                  </pre>
                  <button
                    onClick={handleCopyConfig}
                    className="absolute top-2 right-2 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded transition-colors cursor-pointer"
                  >
                    复制
                  </button>
                </div>

                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  主推荐 URL 接入。新客户端优先使用 Streamable HTTP：
                  <code className="bg-zinc-100 px-1 rounded">/mcp</code>。 如果客户端只支持旧协议，再使用 SSE：
                  <code className="bg-zinc-100 px-1 rounded">/mcp/sse</code>。 stdio
                  入口仅作为本地兼容/备用方式，不作为主推荐。
                </div>
              </div>
            )}
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
