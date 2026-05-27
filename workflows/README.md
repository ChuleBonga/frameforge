# ComfyUI Workflows

This folder is for local ComfyUI workflow JSON files used by FrameForge's `local-comfy` provider.

Recommended free local workflow options:

- Stable Video Diffusion image-to-video
- LTX-Video local model
- AnimateDiff workflow

Model files are not committed because they are large. Install model checkpoints, VAEs, custom nodes, and other required assets locally inside your ComfyUI installation.

The default local workflow path is:

```text
workflows/svd-image-to-video.json
```

When that workflow is added, FrameForge can map the wizard prompt into the workflow, submit it to ComfyUI, and return a generated local video reference to the theater.
