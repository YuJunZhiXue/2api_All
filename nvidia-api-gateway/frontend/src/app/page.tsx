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
          trendColor="text-green-600"
        />
        <StatCard 
          title="Rate Limited" 
          subtitle="冷却中 (HTTP 429)"
          value={coolingKeys.toString()} 
          icon={<Cpu className="text-gray-400" size={20} strokeWidth={1.5} />} 
          trend="Recovering"
          trendColor="text-yellow-600"
        />
        <StatCard 
          title="Quarantine" 
          subtitle="已封禁 (HTTP 401/403)"
          value={deadKeys.toString()} 
          icon={<ServerCrash className="text-gray-400" size={20} strokeWidth={1.5} />} 
          trend="Action Req"
          trendColor="text-red-600"
        />
      </motion.section>

      {/* 极简企业级数据表格 (MINIMALIST TABLE) */}
      <motion.section 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-[#E5E5E5] rounded-xl shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
          <div>
            <h2 className="text-xl font-serif font-medium text-black">资源分配节点 (Resource Allocation)</h2>
            <p className="text-sm text-gray-500 mt-1">管理你的高并发 Nvidia API 分布式凭证池</p>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-black text-white hover:bg-gray-800 rounded-lg h-10 px-5 shadow-sm transition-all"
              >
                <Plus size={16} className="mr-2" /> 新增密钥 (Add Key)
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-[#E5E5E5] text-black rounded-xl sm:max-w-[480px] p-0 overflow-hidden shadow-2xl">
              <div className="p-6 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <DialogTitle className="font-serif text-2xl font-medium text-black">
                  安全负载注入 (Secure Injection)
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mt-2 leading-relaxed">
                  提供新的 Nvidia API 凭证。您的负载将在入库前通过 AES-256-GCM 进行最高级别的强加密。
                </DialogDescription>
              </div>
              
              <form onSubmit={handleAddKey} className="p-6 space-y-5 bg-white">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">节点名称 (Identifier Alias)</label>
                  <Input 
                    required
                    value={newKeyForm.name}
                    onChange={e => setNewKeyForm({...newKeyForm, name: e.target.value})}
                    className="bg-white border-[#E5E5E5] text-black focus-visible:ring-1 focus-visible:ring-black rounded-lg h-11 transition-all"
                    placeholder="e.g. Production Node Alpha"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">凭证负载 (Raw Credential)</label>
                  <Input 
                    required
                    type="password"
                    value={newKeyForm.key}
                    onChange={e => setNewKeyForm({...newKeyForm, key: e.target.value})}
                    className="bg-white border-[#E5E5E5] text-black focus-visible:ring-1 focus-visible:ring-black rounded-lg h-11 transition-all font-mono"
                    placeholder="sk-nv-..."
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">流量权重 (Traffic Weight)</label>
                  <Input 
                    required
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newKeyForm.weight}
                    onChange={e => setNewKeyForm({...newKeyForm, weight: e.target.value})}
                    className="bg-white border-[#E5E5E5] text-black focus-visible:ring-1 focus-visible:ring-black rounded-lg h-11 transition-all"
                  />
                </div>
                
                <div className="pt-2">
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 transition-all rounded-lg"
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
            <TableHeader className="bg-[#FAFAFA]">
              <TableRow className="hover:bg-transparent border-[#E5E5E5]">
                <TableHead className="font-medium text-xs text-gray-500 uppercase tracking-wider py-4 pl-6">ID</TableHead>
                <TableHead className="font-medium text-xs text-gray-500 uppercase tracking-wider">Alias</TableHead>
                <TableHead className="font-medium text-xs text-gray-500 uppercase tracking-wider">Weight</TableHead>
                <TableHead className="font-medium text-xs text-gray-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-medium text-xs text-gray-500 uppercase tracking-wider text-right pr-6">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-red-600 border-none">
                    Connection Refused: Backend gateway unreachable.
                  </TableCell>
                </TableRow>
              )}
              {!keys && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-400 border-none">
                    <span className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
                      Loading Resources...
                    </span>
                  </TableCell>
                </TableRow>
              )}
              
              {keys?.map((key) => (
                <TableRow key={key.ID} className="border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors group">
                  <TableCell className="text-gray-400 pl-6 font-mono text-xs">#{key.ID.toString().padStart(4, '0')}</TableCell>
                  <TableCell className="text-black font-medium">{key.Name || "Unnamed Node"}</TableCell>
                  <TableCell className="text-gray-600">{key.Weight.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusBadge status={key.Status} />
                  </TableCell>
                  <TableCell className="text-gray-500 text-right pr-6 text-sm">{new Date(key.CreatedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                </TableRow>
              ))}
              
              {keys?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-gray-500 border-none bg-[#FAFAFA]/50">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <KeySquare size={32} className="mb-4 text-gray-300" strokeWidth={1} />
                      <p className="font-medium text-gray-700">No resources allocated</p>
                      <p className="text-sm mt-1 text-center">Your gateway is empty. Add your first Nvidia API credential to start routing traffic.</p>
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
    <Card className="bg-white border-[#E5E5E5] rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
        <div>
          <CardTitle className="text-sm font-medium text-gray-900">{title}</CardTitle>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="p-2 bg-[#FAFAFA] rounded-md border border-[#E5E5E5]">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-4 flex items-end justify-between">
        <div className="text-5xl font-serif font-medium tracking-tight text-black">
          {value}
        </div>
        <div className={`flex items-center text-xs font-medium ${trendColor}`}>
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
      <Badge variant="outline" className="rounded-full bg-green-50 text-green-700 border-green-200 px-2.5 py-0.5 text-xs font-medium shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 inline-block"></span>
        Active
      </Badge>
    );
  }
  if (status === "Dead") {
    return (
      <Badge variant="outline" className="rounded-full bg-red-50 text-red-700 border-red-200 px-2.5 py-0.5 text-xs font-medium shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2 inline-block"></span>
        Quarantine
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full bg-yellow-50 text-yellow-700 border-yellow-200 px-2.5 py-0.5 text-xs font-medium shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-2 inline-block"></span>
      Cooling
    </Badge>
  );
}
