# 🎬 LessonForge — AI Showrunner

**Turn a lesson brief into a finished, shot-by-shot video lesson. Qwen agents direct it, Wan renders it — all on Alibaba Cloud.**

> Built for the **Global AI Hackathon with Qwen Cloud** · Track 2: **AI Showrunner**
> Agentic pipeline on **Qwen** · Video generation with **Wan 2.7 (Tongyi Wanxiang)** · Backend on **Alibaba Cloud Function Compute**

---

## What is it?

LessonForge is an **autonomous AI Showrunner** for education. A teacher types a topic and a few learning objectives; the system does the rest:

1. **Qwen** (the director) writes a structured, shot-by-shot plan — a voiceover script, cinematic visual prompt, and continuity notes for every scene.
2. The teacher **reviews** the plan (human-in-the-loop gate).
3. **Wan 2.7** (the camera) renders each shot into a real video clip — with **native audio/voice** and **character consistency** built in.
4. Out comes a ready-to-use lesson: playable clips plus a print-ready PDF pack.

**Author once → the agents produce it.** No film crew, no editing suite, no GPU wrangling.

---

## Why Qwen + Wan

The whole point of the AI Showrunner track is an autonomous *script → storyboard → video → edit* pipeline. Qwen and Wan collapse that into two clean stages:

| Stage | Model | What it does |
|-------|-------|--------------|
| **Direct** | **Qwen-Plus** (OpenAI-compatible chat) | Multi-agent shot planning: curriculum structure, scene continuity, and render-safe cinematic prompts. |
| **Render** | **Wan 2.7** `t2v` / `i2v` | Text/image-to-video with **native audio** (speaks quoted dialogue) and **reference-to-video** for consistent characters — no separate faceswap/TTS chain needed. |

> Earlier versions of this project used a multi-stage local GPU pipeline (ComfyUI + LTX-2 + ReActor faceswap). **Wan 2.7 replaces that entire chain** — voice, motion, and character consistency are native, so the pipeline is dramatically simpler and fully cloud-hosted.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)  —  Cloudflare Pages                   │
│  • Create Lesson  • Editing Suite (review → render)  • Player   │
│  No API keys in the browser — everything goes through backend  │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTPS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Backend  —  Alibaba Cloud Function Compute (Node, web fn)     │
│  Holds DASHSCOPE_API_KEY server-side. Routes:                  │
│    GET  /healthz            liveness + reachable models        │
│    POST /api/agent          → Qwen  (shot-plan / script)       │
│    POST /api/video          → Wan   (async create → task_id)   │
│    GET  /api/video/:taskId  → poll  → { status, videoUrl }     │
└───────────────────────────┬──────────────────────────────────┘
                            │  DashScope (Singapore / International)
                            ▼
        Qwen-Plus  ·  Wan 2.7  (Alibaba Cloud Model Studio)
```

**Design principle:** the DashScope API key lives **only** on the Function Compute backend. The frontend never sees it — it just calls `/api/agent` and `/api/video`.

---

## The pipeline

```
Teacher enters topic + objectives + picks an Educator / Location
        ↓
Qwen agents build the Shot Plan
(voiceover script + render-safe cinematic prompt + continuity per shot)
        ↓
REVIEW  — teacher approves stills + transcripts   ← human-in-the-loop gate
        ↓
Wan 2.7 renders each approved shot → video clip (native audio + consistent character)
        ↓
Playable lesson  +  print-ready PDF lesson pack
```

---

## Features

- **🤖 Qwen multi-agent planning** — curriculum architecture, scene continuity, and prompt engineering, returned as strict JSON.
- **🎥 Wan 2.7 rendering** — text- and image-to-video with native audio; async create → poll → MP4.
- **🧑‍🏫 Reusable Educators & Locations** — define presenters (portrait, gender, accent) and settings once; reuse everywhere. `@slug` injection resolves visual descriptions into prompts.
- **🗣️ Voice control** — educator gender + accent flow into Wan's audio synthesis for consistent vocal delivery.
- **✅ Review Phase** — generate lightweight preview stills first, approve, *then* commit to video. Saves render time and catches mistakes early.
- **🖥️ Split-screen mode** — talking-head presenter (left) + a **person-free** scene clip (right), for places a presenter can't physically be.
- **📄 PDF lesson packs** — export print-ready handouts alongside the video.
- **🧹 Render-safe prompts** — a sanitisation layer strips product jargon and on-frame-text instructions so the video model never hallucinates gibberish text.
- **🎛️ Demo Mode** — preset lessons + sample assets to explore the flow with no backend configured.

---

## Getting started

### Prerequisites
- Node 18+
- An **Alibaba Cloud Model Studio (DashScope)** API key with access to **Qwen** and **Wan** (Singapore / International region).

### 1. Frontend (local dev)

```bash
npm install
npm run dev
```

Open the app → **Settings** and set:
- **Alibaba Cloud backend URL** — where your Function Compute backend is deployed (or `http://localhost:9000` when running the backend locally).
- **Qwen agent model** — default `qwen-plus`.
- **Wan model** — default `wan2.7-t2v`.

Then hit **Test connection** to verify the backend + models are reachable.

> Prefer to try it without a backend? Toggle **Demo Mode**.

### 2. Backend (local)

```bash
cd backend
export DASHSCOPE_API_KEY=sk-...        # your Model Studio key — server-side only
node index.mjs                          # listens on :9000
curl localhost:9000/healthz             # { ok: true, ... }
```

### 3. Deploy the backend to Alibaba Cloud Function Compute

The backend is a plain Node **web function** (listens on `$FC_SERVER_PORT || 9000`).

1. Create a Function Compute **web function** (Node runtime).
2. Set the environment variable **`DASHSCOPE_API_KEY`** in the function config.
3. Deploy `backend/index.mjs` as the entry.
4. Point the frontend's **Alibaba Cloud backend URL** at the function's public HTTP endpoint.
5. Hit `/healthz` — a `200` with `keyPresent: true` is your **deployment proof** for judging.

---

## Configuration

| Setting (in-app) | Purpose | Default |
|------------------|---------|---------|
| Alibaba Cloud backend URL | Where the Function Compute backend lives | — |
| Qwen agent model | Chat model for the planning agents | `qwen-plus` |
| Wan model | Video model | `wan2.7-t2v` |

**Secrets:** the DashScope key is **never** committed and **never** sent to the browser — it lives only as `DASHSCOPE_API_KEY` on the backend. `.env` is git-ignored.

---

## Tech stack

- **Frontend:** React + Vite + Tailwind (Cloudflare Pages)
- **Agents:** Qwen-Plus via DashScope OpenAI-compatible endpoint
- **Video:** Wan 2.7 (`t2v` / `i2v`) via DashScope async video-synthesis
- **Backend:** Node web function on **Alibaba Cloud Function Compute**
- **Storage:** browser `localStorage` (lessons, educators, locations, settings)

---

## Project layout

```
lessonforge-wan/
├── backend/
│   └── index.mjs          # Function Compute web fn: /healthz /api/agent /api/video
├── src/
│   ├── lib/
│   │   ├── wan.js         # renderShot() — Qwen+Wan render lib (calls the backend)
│   │   ├── generateShotPlan.js  # Qwen shot-plan generator (via /api/agent)
│   │   ├── exportPDF.js / exportLessonMp4.js
│   │   └── storage.js / promptKnowledge.js / demoShotPlan.js
│   └── components/        # Home, EditingSuite, LessonPlayer, Settings, …
├── index.html
└── package.json
```

---

*Built with Qwen + Wan on Alibaba Cloud.*
