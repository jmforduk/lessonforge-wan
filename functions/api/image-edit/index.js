import { json, getKey, WAN_BASE, onRequestOptions } from '../../_shared.js'

export { onRequestOptions }

// POST /api/image-edit → Qwen-Image-Edit (reference-image editing).
// Takes a reference image (the educator portrait) + a text instruction and
// returns a NEW image OF THE SAME SUBJECT in the requested pose/scene. This is
// how we lock a character (e.g. Nova the robot) so it doesn't drift between
// shots — plain text-to-image reinvents the subject every time.
//
// This endpoint is SYNCHRONOUS (no async task_id): the image URL comes back in
// the same response under output.choices[0].message.content[].image.
//
// Request body (from the client): { model, input:{messages:[...]}, parameters:{...} }
// Response (normalised): { imageUrl } on success, or { error } on failure.
export const onRequestPost = async ({ request, env }) => {
  const KEY = getKey(env)
  if (!KEY) return json({ error: 'DASHSCOPE_API_KEY not set on the server.' }, 500)

  let body = {}
  try { body = await request.json() } catch { body = {} }

  // multimodal-generation lives at a different path than text2image and is sync.
  const r = await fetch(`${WAN_BASE}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) return json({ error: data?.message || `image-edit failed (HTTP ${r.status})`, raw: data }, r.status)

  // Dig the image URL out of the chat-style multimodal response.
  let imageUrl = null
  try {
    const content = data?.output?.choices?.[0]?.message?.content || []
    for (const part of content) {
      if (part?.image) { imageUrl = part.image; break }
    }
  } catch { /* fall through */ }

  if (!imageUrl) return json({ error: 'image-edit returned no image', raw: data }, 502)
  return json({ imageUrl, raw: data }, 200)
}
