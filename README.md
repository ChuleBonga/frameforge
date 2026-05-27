# FrameForge

FrameForge is a premium, mobile-first AI video generation prototype for creators. It turns guided wizard choices, such as subject, camera motion, cinematic style, aspect ratio, and duration, into a generated video result with a theater view, local download flow, saved history, and remix controls.

The app is designed around a backend proxy: the browser sends generation choices to a Next.js route handler, and the server decides whether to use free preview mode, local ComfyUI, or the optional NVIDIA route.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide React
- Local ComfyUI integration through a server-side route
- Optional NVIDIA API Catalog integration through a server-side route

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Environment Variables

Create a local env file from the example:

```bash
copy .env.example .env.local
```

Safe default values:

```text
VIDEO_PROVIDER=mock
MOCK_NVIDIA=true
FALLBACK_TO_MOCK=true
MOCK_DELAY_MS=1400

NVIDIA_API_KEY=replace-with-your-rotated-nvidia-key
NVIDIA_IMAGE_ENDPOINT=https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl
NVIDIA_VIDEO_ENDPOINT=https://ai.api.nvidia.com/v1/genai/stabilityai/stable-video-diffusion

LOCAL_COMFY_BASE_URL=http://127.0.0.1:8188
LOCAL_COMFY_WORKFLOW_PATH=workflows/svd-image-to-video.json
```

Use real provider keys only in `.env.local`. Do not commit `.env.local`.

## Preview Mode

FrameForge runs safely in preview/mock mode by default:

```text
VIDEO_PROVIDER=mock
MOCK_NVIDIA=true
FALLBACK_TO_MOCK=true
```

In this mode, the Generate button returns a playable demo video result. This keeps the UI, theater, download, save, and remix flows functional with no setup, no GPU, and no paid API calls.

## Free Local Generation

Mock mode is fully free and works immediately.

Real AI generation for free requires a local GPU/model setup. The recommended free backend is ComfyUI running on your own PC at:

```text
http://127.0.0.1:8188
```

Use local ComfyUI mode with:

```text
VIDEO_PROVIDER=local-comfy
MOCK_NVIDIA=false
FALLBACK_TO_MOCK=true
LOCAL_COMFY_BASE_URL=http://127.0.0.1:8188
LOCAL_COMFY_WORKFLOW_PATH=workflows/svd-image-to-video.json
```

ComfyUI runs on your PC, not on Vercel. Vercel cannot run heavy free video models because those models need local GPU hardware, large model files, and long-running inference. `local-comfy` mode is intended for local development unless you self-host a GPU server and point `LOCAL_COMFY_BASE_URL` at that server.

The local ComfyUI adapter currently performs a health check and workflow lookup. Add a workflow JSON under `workflows/` before wiring full local inference.

## Optional NVIDIA Mode

NVIDIA mode is still available, but real NVIDIA Stable Video Diffusion generation is currently blocked by an account-level `404 Not Found` for this project account.

To attempt NVIDIA generation anyway:

```text
VIDEO_PROVIDER=nvidia
MOCK_NVIDIA=false
FALLBACK_TO_MOCK=true
NVIDIA_API_KEY=your-real-key
```

With fallback enabled, the backend will try the configured NVIDIA image/video pipeline first. If the real provider fails, the app falls back to the preview result so the user flow still completes.

## Security

Provider secrets must stay server-side. Do not put API keys in frontend code, do not prefix them with `NEXT_PUBLIC_`, do not log them, and do not return them from API responses.

The project intentionally reads provider secrets only inside the backend route handler. `.gitignore` protects `.env.local` and other `.env` files from being committed.

## Workflows

ComfyUI workflow JSON files belong in `workflows/`. Model files are not committed because they are large; install them locally inside your ComfyUI installation.

## Verification

Run these before pushing changes:

```bash
npm run lint
npm run build
```
