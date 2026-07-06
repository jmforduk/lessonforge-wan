import { json, getKey, WAN_BASE, onRequestOptions } from '../../_shared.js'

export { onRequestOptions }

// GET /api/image/:taskId → poll text-to-image task → { status, imageUrl }
export const onRequestGet = async ({ params, env }) => {
  const KEY = getKey(env)
  if (!KEY) return json({ error: 'DASHSCOPE_API_KEY not set on the server.' }, 500)

  const taskId = params.taskId
  const r = await fetch(`${WAN_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  const data = await r.json()
  const out = data?.output || {}
  const first = Array.isArray(out.results) ? out.results[0] : null
  return json({
    status: out.task_status,
    imageUrl: first?.url || null,
    raw: data,
  }, r.status)
}
