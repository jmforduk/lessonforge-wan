// Shared helpers for the LessonForge AI Showrunner Cloudflare Pages Functions.
// The DASHSCOPE_API_KEY lives as a Cloudflare secret (env), never in the browser.

// ── DashScope endpoints (Singapore region) ───────────────────────────────────
// FREE QUOTA is granted per Singapore WORKSPACE and is most reliably drawn from
// the workspace-specific dedicated domain, NOT the generic dashscope-intl one:
//   https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com
// WAN image/video calls use the workspace domain so they tap the free pool.
// The OpenAI-compatible chat endpoint (/compatible-mode/v1) is only served by the
// generic intl domain, so Qwen chat/planning stays there (it's pennies anyway).
//
// Override either via Cloudflare env vars WAN_BASE / CHAT_BASE if the workspace
// id ever changes — no code change needed.
const WORKSPACE_ID = 'ws-h174b7rezht40hyv'
const WORKSPACE_BASE = `https://${WORKSPACE_ID}.ap-southeast-1.maas.aliyuncs.com/api/v1`

// getBases(env) resolves the bases, honouring env overrides.
export const getBases = (env = {}) => ({
  CHAT_BASE: env.CHAT_BASE || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  WAN_BASE:  env.WAN_BASE  || WORKSPACE_BASE,
})

// Back-compat static exports (default Singapore workspace domain for WAN).
export const CHAT_BASE = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
export const WAN_BASE  = WORKSPACE_BASE

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

// Preflight for every route
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS })

export const getKey = (env) => env.DASHSCOPE_API_KEY || ''
