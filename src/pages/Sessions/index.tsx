import { useEffect, useState } from 'react';
import { Plus, Trash2, Shield } from 'lucide-react';
import { useStore } from '@/store';
import { clsx } from 'clsx';

export default function Sessions() {
  const { sites, sessions, fetchSites, fetchSessions } = useStore();
  const [form, setForm] = useState({ site_id: '', cookie_json: '' });

  useEffect(() => {
    fetchSites();
    fetchSessions();
  }, [fetchSites, fetchSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: form.site_id,
        cookie_json: form.cookie_json
      })
    });
    setForm({ site_id: '', cookie_json: '' });
    fetchSessions();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    fetchSessions();
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-medium text-zinc-100 mb-6 flex items-center">
          <Shield className="w-5 h-5 mr-3 text-blue-400" /> Manage Session Pool
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Target Site</label>
            <select required value={form.site_id} onChange={e => setForm({...form, site_id: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-400">
              <option value="">Select a site...</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name} ({site.url})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Cookie JSON</label>
            <textarea required value={form.cookie_json} onChange={e => setForm({...form, cookie_json: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-400 font-mono text-sm h-32" placeholder='[{"name": "session_id", "value": "...", "domain": "..."}]' />
          </div>
          <button type="submit" className="mt-4 bg-blue-400/10 text-blue-400 border border-blue-400/50 hover:bg-blue-400/20 px-4 py-2 rounded font-medium flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" /> Add Session
          </button>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 border-b border-zinc-800 text-sm text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Site Model</th>
              <th className="px-6 py-4 font-medium">Last Used</th>
              <th className="px-6 py-4 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sessions.map(session => (
              <tr key={session.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className={clsx("w-2 h-2 rounded-full mr-2 animate-pulse", session.is_active ? "bg-[#00FF41]" : "bg-red-500")} />
                    <span className="text-zinc-300 text-sm">{session.is_active ? 'Alive' : 'Dead'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-zinc-200">{session.site_name}</td>
                <td className="px-6 py-4 text-zinc-400 text-sm">{new Date(session.last_used_at).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(session.id)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No sessions available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
