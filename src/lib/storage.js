/**
 * localStorage persistence layer for LessonForge.
 * Handles Educators, Locations, and saved Lesson Plans.
 */

import sarahChen from '../assets/educators/sarah_chen.png'
import jamesOkafor from '../assets/educators/james_okafor.png'
import amaraOkeke from '../assets/educators/amara_okeke.png'
import rajSterling from '../assets/educators/raj_sterling.png'
import roboTeacher from '../assets/educators/robo_teacher.png'

const KEYS = {
  educators: 'lf_educators',
  locations: 'lf_locations',
  lessons:   'lf_lessons',
  settings:  'lf_settings',
}

function load(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // QuotaExceededError — localStorage is full (base64 demo stills + many jobs
    // blow the ~5MB cap fast). Instead of letting this throw and blank the whole
    // app (React unmounts on an unhandled render-path error), shed load and retry.
    console.warn('[storage] quota hit, pruning to recover:', e?.name || e)
    try {
      if (key === JOBS_KEY && Array.isArray(value)) {
        // Keep the newest 40 jobs; strip heavy inline base64 assets from the rest.
        const trimmed = value.slice(0, 40).map(j => j)
        localStorage.setItem(key, JSON.stringify(trimmed))
        return
      }
      // Last resort: drop the oldest jobs entirely, then retry the original write.
      const jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]')
      if (Array.isArray(jobs) && jobs.length > 10) {
        localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 10)))
      }
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e2) {
      // Give up quietly rather than crashing the UI. The in-memory React state
      // still holds the jobs for this session; only persistence is degraded.
      console.error('[storage] could not persist after pruning:', e2?.name || e2)
    }
  }
}

// ── Educators ────────────────────────────────────────────────────────────────

export function getEducators() { return load(KEYS.educators) }

export function saveEducator(educator) {
  const all = getEducators()
  const existing = all.findIndex(e => e.id === educator.id)
  if (existing >= 0) all[existing] = educator
  else all.push({ ...educator, id: educator.id || crypto.randomUUID() })
  save(KEYS.educators, all)
  return all
}

export function deleteEducator(id) {
  const all = getEducators().filter(e => e.id !== id)
  save(KEYS.educators, all)
  return all
}

// ── Locations ────────────────────────────────────────────────────────────────

export function getLocations() { return load(KEYS.locations) }

export function saveLocation(location) {
  const all = getLocations()
  const existing = all.findIndex(l => l.slug === location.slug)
  if (existing >= 0) all[existing] = location
  else all.push(location)
  save(KEYS.locations, all)
  return all
}

export function deleteLocation(slug) {
  const all = getLocations().filter(l => l.slug !== slug)
  save(KEYS.locations, all)
  return all
}

// ── Resolve @slug references in a narrative string ───────────────────────────
export function resolveAtSlugs(text, locations) {
  if (!text) return { resolved: text, usedLocations: [] }
  const used = []
  const resolved = text.replace(/@([\w_-]+)/g, (match, slug) => {
    const loc = locations.find(l => l.slug === slug)
    if (!loc) return match
    used.push(loc)
    const details = loc.details?.join(', ') || ''
    const lighting = loc.lighting?.join(', ') || ''
    return `[${loc.description}${details ? '; ' + details : ''}${lighting ? '; lighting: ' + lighting : ''}]`
  })
  return { resolved, usedLocations: used }
}

// ── Lessons ───────────────────────────────────────────────────────────────────

export function getLessons() { return load(KEYS.lessons) }

export function saveLesson(lesson) {
  const all = getLessons()
  const id = lesson.id || crypto.randomUUID()
  const record = { ...lesson, id, savedAt: new Date().toISOString() }
  const existing = all.findIndex(l => l.id === id)
  if (existing >= 0) {
    // Hard backstop: a locked/bespoke lesson can never be overwritten in place.
    // If something tries, we fork it to a fresh copy so the original survives.
    if (all[existing].locked) {
      const forked = { ...record, id: crypto.randomUUID(), locked: false, isBespoke: false,
        lessonTitle: `${record.lessonTitle} (copy)` }
      all.unshift(forked)
      save(KEYS.lessons, all)
      return forked
    }
    all[existing] = record
  } else {
    all.unshift(record)
  }
  save(KEYS.lessons, all)
  return record
}

export function deleteLesson(id) {
  const all = getLessons().filter(l => l.id !== id)
  save(KEYS.lessons, all)
  return all
}

// ── YAML export ───────────────────────────────────────────────────────────────
export function toYAML(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'boolean') return String(obj)
  if (typeof obj === 'number') return String(obj)
  if (typeof obj === 'string') {
    if (obj.includes('\n')) return '|\n' + obj.split('\n').map(l => pad + '  ' + l).join('\n')
    if (/[:#\[\]{}&*!|>'"%@`]/.test(obj) || obj.trim() !== obj) return JSON.stringify(obj)
    return obj
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return '\n' + obj.map(item => `${pad}- ${toYAML(item, indent + 1)}`).join('\n')
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    return '\n' + entries.map(([k, v]) => {
      const val = toYAML(v, indent + 1)
      return `${pad}${k}: ${val}`
    }).join('\n')
  }
  return String(obj)
}

export function exportLessonYAML(lesson) {
  const yaml = `# LessonForge Shot Plan\n# Generated: ${new Date().toISOString()}\n\nlesson:${toYAML(lesson, 1)}\n`
  const blob = new Blob([yaml], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lesson.lessonTitle?.replace(/\s+/g, '_') || 'lesson'}_shotplan.yaml`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Demo educator definitions (source of truth) ───────────────────────────────
const DEMO_EDUCATORS = [
  {
    id: 'demo-educator-1',
    name: 'Dr. Sarah Chen',
    role: 'Professor of Computer Science',
    portrait: sarahChen,
    appearance: 'Professional academic in her 40s, warm smile, dark hair, wearing a smart blazer. Confident and approachable on camera.',
    gender: 'female',
    accent: 'neutral North American English',
    wardrobe: 'a smart charcoal-navy blazer over a white blouse',
    voiceStyle: 'Clear, measured, enthusiastic — speaks with authority but never condescending',
    onScreenNotes: 'Use in talking-head shots and whiteboard explanations. Always well-lit, shallow depth of field.',
  },
  {
    id: 'demo-educator-2',
    name: 'Prof. James Okafor',
    role: 'Senior Lecturer, Data Science',
    portrait: jamesOkafor,
    appearance: 'Tall, distinguished man in his 50s, greying temples, often in a dark shirt. Thoughtful and precise in delivery.',
    gender: 'male',
    accent: 'British-Nigerian English',
    wardrobe: 'a dark charcoal shirt',
    voiceStyle: 'Deep, deliberate, uses well-placed pauses for emphasis',
    onScreenNotes: 'Works well in studio and outdoor settings. Good for conceptual and philosophical framing shots.',
  },
  {
    id: 'demo-educator-3',
    name: 'Dr. Amara Okeke',
    role: 'Consultant Physician & Medical Educator',
    portrait: amaraOkeke,
    appearance: 'Nigerian woman in her early 40s, warm confident smile, dark natural hair, wearing a white doctor\'s coat over a smart navy blouse with a stethoscope. Authoritative yet approachable on camera.',
    gender: 'female',
    accent: 'warm West African English',
    wardrobe: 'a white doctor\'s coat over a smart navy blouse with a stethoscope',
    voiceStyle: 'Warm, articulate and reassuring — explains complex medicine in plain, vivid language',
    onScreenNotes: 'Ideal for medical, biology and health-science lessons. Use in clinical or studio settings with clean, bright lighting.',
  },
  {
    id: 'demo-educator-4',
    name: 'Mr. Raj Sterling',
    role: 'History Teacher',
    portrait: rajSterling,
    appearance: 'Anglo-Indian man in his late 40s, light brown skin, neatly combed dark hair greying at the temples, warm intelligent expression. Wearing a tweed blazer over a crisp open-collar shirt. Scholarly and approachable on camera.',
    gender: 'male',
    accent: 'refined British English',
    wardrobe: 'a tweed blazer over a crisp open-collar shirt',
    voiceStyle: 'Engaging storyteller — vivid, evocative delivery that brings historical events to life',
    onScreenNotes: 'Perfect for history, humanities and reenactment-style lessons. Works in studio, library and on-location heritage settings.',
  },
  {
    id: 'edu_robo_nova',
    name: 'Nova (Teaching Robot)',
    subject: 'STEM & General Science',
    portrait: roboTeacher,
    appearance: 'Nova is a friendly humanoid teaching robot with a single consistent design in EVERY shot. HEAD: a rounded, glossy pure-white helmet-shaped head; the entire face is one smooth curved glossy black glass panel (like a dark visor) set into the white head. EYES: exactly two large glowing cyan-blue oval eyes on the black face panel, evenly spaced, softly luminous. MOUTH: a single small curved glowing cyan smile line below and between the eyes — friendly, gentle. A slim glowing cyan-blue accent ring outlines the black face panel. ANTENNAE: exactly two thin white antennae rising from the top of the head, each tipped with a small round white ball. BODY: a smooth glossy white robotic torso and shoulders with soft rounded edges and subtle pale-blue seam lines; matte-white articulated arms. No hair, no human skin, no visible wires, no screen text on the face. Proportions: friendly and approachable, slightly stylised, never menacing or industrial. Clean studio lighting, soft reflections on the white shell. This EXACT robot — same white head, same black visor face, same two cyan eyes, same cyan smile, same two ball-tipped antennae — appears identically in every single shot.',
    gender: 'neutral',
    accent: 'a clear, warm, friendly synthetic voice with a neutral English accent',
    wardrobe: 'its own fixed body: a glossy pure-white robotic chassis with soft rounded edges, pale-blue seam accents, a black glass visor face with two glowing cyan eyes and a cyan smile, and two thin white ball-tipped antennae — NO clothing, and this identical shell/colouring in every shot',
    isRobot: true,
  },
]

// ── Seed / patch demo data ────────────────────────────────────────────────────
export function seedDemoDataIfEmpty() {
  const existing = getEducators()

  if (existing.length === 0) {
    // Fresh install — write full demo educators
    save(KEYS.educators, DEMO_EDUCATORS)
  } else {
    // Already seeded — patch portraits onto demo educators if missing
    let changed = false
    let patched = existing.map(ed => {
      const demo = DEMO_EDUCATORS.find(d => d.id === ed.id)
      if (demo && !ed.portrait) {
        changed = true
        return { ...ed, portrait: demo.portrait }
      }
      return ed
    })
    // Append any newly-added demo educators that aren't present yet
    for (const demo of DEMO_EDUCATORS) {
      if (!patched.some(ed => ed.id === demo.id)) {
        patched = [...patched, demo]
        changed = true
      }
    }
    if (changed) save(KEYS.educators, patched)
  }

  if (getLocations().length === 0) {
    save(KEYS.locations, [
      {
        slug: 'lecture_hall',
        name: 'Modern Lecture Hall',
        group: 'University',
        image: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/4bf393da2_generated_image.png',
        description: 'A state-of-the-art university lecture hall with tiered seating, large projection screens, and modern LED lighting',
        details: ['tiered seating for 200 students', 'large dual projection screens', 'modern LED overhead lighting', 'clean wooden desks'],
        lighting: ['cool overhead LED lighting', 'warm accent lighting on the stage', 'soft ambient light from windows'],
      },
      {
        slug: 'gpu_lab',
        name: 'WAN Research Lab',
        group: 'Technology',
        image: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/20a95fba4_generated_image.png',
        description: 'A cutting-edge AI research laboratory packed with GPU servers, glowing rack lights, and multiple monitors displaying neural network visualisations',
        details: ['rows of GPU server racks with glowing amber accents', 'multiple ultrawide monitors', 'cable management with LED strips', 'clean white walls with subtle branding'],
        lighting: ['dramatic blue and amber rack lighting', 'cool white overhead strip lights', 'monitor glow as fill light'],
      },
      {
        slug: 'studio_dark',
        name: 'Dark Presentation Studio',
        group: 'Studio',
        image: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/3c35a06ec_generated_image.png',
        description: 'A professional dark studio with a clean backdrop, cinematic lighting, and a minimalist presenter setup',
        details: ['seamless dark backdrop', 'clean minimalist desk', 'professional microphone and teleprompter'],
        lighting: ['three-point key, fill and rim lighting', 'subtle background gradient lighting', 'warm key light on presenter'],
      },
    ])
  } else {
    // Already seeded — backfill thumbnails onto demo locations that lack one
    const DEMO_LOCATION_IMAGES = {
      lecture_hall: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/4bf393da2_generated_image.png',
      gpu_lab: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/20a95fba4_generated_image.png',
      studio_dark: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/3c35a06ec_generated_image.png',
    }
    let locs = getLocations()
    let changed = false
    locs = locs.map(loc => {
      let next = loc
      if (!next.image && DEMO_LOCATION_IMAGES[next.slug]) {
        changed = true
        next = { ...next, image: DEMO_LOCATION_IMAGES[next.slug] }
      }
      // Rebrand migration: rename the old 'AMD GPU Research Lab' sample to
      // 'WAN Research Lab' for existing installs — but only if the user hasn't
      // renamed it themselves (still matches the seeded AMD name).
      if (next.slug === 'gpu_lab' && next.name === 'AMD GPU Research Lab') {
        changed = true
        next = { ...next, name: 'WAN Research Lab' }
      }
      return next
    })
    if (changed) save(KEYS.locations, locs)
  }
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
// Lightweight job metadata — just enough to track render status and reconnect
// to a ComfyUI job if the page refreshes mid-render.

const JOBS_KEY = 'lf_jobs'
const MAX_JOBS = 300 // cap to avoid bloating localStorage (raised: 50 was evicting in-flight shots)

export function getJobs() { return load(JOBS_KEY, []) }

// Trim history to MAX_JOBS WITHOUT ever evicting jobs that are still in flight
// or still awaiting review — only the oldest settled jobs are dropped. This was
// the cause of "a few shots never reach the render screen": the old blanket
// slice(0, 50) could delete a shot that was still rendering.
function capJobs(all) {
  if (all.length <= MAX_JOBS) return all
  const protectedJobs = []
  const trimmable = []
  for (const j of all) {
    const active = ACTIVE_STATUSES.includes(j.status)
    const pendingReview = (j.reviewStatus || 'pending_review') === 'pending_review'
    if (active || pendingReview) protectedJobs.push(j)
    else trimmable.push(j)
  }
  const keepTrimmable = Math.max(0, MAX_JOBS - protectedJobs.length)
  return [...protectedJobs, ...trimmable.slice(0, keepTrimmable)]
}

export function saveJob(job) {
  const all = getJobs()
  const existing = all.findIndex(j => j.id === job.id)
  if (existing >= 0) all[existing] = job
  else all.unshift(job)
  save(JOBS_KEY, capJobs(all))
  return job
}

export function updateJob(id, patch) {
  const all = getJobs()
  const idx = all.findIndex(j => j.id === id)
  if (idx < 0) {
    // The job was evicted mid-render — re-insert it so the shot isn't lost.
    const revived = { id, ...patch }
    all.unshift(revived)
    save(JOBS_KEY, capJobs(all))
    return revived
  }
  all[idx] = { ...all[idx], ...patch }
  save(JOBS_KEY, capJobs(all))
  return all[idx]
}

export function clearJobs() {
  save(JOBS_KEY, [])
}

// Remove all demo jobs. Called at the start of each new demo run so the Review
// & Render queues show only the latest sample lesson, never stale demo shots.
export function clearDemoJobs() {
  const all = getJobs().filter(j => !j.isDemo)
  save(JOBS_KEY, all)
  return all
}

// Remove only jobs stuck mid-render (never completed). Keeps done/error history.
const STUCK_STATUSES = ['queued', 'uploading', 'building', 'generating']
export function clearStuckJobs() {
  const all = getJobs().filter(j => !STUCK_STATUSES.includes(j.status))
  save(JOBS_KEY, all)
  return all
}

// Remove all jobs that belong to a given lesson (used when a lesson is deleted).
export function deleteJobsByLesson(lessonId) {
  if (!lessonId) return getJobs()
  const all = getJobs().filter(j => j.lessonId !== lessonId)
  save(JOBS_KEY, all)
  return all
}

// Garbage-collect orphan jobs: any job whose lessonId no longer matches an
// existing lesson (or was never stamped) is cruft left over from deleted
// lessons or pre-cascade builds. Call on load and after deletions.
export function pruneOrphanJobs() {
  const liveIds = new Set(getLessons().map(l => l.id))
  const all = getJobs().filter(j => j.lessonId && liveIds.has(j.lessonId))
  save(JOBS_KEY, all)
  return all
}

// Auto-fail jobs that have been "rendering" longer than a sane timeout. Without
// a live render endpoint to flip them to done/error, active jobs would spin
// forever and pile up as cruft. Marks them as errored so they're clearable.
const ACTIVE_STATUSES = ['queued', 'uploading', 'building', 'generating']
const STALE_MS = 8 * 60 * 1000 // 8 minutes (Wan i2v can take 3-4 min; don't kill live renders)
export function failStaleJobs() {
  const now = Date.now()
  let changed = false
  const all = getJobs().map(j => {
    const startedRaw = j.startedAt || j.createdAt
    const started = startedRaw ? new Date(startedRaw).getTime() : 0
    const stale = started && now - started > STALE_MS

    // Case 1: low-level render status stuck active (still/preview never returned).
    if (ACTIVE_STATUSES.includes(j.status) && stale) {
      changed = true
      return { ...j, status: 'error', statusDetail: 'Render timed out', error: 'No render response — endpoint offline or job abandoned.' }
    }

    // Case 2: VIDEO render orphaned. handleRenderApproved sets reviewStatus:'generating'
    // when you click "Render approved video"; if that render died (e.g. backend
    // changed mid-flight) the shot is pinned at reviewStatus:'generating' forever,
    // so the header shows "rendering N · 0 approved · 0 to review". If it already
    // has a video it's really done; otherwise fall BACK to 'approved' so it shows
    // as approved and can be re-rendered — never silently lost.
    if (j.reviewStatus === 'generating' && stale) {
      changed = true
      if (j.video || j.videoUrl) return { ...j, reviewStatus: 'done' }
      return { ...j, reviewStatus: 'approved', statusDetail: 'Previous video render was interrupted — re-render when ready.' }
    }
    return j
  })
  if (changed) save(JOBS_KEY, all)
  return all
}
