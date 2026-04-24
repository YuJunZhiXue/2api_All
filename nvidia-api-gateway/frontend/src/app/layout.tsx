import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NVIDIA API GATEWAY // SYS.ADMIN",
  description: "High-Concurrency API Key Scheduler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} antialiased min-h-screen relative overflow-x-hidden`}
      >
        {/* Decorative Grid Corner Accents */}
        <div className="fixed top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00FF41] m-4 z-10 opacity-70"></div>
        <div className="fixed top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00FF41] m-4 z-10 opacity-70"></div>
        <div className="fixed bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00FF41] m-4 z-10 opacity-70"></div>
        <div className="fixed bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00FF41] m-4 z-10 opacity-70"></div>
        
        <main className="relative z-20 max-w-7xl mx-auto p-8 pt-12">
          <header className="mb-12 flex justify-between items-end border-b border-[#27272A] pb-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter text-[#00FF41] uppercase flex items-center gap-3">
                <div className="w-3 h-8 bg-[#00FF41] animate-pulse"></div>
                NVIDIA_GATEWAY_
              </h1>
              <p className="font-mono text-sm text-gray-500 mt-2 uppercase tracking-widest">
                System Status: <span className="text-[#00FF41]">Online</span> // Concurrency Lock: <span className="text-[#00E5FF]">Active</span>
              </p>
            </div>
            <div className="font-mono text-xs text-right text-gray-600 hidden sm:block">
              <div>V 2.0.4.BUILD_1092</div>
              <div>LOC: /ADMIN/SYS</div>
            </div>
          </header>
          
          {children}
        </main>
      </body>
    </html>
  );
}
