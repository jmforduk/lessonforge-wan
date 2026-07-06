import { json, getKey, CHAT_BASE, WAN_BASE, onRequestOptions } from './_shared.js'

export { onRequestOptions }

export const onRequestGet = ({ env }) =>
  json({
    ok: true,
    service: 'lessonforge-ai-showrunner',
    cloud: 'Cloudflare Pages Functions',
    keyPresent: !!getKey(env),
    chatBase: CHAT_BASE,
    wanBase: WAN_BASE,
    ts: new Date().toISOString(),
  })
