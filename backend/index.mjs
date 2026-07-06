/**
 * LessonForge — AI Showrunner backend
 * Runs on Alibaba Cloud Function Compute (web function, listens on $FC_SERVER_PORT || 9000).
 *
 * Holds the DASHSCOPE_API_KEY server-side and proxies:
 *   POST /api/agent   → Qwen (OpenAI-compatible chat) — shot-plan / script agents
 *   POST /api/video   → Wan text/image/reference-to-video (async create)
 *   GET  /api/video/:taskId → poll Wan task status → { status, videoUrl }
 *   GET  /healthz     → liveness + which models are reachable (deployment proof)
 *
 * Region: Singapore (International). Base:
 *   Chat : https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *   Wan  : https://dashscope-intl.aliyuncs.com/api/v1
 */
import http from 'node:http'

const PORT = process.env.FC_SERVER_PORT || process.env.PORT || 9000
const KEY = process.env.DASHSCOPE_API_KEY || ''
const CHAT_BASE = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const WAN_BASE  = 'https://dashscope-intl.aliyuncs.com/api/v1'

const json = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

const readBody = req => new Promise((resolve) => {
  let d = ''
  req.on('data', c => (d += c))
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}) } catch { resolve({}) } })
})

async function qwenChat(payload) {
  const r = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: payload.model || 'qwen-plus', ...payload }),
  })
  return { status: r.status, data: await r.json() }
}

async function wanCreate(body) {
  // body: { model, input:{prompt,negative_prompt,audio_url,img_url,ref_images_url}, parameters:{...} }
  const r = await fetch(`${WAN_BASE}/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json() }
}

async function wanPoll(taskId) {
  const r = await fetch(`${WAN_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  return { status: r.status, data: await r.json() }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const url = new URL(req.url, 'http://x')
  const path = url.pathname

  try {
    if (path === '/healthz' || path === '/') {
      return json(res, 200, {
        ok: true, service: 'lessonforge-ai-showrunner',
        cloud: 'Alibaba Cloud Function Compute',
        keyPresent: !!KEY, chatBase: CHAT_BASE, wanBase: WAN_BASE,
        ts: new Date().toISOString(),
      })
    }

    if (!KEY) return json(res, 500, { error: 'DASHSCOPE_API_KEY not set on the server.' })

    if (path === '/api/agent' && req.method === 'POST') {
      const body = await readBody(req)
      const { status, data } = await qwenChat(body)
      return json(res, status, data)
    }

    if (path === '/api/video' && req.method === 'POST') {
      const body = await readBody(req)
      const { status, data } = await wanCreate(body)
      return json(res, status, data)
    }

    if (path.startsWith('/api/video/') && req.method === 'GET') {
      const taskId = path.split('/').pop()
      const { status, data } = await wanPoll(taskId)
      const out = data?.output || {}
      return json(res, status, {
        status: out.task_status,
        videoUrl: out.video_url || null,
        raw: data,
      })
    }

    return json(res, 404, { error: 'not found', path })
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) })
  }
})

server.listen(PORT, () => console.log(`LessonForge AI Showrunner backend on :${PORT}`))
