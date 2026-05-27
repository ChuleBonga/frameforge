# FrameForge

FrameForge is a premium, mobile-first AI video generation prototype for creators. It turns guided wizard choices, such as subject, camera motion, cinematic style, aspect ratio, and duration, into a generated video result with a theater view, local download flow, saved history, and remix controls.

The app is designed around a secure backend proxy: the browser never receives the NVIDIA API key. The frontend sends generation choices to a Next.js route handler, and the server decides whether to use preview/mock mode or attempt NVIDIA-hosted generation.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide React
- NVIDIA API Catalog integration through a server-side route
- LTX text-to-video integration through a server-side route

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

Required variables:

```text
VIDEO_PROVIDER=mock
MOCK_NVIDIA=true
FALLBACK_TO_MOCK=true
MOCK_DELAY_MS=1400

NVIDIA_API_KEY=replace-with-your-rotated-nvidia-key
NVIDIA_IMAGE_ENDPOINT=https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl
NVIDIA_VIDEO_ENDPOINT=https://ai.api.nvidia.com/v1/genai/stabilityai/stable-video-diffusion

LTX_API_KEY=replace-with-your-ltx-key
LTX_MODE=async
LTX_ENDPOINT=https://api.ltx.video/v2/text-to-video
LTX_MODEL=ltx-2-3-fast
LTX_DURATION_SECONDS=6
LTX_POLL_INTERVAL_MS=5000
LTX_MAX_POLL_ATTEMPTS=18
```

Use real provider keys only in `.env.local`. Do not commit `.env.local`.

## Preview Mode

FrameForge currently runs safely in preview/mock mode by default:

```text
VIDEO_PROVIDER=mock
MOCK_NVIDIA=true
```

In this mode, the Generate button returns a playable demo video result. This keeps the UI, theater, download, save, and remix flows functional without spending API credits or depending on NVIDIA video endpoint availability.

## Real Provider Setup

Preview mode works without paid API calls and is the safest default for local development:

```text
VIDEO_PROVIDER=mock
MOCK_NVIDIA=true
FALLBACK_TO_MOCK=true
```

NVIDIA mode is still available, but real NVIDIA video generation is currently blocked by an account-level Stable Video Diffusion `404 Not Found` for this project account.

LTX mode is the preferred real test path. For real LTX testing, set:

```text
VIDEO_PROVIDER=ltx
MOCK_NVIDIA=false
FALLBACK_TO_MOCK=false
LTX_API_KEY=your-key
LTX_MODE=async
```

The default LTX async path submits a text-to-video job to `https://api.ltx.video/v2/text-to-video`, polls for completion, and uses the returned video URL. The sync path is also supported with `LTX_MODE=sync` for shorter experiments where a single HTTP response can return the MP4.

## Real NVIDIA Mode

To attempt real NVIDIA generation, update `.env.local`:

```text
VIDEO_PROVIDER=nvidia
MOCK_NVIDIA=false
FALLBACK_TO_MOCK=true
```

With fallback enabled, the backend will try the configured NVIDIA image/video pipeline first. If the real provider fails, the app falls back to the preview result so the user flow still completes.

Set this only when you have valid server-side NVIDIA credentials and endpoint access:

```text
NVIDIA_API_KEY=your-real-key
```

## Security

`NVIDIA_API_KEY` and `LTX_API_KEY` must stay server-side. Do not put provider keys in frontend code, do not prefix them with `NEXT_PUBLIC_`, do not log them, and do not return them from API responses.

The project intentionally reads provider secrets only inside the backend route handler. `.gitignore` protects `.env.local` and other `.env` files from being committed.

## Known Blocker

The real NVIDIA Stable Video Diffusion endpoint currently returns an account-level `404 Not Found` for this API account. Until the account has access to a working NVIDIA-hosted video endpoint, use preview/mock mode for a fully functional local demo.

## Verification

Run these before pushing changes:

```bash
npm run lint
npm run build
```
