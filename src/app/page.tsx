"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Aperture,
  Camera,
  Circle,
  Clapperboard,
  Film,
  History,
  LockKeyhole,
  MoveHorizontal,
  Orbit,
  Satellite,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  ZoomIn,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { LoadingPulse } from "@/components/LoadingPulse";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WizardStep } from "@/components/WizardStep";
import {
  motionLabels,
  styleLabels,
  type CameraMotion,
  type CinematicStyle,
  type GenerationResult,
  type WizardState,
} from "@/lib/video";

const suggestions = ["A lone astronaut", "A sports car", "A fashion model"];

const motionOptions: Array<{
  id: CameraMotion;
  icon: typeof MoveHorizontal;
  description: string;
}> = [
  { id: "pan", icon: MoveHorizontal, description: "Lateral drift" },
  { id: "zoom-in", icon: ZoomIn, description: "Push focus" },
  { id: "drone-orbit", icon: Orbit, description: "Aerial sweep" },
  { id: "static", icon: Circle, description: "Locked frame" },
];

const styleOptions: Array<{
  id: CinematicStyle;
  icon: typeof Aperture;
  description: string;
}> = [
  { id: "cyberpunk", icon: Satellite, description: "Neon contrast" },
  { id: "35mm-film", icon: Aperture, description: "Grain and glow" },
  { id: "anime", icon: Sparkles, description: "Graphic energy" },
  { id: "lo-fi-vhs", icon: Film, description: "Tape texture" },
];

const defaultState: WizardState = {
  subject: "A lone astronaut",
  motion: "drone-orbit",
  style: "35mm-film",
  aspectRatio: "9:16",
  duration: 5,
};

const emptyHistory: GenerationResult[] = [];
const emptySavedIds: string[] = [];
const historyPlaceholders = [undefined, undefined, undefined];

type StorageStateUpdate<T> = T | ((current: T) => T);

function parseStorage<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function getStorageSnapshot(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function subscribeToStorage(key: string, callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const customEventName = `frameforge-storage:${key}`;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === key) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(customEventName, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(customEventName, callback);
  };
}

function useLocalStorageState<T>(key: string, fallback: T) {
  const rawValue = useSyncExternalStore(
    (callback) => subscribeToStorage(key, callback),
    () => getStorageSnapshot(key),
    () => null,
  );
  const value = useMemo(() => parseStorage(rawValue, fallback), [fallback, rawValue]);

  const setValue = (update: StorageStateUpdate<T>) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentValue = parseStorage(getStorageSnapshot(key), fallback);
    const nextValue =
      typeof update === "function"
        ? (update as (current: T) => T)(currentValue)
        : update;

    window.localStorage.setItem(key, JSON.stringify(nextValue));
    window.dispatchEvent(new Event(`frameforge-storage:${key}`));
  };

  return [value, setValue] as const;
}

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function Home() {
  const [wizard, setWizard] = useState<WizardState>(defaultState);
  const [result, setResult] = useState<GenerationResult>();
  const [history, setHistory] = useLocalStorageState("frameforge.history", emptyHistory);
  const [savedIds, setSavedIds] = useLocalStorageState("frameforge.saved", emptySavedIds);
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const [error, setError] = useState("");
  const isMounted = useIsMounted();

  const resultSaved = Boolean(result && savedIds.includes(result.id));

  useEffect(() => {
    if (!generating) {
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingMessage((current) => current + 1);
    }, 1300);

    return () => window.clearInterval(interval);
  }, [generating]);

  function updateWizard(update: Partial<WizardState>) {
    setWizard((current) => ({ ...current, ...update }));
  }

  async function generateVideo() {
    setGenerating(true);
    setLoadingMessage(0);
    setError("");

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wizard),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Generation failed.");
      }

      setResult(payload);
      setHistory((current) => {
        return [payload, ...current].slice(0, 5);
      });
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed. Check the server logs.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function saveResult() {
    if (!result) {
      return;
    }

    setSavedIds((current) => {
      return current.includes(result.id)
        ? current.filter((id) => id !== result.id)
        : [...current, result.id];
    });
  }

  function remixResult() {
    if (!result) {
      return;
    }

    setWizard((current) => ({
      ...current,
      subject: result.prompt.split(" in a cinematic")[0] || current.subject,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.13),transparent_26%),radial-gradient(circle_at_90%_12%,rgba(217,70,239,0.09),transparent_24%),linear-gradient(180deg,#050505_0%,#09090b_48%,#050505_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-rows-[auto_1fr_auto] px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-zinc-100 text-zinc-950 shadow-[0_0_24px_rgba(255,255,255,0.18)]">
              <Clapperboard className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[0.02em] text-white">FrameForge</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Wizard-to-Video Studio
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 backdrop-blur-xl sm:flex">
            <LockKeyhole className="size-3.5 text-zinc-300" />
            Server-side NVIDIA proxy
          </div>
        </header>

        <section className="grid gap-5 py-4 lg:grid-cols-[minmax(21rem,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <GlassCard className="rounded-[1.65rem] p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="max-w-sm text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  Create a cinematic clip.
                </h1>
              </div>
              <div className="hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:block">
                <WandSparkles className="size-5" />
              </div>
            </div>

            <div className="grid gap-6 2xl:gap-8">
              <WizardStep number="01" title="What's the subject?">
                <input
                  suppressHydrationWarning
                  value={wizard.subject}
                  onChange={(event) => updateWizard({ subject: event.target.value })}
                  className="h-11 w-full rounded-xl border border-white/[0.05] bg-black/20 px-4 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-white/10 focus:bg-black/30 focus:ring-1 focus:ring-white/20"
                  placeholder="A lone astronaut"
                />
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => updateWizard({ subject: suggestion })}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                        wizard.subject === suggestion
                          ? "border-transparent bg-zinc-100 font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                          : "border-white/[0.04] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </WizardStep>

              <WizardStep number="02" title="Camera Motion?">
                <div className="grid grid-cols-2 gap-2">
                  {motionOptions.map((option) => {
                    const Icon = option.icon;
                    const active = wizard.motion === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateWizard({ motion: option.id })}
                        className={`min-h-[3.875rem] rounded-xl border p-2.5 text-left transition-all ${
                          active
                            ? "border-transparent bg-zinc-100 font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                            : "border-white/[0.04] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        <Icon className={`mb-1.5 size-4 ${active ? "text-zinc-950" : "text-zinc-500"}`} />
                        <p className={`text-sm font-semibold ${active ? "text-zinc-950" : "text-zinc-200"}`}>
                          {motionLabels[option.id]}
                        </p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-600" : "text-zinc-500"}`}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </WizardStep>

              <WizardStep number="03" title="Cinematic Style?">
                <div className="grid grid-cols-2 gap-2">
                  {styleOptions.map((option) => {
                    const Icon = option.icon;
                    const active = wizard.style === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateWizard({ style: option.id })}
                        className={`min-h-[3.875rem] rounded-xl border p-2.5 text-left transition-all ${
                          active
                            ? "border-transparent bg-zinc-100 font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                            : "border-white/[0.04] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        <Icon className={`mb-1.5 size-4 ${active ? "text-zinc-950" : "text-zinc-500"}`} />
                        <p className={`text-sm font-semibold ${active ? "text-zinc-950" : "text-zinc-200"}`}>
                          {styleLabels[option.id]}
                        </p>
                        <p className={`mt-1 text-xs ${active ? "text-zinc-600" : "text-zinc-500"}`}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </WizardStep>

              <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Format</span>
                  <div className="grid grid-cols-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-1">
                    {(["9:16", "16:9", "1:1"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => updateWizard({ aspectRatio: ratio })}
                        className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                          wizard.aspectRatio === ratio
                            ? "bg-zinc-100 font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                            : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={generateVideo}
                disabled={generating || !wizard.subject.trim()}
                className="group relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-100 px-5 text-sm font-bold tracking-wide text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.2)] ring-1 ring-inset ring-white/70 transition-all hover:scale-[1.02] hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:ring-white/[0.04]"
              >
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 blur-sm transition-transform duration-700 group-hover:translate-x-[420%]" />
                <Sparkles className="relative size-4 transition group-hover:rotate-12" />
                <span className="relative">Generate</span>
              </button>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </GlassCard>

          <div className="grid gap-4">
            <GlassCard className="overflow-hidden rounded-[1.65rem] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Theater</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">
                    {result ? "Render complete" : "Clip preview awaits"}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-xl">
                  <Camera className="size-3.5 text-zinc-300" />
                  {wizard.aspectRatio}
                </div>
              </div>

              <div className="relative">
                <VideoPlayer
                  result={result}
                  onRemix={remixResult}
                  onSave={saveResult}
                  saved={resultSaved}
                />
                <AnimatePresence>
                  {generating ? <LoadingPulse messageIndex={loadingMessage} /> : null}
                </AnimatePresence>
              </div>
            </GlassCard>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
              <GlassCard className="rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-zinc-500" />
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Library
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    {isMounted ? history.length : 0} clips
                  </span>
                </div>

                <div className="grid gap-2">
                  {(isMounted && history.length ? history : historyPlaceholders).map((item, index) =>
                    item ? (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setResult(item)}
                        className="grid grid-cols-[4.2rem_1fr_auto] items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2 text-left transition-all hover:bg-white/[0.06]"
                      >
                        <div className="aspect-video rounded-xl bg-gradient-to-br from-cyan-200/30 via-zinc-800 to-fuchsia-300/20" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-100">
                            {item.prompt.split(".")[0]}
                          </p>
                          <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600">
                            {item.provider}
                          </p>
                        </div>
                        <span className="text-xs text-zinc-600">0{index + 1}</span>
                      </button>
                    ) : (
                      <div
                        key={index}
                        className="grid grid-cols-[4.2rem_1fr] items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2"
                      >
                        <div className="aspect-video rounded-xl bg-white/[0.035]" />
                        <div className="grid gap-2">
                          <span className="h-2 w-4/5 rounded-full bg-white/[0.04]" />
                          <span className="h-2 w-1/3 rounded-full bg-white/[0.03]" />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </GlassCard>

              <GlassCard className="rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-300" />
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Vault</h2>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">API key</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Server environment only</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Storage</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Local library now, Firebase-ready</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Provider</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">NVIDIA NIM adapter</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
