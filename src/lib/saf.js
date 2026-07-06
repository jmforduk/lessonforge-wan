import { optimiseShotPlan } from './promptKnowledge.js'

/**
 * LessonForge — SAF / Lesson Application Framework (LAF) client
 * 
 * Calls the CrewAI SAF service to enrich a shot plan before render.
 * If no SAF endpoint is configured, returns shots unchanged (passthrough).
 */

/**
 * Enrich a shot plan via the SAF service.
 * 
 * @param {object} params
 * @param {string} params.lessonTitle
 * @param {string} params.topic
 * @param {string} params.audience
 * @param {string} params.style
 * @param {string} params.tone
 * @param {Array}  params.educators
 * @param {Array}  params.shots
 * @param {string} safEndpoint  - e.g. "http://localhost:8000"
 * @param {function} onStatus  - (message: string) => void
 * @returns {Promise<{ shots: Array, sceneFramework: object }>}
 */
export async function enrichWithSAF(params, safEndpoint, onStatus) {
  // No agentic endpoint configured → run the local Knowledge-based prompt
  // optimisation (LTX-2 / ReActor best-practice ruleset). This keeps the LAF
  // useful offline / in demo mode without a CrewAI service.
  if (!safEndpoint?.trim()) {
    onStatus?.('LAF · applying prompt optimisation from Knowledge…')
    const optimised = optimiseShotPlan(params.shots, {
      style: params.style,
      educators: params.educators,
    })
    onStatus?.(`LAF · optimised ${optimised.length} shot prompt${optimised.length !== 1 ? 's' : ''}`)
    return { shots: optimised, sceneFramework: { source: 'knowledge', optimised: true } }
  }

  const base = safEndpoint.replace(/\/$/, '')

  // Health check first
  onStatus?.('Connecting to SAF service…')
  try {
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
    if (!health.ok) throw new Error(`SAF health check failed: ${health.status}`)
    const info = await health.json()
    onStatus?.(`SAF ready — model: ${info.model?.split('/').pop() || 'unknown'}`)
  } catch (err) {
    throw new Error(`Cannot reach SAF service at ${base}: ${err.message}`)
  }

  // Run enrichment
  onStatus?.('Agent 1: Curriculum Architect thinking…')
  const res = await fetch(`${base}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lessonTitle: params.lessonTitle,
      topic: params.topic,
      audience: params.audience,
      style: params.style,
      tone: params.tone,
      educators: (params.educators || []).map(e => ({
        name: e.name,
        role: e.role,
        appearance: e.appearance,
        voiceStyle: e.voiceStyle,
      })),
      shots: params.shots.map(s => ({
        index: s.index,
        type: s.type,
        title: s.title,
        duration: s.duration,
        voiceover: s.voiceover,
        videoPrompt: s.videoPrompt,
        negativePrompt: s.negativePrompt,
        onScreenText: s.onScreenText,
        pedagogicalNote: s.pedagogicalNote,
      })),
    }),
    signal: AbortSignal.timeout(300000), // 5 min — agents take time
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SAF enrichment failed (${res.status}): ${text}`)
  }

  onStatus?.('Agents complete — merging enriched prompts…')
  const data = await res.json()

  // Merge enriched fields back into original shots (preserving any fields SAF doesn't touch)
  const enrichedByIndex = Object.fromEntries((data.shots || []).map(s => [s.index, s]))
  const mergedShots = params.shots.map(shot => {
    const enriched = enrichedByIndex[shot.index]
    if (!enriched) return shot
    return {
      ...shot,
      videoPrompt: enriched.videoPrompt || shot.videoPrompt,
      negativePrompt: enriched.negativePrompt || shot.negativePrompt,
      // SAF-specific additions stored alongside the shot
      zitPrompt: enriched.zitPrompt,
      motionDirective: enriched.motionDirective,
      styleTokens: enriched.styleTokens,
    }
  })

  return {
    shots: mergedShots,
    sceneFramework: data.sceneFramework || null,
  }
}
