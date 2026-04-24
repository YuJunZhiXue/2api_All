"use client";

import { useState } from "react";
import useSWR from "swr";
import { Activity, ShieldAlert, Cpu, ServerCrash, KeySquare, Plus, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        alert("新增密钥失败。请检查后端日志（确认环境变量已配置 ENCRYPTION_KEY）。");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-20 font-sans max-w-full">
      {/* 优雅的状态统计卡片 (ELEGANT STATS) */}
      <motion.section 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <StatCard 
          title="Active Resources" 
          subtitle="可用 API 凭证"
          value={activeKeys.toString()} 
          icon={<Activity className="text-gray-400" size={20} strokeWidth={1.5} />} 
          trend="+2 New"
          trendColor="text-green-400"
        />
        <StatCard 
          title="Rate Limited" 
          subtitle="冷却中 (HTTP 429)"
          value={coolingKeys.toString()} 
          icon={<Cpu className="text-gray-400" size={20} strokeWidth={1.5} />} 
          trend="Recovering"
          trendColor="text-yellow-400"
        />
        <StatCard 
          title="Quarantine" 
          subtitle="已封禁 (HTTP 401/403)"
          value={deadKeys.toString()} 
          icon={<ServerCrash className="text-gray-400" size={20} strokeWidth={1.5} />} 
          trend="Action Req"
          trendColor="text-red-400"
        />
      </motion.section>

      {/* 先锋几何网格数据表 (AVANT-GARDE TABLE) */}
      <motion.section 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-none overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#EAEAEA] to-transparent opacity-20"></div>

        <div className="p-6 border-b border-[#1F1F1F] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0A0A0A]">
          <div>
            <h2 className="text-xl font-display uppercase tracking-widest font-bold text-[#EAEAEA]">资源分配节点 (Resource Allocation)</h2>
            <p className="text-sm text-[#888888] mt-1 font-mono uppercase tracking-widest">管理你的高并发 Nvidia API 分布式凭证池</p>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#EAEAEA] text-[#050505] hover:bg-[#CCCCCC] rounded-none h-12 px-6 transition-all font-display uppercase tracking-widest"
              >
                <Plus size={16} className="mr-2" /> 新增密钥 (Add Key)
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0A0A0A] border-[#1F1F1F] text-[#EAEAEA] rounded-none sm:max-w-[480px] p-0 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[#1F1F1F] relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#EAEAEA] m-2"></div>
                <DialogTitle className="font-display text-2xl uppercase tracking-widest font-bold text-[#EAEAEA]">
                  安全负载注入 (Secure Injection)
                </DialogTitle>
                <DialogDescription className="text-sm text-[#888888] mt-2 leading-relaxed font-mono">
                  提供新的 Nvidia API 凭证。您的负载将在入库前通过 AES-256-GCM 进行最高级别的强加密。
                </DialogDescription>
              </div>
              
              <form onSubmit={handleAddKey} className="p-6 space-y-6 bg-[#0A0A0A]">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-[#888888] uppercase tracking-widest">节点名称 (Identifier Alias)</label>
                  <Input 
                    required
                    value={newKeyForm.name}
                    onChange={e => setNewKeyForm({...newKeyForm, name: e.target.value})}
                    className="bg-[#050505] border-[#1F1F1F] text-[#EAEAEA] focus-visible:ring-1 focus-visible:ring-[#EAEAEA] rounded-none h-12 transition-all font-mono"
                    placeholder="e.g. Production Node Alpha"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-[#888888] uppercase tracking-widest">凭证负载 (Raw Credential)</label>
                  <Input 
                    required
                    type="password"
                    value={newKeyForm.key}
                    onChange={e => setNewKeyForm({...newKeyForm, key: e.target.value})}
                    className="bg-[#050505] border-[#1F1F1F] text-[#EAEAEA] focus-visible:ring-1 focus-visible:ring-[#EAEAEA] rounded-none h-12 transition-all font-mono"
                    placeholder="sk-nv-..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-[#888888] uppercase tracking-widest">流量权重 (Traffic Weight)</label>
                  <Input 
                    required
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newKeyForm.weight}
                    onChange={e => setNewKeyForm({...newKeyForm, weight: e.target.value})}
                    className="bg-[#050505] border-[#1F1F1F] text-[#EAEAEA] focus-visible:ring-1 focus-visible:ring-[#EAEAEA] rounded-none h-12 transition-all font-mono"
                  />
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 bg-[#EAEAEA] text-[#050505] font-bold font-display uppercase tracking-widest hover:bg-[#CCCCCC] disabled:opacity-50 transition-all rounded-none"
                  >
                    {isSubmitting ? "加密写入中 (Encrypting Payload)..." : "确认注入 (Confirm & Save)"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#050505]">
              <TableRow className="hover:bg-transparent border-[#1F1F1F]">
                <TableHead className="font-mono text-xs text-[#888888] uppercase tracking-widest py-5 pl-6">ID</TableHead>
                <TableHead className="font-mono text-xs text-[#888888] uppercase tracking-widest">Alias</TableHead>
                <TableHead className="font-mono text-xs text-[#888888] uppercase tracking-widest">Weight</TableHead>
                <TableHead className="font-mono text-xs text-[#888888] uppercase tracking-widest">Status</TableHead>
                <TableHead className="font-mono text-xs text-[#888888] uppercase tracking-widest text-right pr-6">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-[#f87171] border-none font-mono uppercase tracking-widest">
                    Connection Refused: Backend gateway unreachable.
                  </TableCell>
                </TableRow>
              )}
              {!keys && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-[#888888] border-none">
                    <span className="inline-flex items-center gap-3 font-mono uppercase tracking-widest">
                      <div className="w-4 h-4 border border-[#EAEAEA] border-t-transparent rounded-full animate-spin"></div>
                      Loading Resources...
                    </span>
                  </TableCell>
                </TableRow>
              )}
              
              {keys?.map((key) => (
                <TableRow key={key.ID} className="border-[#1F1F1F] hover:bg-[#141414] transition-colors group">
                  <TableCell className="text-[#888888] pl-6 font-mono text-xs">#{key.ID.toString().padStart(4, '0')}</TableCell>
                  <TableCell className="text-[#EAEAEA] font-bold font-mono uppercase tracking-wider">{key.Name || "Unnamed Node"}</TableCell>
                  <TableCell className="text-[#888888] font-mono">{key.Weight.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusBadge status={key.Status} />
                  </TableCell>
                  <TableCell className="text-[#888888] text-right pr-6 text-sm font-mono">{new Date(key.CreatedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                </TableRow>
              ))}
              
              {keys?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-[#888888] border-none bg-[#0A0A0A]">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <KeySquare size={32} className="mb-4 text-[#333333]" strokeWidth={1} />
                      <p className="font-display uppercase tracking-widest font-bold text-[#EAEAEA]">No resources allocated</p>
                      <p className="text-sm mt-2 text-center font-mono">Your gateway is empty. Add your first Nvidia API credential to start routing traffic.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.section>
    </div>
  );
}

// 子组件: 优雅的数据统计卡片 (Elegant StatCard)
function StatCard({ title, subtitle, value, icon, trend, trendColor }: { title: string, subtitle: string, value: string, icon: React.ReactNode, trend: string, trendColor: string }) {
  return (
    <Card className="bg-[#0A0A0A] border-[#1F1F1F] rounded-none shadow-none hover:border-[#333333] transition-colors duration-300 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#1F1F1F] m-2"></div>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
        <div>
          <CardTitle className="text-sm font-display uppercase tracking-widest font-bold text-[#EAEAEA]">{title}</CardTitle>
          <p className="text-xs text-[#888888] mt-1 font-mono uppercase tracking-wider">{subtitle}</p>
        </div>
        <div className="p-2 bg-[#050505] rounded-none border border-[#1F1F1F]">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-4 flex items-end justify-between">
        <div className="text-5xl font-display font-bold tracking-tighter text-[#EAEAEA]">
          {value}
        </div>
        <div className={`flex items-center text-xs font-mono uppercase tracking-widest ${trendColor}`}>
          {trend}
          <ArrowUpRight size={14} className="ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// 子组件: 极简状态徽章 (Minimalist StatusBadge)
function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <Badge variant="outline" className="rounded-none bg-[#050505] text-[#34d399] border-[#34d399]/30 px-2 py-1 text-xs font-mono uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-none bg-[#34d399] mr-2 inline-block animate-pulse"></span>
        Active
      </Badge>
    );
  }
  if (status === "Dead") {
    return (
      <Badge variant="outline" className="rounded-none bg-[#050505] text-[#f87171] border-[#f87171]/30 px-2 py-1 text-xs font-mono uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-none bg-[#f87171] mr-2 inline-block"></span>
        Quarantine
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-none bg-[#050505] text-[#fbbf24] border-[#fbbf24]/30 px-2 py-1 text-xs font-mono uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-none bg-[#fbbf24] mr-2 inline-block"></span>
      Cooling
    </Badge>
  );
}
