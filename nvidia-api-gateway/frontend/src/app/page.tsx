"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Absolute minimalist background noise overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.08%22/%3E%3C/svg%3E')] pointer-events-none mix-blend-screen opacity-40"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center z-10"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 bg-[#EAEAEA] flex items-center justify-center transform rotate-45">
            <Terminal size={32} className="text-[#050505] -rotate-45" strokeWidth={1} />
          </div>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tighter uppercase mb-6 text-[#EAEAEA]">
          Core <br/>
          <span className="text-[#888888]">Gateway</span>
        </h1>
        
        <p className="text-[#888888] max-w-md mx-auto text-sm tracking-widest uppercase mb-12">
          Nvidia API Distributed Scheduler // High Concurrency Locking Engine
        </p>

        <Link href="/admin">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-transparent text-[#EAEAEA] font-display uppercase tracking-widest text-sm overflow-hidden"
          >
            <span className="absolute inset-0 border border-[#EAEAEA] opacity-50 group-hover:opacity-100 transition-opacity"></span>
            <span className="absolute inset-0 bg-[#EAEAEA] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></span>
            <span className="relative z-10 group-hover:text-[#050505] transition-colors duration-300 flex items-center gap-3">
              进入调度控制台 <ArrowRight size={16} />
            </span>
          </motion.button>
        </Link>
      </motion.div>

      {/* Decorative corner pieces */}
      <div className="absolute top-8 left-8 w-4 h-4 border-t border-l border-[#888888]"></div>
      <div className="absolute top-8 right-8 w-4 h-4 border-t border-r border-[#888888]"></div>
      <div className="absolute bottom-8 left-8 w-4 h-4 border-b border-l border-[#888888]"></div>
      <div className="absolute bottom-8 right-8 w-4 h-4 border-b border-r border-[#888888]"></div>
    </div>
  );
}
