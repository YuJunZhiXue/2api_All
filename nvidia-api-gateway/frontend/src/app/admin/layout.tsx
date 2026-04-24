import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

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
          {/* Brutalist Sidebar */}
          <aside className="w-64 border-r border-[#1F1F1F] bg-[#050505] hidden md:flex flex-col justify-between p-8 relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#EAEAEA] to-transparent opacity-20"></div>
            <div>
              <div className="mb-12">
                <div className="w-8 h-8 bg-[#EAEAEA] mb-6 flex items-center justify-center">
                  <div className="w-2 h-2 bg-[#050505]"></div>
                </div>
                <h1 className="text-2xl font-display font-bold tracking-widest uppercase leading-tight text-[#EAEAEA]">Nvidia<br/>Gateway</h1>
                <p className="text-[10px] text-[#888888] mt-3 uppercase tracking-[0.2em] font-mono">Avant-Garde Edition</p>
              </div>
              <nav className="space-y-6 text-sm font-mono uppercase tracking-widest">
                <a href="#" className="block text-[#EAEAEA] border-l-2 border-[#EAEAEA] pl-4 -ml-[33px]">System Dashboard</a>
                <a href="#" className="block text-[#888888] hover:text-[#EAEAEA] transition-colors pl-4 -ml-[33px]">API Keys</a>
                <a href="#" className="block text-[#888888] hover:text-[#EAEAEA] transition-colors pl-4 -ml-[33px]">Configuration</a>
              </nav>
            </div>
            <div className="text-[10px] text-[#333333] font-mono tracking-widest uppercase">
              V 2.0.4.BUILD_1092<br/>
              [SYS.ADMIN.ACCESS]
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 max-w-6xl mx-auto p-8 md:p-12 lg:p-16 relative">
            <header className="mb-16 flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-[#1F1F1F] pb-8">
              <div>
                <h2 className="text-4xl font-display font-bold tracking-widest uppercase text-[#EAEAEA]">全局概览 (Overview)</h2>
                <p className="text-xs text-[#888888] mt-3 font-mono uppercase tracking-widest">管理并监控您的底层 API 调度系统 // Distributed Scheduler</p>
              </div>
              <div className="flex items-center gap-3 bg-[#0A0A0A] border border-[#1F1F1F] px-4 py-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-[#34d399] opacity-75"></span>
                  <span className="relative inline-flex rounded-none h-2 w-2 bg-[#34d399]"></span>
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#888888]">系统在线 (System Online)</span>
              </div>
            </header>
            
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
