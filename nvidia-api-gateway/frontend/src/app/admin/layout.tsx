import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "../globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-clash-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NVIDIA API Gateway | Core",
  description: "Avant-Garde API Scheduler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased min-h-screen relative`}
      >
        <div className="flex min-h-screen">
          {/* Sleek Sidebar */}
          <aside className="w-64 border-r border-[#222222] bg-[#000000] hidden md:flex flex-col justify-between p-8 relative">
            <div>
              <div className="mb-12">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-white to-[#CCC] mb-6 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                  <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                </div>
                <h1 className="text-xl font-display font-bold tracking-wide text-[#EDEDED]">Nvidia Gateway</h1>
                <p className="text-xs text-[#A1A1AA] mt-1 tracking-wide">Enterprise Core</p>
              </div>
              <nav className="space-y-4 text-sm font-medium tracking-wide">
                <a href="#" className="block text-[#EDEDED] bg-[#171717] px-4 py-2.5 rounded-md border border-[#262626]">系统概览 (Dashboard)</a>
                <a href="#" className="block text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#111111] px-4 py-2.5 rounded-md transition-colors">API 密钥 (API Keys)</a>
                <a href="#" className="block text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#111111] px-4 py-2.5 rounded-md transition-colors">系统配置 (Config)</a>
              </nav>
            </div>
            <div className="text-xs text-[#666] font-mono">
              v2.0.4 <br/>
              Enterprise Admin
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 max-w-6xl mx-auto p-8 md:p-12 lg:p-16 relative">
            <header className="mb-12 flex flex-col md:flex-row md:justify-between md:items-end gap-6 pb-8 border-b border-[#222222]">
              <div>
                <h2 className="text-3xl font-display font-bold tracking-tight text-[#EDEDED]">全局概览 (Overview)</h2>
                <p className="text-sm text-[#A1A1AA] mt-2">监控并调度高并发 API 资源池</p>
              </div>
              <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#222222] px-3 py-1.5 rounded-full shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]"></span>
                </span>
                <span className="text-xs font-medium text-[#A1A1AA]">系统在线 (Online)</span>
              </div>
            </header>
            
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
