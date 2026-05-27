import { HTMLAttributes } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement>;

export function GlassCard({ className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.05] bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 shadow-2xl shadow-black/55 backdrop-blur-2xl ${className}`}
      {...props}
    />
  );
}
