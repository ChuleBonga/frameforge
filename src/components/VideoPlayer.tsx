"use client";

import { useRef, useState } from "react";
import { Bookmark, Download, Loader2, Pause, Play, RefreshCcw } from "lucide-react";
import type { GenerationResult } from "@/lib/video";

type VideoPlayerProps = {
  result?: GenerationResult;
  onRemix: () => void;
  onSave: () => void;
  saved: boolean;
};

const DEFAULT_VIDEO_MIME = "video/mp4";

const providerLabels = {
  mock: "Preview Mode",
  nvidia: "NVIDIA Render",
  "local-comfy": "Local ComfyUI",
} satisfies Record<GenerationResult["provider"], string>;

function isRawBase64(source: string) {
  const trimmed = source.trim();

  return (
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("blob:") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("/") &&
    /^[A-Za-z0-9+/=\s]+$/.test(trimmed)
  );
}

function dataUrlToMimeType(source: string) {
  const match = source.match(/^data:([^;,]+)[;,]/);
  return match?.[1];
}

function getPlayableSource(result?: GenerationResult) {
  if (!result) {
    return undefined;
  }

  if (isRawBase64(result.videoUrl)) {
    return `data:${result.mimeType ?? DEFAULT_VIDEO_MIME};base64,${result.videoUrl}`;
  }

  return result.videoUrl;
}

function base64ToBlob(source: string, mimeType = DEFAULT_VIDEO_MIME) {
  const normalized = source.includes(",") ? source.split(",").pop() ?? "" : source;
  const binary = window.atob(normalized.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getFileExtension(blob: Blob, source: string) {
  const mimeType = blob.type || dataUrlToMimeType(source);
  if (mimeType?.includes("webm")) {
    return "webm";
  }
  if (mimeType?.includes("quicktime")) {
    return "mov";
  }
  if (mimeType?.includes("gif")) {
    return "gif";
  }

  return "mp4";
}

function getDownloadFileName(result: GenerationResult, blob: Blob) {
  const promptStem = result.prompt
    .split(".")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 46);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = getFileExtension(blob, result.videoUrl);

  return `frameforge-${promptStem || "render"}-${timestamp}.${extension}`;
}

async function getVideoBlob(result: GenerationResult) {
  const source = getPlayableSource(result);

  if (!source) {
    throw new Error("No generated video source is available.");
  }

  if (source.startsWith("data:")) {
    const response = await fetch(source);
    return response.blob();
  }

  if (isRawBase64(source)) {
    return base64ToBlob(source, result.mimeType ?? DEFAULT_VIDEO_MIME);
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not download video asset (${response.status}).`);
  }

  return response.blob();
}

export function VideoPlayer({ result, onRemix, onSave, saved }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const playableSource = getPlayableSource(result);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || !result) {
      return;
    }

    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleDownload = async () => {
    if (!result || downloading) {
      return;
    }

    setDownloading(true);
    let objectUrl: string | undefined;

    try {
      const blob = await getVideoBlob(result);
      objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getDownloadFileName(result, blob);
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Video download failed", error);
      window.alert("Could not prepare the video download. Please try again.");
    } finally {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
      setDownloading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[1.45rem] border border-white/[0.05] bg-black shadow-2xl shadow-black/70">
      {result ? (
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          src={playableSource}
          poster={result.posterUrl}
          loop
          playsInline
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      ) : (
        <div
          className="relative aspect-video w-full overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(0,0,0,0.38), rgba(0,0,0,0.08)), url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_26%),linear-gradient(135deg,rgba(5,5,5,0.18)_0%,rgba(20,20,20,0.08)_45%,rgba(3,7,18,0.26)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.06)_48%,transparent_51%)]" />
        </div>
      )}

      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-black/45 p-2.5 shadow-2xl shadow-black/45 backdrop-blur-2xl">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!result}
          className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-950 shadow-[0_0_18px_rgba(255,255,255,0.16)] transition-all hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-zinc-500 disabled:shadow-none"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-100">
            {result ? "Final render" : "Preview theater"}
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {result ? providerLabels[result.provider] : "Ready for generation"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!result || downloading}
            title="Download HD"
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.03] px-3 text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Download HD"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span className="hidden text-xs font-semibold xl:inline">
              {downloading ? "Saving..." : "Download HD"}
            </span>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!result}
            title={saved ? "Saved" : "Save to Library"}
            className={`flex h-10 items-center justify-center gap-2 rounded-full border px-3 transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
              saved
                ? "border-transparent bg-zinc-100 text-zinc-950 shadow-[0_0_18px_rgba(255,255,255,0.14)]"
                : "border-white/[0.05] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            }`}
            aria-label={saved ? "Saved" : "Save to Library"}
          >
            <Bookmark className={`size-4 ${saved ? "fill-zinc-950 text-zinc-950" : ""}`} />
            <span className="hidden text-xs font-semibold xl:inline">{saved ? "Saved" : "Save"}</span>
          </button>
          <button
            type="button"
            onClick={onRemix}
            disabled={!result}
            title="Remix"
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.03] px-3 text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Remix"
          >
            <RefreshCcw className="size-4" />
            <span className="hidden text-xs font-semibold xl:inline">Remix</span>
          </button>
        </div>
      </div>
    </div>
  );
}
