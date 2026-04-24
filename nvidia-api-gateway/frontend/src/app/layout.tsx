import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NVIDIA API Gateway | Enterprise Dashboard",
  description: "Enterprise-grade high-concurrency API scheduler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${inter.variable} ${playfair.variable} antialiased min-h-screen relative bg-[#FAFAFA] text-[#111111]`}
      >
        <div className="flex min-h-screen">
          {/* Elegant Sidebar */}
          <aside className="w-64 border-r border-[#E5E5E5] bg-white hidden md:flex flex-col justify-between p-8">
            <div>
              <div className="mb-12">
                <div className="w-8 h-8 bg-black mb-4"></div>
                <h1 className="text-xl font-serif font-semibold tracking-tight leading-tight">Nvidia<br/>Gateway</h1>
                <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-medium">Enterprise Edition</p>
              </div>
              <nav className="space-y-4 text-sm font-medium">
                <a href="#" className="block text-black">系统大盘 (Dashboard)</a>
                <a href="#" className="block text-gray-400 hover:text-black transition-colors">密钥管理 (API Keys)</a>
                <a href="#" className="block text-gray-400 hover:text-black transition-colors">偏好设置 (Settings)</a>
              </nav>
            </div>
            <div className="text-xs text-gray-400">
              V 2.0.4.BUILD_1092
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 max-w-5xl mx-auto p-8 md:p-12 lg:p-16">
            <header className="mb-12 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-serif tracking-tight">全局概览 (Overview)</h2>
                <p className="text-sm text-gray-500 mt-1">管理并监控您的底层 API 调度系统</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium uppercase tracking-widest text-gray-500">系统在线 (System Online)</span>
              </div>
            </header>
            
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
