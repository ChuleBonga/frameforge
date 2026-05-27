export type CameraMotion = "pan" | "zoom-in" | "drone-orbit" | "static";
export type CinematicStyle = "cyberpunk" | "35mm-film" | "anime" | "lo-fi-vhs";
export type AspectRatio = "9:16" | "16:9" | "1:1";

export type WizardState = {
  subject: string;
  motion: CameraMotion;
  style: CinematicStyle;
  aspectRatio: AspectRatio;
  duration: number;
};

export type GenerationResult = {
  id: string;
  prompt: string;
  videoUrl: string;
  url?: string;
  base64?: string;
  mimeType?: string;
  posterUrl?: string;
  createdAt: string;
  provider: "nvidia" | "mock";
};

export const motionLabels: Record<CameraMotion, string> = {
  pan: "Pan",
  "zoom-in": "Zoom In",
  "drone-orbit": "Drone Orbit",
  static: "Static",
};

export const styleLabels: Record<CinematicStyle, string> = {
  cyberpunk: "Cyberpunk",
  "35mm-film": "35mm Film",
  anime: "Anime",
  "lo-fi-vhs": "Lo-Fi VHS",
};

const motionDirectives: Record<CameraMotion, string> = {
  pan: "a slow horizontal camera pan with smooth parallax",
  "zoom-in": "a deliberate cinematic push-in toward the subject",
  "drone-orbit": "a graceful aerial orbit around the subject",
  static: "a locked-off camera with subtle atmospheric movement",
};

const styleDirectives: Record<CinematicStyle, string> = {
  cyberpunk: "neon reflections, wet streets, high contrast cyberpunk lighting",
  "35mm-film": "natural 35mm film grain, warm highlights, tactile cinematic color",
  anime: "premium anime key art, clean motion, expressive lighting",
  "lo-fi-vhs": "lo-fi VHS texture, mild chromatic aberration, nostalgic scanlines",
};

export function compileVideoPrompt(state: WizardState) {
  const subject = state.subject.trim() || "A lone astronaut";

  return [
    `${subject} in a cinematic 5-second social video`,
    motionDirectives[state.motion],
    styleDirectives[state.style],
    `framed for ${state.aspectRatio} creator distribution`,
    "clear subject silhouette, rich environment detail, physically plausible motion",
    "no text, no logos, no watermarks, no distorted faces, no extra limbs",
  ].join(". ");
}

export function getMockGeneration(state: WizardState): GenerationResult {
  return {
    id: crypto.randomUUID(),
    prompt: compileVideoPrompt(state),
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    mimeType: "video/mp4",
    posterUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    createdAt: new Date().toISOString(),
    provider: "mock",
  };
}
