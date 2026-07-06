import { json, getKey, WAN_BASE, onRequestOptions } from '../../_shared.js'

export { onRequestOptions }

// POST /api/video → Wan text/image/reference-to-video (async create) → { task_id }
export const onRequestPost = async ({ request, env }) => {
  const KEY = getKey(env)
  if (!KEY) return json({ error: 'DASHSCOPE_API_KEY not set on the server.' }, 500)

  let body = {}
  try { body = await request.json() } catch { body = {} }

  const r = await fetch(`${WAN_BASE}/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  return json(data, r.status)
}
