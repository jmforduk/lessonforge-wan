import { json, getKey, CHAT_BASE, onRequestOptions } from '../_shared.js'

export { onRequestOptions }

// POST /api/agent → Qwen (OpenAI-compatible chat) for the shot-plan / script agents
export const onRequestPost = async ({ request, env }) => {
  const KEY = getKey(env)
  if (!KEY) return json({ error: 'DASHSCOPE_API_KEY not set on the server.' }, 500)

  let body = {}
  try { body = await request.json() } catch { body = {} }

  const r = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: body.model || 'qwen-plus', ...body }),
  })
  const data = await r.json()
  return json(data, r.status)
}
