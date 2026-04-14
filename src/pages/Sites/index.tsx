import { useEffect, useState } from 'react';
import { Plus, Trash2, Globe } from 'lucide-react';
import { useStore } from '@/store';

export default function Sites() {
  const { sites, fetchSites } = useStore();
  const [form, setForm] = useState({ name: '', url: '', input: '', submit: '', response: '' });

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        url: form.url,
        dom_selectors_json: JSON.stringify({
          input: form.input,
          submit: form.submit,
          response: form.response
        })
      })
    });
    setForm({ name: '', url: '', input: '', submit: '', response: '' });
    fetchSites();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/sites/${id}`, { method: 'DELETE' });
    fetchSites();
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-medium text-zinc-100 mb-6 flex items-center">
          <Globe className="w-5 h-5 mr-3 text-[#00FF41]" /> 注册目标站点
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">站点名 / 模型ID</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-[#00FF41]" placeholder="例如：gpt-4-web" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">网址</label>
              <input required value={form.url} onChange={e => setForm({...form, url: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-[#00FF41]" placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">输入框选择器</label>
              <input required value={form.input} onChange={e => setForm({...form, input: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-[#00FF41]" placeholder="例如：textarea" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">发送按钮选择器</label>
              <input required value={form.submit} onChange={e => setForm({...form, submit: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-[#00FF41]" placeholder="例如：button[type=submit]" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">回答区选择器</label>
              <input required value={form.response} onChange={e => setForm({...form, response: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-[#00FF41]" placeholder="例如：.prose" />
            </div>
          </div>
          <button type="submit" className="mt-4 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/50 hover:bg-[#00FF41]/20 px-4 py-2 rounded font-medium flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" /> 添加站点
          </button>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 border-b border-zinc-800 text-sm text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-medium">模型ID</th>
              <th className="px-6 py-4 font-medium">网址</th>
              <th className="px-6 py-4 font-medium">选择器</th>
              <th className="px-6 py-4 font-medium w-24">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sites.map(site => (
              <tr key={site.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-mono text-zinc-200">{site.name}</td>
                <td className="px-6 py-4 text-zinc-400 truncate max-w-[200px]">{site.url}</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">{site.dom_selectors_json}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(site.id)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">暂无已登记站点。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
