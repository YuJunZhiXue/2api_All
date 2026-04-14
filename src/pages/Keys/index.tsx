import { useEffect } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { useStore } from '@/store';

export default function Keys() {
  const { keys, fetchKeys } = useStore();

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async () => {
    await fetch('/api/admin/keys', { method: 'POST' });
    fetchKeys();
  };

  const handleDelete = async (key: string) => {
    await fetch(`/api/admin/keys/${key}`, { method: 'DELETE' });
    fetchKeys();
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-zinc-100 mb-2 flex items-center">
            <Key className="w-5 h-5 mr-3 text-yellow-400" /> API Keys
          </h2>
          <p className="text-zinc-400 text-sm">Manage keys for accessing the /v1/chat/completions endpoint.</p>
        </div>
        <button onClick={handleGenerate} className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/50 hover:bg-yellow-400/20 px-4 py-2 rounded font-medium flex items-center transition-colors">
          <Plus className="w-4 h-4 mr-2" /> Generate Key
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 border-b border-zinc-800 text-sm text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-medium">API Key</th>
              <th className="px-6 py-4 font-medium">Total Calls</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {keys.map(k => (
              <tr key={k.key} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-mono text-[#00FF41] select-all">{k.key}</td>
                <td className="px-6 py-4 font-mono text-zinc-300">{k.total_calls}</td>
                <td className="px-6 py-4 text-zinc-400 text-sm">{k.is_active ? 'Active' : 'Revoked'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(k.key)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No API Keys generated yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
