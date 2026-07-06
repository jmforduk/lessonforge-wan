/**
 * LessonForge — Prompt Optimisation Knowledge Base
 *
 * Externalised, editable ruleset that the Lesson Application Framework (LAF)
 * applies to every shot prompt before it reaches the render backend.
 *
 * This is the local fallback "Knowledge" used when the agentic SAF service is
 * not configured — it encodes LTX-2 / ReActor / cinematic best-practice so the
 * client still ships optimised prompts. When the SAF service IS configured, its
 * Prompt Engineer agent supersedes these rules with model-reasoned output.
 *
 * Source-of-truth: LessonForge prompt engineering Knowledge.
 * Edit freely — the LAF reads these rules at runtime.
 */

export const PROMPT_KNOWLEDGE = {
  // Structural ordering the optimiser enforces on every video prompt:
  // subject → action → environment → camera → lighting → style.
  promptOrder: ['subject', 'action', 'environment', 'camera', 'lighting', 'style'],

  // Cinematic quality tokens appended to lift fidelity (LTX-2 responds well to these).
  qualityTokens: [
    'cinematic',
    'sharp focus',
    'detailed',
    'professional lighting',
    'shallow depth of field',
    '35mm',
    'high dynamic range',
  ],

  // Camera/motion grammar — keeps LTX-2 motion controlled instead of chaotic.
  motionTokens: {
    talking:   'subtle natural head movement, steady eye contact, locked-off camera',
    cinematic: 'slow dolly push-in, smooth gimbal motion, parallax depth',
    infographic: 'clean static frame, gentle parallax on graphic layers',
  },

  // Style presets mapped from the lesson's chosen Visual Style.
  styleTokens: {
    Cinematic:   'filmic colour grade, dramatic key light, anamorphic bokeh',
    Infographic: 'clean flat-design, bright even lighting, bold readable graphics',
    Documentary: 'naturalistic lighting, handheld realism, muted colour palette',
    Whiteboard:  'clean studio backdrop, soft frontal light, high clarity',
    Default:     'balanced studio lighting, neutral colour grade',
  },

  // Always-on negative prompt — what LTX-2 must avoid for educational clarity.
  negativeBase: [
    'blurry', 'distorted face', 'extra fingers', 'deformed hands',
    'watermark', 'text artifacts', 'jpeg artifacts', 'low resolution',
    'warped geometry', 'flickering', 'duplicated subject', 'morphing',
  ],

  // Consistency anchors — injected so a presenter holds identity across shots
  // (works alongside ReActor faceswap to fight state-drift on long videos).
  consistencyDirectives: [
    'same person throughout',
    'consistent wardrobe',
    'consistent lighting and colour temperature',
    'matching environment continuity',
  ],

  // Resolution guidance — LTX-2 tensors require multiples of 32/64.
  resolutionRule: 'dimensions snapped to multiples of 32',
}

/**
 * Optimise a single shot's prompt using the Knowledge ruleset.
 * Pure, deterministic, no network — safe to run client-side every time.
 *
 * @param {object} shot     - shot with videoPrompt / negativePrompt / type
 * @param {object} ctx      - { style, educators }
 * @returns {object}        - shot with optimised videoPrompt + negativePrompt + _laf flag
 */
export function optimiseShotPrompt(shot, ctx = {}) {
  const K = PROMPT_KNOWLEDGE
  const base = (shot.videoPrompt || shot.title || '').trim().replace(/\s+/g, ' ')

  // 1. Motion grammar by shot type
  const motion = K.motionTokens[shot.type] || K.motionTokens.talking

  // 2. Style tokens from the lesson's visual style
  const style = K.styleTokens[ctx.style] || K.styleTokens.Default

  // 3. Consistency anchors (only if we have a recurring presenter)
  const consistency = (ctx.educators && ctx.educators.length)
    ? K.consistencyDirectives.join(', ')
    : ''

  // 4. Assemble in the canonical order, de-duping tokens already present
  const parts = [
    base,
    motion,
    style,
    consistency,
    K.qualityTokens.join(', '),
  ].filter(Boolean)

  const seen = new Set()
  const optimised = parts
    .join(', ')
    .split(',')
    .map(t => t.trim())
    .filter(t => {
      const k = t.toLowerCase()
      if (!t || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .join(', ')

  // 5. Merge negative prompt with the always-on base
  const negSeen = new Set()
  const negative = [...(shot.negativePrompt || '').split(','), ...K.negativeBase]
    .map(t => t.trim())
    .filter(t => {
      const k = t.toLowerCase()
      if (!t || negSeen.has(k)) return false
      negSeen.add(k)
      return true
    })
    .join(', ')

  return { ...shot, videoPrompt: optimised, negativePrompt: negative, _lafOptimised: true }
}

/**
 * Optimise a full shot plan. Returns the same shape enrichWithSAF returns,
 * so the LAF can use it as a local fallback when no SAF endpoint is set.
 */
export function optimiseShotPlan(shots, ctx = {}) {
  return (shots || []).map(s => optimiseShotPrompt(s, ctx))
}
