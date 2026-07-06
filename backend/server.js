/**
 * LessonForge-WAN backend — the Alibaba Cloud service.
 *
 * This is the piece the hackathon requires to run ON Alibaba Cloud (Function
 * Compute / ECS). It is the ONLY thing that holds the DashScope API key and the
 * ONLY thing that talks to Qwen + Wan. The React frontend calls THIS service,
 * never DashScope directly (which also sidesteps browser CORS + key exposure).
 *
 * Endpoints:
 *   GET  /health                 → liveness + which region/models are wired
 *   POST /agent/plan             → Qwen: turn a brief into a structured shot plan
 *   POST /render                 → Wan: create a video-generation task → {taskId}
 *   GET  /render/:taskId         → Wan: poll a task → {status, videoUrl?, ...}
 *
 * Runs as a plain Node HTTP server (no framework) so it deploys cleanly to
 * Function Compute's custom-runtime / web-function without extra dependencies.
 */

import http from 'node:http'

const PORT = process.env.PORT || 9000
const API_KEY = process.env.DASHSCOPE_API_KEY || ''
// Singapore / International region.
const DASHSCOPE_BASE = process.env.DASHSCOPE_BASE || 'https://dashscope-intl.aliyuncs.com'
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const WAN_MODEL = process.env.WAN_MODEL || 'wan2.5-t2v-preview'

// ── small helpers ────────────────────────────────────────────────────────────
function sendJSON(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // The frontend is served from a different origin (Cloudflare Pages), so we
    // allow cross-origin calls to THIS backend explicitly.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 5e6) req.destroy() })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function requireKey(res) {
  if (!API_KEY) { sendJSON(res, 500, { error: 'DASHSCOPE_API_KEY not configured on the server' }); return false }
  return true
}

// ── Qwen: brief → shot plan ──────────────────────────────────────────────────
const PLANNER_SYSTEM = `You are the planning brain of an autonomous "AI Showrunner" that turns a short brief into a filmable multi-shot video.
Return STRICT JSON only, no prose, matching:
{"title": string, "synopsis": string, "shots": [{"index": number, "title": string, "voiceover": string, "videoPrompt": string, "onScreenText": string, "duration": number}]}
Rules:
- 4 to 6 shots. Each duration 3-8 (seconds).
- videoPrompt MUST describe a concrete, filmable real-world scene (people, places, objects). NEVER describe UIs, dashboards, app screens, invented acronyms, or product brand names.
- Do NOT ask for on-frame words, labels, captions, charts or diagrams inside videoPrompt — viewer-facing words go ONLY in onScreenText (rendered as an overlay later).
- voiceover is what the narrator says; keep each to 1-2 sentences.`

async function qwenPlan(brief) {
  const r = await fetch(`${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: `Brief: ${brief}\nReturn the JSON shot plan.` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || `Qwen HTTP ${r.status}`)
  const txt = j?.choices?.[0]?.message?.content || '{}'
  return JSON.parse(txt)
}

// ── Wan: create + poll video tasks ───────────────────────────────────────────
async function wanCreate({ prompt, negativePrompt, audioUrl, resolution, ratio, duration }) {
  const input = { prompt }
  if (negativePrompt) input.negative_prompt = negativePrompt
  if (audioUrl) input.audio_url = audioUrl
  const parameters = {
    resolution: resolution || '720P',
    ratio: ratio || '16:9',
    prompt_extend: true,
  }
  if (duration) parameters.duration = Math.max(2, Math.min(15, Math.round(duration)))

  const r = await fetch(`${DASHSCOPE_BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({ model: WAN_MODEL, input, parameters }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.message || j?.code || `Wan create HTTP ${r.status}`)
  const taskId = j?.output?.task_id
  if (!taskId) throw new Error('Wan did not return a task_id')
  return { taskId, status: j?.output?.task_status || 'PENDING' }
}

async function wanPoll(taskId) {
  const r = await fetch(`${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.message || `Wan poll HTTP ${r.status}`)
  const out = j?.output || {}
  return {
    status: out.task_status || 'UNKNOWN',
    videoUrl: out.video_url || null,
    code: out.code || null,
    message: out.message || null,
  }
}

// ── router ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return sendJSON(res, 204, {})
    const url = new URL(req.url, `http://${req.headers.host}`)
    const path = url.pathname

    if (req.method === 'GET' && path === '/health') {
      return sendJSON(res, 200, {
        ok: true, service: 'lessonforge-wan-backend',
        region: DASHSCOPE_BASE, qwenModel: QWEN_MODEL, wanModel: WAN_MODEL,
        keyConfigured: !!API_KEY,
      })
    }

    if (req.method === 'POST' && path === '/agent/plan') {
      if (!requireKey(res)) return
      const body = await readBody(req)
      if (!body.brief) return sendJSON(res, 400, { error: 'brief is required' })
      const plan = await qwenPlan(body.brief)
      return sendJSON(res, 200, plan)
    }

    if (req.method === 'POST' && path === '/render') {
      if (!requireKey(res)) return
      const body = await readBody(req)
      if (!body.prompt) return sendJSON(res, 400, { error: 'prompt is required' })
      const out = await wanCreate(body)
      return sendJSON(res, 200, out)
    }

    if (req.method === 'GET' && path.startsWith('/render/')) {
      if (!requireKey(res)) return
      const taskId = decodeURIComponent(path.slice('/render/'.length))
      if (!taskId) return sendJSON(res, 400, { error: 'taskId is required' })
      const out = await wanPoll(taskId)
      return sendJSON(res, 200, out)
    }

    return sendJSON(res, 404, { error: 'not found', path })
  } catch (e) {
    return sendJSON(res, 500, { error: e.message || String(e) })
  }
})

server.listen(PORT, () => {
  console.log(`[lessonforge-wan-backend] listening on :${PORT} → ${DASHSCOPE_BASE} (${WAN_MODEL} / ${QWEN_MODEL})`)
})
