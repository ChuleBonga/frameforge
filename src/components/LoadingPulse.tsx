"use client";

import { motion } from "framer-motion";

const loadingMessages = [
  "Allocating NVIDIA GPUs...",
  "Rendering physics...",
  "Finalizing frames...",
];

type LoadingPulseProps = {
  messageIndex: number;
};

export function LoadingPulse({ messageIndex }: LoadingPulseProps) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/58 backdrop-blur-sm">
      <div className="grid w-[min(82%,26rem)] gap-5 text-center">
        <div className="relative mx-auto size-28">
          <motion.div
            className="absolute inset-0 rounded-full bg-cyan-300/25 blur-xl"
            animate={{ scale: [0.85, 1.08, 0.85], opacity: [0.5, 0.95, 0.5] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-3 rounded-full border border-cyan-200/60"
            animate={{ rotate: 360 }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent"
            animate={{ y: [-34, 34, -34] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <p className="text-sm font-medium text-zinc-100">
          {loadingMessages[messageIndex % loadingMessages.length]}
        </p>
      </div>
    </div>
  );
}
