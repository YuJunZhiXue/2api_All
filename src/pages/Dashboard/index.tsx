import { useEffect } from 'react';
import { Activity, Server, ShieldCheck, Zap } from 'lucide-react';
import { useStore } from '@/store';

export default function Dashboard() {
  const { status, fetchStatus } = useStore();

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  if (!status) {
    return <div className="text-zinc-500 animate-pulse font-mono">Initializing system...</div>;
  }

  const CARDS = [
    { label: 'QPS', value: status.qps, icon: Zap, color: 'text-yellow-400' },
    { label: 'Success Rate', value: status.successRate, icon: Activity, color: 'text-[#00FF41]' },
    { label: 'Active Sessions', value: status.activeSessions, icon: ShieldCheck, color: 'text-blue-400' },
    { label: 'Total Sites', value: status.totalSites, icon: Server, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c) => (
          <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col">
            <div className="flex items-center text-zinc-400 mb-4">
              <c.icon className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">{c.label}</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${c.color}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <h2 className="text-zinc-300 font-medium">Terminal Logs</h2>
        </div>
        <div className="p-6 h-64 overflow-y-auto font-mono text-sm text-zinc-500 space-y-2 bg-[#0a0a0a]">
          <div><span className="text-[#00FF41]">root@2api:~#</span> systemctl status 2api</div>
          <div className="text-zinc-300">● 2api.service - 2api Gateway</div>
          <div className="text-zinc-300">   Loaded: loaded (/etc/systemd/system/2api.service; enabled; preset: enabled)</div>
          <div className="text-[#00FF41]">   Active: active (running) since Sun 2026-04-14 00:00:00 UTC</div>
          <div className="text-zinc-300">   Memory: 184.2M (Limit: 1.0G)</div>
          <div className="text-zinc-300">   CGroup: /system.slice/2api.service</div>
          <div className="mt-4"><span className="text-zinc-400">[2026-04-14 02:40:12]</span> INFO: Handled 14 requests seamlessly.</div>
          <div><span className="text-zinc-400">[2026-04-14 02:40:15]</span> <span className="text-yellow-400">WARN</span>: Session pool for site "chatgpt" is running low (1 active).</div>
        </div>
      </div>
    </div>
  );
}
