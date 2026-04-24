"use client";

import { useState } from "react";
import useSWR from "swr";
import { Activity, ShieldAlert, Cpu, Terminal, Plus, X, ServerCrash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface APIKey {
  ID: number;
  Name: string;
  Weight: number;
  Status: string;
  CreatedAt: string;
}

export default function Dashboard() {
  const { data: keys, error, mutate } = useSWR<APIKey[]>("/api/keys", fetcher, {
    refreshInterval: 5000,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({ name: "", key: "", weight: "1.0" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeKeys = keys?.filter((k) => k.Status === "Active").length || 0;
  const deadKeys = keys?.filter((k) => k.Status === "Dead").length || 0;
  const coolingKeys = keys?.filter((k) => k.Status === "Cooling").length || 0;

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyForm.name,
          key: newKeyForm.key,
          weight: parseFloat(newKeyForm.weight),
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewKeyForm({ name: "", key: "", weight: "1.0" });
        mutate();
      } else {
        alert("Failed to add key. Check server logs (ENCRYPTION_KEY required).");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* STATS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="ACTIVE POOL" 
          value={activeKeys.toString()} 
          icon={<Activity className="text-[#00FF41]" size={24} />} 
          color="text-[#00FF41]"
          borderColor="border-[#00FF41]/30"
        />
        <StatCard 
          title="COOLING (429)" 
          value={coolingKeys.toString()} 
          icon={<Cpu className="text-[#FFD600]" size={24} />} 
          color="text-[#FFD600]"
          borderColor="border-[#FFD600]/30"
        />
        <StatCard 
          title="DEAD (401/403)" 
          value={deadKeys.toString()} 
          icon={<ServerCrash className="text-[#FF003C]" size={24} />} 
          color="text-[#FF003C]"
          borderColor="border-[#FF003C]/30"
        />
      </section>

      {/* KEY MANAGEMENT */}
      <section className="bg-[#1A1A1C] border border-[#27272A] relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent opacity-20"></div>
        
        <div className="p-6 border-b border-[#27272A] flex justify-between items-center bg-[#0A0A0B]/50">
          <h2 className="text-xl font-bold tracking-widest text-[#ededed] uppercase flex items-center gap-2">
            <Terminal size={20} className="text-[#00E5FF]" />
            RESOURCE_ALLOCATION_TABLE
          </h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/50 hover:bg-[#00FF41] hover:text-black transition-all duration-200 font-mono text-sm uppercase font-bold uppercase"
          >
            <Plus size={16} /> INJECT_NEW_KEY
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-sm">
            <thead className="bg-[#0A0A0B] text-gray-500 uppercase border-b border-[#27272A]">
              <tr>
                <th className="p-4 font-normal tracking-widest">ID</th>
                <th className="p-4 font-normal tracking-widest">ALIAS</th>
                <th className="p-4 font-normal tracking-widest">WEIGHT</th>
                <th className="p-4 font-normal tracking-widest">STATUS</th>
                <th className="p-4 font-normal tracking-widest">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={5} className="p-8 text-center text-[#FF003C]">ERR_CONNECTION_REFUSED</td></tr>}
              {!keys && !error && <tr><td colSpan={5} className="p-8 text-center text-gray-500">INITIALIZING_DATA_STREAM...</td></tr>}
              
              {keys?.map((key) => (
                <tr key={key.ID} className="border-b border-[#27272A] hover:bg-[#222225] transition-colors group">
                  <td className="p-4 text-gray-400">#{key.ID.toString().padStart(4, '0')}</td>
                  <td className="p-4 text-[#ededed]">{key.Name || "UNNAMED_NODE"}</td>
                  <td className="p-4 text-[#00E5FF]">{key.Weight.toFixed(1)}</td>
                  <td className="p-4">
                    <StatusBadge status={key.Status} />
                  </td>
                  <td className="p-4 text-gray-500">{new Date(key.CreatedAt).toLocaleString()}</td>
                </tr>
              ))}
              
              {keys?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <ShieldAlert size={32} className="mx-auto mb-4 opacity-50" />
                    NO_ACTIVE_RESOURCES_DETECTED
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-[#1A1A1C] border border-[#00FF41] w-full max-w-md relative overflow-hidden"
            >
              {/* Scanline overlay for modal */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-50"></div>
              
              <div className="p-4 border-b border-[#27272A] flex justify-between items-center bg-[#0A0A0B] relative z-20">
                <h3 className="font-bold text-[#00FF41] uppercase tracking-widest font-mono">
                  &gt; INJECT_SECURE_PAYLOAD
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-[#FF003C] transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddKey} className="p-6 space-y-6 relative z-20">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">ALIAS (IDENTIFIER)</label>
                  <input 
                    required
                    value={newKeyForm.name}
                    onChange={e => setNewKeyForm({...newKeyForm, name: e.target.value})}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] p-3 text-[#ededed] font-mono focus:outline-none focus:border-[#00FF41] transition-colors"
                    placeholder="e.g. NODE_ALPHA_01"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">RAW_KEY_STRING</label>
                  <input 
                    required
                    type="password"
                    value={newKeyForm.key}
                    onChange={e => setNewKeyForm({...newKeyForm, key: e.target.value})}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] p-3 text-[#ededed] font-mono focus:outline-none focus:border-[#00FF41] transition-colors"
                    placeholder="sk-nv-..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">WEIGHT_MULTIPLIER</label>
                  <input 
                    required
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newKeyForm.weight}
                    onChange={e => setNewKeyForm({...newKeyForm, weight: e.target.value})}
                    className="w-full bg-[#0A0A0B] border border-[#27272A] p-3 text-[#00E5FF] font-mono focus:outline-none focus:border-[#00FF41] transition-colors"
                  />
                </div>
                
                <button 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#00FF41] text-black font-bold font-mono uppercase tracking-widest hover:bg-[#00FF41]/80 disabled:opacity-50 transition-colors mt-4"
                >
                  {isSubmitting ? "ENCRYPTING_AND_SAVING..." : "EXECUTE_INJECTION"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponents

function StatCard({ title, value, icon, color, borderColor }: { title: string, value: string, icon: React.ReactNode, color: string, borderColor: string }) {
  return (
    <div className={`bg-[#1A1A1C] border border-[#27272A] p-6 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-10 group-hover:opacity-20 transition-opacity duration-500 ${color}`}></div>
      <div className={`absolute left-0 top-0 h-full w-1 ${color.replace('text-', 'bg-')} opacity-50`}></div>
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest">{title}</h3>
        {icon}
      </div>
      <div className={`text-5xl font-bold tracking-tighter ${color} font-mono glow-text`}>
        {value.padStart(3, '0')}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <span className="inline-flex items-center gap-2 px-2 py-1 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 text-xs uppercase tracking-widest font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse glow-green"></span>
        ACTIVE
      </span>
    );
  }
  if (status === "Dead") {
    return (
      <span className="inline-flex items-center gap-2 px-2 py-1 bg-[#FF003C]/10 text-[#FF003C] border border-[#FF003C]/30 text-xs uppercase tracking-widest font-bold">
        <span className="w-1.5 h-1.5 bg-[#FF003C] glow-red"></span>
        DEAD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 bg-[#FFD600]/10 text-[#FFD600] border border-[#FFD600]/30 text-xs uppercase tracking-widest font-bold">
      <span className="w-1.5 h-1.5 bg-[#FFD600] glow-yellow"></span>
      COOLING
    </span>
  );
}
