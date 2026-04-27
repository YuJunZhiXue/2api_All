"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black">
      {/* Absolute minimalist background noise and subtle gradient overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.05%22/%3E%3C/svg%3E')] pointer-events-none mix-blend-screen opacity-50"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-center z-10"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#333] to-[#111] flex items-center justify-center border border-[#333] shadow-2xl">
            <Terminal size={32} className="text-[#EDEDED]" strokeWidth={1.5} />
          </div>
        </div>
        
        <h1 className="text-6xl md:text-7xl font-display font-semibold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-[#888888]">
          NVIDIA API <br/>
          Gateway Core
        </h1>
        
        <p className="text-[#A1A1AA] max-w-md mx-auto text-base mb-10">
          High-concurrency locking engine & distributed scheduler for enterprise AI workloads.
        </p>

        <Link href="/admin">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-medium rounded-full shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all duration-300"
          >
            <span className="relative z-10 flex items-center gap-2">
              进入调度控制台 <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
}
