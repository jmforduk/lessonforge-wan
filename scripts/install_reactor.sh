#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Install ComfyUI-ReActor (faceswap) for LessonForge on an AMD MI300X / ROCm box.
#
# SSH port of the Colab "Cell 2 — Reactor" bootstrap. Key change vs Colab:
#   • Colab uses `onnxruntime-gpu` (CUDA-only). On AMD that won't use the GPU and
#     may fail to import, so we install plain `onnxruntime` (CPU provider) —
#     faceswap on CPU is fast enough for this pipeline.
#
# Usage:   COMFY_DIR=/path/to/ComfyUI bash install_reactor.sh
#   (defaults to ~/ComfyUI, then /content/ComfyUI, then ./ComfyUI)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Locate ComfyUI ───────────────────────────────────────────────────────────
if [ -n "${COMFY_DIR:-}" ]; then
  :
elif [ -d "$HOME/ComfyUI" ]; then
  COMFY_DIR="$HOME/ComfyUI"
elif [ -d "/content/ComfyUI" ]; then
  COMFY_DIR="/content/ComfyUI"
elif [ -d "./ComfyUI" ]; then
  COMFY_DIR="$(pwd)/ComfyUI"
else
  echo "❌ Could not find ComfyUI. Set COMFY_DIR=/path/to/ComfyUI and re-run." >&2
  exit 1
fi
echo "▶ Using ComfyUI at: $COMFY_DIR"

NODE_PATH="$COMFY_DIR/custom_nodes/ComfyUI-ReActor"

# ── Helper: download only if the file is missing ─────────────────────────────
download_if_missing() {
  local url="$1" dest="$2" name="$3"
  if [ -f "$dest" ]; then
    echo "  ✓ $name already present"
  else
    echo "  ↓ downloading $name …"
    # -L follow redirects, --fail on HTTP errors, retry a few times
    curl -L --fail --retry 3 -o "$dest" "$url"
    echo "  ✓ $name done"
  fi
}

# ── 1. Clone the ReActor node (mirror fallback) ──────────────────────────────
if [ ! -d "$NODE_PATH" ]; then
  echo "▶ Cloning ComfyUI-ReActor …"
  git clone https://github.com/Gourieff/comfyui-reactor-node.git "$NODE_PATH" \
    || git clone https://codeberg.org/Gourieff/comfyui-reactor-node.git "$NODE_PATH"
else
  echo "▶ ReActor already cloned — pulling latest"
  git -C "$NODE_PATH" pull --ff-only || true
fi

# ── 2. Python deps ───────────────────────────────────────────────────────────
# Use the same interpreter ComfyUI runs with if a venv is active; else system python3.
PY="${PYTHON:-python3}"
echo "▶ Installing Python requirements with: $PY -m pip"
$PY -m pip install -q -r "$NODE_PATH/requirements.txt" || true
# insightface pinned to 0.7.3 (the version that builds cleanly);
# onnxruntime (CPU) instead of onnxruntime-gpu — the GPU wheel is CUDA-only.
$PY -m pip install -q insightface==0.7.3 onnxruntime

# ── 3. Model directories ─────────────────────────────────────────────────────
mkdir -p "$COMFY_DIR/models/insightface"
mkdir -p "$COMFY_DIR/models/ultralytics/bbox"
mkdir -p "$COMFY_DIR/models/facerestore_models"

# ── 4. Download models (idempotent) ──────────────────────────────────────────
echo "▶ Fetching models …"
download_if_missing \
  "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx" \
  "$COMFY_DIR/models/insightface/inswapper_128.onnx" \
  "inswapper_128.onnx"

download_if_missing \
  "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/detection/bbox/face_yolov8m.pt" \
  "$COMFY_DIR/models/ultralytics/bbox/face_yolov8m.pt" \
  "face_yolov8m.pt"

download_if_missing \
  "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth" \
  "$COMFY_DIR/models/facerestore_models/GFPGANv1.4.pth" \
  "GFPGANv1.4.pth"

echo
echo "✅ ReActor installed. Now RESTART ComfyUI with your usual flags, e.g.:"
echo "     python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header"
echo
echo "   Then verify from anywhere:"
echo "     curl -s http://<host>:8188/object_info/ReActorOptions | head -c 80"
echo "   (should return a real schema, not '{}')"
