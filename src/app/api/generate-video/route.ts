import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  getMockGeneration,
  motionLabels,
  styleLabels,
  type GenerationProvider,
  type GenerationResult,
  type WizardState,
} from "@/lib/video";

export const runtime = "nodejs";

type ProviderPayload = Record<string, unknown>;
type VideoProvider = GenerationProvider;
type VideoAsset = {
  videoUrl: string;
  url?: string;
  base64?: string;
  mimeType?: string;
};

type ImageAsset = {
  dataUrl?: string;
  base64?: string;
  url?: string;
  mimeType?: string;
};

const videoMimeType = "video/mp4";
const imageMimeType = "image/png";
const directImagePayloadLimit = 180_000;
const nvcfAssetsEndpoint = "https://api.nvcf.nvidia.com/v2/nvcf/assets";
const defaultImageEndpoint =
  "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl";
const defaultFallbackImageEndpoint =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";
const defaultVideoEndpoint =
  "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-video-diffusion";
const defaultLocalComfyBaseUrl = "http://127.0.0.1:8188";
const defaultLocalComfyWorkflowPath = "workflows/svd-image-to-video.json";
const validAspectRatios = new Set<WizardState["aspectRatio"]>(["9:16", "16:9", "1:1"]);

function hasRecordKey<T extends Record<string, unknown>>(
  record: T,
  key: unknown,
): key is keyof T {
  return typeof key === "string" && key in record;
}

function isWizardState(input: unknown): input is WizardState {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<WizardState>;

  return (
    typeof candidate.subject === "string" &&
    hasRecordKey(motionLabels, candidate.motion) &&
    hasRecordKey(styleLabels, candidate.style) &&
    typeof candidate.aspectRatio === "string" &&
    validAspectRatios.has(candidate.aspectRatio as WizardState["aspectRatio"]) &&
    typeof candidate.duration === "number"
  );
}

function buildCreatorPrompt(state: WizardState) {
  const subject = state.subject.trim() || "A lone astronaut";
  const cropInstruction =
    state.aspectRatio === "1:1" ? "center-safe for a square social crop" : undefined;

  return [
    `A cinematic shot of ${subject}`,
    motionLabels[state.motion].toLowerCase(),
    `in the style of ${styleLabels[state.style]}`,
    `composed for ${state.aspectRatio} creator video`,
    cropInstruction,
    "rich lighting, smooth motion, high detail",
    "no text, no logos, no watermarks",
  ]
    .filter(Boolean)
    .join(", ");
}

function buildImagePayload(prompt: string, endpoint: string): ProviderPayload {
  if (endpoint.includes("black-forest-labs/flux.1-schnell")) {
    return {
      prompt,
      height: 1024,
      width: 1024,
      cfg_scale: 0,
      mode: "base",
      samples: 1,
      seed: 0,
      steps: 4,
    };
  }

  return {
    text_prompts: [{ text: prompt }],
    steps: 30,
  };
}

function buildNvidiaVideoPayload(image: string): ProviderPayload {
  return {
    image,
    cfg_scale: 2.5,
    seed: 0,
  };
}

function getString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function extractVideoAsset(payload: unknown): VideoAsset | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const directBase64 = getString(record, ["base64", "video_base64", "videoBase64"]);
  if (directBase64) {
    const mimeType = getString(record, ["mime_type", "mimeType", "content_type"]) ?? videoMimeType;
    return {
      videoUrl: directBase64.startsWith("data:")
        ? directBase64
        : `data:${mimeType};base64,${directBase64}`,
      base64: directBase64,
      mimeType,
    };
  }

  const output = record.output as Record<string, unknown> | undefined;
  const result = record.result as Record<string, unknown> | undefined;
  const video = record.video as Record<string, unknown> | undefined;

  const directCandidates = [
    record.video_url,
    record.videoUrl,
    record.url,
    record.output_url,
    record.outputUrl,
    video?.url,
    output?.video_url,
    output?.videoUrl,
    output?.url,
    result?.video_url,
    result?.videoUrl,
    result?.url,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return { videoUrl: candidate, url: candidate };
    }
  }

  for (const nestedRecord of [output, result]) {
    const nestedOutputBase64 = getString(nestedRecord ?? {}, [
      "base64",
      "video_base64",
      "videoBase64",
    ]);
    if (nestedOutputBase64) {
      const mimeType =
        getString(nestedRecord ?? {}, ["mime_type", "mimeType", "content_type"]) ?? videoMimeType;
      return {
        videoUrl: nestedOutputBase64.startsWith("data:")
          ? nestedOutputBase64
          : `data:${mimeType};base64,${nestedOutputBase64}`,
        base64: nestedOutputBase64,
        mimeType,
      };
    }
  }

  const scanArrays = [record.data, record.artifacts, record.outputs];
  for (const value of scanArrays) {
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (item && typeof item === "object") {
        const itemRecord = item as Record<string, unknown>;
        const itemUrl = getString(itemRecord, ["url", "video_url", "videoUrl"]);
        if (itemUrl) {
          return { videoUrl: itemUrl, url: itemUrl };
        }

        const itemBase64 = getString(itemRecord, ["base64", "video_base64", "videoBase64"]);
        if (itemBase64) {
          const mimeType =
            getString(itemRecord, ["mime_type", "mimeType", "content_type"]) ?? videoMimeType;
          return {
            videoUrl: itemBase64.startsWith("data:")
              ? itemBase64
              : `data:${mimeType};base64,${itemBase64}`,
            base64: itemBase64,
            mimeType,
          };
        }
      }
    }
  }

  return undefined;
}

function extractImageAsset(payload: unknown): ImageAsset | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const directImage = getString(record, ["image", "image_base64", "imageBase64", "base64"]);
  if (directImage) {
    const mimeType = getString(record, ["mime_type", "mimeType", "content_type"]) ?? imageMimeType;
    return directImage.startsWith("data:")
      ? { dataUrl: directImage, mimeType }
      : { base64: directImage, mimeType };
  }

  const directUrl = getString(record, ["image_url", "imageUrl", "url"]);
  if (directUrl) {
    return { url: directUrl };
  }

  const output = record.output;
  if (output && typeof output === "object") {
    const outputRecord = output as Record<string, unknown>;
    const outputImage = getString(outputRecord, ["image", "image_base64", "imageBase64", "base64"]);
    if (outputImage) {
      const mimeType =
        getString(outputRecord, ["mime_type", "mimeType", "content_type"]) ?? imageMimeType;
      return outputImage.startsWith("data:")
        ? { dataUrl: outputImage, mimeType }
        : { base64: outputImage, mimeType };
    }

    const outputUrl = getString(outputRecord, ["image_url", "imageUrl", "url"]);
    if (outputUrl) {
      return { url: outputUrl };
    }
  }

  for (const key of ["artifacts", "data", "images"] as const) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const itemRecord = item as Record<string, unknown>;
      const image = getString(itemRecord, ["image", "image_base64", "imageBase64", "base64"]);
      if (image) {
        const mimeType =
          getString(itemRecord, ["mime_type", "mimeType", "content_type"]) ?? imageMimeType;
        return image.startsWith("data:")
          ? { dataUrl: image, mimeType }
          : { base64: image, mimeType };
      }

      const url = getString(itemRecord, ["image_url", "imageUrl", "url"]);
      if (url) {
        return { url };
      }
    }
  }

  return undefined;
}

function ensureImageDataUrl(base64OrDataUrl: string, mimeType = imageMimeType) {
  if (base64OrDataUrl.startsWith("data:image/")) {
    return base64OrDataUrl;
  }

  const base64 = base64OrDataUrl.includes(",")
    ? base64OrDataUrl.split(",").pop()
    : base64OrDataUrl;

  return `data:${mimeType};base64,${base64}`;
}

async function resolveImageDataUrl(asset: ImageAsset) {
  if (asset.dataUrl) {
    return asset.dataUrl;
  }

  if (asset.base64) {
    return ensureImageDataUrl(asset.base64, asset.mimeType ?? imageMimeType);
  }

  if (!asset.url) {
    return undefined;
  }

  const imageResponse = await fetch(asset.url);
  if (!imageResponse.ok) {
    throw new Error(`Generated image URL could not be fetched (${imageResponse.status}).`);
  }

  const contentType = (imageResponse.headers.get("content-type") ?? imageMimeType)
    .split(";")[0]
    .trim();
  const imageBytes = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(imageBytes).toString("base64");

  return ensureImageDataUrl(base64, contentType);
}

function parseImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(dataUrl);

  if (!match) {
    return undefined;
  }

  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");

  return { mimeType, base64, bytes };
}

function summarizeProviderPayload(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.length <= 500) {
      return value;
    }

    return `${value.slice(0, 160)}...[${value.length} chars]`;
  }

  if (depth > 3) {
    return "[nested payload]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => summarizeProviderPayload(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 12)
        .map(([key, item]) => [key, summarizeProviderPayload(item, depth + 1)]),
    );
  }

  return undefined;
}

function errorDetails(value: unknown) {
  return JSON.stringify(summarizeProviderPayload(value) ?? "No provider payload.");
}

function getProviderFromEnv(): VideoProvider {
  const configuredProvider = process.env.VIDEO_PROVIDER?.toLowerCase();
  if (
    configuredProvider === "mock" ||
    configuredProvider === "nvidia" ||
    configuredProvider === "local-comfy"
  ) {
    return configuredProvider;
  }

  return process.env.MOCK_NVIDIA === "false" ? "nvidia" : "mock";
}

function getMockDelay() {
  const configuredDelay = Number(process.env.MOCK_DELAY_MS ?? 1400);
  return Number.isFinite(configuredDelay) ? Math.min(Math.max(configuredDelay, 0), 5000) : 1400;
}

function getFallbackGeneration(state: WizardState, prompt: string) {
  return {
    ...getMockGeneration(state),
    prompt,
  };
}

function getUniqueImageEndpoints(primaryEndpoint: string) {
  return [primaryEndpoint, defaultFallbackImageEndpoint].filter(
    (endpoint, index, endpoints) => endpoints.indexOf(endpoint) === index,
  );
}

async function createNvcfAsset(apiKey: string, contentType: string, description: string) {
  const response = await fetch(nvcfAssetsEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType, description }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(
      `NVIDIA asset creation failed (${response.status}): ${errorDetails(
        payload ?? response.statusText,
      )}`,
    );
  }

  const record = payload as Record<string, unknown>;
  const assetId = getString(record, ["assetId", "asset_id", "id"]);
  const uploadUrl = getString(record, ["uploadUrl", "upload_url", "url"]);

  if (!assetId || !uploadUrl) {
    throw new Error("NVIDIA asset creation response did not include an asset id and upload URL.");
  }

  return { assetId, uploadUrl };
}

async function uploadNvcfAsset(
  uploadUrl: string,
  bytes: Buffer,
  contentType: string,
  description: string,
) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-meta-nvcf-asset-description": description,
    },
    body: new Blob([new Uint8Array(bytes)], { type: contentType }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA asset upload failed (${response.status}): ${response.statusText}`);
  }
}

async function deleteNvcfAsset(apiKey: string, assetId: string) {
  await fetch(`${nvcfAssetsEndpoint}/${assetId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }).catch(() => undefined);
}

async function prepareImageForVideo(imageDataUrl: string, apiKey: string) {
  const parsed = parseImageDataUrl(imageDataUrl);

  if (!parsed || parsed.bytes.byteLength <= directImagePayloadLimit) {
    return { image: imageDataUrl };
  }

  const description = "FrameForge Stable Video Diffusion source image";
  const { assetId, uploadUrl } = await createNvcfAsset(apiKey, parsed.mimeType, description);

  await uploadNvcfAsset(uploadUrl, parsed.bytes, parsed.mimeType, description);

  return {
    image: `data:${parsed.mimeType};asset_id,${assetId}`,
    assetId,
  };
}

async function requestImageGeneration(apiKey: string, prompt: string, endpoint: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildImagePayload(prompt, endpoint)),
  });

  const payload = await response.json().catch(() => null);

  return { endpoint, response, payload };
}

async function generateWithNvidia(state: WizardState, prompt: string): Promise<GenerationResult> {
  const imageEndpoint = process.env.NVIDIA_IMAGE_ENDPOINT ?? defaultImageEndpoint;
  const videoEndpoint = process.env.NVIDIA_VIDEO_ENDPOINT ?? defaultVideoEndpoint;
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured on the server.");
  }

  let imageResult: Awaited<ReturnType<typeof requestImageGeneration>> | undefined;

  for (const endpoint of getUniqueImageEndpoints(imageEndpoint)) {
    const candidate = await requestImageGeneration(apiKey, prompt, endpoint);
    imageResult = candidate;

    if (candidate.response.ok || candidate.response.status !== 404) {
      break;
    }
  }

  if (!imageResult) {
    throw new Error("NVIDIA image generation could not be started.");
  }

  const { response: imageResponse, payload: imagePayload } = imageResult;

  if (!imageResponse.ok) {
    throw new Error(
      `NVIDIA image generation failed (${imageResponse.status}): ${errorDetails(
        imagePayload ?? imageResponse.statusText,
      )}`,
    );
  }

  const imageAsset = extractImageAsset(imagePayload);

  if (!imageAsset) {
    throw new Error(
      `NVIDIA image response did not include an image asset: ${errorDetails(imagePayload)}`,
    );
  }

  const imageDataUrl = await resolveImageDataUrl(imageAsset);

  if (!imageDataUrl) {
    throw new Error("Generated image could not be converted to a data URL.");
  }

  const videoInput = await prepareImageForVideo(imageDataUrl, apiKey);
  const videoHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (videoInput.assetId) {
    videoHeaders["NVCF-INPUT-ASSET-REFERENCES"] = videoInput.assetId;
  }

  let videoResponse: Response | undefined;
  let videoPayload: unknown;

  try {
    videoResponse = await fetch(videoEndpoint, {
      method: "POST",
      headers: videoHeaders,
      body: JSON.stringify(buildNvidiaVideoPayload(videoInput.image)),
    });

    videoPayload = await videoResponse.json().catch(() => null);
  } finally {
    if (videoInput.assetId) {
      await deleteNvcfAsset(apiKey, videoInput.assetId);
    }
  }

  if (!videoResponse?.ok) {
    throw new Error(
      `NVIDIA video generation failed (${videoResponse?.status ?? "unknown"}): ${errorDetails(
        videoPayload ?? videoResponse?.statusText,
      )}`,
    );
  }

  const videoAsset = extractVideoAsset(videoPayload);

  if (!videoAsset) {
    throw new Error(
      `NVIDIA video response did not include a video asset: ${errorDetails(videoPayload)}`,
    );
  }

  return {
    id: crypto.randomUUID(),
    prompt,
    videoUrl: videoAsset.videoUrl,
    url: videoAsset.url,
    base64: videoAsset.base64,
    mimeType: videoAsset.mimeType,
    createdAt: new Date().toISOString(),
    provider: "nvidia",
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLocalComfyBaseUrl() {
  return (process.env.LOCAL_COMFY_BASE_URL ?? defaultLocalComfyBaseUrl).replace(/\/$/, "");
}

function getLocalComfyWorkflowFileName() {
  return basename(process.env.LOCAL_COMFY_WORKFLOW_PATH ?? defaultLocalComfyWorkflowPath);
}

async function assertLocalComfyReady(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/system_stats`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI health check returned ${response.status}.`);
    }
  } catch {
    throw new Error("Local ComfyUI is not running. Start ComfyUI on port 8188 and try again.");
  }
}

async function loadLocalComfyWorkflow() {
  const workflowPath = join(process.cwd(), "workflows", getLocalComfyWorkflowFileName());

  try {
    const workflow = await readFile(workflowPath, "utf8");
    return JSON.parse(workflow) as ProviderPayload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Local ComfyUI workflow JSON is invalid.");
    }

    return undefined;
  }
}

async function generateWithLocalComfy(
  state: WizardState,
  prompt: string,
): Promise<GenerationResult> {
  void state;
  void prompt;

  const baseUrl = getLocalComfyBaseUrl();

  await assertLocalComfyReady(baseUrl);

  const workflow = await loadLocalComfyWorkflow();

  if (!workflow) {
    throw new Error(
      "Local ComfyUI workflow is not configured yet. Add a workflow JSON file under workflows/ and try again.",
    );
  }

  // TODO: inject the FrameForge prompt into an SVD, LTX-Video local model, or AnimateDiff
  // ComfyUI workflow JSON, POST it to /prompt, poll /history, and map the generated file
  // into a browser-playable /view URL for the theater/download flow.
  throw new Error(
    "Local ComfyUI workflow execution is not wired yet. Add the workflow node mapping before running local AI generation.",
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isWizardState(body)) {
    return NextResponse.json({ error: "Invalid wizard payload." }, { status: 400 });
  }

  const prompt = buildCreatorPrompt(body);
  const provider = getProviderFromEnv();
  const fallbackToMock = process.env.FALLBACK_TO_MOCK !== "false";

  if (provider === "mock") {
    await wait(getMockDelay());
    return NextResponse.json(getFallbackGeneration(body, prompt));
  }

  try {
    const result =
      provider === "local-comfy"
        ? await generateWithLocalComfy(body, prompt)
        : await generateWithNvidia(body, prompt);

    return NextResponse.json(result);
  } catch (error) {
    if (fallbackToMock) {
      return NextResponse.json(getFallbackGeneration(body, prompt));
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : `${provider.toUpperCase()} video generation failed.`,
      },
      { status: 502 },
    );
  }
}
