"use client";

import { useState } from "react";
import useSWR from "swr";
import { Activity, ShieldAlert, Cpu, Terminal, Plus, ServerCrash, KeySquare, Network } from "lucide-react";
import { motion } from "framer-motion";

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
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="space-y-12 pb-20 font-sans">
      {/* 状态统计网格 (STATS GRID) */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <StatCard 
          title="活跃资源池 (ACTIVE)" 
          value={activeKeys.toString()} 
          icon={<Activity className="text-[#00FF41]" size={24} />} 
          color="text-[#00FF41]"
          borderColor="border-[#00FF41]/30"
        />
        <StatCard 
          title="请求受限冷却中 (429)" 
          value={coolingKeys.toString()} 
          icon={<Cpu className="text-[#FFD600]" size={24} />} 
          color="text-[#FFD600]"
          borderColor="border-[#FFD600]/30"
        />
        <StatCard 
          title="阵亡已隔离 (401/403)" 
          value={deadKeys.toString()} 
          icon={<ServerCrash className="text-[#FF003C]" size={24} />} 
          color="text-[#FF003C]"
          borderColor="border-[#FF003C]/30"
        />
      </motion.section>

      {/* 核心密钥资源管理 (KEY MANAGEMENT) */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-[#1A1A1C]/80 border border-[#27272A] relative overflow-hidden backdrop-blur-md"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent opacity-20"></div>
        
        <div className="p-6 border-b border-[#27272A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0A0A0B]/50">
          <div>
            <h2 className="text-xl font-bold tracking-widest text-white flex items-center gap-2">
              <Network size={20} className="text-[#00E5FF]" />
              资源分配序列表 <span className="text-xs text-muted-foreground font-mono ml-2 border border-border px-2 py-0.5">/RESOURCE_ALLOCATION_TABLE</span>
            </h2>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/50 hover:bg-[#00FF41] hover:text-black font-mono font-bold tracking-widest transition-all duration-300 rounded-none h-10"
              >
                <Plus size={16} className="mr-2" /> 注入新密钥 (INJECT)
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1A1A1C] border-[#00FF41] text-foreground rounded-none shadow-[0_0_40px_rgba(0,255,65,0.1)] sm:max-w-[425px]">
              {/* CRT Scanline Overlay inside modal */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-30"></div>
              
              <DialogHeader className="relative z-20 border-b border-[#27272A] pb-4">
                <DialogTitle className="font-bold text-[#00FF41] tracking-widest font-mono flex items-center gap-2">
                  <KeySquare size={18} />
                  &gt; 注入安全负载 (PAYLOAD)
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-muted-foreground mt-2">
                  输入的原始 Key 将被 AES-256-GCM 强加密落盘，系统绝不明文存储核心凭证。
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleAddKey} className="space-y-6 pt-4 relative z-20">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground tracking-widest">标识符别名 (ALIAS)</label>
                  <Input 
                    required
                    value={newKeyForm.name}
                    onChange={e => setNewKeyForm({...newKeyForm, name: e.target.value})}
                    className="bg-[#0A0A0B] border-[#27272A] text-foreground font-mono focus-visible:ring-0 focus-visible:border-[#00FF41] rounded-none h-12"
                    placeholder="例如: NODE_ALPHA_01"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground tracking-widest">原始凭证字符串 (RAW_KEY)</label>
                  <Input 
                    required
                    type="password"
                    value={newKeyForm.key}
                    onChange={e => setNewKeyForm({...newKeyForm, key: e.target.value})}
                    className="bg-[#0A0A0B] border-[#27272A] text-foreground font-mono focus-visible:ring-0 focus-visible:border-[#00FF41] rounded-none h-12"
                    placeholder="sk-nv-..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground tracking-widest">调度权重乘数 (WEIGHT)</label>
                  <Input 
                    required
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newKeyForm.weight}
                    onChange={e => setNewKeyForm({...newKeyForm, weight: e.target.value})}
                    className="bg-[#0A0A0B] border-[#27272A] text-[#00E5FF] font-mono focus-visible:ring-0 focus-visible:border-[#00FF41] rounded-none h-12"
                  />
                </div>
                
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-[#00FF41] text-black font-bold font-mono tracking-widest hover:bg-[#00FF41]/80 disabled:opacity-50 transition-colors rounded-none mt-2"
                >
                  {isSubmitting ? "加密写入中 (ENCRYPTING)..." : "执行注入 (EXECUTE)"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table className="font-mono text-sm">
            <TableHeader className="bg-[#0A0A0B] border-b border-[#27272A]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-normal text-muted-foreground tracking-widest py-4">ID</TableHead>
                <TableHead className="font-normal text-muted-foreground tracking-widest">别名 (ALIAS)</TableHead>
                <TableHead className="font-normal text-muted-foreground tracking-widest">权重 (WEIGHT)</TableHead>
                <TableHead className="font-normal text-muted-foreground tracking-widest">实时状态 (STATUS)</TableHead>
                <TableHead className="font-normal text-muted-foreground tracking-widest text-right">时间戳 (TIMESTAMP)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-[#FF003C] border-none">
                    [FATAL] ERR_CONNECTION_REFUSED: 无法连接至底层网关引擎
                  </TableCell>
                </TableRow>
              )}
              {!keys && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground border-none">
                    <span className="inline-flex items-center gap-2">
                      <Terminal size={16} className="animate-pulse" />
                      INITIALIZING_DATA_STREAM...
                    </span>
                  </TableCell>
                </TableRow>
              )}
              
              {keys?.map((key) => (
                <TableRow key={key.ID} className="border-b border-[#27272A]/50 hover:bg-[#222225] transition-colors group">
                  <TableCell className="text-muted-foreground py-4">#{key.ID.toString().padStart(4, '0')}</TableCell>
                  <TableCell className="text-foreground font-bold">{key.Name || "UNNAMED_NODE"}</TableCell>
                  <TableCell className="text-[#00E5FF]">{key.Weight.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusBadge status={key.Status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">{new Date(key.CreatedAt).toLocaleString('zh-CN')}</TableCell>
                </TableRow>
              ))}
              
              {keys?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground border-none">
                    <div className="flex flex-col items-center justify-center">
                      <ShieldAlert size={32} className="mb-4 opacity-50 text-[#FFD600]" />
                      <p>未探测到活跃资源 (NO_RESOURCES_DETECTED)</p>
                      <p className="text-xs opacity-50 mt-1">请点击右上角注入新的 Nvidia API 凭证</p>
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

// 子组件: 数据统计卡片 (StatCard)
function StatCard({ title, value, icon, color, borderColor }: { title: string, value: string, icon: React.ReactNode, color: string, borderColor: string }) {
  return (
    <Card className={`bg-[#1A1A1C] border ${borderColor} rounded-none relative overflow-hidden group shadow-none`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-current to-transparent opacity-5 group-hover:opacity-15 transition-opacity duration-500 ${color}`}></div>
      <div className={`absolute left-0 top-0 h-full w-1 ${color.replace('text-', 'bg-')} opacity-80`}></div>
      
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xs font-mono text-muted-foreground tracking-widest">{title}</h3>
          {icon}
        </div>
        <div className={`text-6xl font-bold tracking-tighter ${color} font-mono drop-shadow-[0_0_15px_rgba(currentcolor,0.3)]`}>
          {value.padStart(3, '0')}
        </div>
      </CardContent>
    </Card>
  );
}

// 子组件: 状态徽章 (StatusBadge)
function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <Badge variant="outline" className="rounded-none bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/40 px-2 py-0.5 font-mono tracking-wider hover:bg-[#00FF41]/20">
        <span className="w-1.5 h-1.5 rounded-none bg-[#00FF41] animate-pulse glow-green mr-2 inline-block"></span>
        ACTIVE
      </Badge>
    );
  }
  if (status === "Dead") {
    return (
      <Badge variant="outline" className="rounded-none bg-[#FF003C]/10 text-[#FF003C] border-[#FF003C]/40 px-2 py-0.5 font-mono tracking-wider hover:bg-[#FF003C]/20">
        <span className="w-1.5 h-1.5 rounded-none bg-[#FF003C] glow-red mr-2 inline-block"></span>
        DEAD
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-none bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/40 px-2 py-0.5 font-mono tracking-wider hover:bg-[#FFD600]/20">
      <span className="w-1.5 h-1.5 rounded-none bg-[#FFD600] glow-yellow mr-2 inline-block"></span>
      COOLING
    </Badge>
  );
}
