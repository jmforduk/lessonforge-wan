import { json, getKey, WAN_BASE, onRequestOptions } from '../../_shared.js'

export { onRequestOptions }

// POST /api/image → Wan/Qwen text-to-image (async create) → { task_id }
// Used for the CHEAP review still: a real image (seconds), not a full video clip.
// Default model wan2.2-t2i-flash (fast/cheap, Z-Image-turbo equivalent);
// qwen-image also supported for higher-fidelity scenes.
export const onRequestPost = async ({ request, env }) => {
  const KEY = getKey(env)
  if (!KEY) return json({ error: 'DASHSCOPE_API_KEY not set on the server.' }, 500)

  let body = {}
  try { body = await request.json() } catch { body = {} }

  const r = await fetch(`${WAN_BASE}/services/aigc/text2image/image-synthesis`, {
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
