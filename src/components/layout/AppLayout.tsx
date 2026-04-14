import { Link, useLocation } from 'react-router-dom';
import { Activity, Globe, Shield, Key, Wand2 } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { path: '/', label: '控制台', icon: Activity },
  { path: '/sites', label: '站点管理', icon: Globe },
  { path: '/sessions', label: '会话池', icon: Shield },
  { path: '/keys', label: 'API 密钥', icon: Key },
  { path: '/magic', label: '智能解析 (Magic)', icon: Wand2 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#121212] text-zinc-100 font-sans selection:bg-[#00FF41]/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-[#0a0a0a] flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <span className="text-xl font-bold tracking-wider text-[#00FF41] font-mono">2api_</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center px-4 py-3 rounded-md transition-colors",
                  isActive 
                    ? "bg-zinc-800/50 text-[#00FF41] border border-zinc-700/50" 
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/30"
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-zinc-800 bg-[#121212]">
          <h1 className="text-lg font-medium text-zinc-300">
            {NAV_ITEMS.find(n => n.path === location.pathname)?.label || '2api'}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
