/**
 * LessonForge → ComfyUI render engine
 * 
 * Pipeline per shot:
 *   1. Upload educator portrait  →  /upload/image
 *   2. Build workflow JSON with all injected values
 *   3. POST to /prompt  →  get prompt_id
 *   4. Poll /history/{prompt_id} until done
 *   5. Parse outputs: ZIT scene (node 19), faceswap (node 900), video (node 75)
 */

import BASE_WORKFLOW from './workflow_template.json'

// ── Frame helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a shot duration string like "30s", "1m", "45" to seconds.
 */
function parseDurationSeconds(durationStr) {
  if (!durationStr) return 10
  const s = String(durationStr).trim().toLowerCase()
  if (s.endsWith('m')) return parseFloat(s) * 60
  if (s.endsWith('s')) return parseFloat(s)
  return parseFloat(s) || 10
}

/**
 * LTX requires odd frame counts.
 * frames = floor(seconds * fps / 2) * 2 + 1
 */
// Hard cap on generated video length. The shot's `duration` still drives the
// voiceover/pacing, but we NEVER render more than this many seconds of actual
// video per shot — long single LTX-2 generations are slow, VRAM-hungry, and
// drift badly (faces morph, rooms wander). For the hackathon a short, clean
// proof clip beats a long polished one, and it saves a lot of AMD compute.
export const MAX_RENDER_SECONDS = 12
// Never render a clip shorter than this even for a one-line voiceover — very
// short LTX clips look like a jarring flash.
export const MIN_RENDER_SECONDS = 3

// Average narration pace. ~150 words/min is a natural, unhurried teaching
// cadence → 2.5 words per second. We add a small breathing buffer so the clip
// doesn't cut the instant the last word ends.
const WORDS_PER_SECOND = 2.5
const VOICEOVER_TAIL_PADDING_SECONDS = 0.6

function countWords(text) {
  if (!text) return 0
  return String(text).trim().split(/\s+/).filter(Boolean).length
}

/**
 * How many seconds of speech the voiceover actually needs.
 * Returns 0 when there's no narration (fall back to the authored duration).
 */
function voiceoverSeconds(voiceover) {
  const words = countWords(voiceover)
  if (!words) return 0
  return words / WORDS_PER_SECOND + VOICEOVER_TAIL_PADDING_SECONDS
}

/**
 * Decide the clip length for a shot. The VOICEOVER length is the primary driver
 * (so the video matches how long the narration takes to speak); the authored
 * `duration` is used only as a fallback when there's no voiceover. Result is
 * clamped between MIN_RENDER_SECONDS and MAX_RENDER_SECONDS.
 */
function shotSeconds(shot) {
  const voSecs = voiceoverSeconds(shot?.voiceover || shot?.voiceoverScript)
  const authored = parseDurationSeconds(shot?.duration)
  const target = voSecs > 0 ? voSecs : authored
  return Math.max(MIN_RENDER_SECONDS, Math.min(target, MAX_RENDER_SECONDS))
}

function secondsToFrames(secs, fps = 24) {
  const raw = Math.round(secs * fps)
  return Math.max(1, Math.floor(raw / 2) * 2 + 1) // force odd, >= 1
}

// Back-compat: still used anywhere that only has a duration string.
function durationToFrames(durationStr, fps = 24) {
  const secs = Math.min(parseDurationSeconds(durationStr), MAX_RENDER_SECONDS)
  return secondsToFrames(secs, fps)
}

// ── Portrait upload ────────────────────────────────────────────────────────────

/**
 * Upload a base64 data URL (or blob URL) to ComfyUI's /upload/image endpoint.
 * Returns the filename ComfyUI assigned (use this in LoadImage nodes).
 */
export async function uploadPortrait(base, dataUrl, filename) {
  // Convert data URL → Blob
  const res = await fetch(dataUrl)
  const blob = await res.blob()

  const form = new FormData()
  form.append('image', blob, filename)
  form.append('overwrite', 'true')

  const uploadRes = await fetch(`${base}/upload/image`, {
    method: 'POST',
    body: form,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Portrait upload failed (${uploadRes.status}): ${text}`)
  }

  const data = await uploadRes.json()
  // ComfyUI returns { name: "filename.png", subfolder: "", type: "input" }
  return data.name
}

// ── Workflow builder ───────────────────────────────────────────────────────────

/**
 * Deep-clone the base workflow and inject all per-shot values.
 * 
 * Injection points:
 *   node 13      .text          → ZIT prompt (scene description)
 *   node 30      .image         → uploaded educator portrait filename
 *   node 19      .filename_prefix → lf_{slug}_shot_{i}_scene
 *   node 900     .filename_prefix → lf_{slug}_shot_{i}_faceswap
 *   node 75      .filename_prefix → lf_{slug}_shot_{i}
 *   node 267:266 .value         → LTX video prompt + "\n\nAudio: " + voiceover
 *   node 267:240 .text          → same LTX prompt (drives LTXVConditioning)
 *   node 267:247 .text          → negative prompt
 *   node 267:225 .value         → frames (odd number)
 *   node 267:228 .length        → frames
 *   node 267:214 .frames_number → frames
 *   node 267:216 .noise_seed    → random
 *   node 267:237 .noise_seed    → random + 1
 *   node 17      .seed          → random
 */
// ── Prompt sanitisation ─────────────────────────────────────────────────────
/**
 * The renderer can only draw concrete, real-world things. Product-internal
 * jargon (LessonForge, the LAF, SAF agents, GPU telemetry, dashboards, ROCm…)
 * has no visual referent, so a text-to-video model hallucinates garbage —
 * fake documents, whiteboards scribbled with acronyms, UI it invents.
 *
 * This strips those terms out of any visual prompt / on-screen caption so a
 * shot always renders something real, regardless of what the plan said.
 */
const JARGON_PATTERNS = [
  /\blessonforge\b/gi,
  /\bthe laf\b/gi,
  /\blaf agents?\b/gi,
  /\blaf\b/gi,
  /\bsaf agents?\b/gi,
  /\bsaf\b/gi,
  /\blesson application framework\b/gi,
  /\bscene application framework\b/gi,
  /\bcurriculum architect\b/gi,
  /\bscene consistency director\b/gi,
  /\bprompt engineer(ing)?\b/gi,
  /\bcrewai\b/gi,
  /\bfireworks ai\b/gi,
  /\brocm\b/gi,
  /\bmi300x?\b/gi,
  /\bgpu telemetry\b/gi,
  /\btelemetry ticks?\b/gi,
  /\bgpu[- ]grid\b/gi,
  /\brender queue\b/gi,
  /\bcreate lesson modal\b/gi,
  /\bhome dashboard\b/gi,
  /\bscreen[- ]capture\b/gi,
  /\bscreen recording\b/gi,
  /\bUI\b/g,
]

export function sanitiseVisualPrompt(text, fallback = 'a friendly teacher in a bright modern classroom, photorealistic, cinematic 4K') {
  if (!text) return fallback
  let out = String(text)
  for (const re of JARGON_PATTERNS) out = out.replace(re, '')
  // collapse artefacts left by removals: doubled spaces, dangling punctuation
  out = out.replace(/\s{2,}/g, ' ')
            .replace(/\s+([,.;:])/g, '$1')
            .replace(/([,;:]\s*){2,}/g, ', ')
            .replace(/^[\s,.;:–-]+/, '')
            .trim()
  // If we gutted it, fall back to something renderable.
  if (out.replace(/[^a-z]/gi, '').length < 12) return fallback
  return out
}


// ── Text-in-video suppression ────────────────────────────────────────────────
// ZIT and LTX-2 are BAD at rendering legible text — any words/labels/diagrams
// baked into a frame come out as garbled glyphs and look broken. So we (a) strip
// phrases that ask the model to draw text/labels/writing/diagrams from the
// positive prompt, and (b) always force strong anti-text tokens into the
// negative prompt. Real captions/titles are composited as overlays instead.

// Tokens always appended to every negative prompt.
export const NO_TEXT_NEGATIVE =
  // Anti-text: LTX/ZIT render words as garbled glyphs, so forbid every kind of
  // on-frame text hard. Real captions are composited as overlays instead.
  'text, words, letters, captions, subtitles, title card, watermark, signage, ' +
  'labels, handwriting, writing, typography, numbers, gibberish text, ' +
  'garbled text, misspelled text, fake letters, slide text, whiteboard text, ' +
  'poster text, book text, diagram labels, charts, graphs, UI, screen text, logos, ' +
  // Anti-crowd: a second face breaks the faceswap, so forbid extra people.
  'other people, second person, extra people, bystanders, crowd, group of people, ' +
  'audience, students in frame, background people, two faces, multiple faces, duplicate person'

// Phrases in the positive prompt that beg the model to render text — softened
// to neutral visuals so it stops trying to draw words.
const TEXT_PHRASE_PATTERNS = [
  [/\bhand-?written digits?\b/gi, 'a small object'],
  [/\bthe correct digit\b/gi, 'the correct answer'],
  [/\bwith (?:a )?short labels?\b/gi, ''],
  [/\ba short label\b/gi, ''],
  [/\blabelled\b/gi, ''],
  [/\bwriting (?:a |an )?[a-z ]*?(?:outline|notes?|lesson|list)\b/gi, 'sketching quick notes'],
  [/\bhand-?drawn (?:scene )?cards?\b/gi, 'small blank storyboard cards'],
  [/\bstoryboard of[^.,]*cards?\b/gi, 'a corkboard of blank storyboard cards'],
  [/\b(?:network )?diagrams?\b/gi, 'abstract glowing node shapes'],
  [/\bcharts?\b/gi, 'abstract glowing shapes'],
  [/\bgraphs?\b/gi, 'abstract glowing shapes'],
  [/\bicons?\b/gi, 'simple glowing symbols'],
  [/\bcourse portal\b/gi, 'a glowing screen'],
  [/\bshowing (?:the )?(?:loss|accuracy)[^.,]*\b/gi, 'showing abstract shifting light'],
  // Surfaces that beg the model to render (garbled) text → neutralise them.
  [/\bwhiteboard\b/gi, 'a plain softly-lit wall'],
  [/\bblackboard\b/gi, 'a plain wall'],
  [/\bchalkboard\b/gi, 'a plain wall'],
  [/\b(?:presentation )?slides?\b/gi, 'a softly glowing screen'],
  [/\bbullet points?\b/gi, 'simple glowing marks'],
  [/\bwriting[^.,]*(?:outline|notes?|words|text)\b/gi, 'sketching quick pictures'],
]

export function stripRenderedText(text) {
  if (!text) return text
  let out = String(text)
  for (const [re, rep] of TEXT_PHRASE_PATTERNS) out = out.replace(re, rep)
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()
  return out
}

// ── Educator identity injection ──────────────────────────────────────────────
// Pins the on-screen presenter's gender + appearance into the visual prompt so
// the generated base image matches the selected educator (before faceswap), and
// the voice matches their gender/accent.

// Deterministic seed derived from the educator identity, so the ZIT BASE image
// renders the SAME person on every shot (before ReActor faceswap). Without a
// stable base seed, each shot samples a different face/hair/build and the
// educator visibly "changes" between shots even with an identical text prompt.
function educatorSeed(educator) {
  const key = (educator?.id || educator?.name || 'presenter').toString()
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 999999999
}

// A robot educator (isRobot) is described as a consistent friendly humanoid
// robot rather than a person — and NO faceswap is applied (see isFaceswapEducator).
function buildPersonDescriptor(educator) {
  if (!educator) return ''
  const look = (educator.appearance || '').trim().replace(/\s+/g, ' ')

  if (educator.isRobot) {
    const design = look || 'a friendly humanoid teaching robot with smooth rounded panels, glowing lens eyes and a gently lit smile — approachable, never menacing'
    const chassis = (educator.wardrobe || '').trim()
    const chassisClause = chassis ? ` Its body is identical in every shot: ${chassis}.` : ''
    const soloBot = ' It is completely alone in the frame — the single, only character visible, facing the camera. No people, no humans, no bystanders, no second robot, no second face.'
    return `The presenter is a robot, NOT a human: ${design}. The EXACT same robot design, same face, same colours in every shot.${chassisClause}${soloBot}`
  }

  const g = (educator.gender || '').toLowerCase()
  const genderWord = g === 'female' ? 'woman' : g === 'male' ? 'man' : 'person'
  // Wardrobe is pinned as an explicit, IDENTICAL clause on every shot so the
  // outfit never drifts (e.g. blazer in one shot, lab coat in the next).
  const wardrobe = (educator.wardrobe || '').trim()
  const outfit = wardrobe
    ? ` Always wearing exactly the same outfit in every shot: ${wardrobe}.`
    : ''
  // SOLO enforcement: the base image must contain ONLY the presenter. A second
  // face beside the educator makes the ReActor faceswap grab the WRONG face, so
  // we hard-pin a single-person frame on every shot.
  const solo = ' They are completely alone in the frame — the single, only person visible, facing the camera. No other people, no bystanders, no colleagues, no students, no background crowd, no second face.'
  if (look) return `The presenter is a ${genderWord}: ${look}${outfit}${solo}`
  return `The presenter is a ${genderWord}.${outfit}${solo}`
}

// Robots have no human face for ReActor to detect/swap — skip faceswap for them
// and let the ZIT base image render the robot directly.
function isFaceswapEducator(educator) {
  return !!(educator && !educator.isRobot)
}

// Wardrobe/outfit words the model should NOT invent — appended to the negative
// prompt so it doesn't spontaneously add a lab coat, hi-vis, uniform, etc. when
// the educator's wardrobe doesn't include them.
function buildWardrobeNegative(educator) {
  if (!educator || !educator.wardrobe) return ''
  const w = educator.wardrobe.toLowerCase()
  const candidates = [
    ['lab coat', "lab coat, white coat, medical coat, scrubs"],
    ['scrubs', 'scrubs'],
    ['blazer', ''],
    ['tweed', ''],
  ]
  const negs = []
  if (!w.includes('coat') && !w.includes('scrub')) negs.push('lab coat', 'white coat', 'medical scrubs')
  if (!w.includes('hi-vis') ) negs.push('hi-vis vest', 'safety vest')
  if (!w.includes('uniform')) negs.push('uniform')
  return negs.join(', ')
}

// Default accent so the LTX audio is NEVER left unsteered — an unspecified
// accent is exactly what makes the voice drift American → German → English
// between shots. If an educator has no accent set, everyone defaults to the
// same clear neutral English so at least it stays CONSISTENT across the lesson.
const DEFAULT_ACCENT = 'a clear neutral English accent'

function buildVoiceDescriptor(educator) {
  const g = (educator?.gender || '').toLowerCase()
  const genderVoice = g === 'female' ? 'a female voice' : g === 'male' ? 'a male voice' : 'a clear voice'
  // Normalise a leading "with"/"in" so both "English accent" and "with an
  // English accent" work, then fall back to the default if nothing is set.
  const rawAccent = (educator?.accent || '').trim().replace(/^(with|in)\s+/i, '')
  const accent = rawAccent || DEFAULT_ACCENT
  // STRONG, REPEATED accent lock. A soft ", speaking with X," barely steers
  // LTX-2 and lets the accent wander shot-to-shot. We state it firmly and TWICE
  // (before and as a consistency directive) so every shot lands the same accent.
  return `${genderVoice} with ${accent}, always ${accent} — the exact same accent in every shot, consistent delivery, `
}

// Prepend the person descriptor to a scene prompt when the prompt refers to a
// generic teacher/presenter/person but doesn't already fix their gender.
function withPerson(prompt, personDesc) {
  if (!personDesc) return prompt
  return `${personDesc}. ${prompt}`
}

export function buildWorkflow(shot, educatorPortraitFile, lessonSlug, imageOnly = false, educator = null, sceneOnly = false, ltxCheckpoint = null) {
  const workflow = JSON.parse(JSON.stringify(BASE_WORKFLOW)) // deep clone

  // LTX-2 checkpoint override: different AMD boxes ship different checkpoint
  // filenames (fp8 vs non-fp8, etc.). If the user set one in Settings, point the
  // three loader nodes (checkpoint, audio VAE, text encoder) at it so the
  // workflow validates against what's actually installed on the box.
  if (ltxCheckpoint && ltxCheckpoint.trim()) {
    const ck = ltxCheckpoint.trim()
    for (const nid of ['267:236', '267:221', '267:243']) {
      if (workflow[nid]?.inputs && 'ckpt_name' in workflow[nid].inputs) {
        workflow[nid].inputs.ckpt_name = ck
      }
    }
  }

  const i = String(shot.index || 0).padStart(3, '0')
  const slug = (lessonSlug || 'lesson').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const seed = Math.floor(Math.random() * 999999999)
  // Clip length now follows the VOICEOVER length (how long the narration takes
  // to speak), not just the authored duration — so audio and video stay in sync.
  const clipSeconds = shotSeconds(shot)
  const frames = secondsToFrames(clipSeconds)

  // Educator descriptor — pin the on-screen person's gender + appearance so the
  // BASE image matches the educator before ReActor faceswap. Without this, the
  // scene prompt ("a friendly teacher") lets the model pick a random person
  // (e.g. a bearded man for a female educator), which faceswap can't fully fix.
  const personDesc = buildPersonDescriptor(educator)
  const wardrobeNeg = buildWardrobeNegative(educator)

  // SPLIT-SCREEN MODE: the ONE rendered LTX clip is the PRESENTER TALKING-HEAD
  // (left column) — the educator, faceswapped, mouthing the narration to camera.
  // The RIGHT column shows the content (a still, or an external/scene clip) and
  // is handled outside this render. This avoids the "double presenter" bug (the
  // educator was appearing both as a left still AND baked into the right video)
  // and gives a LIVE talking presenter on the left instead of a dead still.
  // In NORMAL mode the single clip keeps the presenter embedded in the scene.
  const isSplit = shot.layout === 'split'

  // The visual the LTX clip renders:
  //  - split  → a clean head-and-shoulders talking-head of the educator
  //  - normal → the shot's own scene, with the educator embedded
  const talkingHead = educator?.isRobot
    ? `Head-and-shoulders talking-head of a friendly humanoid teaching robot (${(educator.appearance||'smooth rounded panels, glowing lens eyes, gently lit smile').replace(/\s+/g,' ').slice(0,180)}) facing camera, mid-speech, its glowing eyes and lit mouth-panel animating as it explains, clean softly-lit studio backdrop, shallow depth of field. Calm, warm, friendly. NOT a human — a robot.`
    : `Head-and-shoulders talking-head of a ${(educator?.gender||'').toLowerCase()==='female'?'woman':(educator?.gender||'').toLowerCase()==='male'?'man':'presenter'} facing camera, mid-speech, lips moving naturally as they explain, clean softly-lit studio backdrop, shallow depth of field. Calm, natural presenting.`
  const sceneSource = isSplit
    ? talkingHead
    : (shot.scenePrompt || shot.videoPrompt || shot.title)

  // ZIT prompt — always educator-pinned (we WANT the presenter in the base image
  // for the talking-head in split mode, and in the scene for normal mode).
  const zitPrompt = withPerson(
    stripRenderedText(sanitiseVisualPrompt(sceneSource)),
    personDesc
  )
  workflow['13'].inputs.text = zitPrompt

  // ── ROBOT educators: skip ReActor entirely ──────────────────────────────
  // A robot has no human face to swap. The ZIT base image (node 18) already
  // renders the robot from the descriptor, so we route the faceswap SAVE (900)
  // and the video input (267:238) straight off node 18 and bypass ReActor.
  const robotEducator = !isFaceswapEducator(educator)
  if (robotEducator) {
    if (workflow['900']?.inputs) workflow['900'].inputs.images = ['18', 0]
    if (workflow['267:238']?.inputs) workflow['267:238'].inputs.input = ['18', 0]
    // Point ReActor's input at a valid node so it never errors even if left in
    // the graph, but nothing downstream consumes its output anymore.
  } else {
    // Educator portrait for ReActor face swap. Guard: if the portrait upload
    // didn't produce a filename, fail loudly rather than silently faceswapping a
    // blank/stale face (the old template shipped a hardcoded "isabela-costa.png").
    if (!educatorPortraitFile) {
      throw new Error('Faceswap source missing: no educator portrait was uploaded for this shot. Pick an educator with a portrait image, then re-render.')
    }
    workflow['30'].inputs.image = educatorPortraitFile
  }


  // Output filenames — include a short run token so repeated renders of the same
  // shot don't collide (which is what produced stray _00002_ files in the
  // ComfyUI file browser mixing outputs across lessons).
  const runTok = Math.random().toString(36).slice(2, 7)
  workflow['19'].inputs.filename_prefix  = `lf_${slug}_shot_${i}_${runTok}_scene`
  workflow['900'].inputs.filename_prefix = `lf_${slug}_shot_${i}_${runTok}_faceswap`
  workflow['75'].inputs.filename_prefix  = `lf_${slug}_shot_${i}_${runTok}`

  // The raw pre-faceswap ZIT scene (node 19) is only a debugging/fallback still.
  // In a FULL render we don't need it saved to disk — every extra SaveImage is
  // permanent clutter in ComfyUI's output folder (the source of the stray
  // "_scene_" files). Downgrade it to a PreviewImage so it still shows up in
  // /history (our fallback + extraction keep working) but writes to temp, not
  // output. In image-only review mode we KEEP it as a real SaveImage, since the
  // scene still is a legitimate review artifact there.
  if (!imageOnly) {
    workflow['19'].class_type = 'PreviewImage'
    delete workflow['19'].inputs.filename_prefix
  }

  // LTX prompt — video motion description (educator-pinned) + embedded audio.
  const voiceover = shot.voiceover || shot.voiceoverScript || ''
  const voiceDesc = buildVoiceDescriptor(educator)
  const audioInstruction = voiceover
    ? `\n\nAudio: ${voiceDesc}saying: ${voiceover}`
    : `\n\nAudio: ${voiceDesc}clear natural voice, no background music, no score`
  let ltxPrompt = withPerson(
    stripRenderedText(sanitiseVisualPrompt(isSplit ? talkingHead : (shot.videoPrompt || zitPrompt))),
    personDesc
  ) + audioInstruction

  // ── SCENE-ONLY (split-screen right pane) ───────────────────────────────────
  // Second render pass for the RIGHT frame of a split-screen shot: the actual
  // lesson scene with motion, but PERSON-FREE (no presenter, no faceswap). This
  // is where "the teacher can't be on the Moon" content lives, and it keeps the
  // faceswap risk at ZERO because there's no face in this clip at all.
  if (sceneOnly) {
    // Feed the LTX video off the raw ZIT scene (node 18), NOT the faceswap
    // output (node 32) — so no educator face is composited into this clip.
    workflow['267:238'].inputs.input = ['18', 0]
    // Person-free scene prompt, no audio (the right pane plays muted).
    const scenePrompt = stripRenderedText(sanitiseVisualPrompt(
      shot.sceneRightPrompt || shot.videoPrompt || shot.scenePrompt || shot.title
    ))
    ltxPrompt = `${scenePrompt}. An empty scene with no people, no person, unpopulated, environment only.`
    // The ZIT base for this pass must also be person-free.
    workflow['13'].inputs.text = `${scenePrompt}. Empty environment, no people, no person, no presenter, no figures.`
    // Person-free base seed so the right pane is stable but distinct.
    workflow['17'].inputs.seed = (educatorSeed(educator) + 7919) % 999999999
  }

  // Both nodes that drive LTX conditioning must get the same prompt
  workflow['267:266'].inputs.value = ltxPrompt  // PrimitiveStringMultiline → TextGenerateLTX2Prompt
  workflow['267:240'].inputs.text  = ltxPrompt  // CLIPTextEncode → LTXVConditioning (was hardcoded FilmForge/hamster prompt)

  // Negative prompt — always force anti-text tokens so the model doesn't try to
  // render (garbled) words/labels into the frame.
  workflow['267:247'].inputs.text = [
    shot.negativePrompt, wardrobeNeg, NO_TEXT_NEGATIVE,
    // Right-pane scene clip must be person-free — hard-negative any humans.
    sceneOnly ? 'people, person, human, presenter, face, teacher, man, woman, figure, silhouette' : '',
  ].filter(Boolean).join(', ')

  // Frame count (must be odd, synced across 3 nodes)
  workflow['267:225'].inputs.value         = frames
  workflow['267:228'].inputs.length        = frames
  workflow['267:214'].inputs.frames_number = frames

  // Seeds — randomise per shot for variation
  workflow['267:216'].inputs.noise_seed = seed          // video motion — random per shot
  workflow['267:237'].inputs.noise_seed = seed + 1      // video motion — random per shot
  // ZIT base image (node 17): STABLE per-educator seed so the same person is
  // rendered every shot, keeping appearance consistent before ReActor faceswap.
  // (sceneOnly set its own person-free seed above — don't clobber it.)
  if (!sceneOnly) workflow['17'].inputs.seed = educatorSeed(educator)

  // ── Image-only mode: prune the LTX video pipeline ───────────────────────────
  // For the review phase we only need the ZIT scene + ReActor faceswap stills.
  // Walking dependencies back from the two image SaveImage nodes (19, 900) keeps
  // ONLY the nodes required to produce them — dropping all the expensive LTX
  // video nodes (267:*, 75, 269). This is multiples-of-cheaper to render.
  if (imageOnly) {
    return pruneToImageOnly(workflow)
  }

  return workflow
}

// ── Image-only pruning ─────────────────────────────────────────────────────────

/**
 * Image SaveImage output nodes whose dependency tree we keep for review stills.
 */
const IMAGE_OUTPUT_NODES = ['19', '900']

/**
 * Return a new workflow containing only the nodes reachable from the image
 * output nodes (ZIT scene + ReActor faceswap). The LTX video sub-graph is
 * dropped entirely so ComfyUI renders the stills in seconds, not minutes.
 */
export function pruneToImageOnly(workflow) {
  const keep = new Set()

  const walk = (nodeId) => {
    if (keep.has(nodeId)) return
    const node = workflow[nodeId]
    if (!node) return
    keep.add(nodeId)
    for (const v of Object.values(node.inputs || {})) {
      // ComfyUI links are [sourceNodeId, outputIndex]
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string') {
        walk(v[0])
      }
    }
  }

  for (const out of IMAGE_OUTPUT_NODES) walk(out)

  const pruned = {}
  for (const id of keep) pruned[id] = workflow[id]
  return pruned
}

// ── Job submission ─────────────────────────────────────────────────────────────

/**
 * Submit a workflow to ComfyUI's /prompt endpoint.
 * Returns the prompt_id for polling.
 */
export async function submitWorkflow(base, workflow) {
  const res = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ComfyUI /prompt error (${res.status}): ${text}`)
  }

  const data = await res.json()
  if (!data.prompt_id) throw new Error('ComfyUI did not return a prompt_id')
  return data.prompt_id
}

// ── Polling ────────────────────────────────────────────────────────────────────

/**
 * Poll /history/{promptId} until the job completes or times out.
 * Returns parsed output files: { sceneImage, faceswapImage, video, promptId }
 */
export async function pollJob(base, promptId, onProgress, maxWaitMs = 600000, expectVideo = false) {
  const start = Date.now()
  let attempt = 0

  while (Date.now() - start < maxWaitMs) {
    await sleep(3000)
    attempt++

    try {
      const res = await fetch(`${base}/history/${promptId}`)
      if (!res.ok) continue

      const history = await res.json()
      const job = history[promptId]
      if (!job) continue // not done yet

      // ComfyUI writes a history entry even for FAILED prompts. A bare
      // "entry exists" is NOT success — inspect the reported status first so a
      // crashed/errored generation doesn't get silently marked done with no image.
      const st = job.status || {}
      if (st.completed === false || st.status_str === 'error') {
        const nodeErrs = job.status?.messages
          ? JSON.stringify(job.status.messages).slice(0, 400)
          : (st.status_str || 'unknown error')
        const e = new Error(`ComfyUI reported a failed generation: ${nodeErrs}`); e.terminal = true; throw e
      }

      // Job finished — parse outputs by node ID
      const outputs = job.outputs || {}

      // Full dump of every output node so we can see exactly where the video
      // lands (node id + key), regardless of workflow node numbering.
      console.log('[LessonForge] ComfyUI outputs dump:',
        JSON.stringify(Object.fromEntries(
          Object.entries(outputs).map(([id, o]) => [id, Object.keys(o)])
        )))

      const sceneImage    = extractImage(outputs['19'])
      const faceswapImage = extractImage(outputs['900'])

      // Find the video ANYWHERE in the outputs — not just node 75. Some builds
      // save under a different node id / key. Prefer node 75 if it has one.
      let video = extractVideo(outputs['75'])
      if (!video) {
        for (const [id, o] of Object.entries(outputs)) {
          const v = extractVideo(o)
          if (v) { console.log('[LessonForge] video found on node', id, v); video = v; break }
        }
      }
      if (!video) {
        console.warn('[LessonForge] NO video parsed from any node. Raw outputs:', outputs)
      }

      // A "completed" job that produced NO usable image is a spurious/empty
      // result (e.g. ReActor found no face, or a node emitted nothing). Surface
      // it as an error instead of a blank done-card that never shows a render.
      const wantVideo = !!outputs['75']
      const gotNothing = !sceneImage && !faceswapImage && !video
      if (gotNothing) {
        const e = new Error('ComfyUI finished but produced no image/video (empty output — likely a failed node or no face detected).'); e.terminal = true; throw e
      }
      // A full (video) render that completes with an image but NO video is a
      // real failure — otherwise the shot is marked "done" yet shows "no clip
      // yet" forever. Surface it so the user sees WHY instead of silence.
      if (expectVideo && !video) {
        const e = new Error('Render completed but no video clip was produced. The still rendered, but the LTX-2 video node emitted nothing — check that the video nodes (267:*, 75) ran and the SaveVideo node saved a file.'); e.terminal = true; throw e
      }

      onProgress?.(100)

      return {
        promptId,
        sceneImage,    // ZIT output
        faceswapImage, // ReActor output
        video,         // LTX final video
        rawOutputs: outputs,
      }
    } catch (err) {
      // Terminal errors (failed node, empty output) must surface immediately —
      // NOT get retried until the 10-min timeout, which is why image-only
      // review renders appeared to "do nothing". Only true network blips retry.
      if (err.terminal) throw err
      console.warn(`Poll attempt ${attempt} failed (will retry):`, err.message)
    }
  }

  throw new Error('Timed out waiting for ComfyUI (10 min limit)')
}

// ── Output URL builders ────────────────────────────────────────────────────────

/**
 * Build the ComfyUI /view URL for a file object.
 */
export function comfyFileUrl(base, file) {
  if (!file) return null
  // Demo mode / direct URLs: a plain string is already a usable URL.
  if (typeof file === 'string') return file
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || '',
    type: file.type || 'output',
  })
  return `${base}/view?${params}`
}

// ── Housekeeping ───────────────────────────────────────────────────────────────

/**
 * Clear ComfyUI's in-memory history and queue so its file browser / history
 * panel doesn't accumulate stale outputs from earlier (unrelated) renders.
 * Best-effort: failures are non-fatal — rendering still works without it.
 */
export async function clearComfyHistory(comfyBase) {
  const base = comfyBase.replace(/\/$/, '')
  try {
    await fetch(`${base}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    })
    await fetch(`${base}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    })
  } catch {
    /* non-fatal — housekeeping only */
  }
}

// ── Endpoint health check (no render) ──────────────────────────────────────────

/**
 * Probes a ComfyUI endpoint WITHOUT rendering anything. Runs a series of cheap
 * checks and returns a structured report the UI can show as a checklist:
 *   - mixed-content (https page + http endpoint → browser will block)
 *   - reachability (/system_stats)
 *   - CORS (are the Access-Control headers present)
 *   - GPU / device info (nice confirmation it's the AMD box)
 *   - required custom nodes present (ReActor faceswap nodes)
 *
 * Never throws — always resolves to { ok, checks:[{id,label,status,detail}] }.
 * status ∈ 'pass' | 'fail' | 'warn'.
 */
export async function testComfyEndpoint(comfyBase, ltxCheckpoint = null) {
  const checks = []
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail })

  const raw = (comfyBase || '').trim()
  if (!raw) {
    add('url', 'Endpoint set', 'fail', 'No endpoint entered. Add your ComfyUI URL first.')
    return { ok: false, checks }
  }
  const base = raw.replace(/\/$/, '')

  // 1. Mixed-content: an https page cannot fetch an http endpoint.
  const pageHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  const endpointHttp = /^http:\/\//i.test(base)
  if (pageHttps && endpointHttp) {
    add('mixed', 'Not blocked by browser', 'fail',
      'This app is on HTTPS but the endpoint is HTTP — the browser will block every request (mixed content). Use an HTTPS tunnel (e.g. cloudflared → https://xxxx.trycloudflare.com).')
    // Everything else will fail for the same reason; stop early with guidance.
    return { ok: false, checks }
  }
  add('mixed', 'Not blocked by browser', 'pass', pageHttps ? 'HTTPS page + HTTPS endpoint.' : 'App served over HTTP — direct calls allowed.')

  // 2. Reachability — GET /system_stats
  let stats = null
  try {
    const res = await fetch(`${base}/system_stats`, { method: 'GET' })
    if (!res.ok) {
      add('reach', 'ComfyUI reachable', 'fail', `Server responded HTTP ${res.status}. Is ComfyUI running on this address?`)
      return { ok: false, checks }
    }
    stats = await res.json().catch(() => null)
    add('reach', 'ComfyUI reachable', 'pass', stats?.system?.comfyui_version ? `ComfyUI ${stats.system.comfyui_version}` : 'Responded 200 OK.')
  } catch (e) {
    add('reach', 'ComfyUI reachable', 'fail',
      `Couldn't connect (${e.message}). If the endpoint is definitely up, this is almost always a CORS or mixed-content block — start ComfyUI with --enable-cors-header and use an HTTPS URL.`)
    return { ok: false, checks }
  }

  // 3. GPU / device (informational)
  const dev = stats?.devices?.[0]
  if (dev?.name) {
    const isAmd = /amd|instinct|mi\d|rocm/i.test(dev.name) || /rocm/i.test(stats?.system?.pytorch_version || '')
    add('gpu', 'GPU detected', isAmd ? 'pass' : 'warn',
      `${dev.name}${stats?.system?.pytorch_version ? ' · ' + stats.system.pytorch_version : ''}`)
  }

  // 4. CORS — did the browser actually let us READ the response above? If the
  //    fetch resolved with .json() we already passed the browser's CORS gate,
  //    so mark pass. (A CORS failure would have thrown in step 2.)
  add('cors', 'CORS enabled', 'pass', 'Browser accepted the cross-origin response.')

  // 5. Required custom nodes — ReActor faceswap (the pipeline needs these).
  try {
    const res = await fetch(`${base}/object_info/ReActorOptions`, { method: 'GET' })
    const info = res.ok ? await res.json().catch(() => ({})) : {}
    const hasReActor = info && Object.keys(info).length > 0 && info.ReActorOptions
    if (hasReActor) {
      add('reactor', 'ReActor faceswap installed', 'pass', 'ReActorOptions node is registered.')
    } else {
      add('reactor', 'ReActor faceswap installed', 'fail',
        'The ReActor custom node is missing — faceswap shots will 400. Install ComfyUI-ReActor in custom_nodes and restart ComfyUI.')
    }
  } catch {
    add('reactor', 'ReActor faceswap installed', 'warn', "Couldn't query node list — skip if faceswap already works.")
  }

  // 6. LTX-2 checkpoint present — the exact mismatch that renders a still but no
  //    video (the workflow asks for a filename the box doesn't have). Compare the
  //    checkpoint the workflow WILL request against the box's installed list.
  try {
    const wanted = (ltxCheckpoint && ltxCheckpoint.trim())
      || BASE_WORKFLOW?.['267:236']?.inputs?.ckpt_name
      || 'ltx-2.3-22b-dev.safetensors'
    const res = await fetch(`${base}/object_info/CheckpointLoaderSimple`, { method: 'GET' })
    const info = res.ok ? await res.json().catch(() => null) : null
    // ckpt_name enum lives at object_info.CheckpointLoaderSimple.input.required.ckpt_name[0]
    const enumList = info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]
    if (Array.isArray(enumList)) {
      if (enumList.includes(wanted)) {
        add('ckpt', 'LTX-2 checkpoint installed', 'pass', `${wanted} is present on the box.`)
      } else {
        const ltxOnes = enumList.filter(n => /ltx/i.test(n))
        const hint = ltxOnes.length
          ? ` Installed LTX checkpoints: ${ltxOnes.join(', ')}. Set one of these as the LTX-2 checkpoint in Settings.`
          : ' No LTX checkpoints found in models/checkpoints — download one first.'
        add('ckpt', 'LTX-2 checkpoint installed', 'fail',
          `The workflow wants "${wanted}", which isn't installed — video output will be rejected while the still still renders.${hint}`)
      }
    } else {
      add('ckpt', 'LTX-2 checkpoint installed', 'warn', "Couldn't read the checkpoint list — skip if video already renders.")
    }
  } catch {
    add('ckpt', 'LTX-2 checkpoint installed', 'warn', "Couldn't query checkpoints — skip if video already renders.")
  }

  const ok = checks.every(c => c.status !== 'fail')
  return { ok, checks }
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Full pipeline for one shot:
 *   upload portrait → build workflow → submit → poll → return results
 * 
 * @param {object} shot       - Shot object from the shot plan
 * @param {object} educator   - Educator object with portrait (base64 data URL)
 * @param {string} lessonSlug - Slug for output file naming
 * @param {string} comfyBase  - ComfyUI base URL e.g. http://localhost:8188
 * @param {function} onStatus - Callback for status updates: (status, detail) => void
 */
export async function renderShot(shot, educator, lessonSlug, comfyBase, onStatus, opts = {}) {
  const ltxCheckpoint = opts.ltxCheckpoint || null
  // Explicit, actionable guards so a misconfig surfaces instead of a silent
  // fetch(undefined) that never reaches ComfyUI.
  if (!comfyBase || !comfyBase.trim()) {
    throw new Error('No render backend set. Add your ComfyUI endpoint in Settings (e.g. http://localhost:8188 or your tunnel URL).')
  }
  if (!educator?.portrait) {
    throw new Error('This educator has no portrait photo. Add one in the Educators tab — the faceswap needs it.')
  }
  const base = comfyBase.replace(/\/$/, '')
  const imageOnly = !!shot._imageOnlyMode

  // 0. Preflight: confirm ComfyUI is actually reachable before we do work, so
  // "nothing happened" becomes a clear connection error instead.
  onStatus('uploading', `Connecting to ComfyUI (${base})…`)
  try {
    const ping = await fetch(`${base}/system_stats`, { method: 'GET' })
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`)
  } catch (e) {
    throw new Error(`Couldn't reach ComfyUI at ${base}. Is it running and CORS-enabled (--enable-cors-header)? (${e.message})`)
  }

  // 1. Upload portrait
  onStatus('uploading', 'Uploading educator portrait…')
  const portraitFilename = await uploadPortrait(
    base,
    educator.portrait,
    `lf_educator_${(educator.name || 'unknown').replace(/\s+/g, '_').toLowerCase()}.png`
  )

  // 2. Build workflow with all injections (pruned to stills if imageOnly).
  // A shot can declare itself PERSON-FREE (presenter: false / sceneOnly: true) —
  // e.g. abstract animations where the educator only narrates. Person-free shots
  // skip ReActor faceswap so no stray faces get smeared into a scene with no
  // clean single face to target.
  // In SPLIT mode the LEFT pane is ALWAYS the presenter talking-head (faceswap ON),
  // regardless of an authored `presenter: false` — that flag only makes a NORMAL
  // (non-split) shot person-free. The person-free content in split lives in the
  // RIGHT pane, rendered by the sceneOnly second pass below.
  const shotIsSceneOnly = shot.layout !== 'split' && (shot.presenter === false || shot.sceneOnly === true)
  onStatus('building', imageOnly ? 'Building preview workflow…' : 'Building workflow…')
  const workflow = buildWorkflow(shot, portraitFilename, lessonSlug, imageOnly, educator, shotIsSceneOnly, ltxCheckpoint)

  // 3. Submit to ComfyUI
  onStatus('queued', 'Submitting to ComfyUI…')
  const promptId = await submitWorkflow(base, workflow)

  // 4. Poll until done
  const label = imageOnly ? 'Rendering preview still' : 'Generating'
  onStatus('generating', `${label}… (job ${promptId.slice(0, 8)})`)
  const result = await pollJob(base, promptId, (pct) => {
    onStatus('generating', `${label}… ${pct}%`)
  }, 600000, !imageOnly)

  // ── Split-screen preview: person-free RIGHT-pane STILL (Review phase) ───────
  // During image-only Review we also render a quick person-free scene still so
  // judges can preview BOTH panes (presenter + schematic) before committing to
  // video. Without this, split shots showed only the presenter still.
  if (imageOnly && shot.layout === 'split' && !(shot.sceneVideoUrl || '').trim()) {
    try {
      onStatus('building', 'Building right-pane preview…')
      const sceneWf = buildWorkflow(shot, portraitFilename, lessonSlug, true, educator, true, ltxCheckpoint)
      const scenePromptId = await submitWorkflow(base, sceneWf)
      onStatus('generating', `Right-pane preview… (job ${scenePromptId.slice(0, 8)})`)
      const sceneResult = await pollJob(base, scenePromptId, (pct) => {
        onStatus('generating', `Right-pane preview… ${pct}%`)
      })
      // The person-free ZIT scene still is the right-pane preview image.
      result.sceneRightImage = sceneResult.sceneImage || sceneResult.faceswapImage || null
    } catch (e) {
      console.warn('[LessonForge] right-pane preview still failed:', e.message)
    }
  }

  // ── Split-screen second pass: person-free scene clip for the RIGHT pane ─────
  // Only for full video renders of a split shot. The left pane already has the
  // faceswapped talking-head (result.video); now render the scene with motion
  // but NO person, so both sides move and the faceswap never touches this clip.
  if (!imageOnly && shot.layout === 'split' && !(shot.sceneVideoUrl || '').trim()) {
    // Skip the auto-render second pass if the user supplied their own external
    // right-frame clip — the player will use shot.sceneVideoUrl directly.
    try {
      onStatus('building', 'Building right-pane scene clip…')
      const sceneWf = buildWorkflow(shot, portraitFilename, lessonSlug, false, educator, true, ltxCheckpoint)
      onStatus('queued', 'Submitting scene clip…')
      const scenePromptId = await submitWorkflow(base, sceneWf)
      onStatus('generating', `Rendering scene clip… (job ${scenePromptId.slice(0, 8)})`)
      const sceneResult = await pollJob(base, scenePromptId, (pct) => {
        onStatus('generating', `Scene clip… ${pct}%`)
      })
      result.sceneVideo = sceneResult.video || null
    } catch (e) {
      // The scene clip is a nice-to-have — if it fails, the right pane just
      // falls back to the scene still. Don't fail the whole shot over it.
      console.warn('[LessonForge] right-pane scene clip failed, using still fallback:', e.message)
    }
  }

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function extractImage(nodeOutput) {
  if (!nodeOutput?.images?.length) return null
  return nodeOutput.images[0] // { filename, subfolder, type }
}

function extractVideo(nodeOutput) {
  if (!nodeOutput) return null
  // Different node types report video output under different keys:
  //   SaveVideo            → "videos"
  //   VHS_VideoCombine     → "gifs"
  // and some frontend versions vary. Check the known keys first, then fall
  // back to scanning any array field whose items look like a video file.
  const known = nodeOutput.videos || nodeOutput.gifs || nodeOutput.video || nodeOutput.audio
  if (Array.isArray(known) && known.length) return known[0]

  const VIDEO_RE = /\.(mp4|webm|mov|mkv|gif|avi)$/i
  for (const val of Object.values(nodeOutput)) {
    if (Array.isArray(val) && val.length && val[0] && typeof val[0] === 'object') {
      const hit = val.find(f => f && typeof f.filename === 'string' && VIDEO_RE.test(f.filename))
      if (hit) return hit // { filename, subfolder, type }
    }
  }
  return null
}
