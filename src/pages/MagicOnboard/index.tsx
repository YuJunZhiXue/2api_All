import { useState } from 'react';
import { Wand2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useStore } from '@/store';

export default function MagicOnboard() {
  const { fetchSites, fetchSessions } = useStore();
  const [form, setForm] = useState({ url: 'https://www.vibecodeapp.com/', email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/api/admin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      
      if (json.success) {
        setStatus('success');
        setResult(json.data);
        fetchSites();
        fetchSessions();
      } else {
        setStatus('error');
        setResult(json.error);
      }
    } catch (err) {
      setStatus('error');
      setResult(String(err));
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-medium text-zinc-100 mb-2 flex items-center">
          <Wand2 className="w-5 h-5 mr-3 text-purple-400" /> 智能解析抓包 (Magic Onboard)
        </h2>
        <p className="text-zinc-400 text-sm mb-6">输入任何带有大模型的公网网站 URL。系统将自动启动无头浏览器，进行抓包分析、启发式表单寻找、自动注册/登录，并将完整的 Session 和 Cookie 转换为可用的 2api 节点。</p>
        
        <form onSubmit={handleAnalyze} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">目标网站 URL</label>
            <input 
              required 
              value={form.url} 
              onChange={e => setForm({...form, url: e.target.value})} 
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-400" 
              placeholder="https://www.vibecodeapp.com/" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">登录账号 (可选)</label>
              <input 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-400" 
                placeholder="自动填充用，可留空" 
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">登录密码 (可选)</label>
              <input 
                type="password"
                value={form.password} 
                onChange={e => setForm({...form, password: e.target.value})} 
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-400" 
                placeholder="自动填充用，可留空" 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={status === 'loading'}
            className="mt-4 bg-purple-400/10 text-purple-400 border border-purple-400/50 hover:bg-purple-400/20 px-6 py-2 rounded font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 正在分析目标网站 (可能需要 15-30 秒)...</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-2" /> 一键转换 2api</>
            )}
          </button>
        </form>
      </div>

      {status === 'success' && result && (
        <div className="bg-zinc-900 border border-[#00FF41]/30 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#00FF41]"></div>
          <h3 className="text-lg font-medium text-[#00FF41] mb-4 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" /> 解析成功！站点已入库
          </h3>
          <div className="space-y-3 font-mono text-sm text-zinc-300">
            <p><span className="text-zinc-500">生成站点模型 ID:</span> {result.siteName}</p>
            <p><span className="text-zinc-500">生成会话 ID:</span> {result.sessionId}</p>
            <p><span className="text-zinc-500">执行日志:</span> {result.logs}</p>
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="text-zinc-500 mb-2">嗅探到的 API 端点 ({result.apiCandidates?.length || 0} 个):</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {result.apiCandidates?.map((api: any, i: number) => (
                  <li key={i}><span className="text-purple-400">[{api.method}]</span> {api.url}</li>
                ))}
              </ul>
            </div>
            <p className="mt-4 text-xs text-zinc-400">现在您可以前往「站点管理」和「会话池」查看生成的记录，或者生成一个 API 密钥直接发起对话请求。</p>
          </div>
        </div>
      )}

      {status === 'error' && result && (
        <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <h3 className="text-lg font-medium text-red-400 mb-4 flex items-center">
            <XCircle className="w-5 h-5 mr-2" /> 解析失败
          </h3>
          <div className="font-mono text-sm text-zinc-300 whitespace-pre-wrap">
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
