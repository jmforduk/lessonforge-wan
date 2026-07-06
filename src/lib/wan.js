/**
 * LessonForge — Wan render backend (Alibaba Cloud / Qwen Cloud, AI Showrunner track)
 *
 * Drop-in replacement for the ComfyUI/LTX-2 pipeline (comfyui.js). Same public
 * contract so App.jsx barely changes:
 *
 *   renderShot(shot, educator, lessonSlug, backendBase, onStatus, opts)
 *     → { promptId, sceneImage, faceswapImage, video, sceneVideo, sceneRightImage }
 *
 * Why this is SO much simpler than the ComfyUI graph:
 *   • Wan does its OWN audio — put the narration in quotes in the prompt and the
 *     model speaks it (audio-video synced). No separate TTS / audio node.
 *   • Wan reference-to-video / image-to-video preserves a character's appearance
 *     from a reference image — so NO ZIT base-image + ReActor faceswap chain.
 *   • Native multi-shot + negative_prompt. Async: create task → poll task_id.
 *
 * The DASHSCOPE_API_KEY is NEVER in the browser — every call goes through our
 * Alibaba Cloud Function Compute backend (backend/index.mjs), which holds the key.
 * `backendBase` is that FC endpoint (set in Settings).
 */

// ── Prompt hygiene (ported from the AMD build — still valuable on Wan) ────────
const JARGON_PATTERNS = [
  /\bLessonForge\b/gi, /\bLAF\b/g, /\bSAF\b/g, /\bComfyUI\b/gi, /\bLTX-?2?\b/gi,
  /\bReActor\b/gi, /\bZIT\b/g, /\bCurriculum Architect\b/gi,
  /\bScene Consistency Director\b/gi, /\bPrompt Engineer\b/gi,
  /\btelemetry\b/gi, /\bGPU-?grid\b/gi, /\bscreen recording\b/gi,
  /\bMI300X\b/gi, /\bROCm\b/gi, /\bdashboard\b/gi,
]

export function sanitiseVisualPrompt(text, fallback = 'a friendly teacher in a bright modern classroom, photorealistic, cinematic 4K') {
  if (!text) return fallback
  let out = String(text)
  for (const re of JARGON_PATTERNS) out = out.replace(re, '')
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1')
           .replace(/([,;:]\s*){2,}/g, ', ').replace(/^[\s,.;:–-]+/, '').trim()
  if (out.replace(/[^a-z]/gi, '').length < 12) return fallback
  return out
}

export const NO_TEXT_NEGATIVE =
  'text, words, letters, captions, subtitles, title card, watermark, signage, ' +
  'labels, handwriting, writing, typography, numbers, gibberish text, ' +
  'garbled text, misspelled text, fake letters, slide text, whiteboard text, ' +
  'poster text, book text, diagram labels, charts, graphs, UI, screen text, logos, ' +
  'low resolution, worst quality, low quality, deformed, extra fingers, bad proportions'

const NO_ONSCREEN_TEXT_CLAUSE = ' No text, no captions, no subtitles, no words, no labels, no signage anywhere in the frame.'

const TEXT_PHRASE_PATTERNS = [
  [/\bhand-?written digits?\b/gi, 'a small object'],
  [/\blabelled\b/gi, ''],
  [/\b(?:network )?diagrams?\b/gi, 'abstract glowing node shapes'],
  [/\bcharts?\b/gi, 'abstract glowing shapes'],
  [/\bgraphs?\b/gi, 'abstract glowing shapes'],
  [/\bicons?\b/gi, 'simple glowing symbols'],
  [/\bwhiteboard\b/gi, 'a plain softly-lit wall'],
  [/\bblackboard\b/gi, 'a plain wall'],
  [/\bchalkboard\b/gi, 'a plain wall'],
  [/\b(?:presentation )?slides?\b/gi, 'a softly glowing screen'],
  [/\bbullet points?\b/gi, 'simple glowing marks'],
]

export function stripRenderedText(text) {
  if (!text) return text
  let out = String(text)
  for (const [re, rep] of TEXT_PHRASE_PATTERNS) out = out.replace(re, rep)
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()
}

// ── Duration (voiceover-driven, clamped to Wan's supported range) ─────────────
export const MAX_RENDER_SECONDS = 15  // wan2.7 supports [2s, 15s]
export const MIN_RENDER_SECONDS = 5   // clean floor; Wan supports 5/10/15 tiers best
const WORDS_PER_SECOND = 2.5
const TAIL_PAD = 0.6

function countWords(t) { return t ? String(t).trim().split(/\s+/).filter(Boolean).length : 0 }
function parseDurationSeconds(d) {
  if (!d) return 10
  const s = String(d).trim().toLowerCase()
  if (s.endsWith('m')) return parseFloat(s) * 60
  return parseFloat(s) || 10
}
function shotSeconds(shot) {
  const words = countWords(shot?.voiceover || shot?.voiceoverScript)
  const target = words ? words / WORDS_PER_SECOND + TAIL_PAD : parseDurationSeconds(shot?.duration)
  const clamped = Math.max(MIN_RENDER_SECONDS, Math.min(target, MAX_RENDER_SECONDS))
  // Wan is happiest at its named tiers.
  return clamped <= 7 ? 5 : clamped <= 12 ? 10 : 15
}

// ── Educator identity → prompt (no faceswap; Wan speaks + keeps ref look) ─────
const DEFAULT_ACCENT = 'a clear neutral English accent'

function personDescriptor(educator) {
  if (!educator) return ''
  const look = (educator.appearance || '').trim().replace(/\s+/g, ' ')
  if (educator.isRobot) {
    const design = look || 'a friendly humanoid teaching robot with smooth rounded panels, glowing lens eyes and a gently lit smile — approachable, never menacing'
    const chassis = (educator.wardrobe || '').trim()
    return `The presenter is a robot, NOT a human: ${design}. The EXACT same robot design, same face and colours in every shot.${chassis ? ` Its body is identical every shot: ${chassis}.` : ''} It is completely alone in frame, facing camera. No people, no second robot.`
  }
  const g = (educator.gender || '').toLowerCase()
  const genderWord = g === 'female' ? 'woman' : g === 'male' ? 'man' : 'person'
  const wardrobe = (educator.wardrobe || '').trim()
  const outfit = wardrobe ? ` Always wearing exactly the same outfit every shot: ${wardrobe}.` : ''
  const solo = ' Completely alone in frame, the only person visible, facing camera. No other people, no bystanders, no crowd.'
  return look ? `The presenter is a ${genderWord}: ${look}.${outfit}${solo}` : `The presenter is a ${genderWord}.${outfit}${solo}`
}

function voiceLine(educator, voiceover) {
  if (!voiceover) return ''
  const g = (educator?.gender || '').toLowerCase()
  const who = educator?.isRobot ? 'The robot' : g === 'female' ? 'The woman' : g === 'male' ? 'The man' : 'The presenter'
  const accent = ((educator?.accent || '').trim().replace(/^(with|in)\s+/i, '')) || DEFAULT_ACCENT
  // IMPORTANT: do NOT quote the script here. Passing the verbatim line as
  // `saying: "..."` makes Wan render it as on-screen captions/subtitles. The
  // actual spoken words are delivered via the separate dubbing channel
  // (input.audio_text / auto-dub). Here we only describe the ACT of speaking so
  // the lips move and the shot reads as a piece-to-camera — no text in frame.
  return ` ${who} looks straight at the camera and speaks warmly and naturally, with clear lip movement, delivering a spoken narration in ${accent} (the same voice in every shot). The narration is heard as audio only — there is absolutely no text, no caption and no subtitle anywhere in the picture.`
}

// The actual words to be spoken, cleaned for the dubbing channel.
function spokenScript(voiceover) {
  return voiceover ? String(voiceover).replace(/\s+/g, ' ').trim() : ''
}

// Frame the script as WHAT IS HEARD (audio), never as a quoted line to render.
// This drives wan2.5/2.6 auto-dubbing while keeping captions out of the picture.
function narrationClause(educator, voiceover) {
  const script = spokenScript(voiceover)
  if (!script) return ''
  const accent = ((educator?.accent || '').trim().replace(/^(with|in)\s+/i, '')) || DEFAULT_ACCENT
  return ` The only audio is the presenter's spoken narration in ${accent}: ${script} There is no music and no other sound.`
}

// ── Backend calls (via Alibaba Cloud FC proxy that holds the key) ─────────────
async function postVideo(backend, body) {
  const r = await fetch(`${backend}/api/video`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok || !data?.output?.task_id) {
    throw new Error(data?.message || data?.error || `Wan create failed (HTTP ${r.status})`)
  }
  return data.output.task_id
}

async function pollVideo(backend, taskId, onStatus, expectSeconds) {
  const started = Date.now()
  const TIMEOUT = 10 * 60 * 1000
  let n = 0
  while (Date.now() - started < TIMEOUT) {
    await sleep(n === 0 ? 4000 : 8000); n++
    let data
    try {
      const r = await fetch(`${backend}/api/video/${taskId}`)
      data = await r.json()
    } catch (e) { console.warn('poll blip', e.message); continue }
    const st = (data?.status || '').toUpperCase()
    const elapsed = Math.round((Date.now() - started) / 1000)
    // Wan render time swings with Alibaba load (seen 35s–4min for the same clip),
    // so show elapsed seconds + reassure past ~90s that a slow queue is normal.
    const note = elapsed > 90 ? ' — Wan is busy, this can take a few minutes' : ''
    onStatus?.('generating', `Wan rendering ${expectSeconds}s clip… ${elapsed}s${note}`)
    if (st === 'SUCCEEDED' && data.videoUrl) return data.videoUrl
    if (st === 'FAILED' || st === 'UNKNOWN') {
      const e = new Error(`Wan render failed: ${data?.raw?.output?.message || 'task failed'}`); e.terminal = true; throw e
    }
  }
  throw new Error('Timed out waiting for Wan (10 min) — the service may be under heavy load. Try re-rendering this shot.')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Text-to-image (CHEAP review still — real image, not a video) ─────────────
async function postImage(backend, body) {
  const r = await fetch(`${backend}/api/image`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok || !data?.output?.task_id) {
    throw new Error(data?.message || data?.error || `Image create failed (HTTP ${r.status})`)
  }
  return data.output.task_id
}

async function pollImage(backend, taskId, onStatus) {
  const started = Date.now()
  const TIMEOUT = 3 * 60 * 1000
  let n = 0
  while (Date.now() - started < TIMEOUT) {
    await sleep(n === 0 ? 2500 : 4000); n++
    let data
    try {
      const r = await fetch(`${backend}/api/image/${taskId}`)
      data = await r.json()
    } catch (e) { console.warn('img poll blip', e.message); continue }
    const st = (data?.status || '').toUpperCase()
    onStatus?.('generating', 'Rendering preview still…')
    if (st === 'SUCCEEDED' && data.imageUrl) return data.imageUrl
    if (st === 'FAILED' || st === 'UNKNOWN') {
      const e = new Error(`Still render failed: ${data?.raw?.output?.message || 'task failed'}`); e.terminal = true; throw e
    }
  }
  throw new Error('Timed out waiting for the preview still (3 min).')
}

// Model for the cheap review still. wan2.2-t2i-flash = fast/low-cost;
// qwen-image = higher fidelity. Overridable via settings.stillModel.
export const DEFAULT_STILL_MODEL = 'qwen-image'    // FREE quota (async, verified live). wan2.6-image is sync-only.

// Video models (DashScope Wan). These are the ones VERIFIED to SUCCEED on the
// video-synthesis endpoint with audio/dubbing:
//   • i2v (reference image)  → wan2.6-i2v-flash  (img_url; fast ~50s; auto-dub)
//   • t2v (no reference)     → wan2.5-t2v-preview
// NB: wan2.7-i2v FAILS here (needs a different media[] shape) and wan2.2-i2v-plus
// is silent + was failing — do not use them for the presenter/narrated clips.
export const DEFAULT_I2V_MODEL = 'wan2.6-i2v-flash'
export const DEFAULT_T2V_MODEL = 'wan2.6-t2v'        // FREE quota (50).

// ── COST GUARD ───────────────────────────────────────────────────────────────
// Julian was billed ~$18 by the pricey wan2.7-t2v / wan2.7-i2v models (which
// also FAIL on this endpoint). Block them: any model outside this cheap, verified
// allow-list is coerced to the safe flash equivalent before it can reach the
// billed API. Kind: 'i2v' | 't2v' | 'still'.
const ALLOWED_MODELS = {
  // FREE-QUOTA-FIRST. The Singapore workspace free grant covers ONLY these codes:
  //   still/image: wan2.6-image (50), qwen-image (99)
  //   t2v:         wan2.6-t2v (50)
  //   edit:        qwen-image-edit (100), qwen-image-edit-plus (100)
  //   i2v:         (NONE — no free image-to-video model exists in the grant)
  // Non-free codes are still allowed (verified to work) but bill Pay-As-You-Go,
  // so keep them for FINAL approved clips only.
  i2v:   new Set(['wan2.6-i2v-flash', 'wan2.5-i2v-preview']),            // PAID (no free i2v)
  t2v:   new Set(['wan2.6-t2v', 'wan2.5-t2v-preview', 'wan2.6-t2v-flash']), // wan2.6-t2v = FREE
  still: new Set(['wan2.6-image', 'qwen-image', 'wan2.2-t2i-flash']),   // wan2.6-image/qwen-image = FREE
  edit:  new Set(['qwen-image-edit', 'qwen-image-edit-plus']),          // both FREE
}
const DEFAULT_EDIT_MODEL = 'qwen-image-edit'
const SAFE_FALLBACK = { i2v: DEFAULT_I2V_MODEL, t2v: DEFAULT_T2V_MODEL, still: DEFAULT_STILL_MODEL, edit: DEFAULT_EDIT_MODEL }
export function safeModel(kind, requested) {
  const want = (requested || '').trim()
  if (want && ALLOWED_MODELS[kind]?.has(want)) return want
  if (want && !ALLOWED_MODELS[kind]?.has(want)) {
    console.warn(`[cost-guard] blocked non-allowed ${kind} model "${want}" → ${SAFE_FALLBACK[kind]}`)
  }
  return SAFE_FALLBACK[kind]
}

const PERSON_FREE_NEG = 'person, people, human, man, woman, presenter, host, teacher, face, portrait, figure, crowd, hands, robot, mascot, character'

// Robot anti-drift: the specific ways Nova (and any robot educator) mutates
// between shots. Merged into the presenter negative when educator.isRobot.
const ROBOT_DRIFT_NEG = 'human face, human skin, hair, humanoid person, changing robot design, different robot, redesigned robot, extra eyes, three eyes, one eye, glowing red eyes, orange eyes, green eyes, different eye colour, angry face, menacing, sharp edges, industrial machine, exposed wires, metallic grey body, rusty, bulky mech, missing antenna, extra antennae, text on face, screen text, changing colours, different colour scheme'
// Hard suppression of the #1 non-split failure: TWO presenters / a duplicate
// person in different positions. Always merged into the presenter negative so
// even the plain text-to-image fallback (no portrait / edit failed) can't render
// a second subject.
const SOLO_PRESENTER_NEG = 'two people, second person, duplicate person, twins, clone, another presenter, extra person, group of people, crowd, bystanders, background people, two faces, multiple subjects, split composition, side by side people, person on the left and person on the right, mirrored person'

// Reference-image edit: send the educator PORTRAIT + an instruction, get back a
// NEW still of the SAME subject. Synchronous — returns { imageUrl } directly.
async function postImageEdit(backend, body) {
  const r = await fetch(`${backend}/api/image-edit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok || !data?.imageUrl) {
    const e = new Error(data?.error || `Image-edit failed (HTTP ${r.status})`); e.terminal = true; throw e
  }
  return data.imageUrl
}

// Build the qwen-image-edit request: reference image (portrait) + instruction.
function buildImageEditBody(shot, educator, refImage) {
  const isSplit = shot.layout === 'split'
  // IDENTITY LOCK RULE: with qwen-image-edit the REFERENCE IMAGE carries the face.
  // Do NOT re-describe the person's appearance in words — a verbose text
  // re-description (hair, age, face…) makes the model regenerate the face FROM the
  // text instead of preserving the reference pixels, which is what caused the
  // presenter/robot to drift between the portrait and the still. So the text here
  // describes ONLY the framing/scene/wardrobe-continuity, never the face.
  const subject = educator?.isRobot ? 'robot/character' : 'person'
  const wardrobe = (educator?.wardrobe || '').trim()
  const wardrobeClause = wardrobe ? ` They are wearing exactly: ${wardrobe}.` : ''
  const keep = `Preserve the EXACT same ${subject} from the reference image with 100% identity fidelity — do not change the face, head shape, features, colours or proportions in any way. This is the same individual, not a look-alike.`
  let instruction
  if (isSplit) {
    instruction = `${keep} Re-frame them as a head-and-shoulders talking-head portrait on a clean neutral studio backdrop, soft key light, facing camera.${wardrobeClause} Alone in frame, no second subject, no scenery behind, no graphics. Photorealistic, cinematic.${NO_ONSCREEN_TEXT_CLAUSE}`
  } else {
    const sceneSource = shot.videoPrompt || shot.scenePrompt || shot.title || ''
    const sceneClean = stripRenderedText(sanitiseVisualPrompt(sceneSource))
    instruction = `${keep} Place this same individual, unchanged, as the ONLY person into the following setting (the setting is background only — any people mentioned in it are replaced by this one individual, do not add anyone else): ${sceneClean}.${wardrobeClause} Exactly one person in the whole frame, centered, facing camera, no second person anywhere. Photorealistic, cinematic.${NO_ONSCREEN_TEXT_CLAUSE}`
  }
  return {
    model: safeModel('edit', DEFAULT_EDIT_MODEL),
    input: { messages: [ { role: 'user', content: [ { image: refImage }, { text: instruction } ] } ] },
    parameters: { n: 1, negative_prompt: presenterNeg(shot, educator, 'second subject, duplicate, crowd, scenery clutter'), prompt_extend: false, watermark: false, size: isSplit ? '768*1024' : '1280*720' },
  }
}

function buildImageBody(shot, educator, { sceneOnly = false, model = DEFAULT_STILL_MODEL } = {}) {
  // sceneOnly === true  → the RIGHT pane: the lesson scene ALONE, zero people/robots.
  // sceneOnly === false → the presenter: for a split shot, the LEFT talking-head
  //   pane (presenter on a clean backdrop, NOT the scene); for a normal shot, the
  //   presenter embedded in the scene.
  const isSplit = shot.layout === 'split'
  const person = sceneOnly ? '' : personDescriptor(educator)

  let prompt, negative
  if (sceneOnly) {
    // RIGHT pane — use the dedicated person-free right-pane prompt; never the
    // videoPrompt/presenter prompt (which would re-introduce a person/robot).
    const sceneSource = shot.sceneRightPrompt || shot.scenePrompt || shot.videoPrompt || shot.title || ''
    prompt = `${stripRenderedText(sanitiseVisualPrompt(sceneSource))}. Empty environment, absolutely no people, no person, no presenter, no robot, no characters — scene only. Photorealistic, cinematic 4K.${NO_ONSCREEN_TEXT_CLAUSE}`
    negative = [shot.negativePrompt, NO_TEXT_NEGATIVE, PERSON_FREE_NEG].filter(Boolean).join(', ')
  } else if (isSplit) {
    // LEFT pane — JUST the presenter, clean studio backdrop. Ignore the scene
    // description entirely so we never render the presenter AND a scene subject.
    const backdrop = 'a clean neutral studio backdrop, soft key light, cinematic depth of field'
    prompt = `Head-and-shoulders talking-head portrait, single subject, framed for a vertical LEFT column. ${person} Alone on ${backdrop}. No lesson graphics, no diagrams, no second subject, no scenery behind. Photorealistic, cinematic 4K.${NO_ONSCREEN_TEXT_CLAUSE}`
    negative = presenterNeg(shot, educator, 'second person, second robot, two robots, duplicate, extra character, crowd, other people, background people, scenery, landscape, room full of objects')
  } else {
    // Normal (non-split) shot — presenter embedded in the scene AS the only person.
    // CRITICAL: the scene text frequently ALSO describes a person ("a scientist
    // gesturing…"). Rendered alongside the presenter descriptor that produced TWO
    // different people in different positions. So we (a) lead with the presenter as
    // THE single subject, (b) fold the scene in as their SURROUNDINGS/action, and
    // (c) hard-assert exactly one person via prompt + SOLO negative.
    const sceneSource = shot.videoPrompt || shot.scenePrompt || shot.title || ''
    const scene = stripRenderedText(sanitiseVisualPrompt(sceneSource))
    prompt = `A single presenter, and only this one person, is the sole subject of the shot. ${person} This same one person is shown within the following setting, as the only human present: ${scene}. Exactly one person in the entire frame, centered, facing camera — the setting is background only and contains no other people. Photorealistic, cinematic 4K.${NO_ONSCREEN_TEXT_CLAUSE}`.trim()
    negative = presenterNeg(shot, educator, 'second person in the background, a different person elsewhere in frame, two people in different positions')
  }
  return {
    model,
    input: { prompt, negative_prompt: negative },
    parameters: { size: '1280*720', n: 1, prompt_extend: false },
  }
}

// Public: renderStill — generate a REAL image for the review gate (cheap).
// Contract mirrors renderShot's still fields so App wiring is unchanged.
export async function renderStill(shot, educator, lessonSlug, backendBase, onStatus, opts = {}) {
  const backend = (backendBase || '').replace(/\/$/, '')
  if (!backend) throw new Error('No render backend set. Add your Alibaba Cloud backend URL in Settings.')
  const isSplit = shot.layout === 'split'
  const shotIsSceneOnly = !isSplit && (shot.presenter === false || shot.sceneOnly === true)
  const model = safeModel('still', opts.stillModel)

  onStatus?.('building', 'Building still request…')
  try {
    const ping = await fetch(`${backend}/healthz`); const h = await ping.json()
    if (!h?.keyPresent) throw new Error('backend has no DASHSCOPE_API_KEY configured')
  } catch (e) {
    throw new Error(`Couldn't reach the backend at ${backend}. (${e.message})`)
  }

  onStatus?.('generating', 'Rendering preview still…')

  // CHARACTER LOCK: if this is the presenter (not a scene-only frame) AND we have
  // a reference portrait, generate the still with qwen-image-edit so it's the
  // SAME subject as the portrait — this stops Nova (and any character) drifting
  // between shots. Falls back to plain text-to-image if edit fails or no portrait.
  const refPortrait = (!shotIsSceneOnly && educator?.portrait) ? educator.portrait : null
  let imageUrl, task
  if (refPortrait) {
    try {
      onStatus?.('generating', 'Locking character to portrait…')
      imageUrl = await postImageEdit(backend, buildImageEditBody(shot, educator, refPortrait))
      task = 'edit'
    } catch (e) {
      console.warn('image-edit lock failed, falling back to t2i:', e.message)
    }
  }
  let identityLocked = !!(refPortrait && task === 'edit')
  if (!imageUrl) {
    if (refPortrait) console.warn('identity-lock did NOT run — still uses plain text-to-image, face will not match the portrait')
    task = await postImage(backend, buildImageBody(shot, educator, { sceneOnly: shotIsSceneOnly, model }))
    imageUrl = await pollImage(backend, task, onStatus)
    identityLocked = false
  }

  const result = {
    promptId: task,
    identityLocked,
    sceneImage: imageUrl,
    faceswapImage: imageUrl,
    video: null,
    sceneVideo: null,
    sceneRightImage: null,
  }
  // Split shots: also make a cheap person-free scene still for the right pane.
  if (isSplit) {
    try {
      const sTask = await postImage(backend, buildImageBody(shot, educator, { sceneOnly: true, model }))
      result.sceneRightImage = await pollImage(backend, sTask, onStatus)
    } catch (e) { console.warn('scene still failed (non-fatal):', e.message) }
  }
  onStatus?.('done', 'Preview ready')
  return result
}

// ── Build the Wan request for one shot ───────────────────────────────────────
function presenterNeg(shot, educator, extra) {
  const parts = [shot.negativePrompt, NO_TEXT_NEGATIVE, SOLO_PRESENTER_NEG, extra]
  if (educator?.isRobot) parts.push(ROBOT_DRIFT_NEG)
  return parts.filter(Boolean).join(', ')
}

function buildWanBody(shot, educator, { sceneOnly = false, model = DEFAULT_T2V_MODEL, refImage = null, finalRender = false } = {}) {
  model = safeModel('t2v', model)
  const secs = shotSeconds(shot)
  const isSplit = shot.layout === 'split'
  const person = sceneOnly ? '' : personDescriptor(educator)
  let prompt, negative
  if (sceneOnly) {
    // RIGHT pane clip — scene only, no people/robots. Use the dedicated right prompt.
    const sceneSource = shot.sceneRightPrompt || shot.scenePrompt || shot.videoPrompt || shot.title || ''
    prompt = `Generate a single-shot video. ${stripRenderedText(sanitiseVisualPrompt(sceneSource))}. Empty environment, no people, no person, no presenter, no robot, no characters. Cinematic, photorealistic.${NO_ONSCREEN_TEXT_CLAUSE}`
    negative = [shot.negativePrompt, NO_TEXT_NEGATIVE, PERSON_FREE_NEG].filter(Boolean).join(', ')
  } else if (isSplit) {
    // LEFT pane clip — presenter talking head only, clean backdrop, single subject.
    prompt = `Generate a single-shot video. Head-and-shoulders talking-head, single subject. ${person} Alone on a clean neutral studio backdrop, soft key light. No lesson graphics, no second subject.${voiceLine(educator, shot.voiceover || shot.voiceoverScript)}${NO_ONSCREEN_TEXT_CLAUSE}${narrationClause(educator, shot.voiceover || shot.voiceoverScript)}`.trim()
    negative = presenterNeg(shot, educator, 'second person, second robot, two robots, duplicate, extra character, crowd, scenery')
  } else {
    // Normal shot — presenter in the scene.
    const sceneSource = shot.videoPrompt || shot.scenePrompt || shot.title || ''
    prompt = `Generate a single-shot video. ${person} ${stripRenderedText(sanitiseVisualPrompt(sceneSource))}.${voiceLine(educator, shot.voiceover || shot.voiceoverScript)}${NO_ONSCREEN_TEXT_CLAUSE}${narrationClause(educator, shot.voiceover || shot.voiceoverScript)}`.trim()
    negative = presenterNeg(shot, educator, 'second person, duplicate person, extra people, crowd')
  }

  const body = {
    model,
    input: { prompt, negative_prompt: negative },
    parameters: { resolution: '720P', ratio: '16:9', duration: secs, prompt_extend: false },
  }
  // CONSISTENCY (the ReActor equivalent): Wan 2.7 image-to-video animates the
  // clip STARTING from a reference first_frame, so the presenter's face/design is
  // baked in from frame 0 — no faceswap, no detection miss, no bleed. Best
  // reference = the APPROVED review still (exact look you signed off); fall back
  // to the educator portrait. Uses the correct wan2.7 media:[{first_frame}] shape.
  // FREE-QUOTA DEFAULT: image-to-video (i2v) has NO free quota, so normal renders
  // and all iteration use text-to-video (wan2.6-t2v, FREE). Character consistency
  // then leans on the qwen-image-edit locked still + strong descriptor prompts.
  // Only a FINAL render (finalRender:true) switches to the PAID i2v path, which
  // anchors the exact approved still as the first frame — spend it on keepers only.
  const reference = (!sceneOnly && (refImage || educator?.portrait)) || null
  if (finalRender && reference && /^(https?:\/\/|data:image\/)/.test(reference)) {
    body.model = safeModel('i2v', null)   // PAID wan2.6-i2v-flash (img_url first-frame)
    body.input.img_url = reference
  }
  return { body, secs }
}

// ── Public: renderShot (contract-compatible with comfyui.js) ─────────────────
export async function renderShot(shot, educator, lessonSlug, backendBase, onStatus, opts = {}) {
  const backend = (backendBase || '').replace(/\/$/, '')
  if (!backend) throw new Error('No render backend set. Add your Alibaba Cloud backend URL in Settings (the Function Compute endpoint).')

  onStatus?.('building', 'Building Wan request…')
  const imageOnly = !!shot._imageOnlyMode
  const isSplit = shot.layout === 'split'
  const shotIsSceneOnly = !isSplit && (shot.presenter === false || shot.sceneOnly === true)

  // Preflight the backend so "nothing happened" becomes a clear error.
  onStatus?.('uploading', `Connecting to backend (${backend})…`)
  try {
    const ping = await fetch(`${backend}/healthz`)
    const h = await ping.json()
    if (!h?.keyPresent) throw new Error('backend has no DASHSCOPE_API_KEY configured')
  } catch (e) {
    throw new Error(`Couldn't reach the Alibaba Cloud backend at ${backend}. Is the Function Compute service deployed and running? (${e.message})`)
  }

  // IMAGE-ONLY (review) mode: Wan has no cheap "still" — we ask for the shortest
  // clip and use its first frame as the preview still. Keeps the two-stage gate.
  // Consistency reference: prefer the APPROVED review still (opts.refImage /
  // shot.reviewStill), else the educator portrait (handled inside buildWanBody).
  const refImage = opts.refImage || shot.reviewStill || shot.approvedStill || null
  const { body, secs } = buildWanBody(shot, educator, { sceneOnly: shotIsSceneOnly, refImage, finalRender: !!opts.finalRender })
  if (imageOnly) body.parameters.duration = MIN_RENDER_SECONDS

  onStatus?.('generating', imageOnly ? 'Rendering preview clip…' : `Rendering ${secs}s clip…`)
  const taskId = await postVideo(backend, body)
  const videoUrl = await pollVideo(backend, taskId, onStatus, imageOnly ? MIN_RENDER_SECONDS : secs)

  const result = {
    promptId: taskId,
    sceneImage: videoUrl,      // first frame used as preview thumbnail
    faceswapImage: videoUrl,   // no faceswap on Wan — reuse for UI still slot
    video: imageOnly ? null : videoUrl,
    sceneVideo: null,
    sceneRightImage: null,
  }

  // SPLIT mode: render a second person-free scene clip for the right pane.
  if (isSplit && !imageOnly) {
    try {
      onStatus?.('generating', 'Rendering person-free scene clip (right pane)…')
      const { body: sb, secs: ss } = buildWanBody(shot, educator, { sceneOnly: true })
      const sTask = await postVideo(backend, sb)
      result.sceneVideo = await pollVideo(backend, sTask, onStatus, ss)
    } catch (e) {
      console.warn('Split scene clip failed (non-fatal):', e.message)
    }
    // Guaranteed right-pane fallback: if the scene VIDEO didn't render (failed,
    // free-quota exhausted, etc.), generate a cheap person-free scene STILL so the
    // right pane is NEVER empty. t2i (~$0.02) is far cheaper than a 2nd video.
    if (!result.sceneVideo) {
      try {
        onStatus?.('generating', 'Rendering scene still for right pane…')
        const stillModel = safeModel('still', opts.stillModel)
        const sImgTask = await postImage(backend, buildImageBody(shot, educator, { sceneOnly: true, model: stillModel }))
        result.sceneRightImage = await pollImage(backend, sImgTask, onStatus)
      } catch (e2) {
        console.warn('Scene still fallback failed (non-fatal):', e2.message)
      }
    }
  }

  onStatus?.('done', 'Done')
  return result
}

// ── Preflight check for Settings "Test connection" ───────────────────────────
export async function testWanBackend(backendBase) {
  const checks = []
  const backend = (backendBase || '').replace(/\/$/, '')
  if (!backend) return { ok: false, checks: [{ label: 'Backend URL set', ok: false, detail: 'Enter your Alibaba Cloud backend URL.' }] }
  try {
    const r = await fetch(`${backend}/healthz`)
    const h = await r.json()
    checks.push({ label: 'Backend reachable', ok: r.ok, detail: h?.cloud || '' })
    checks.push({ label: 'DASHSCOPE key configured on server', ok: !!h?.keyPresent, detail: h?.keyPresent ? 'Qwen + Wan ready' : 'Key missing on backend' })
    checks.push({ label: 'Running on Alibaba Cloud', ok: /alibaba/i.test(h?.cloud || ''), detail: h?.cloud || 'unknown' })
  } catch (e) {
    checks.push({ label: 'Backend reachable', ok: false, detail: e.message })
  }
  return { ok: checks.every(c => c.ok), checks }
}

// No-op stubs so imports from the old ComfyUI build don't break.
export async function clearComfyHistory() { return true }
export function comfyFileUrl(_b, f) { return f }
