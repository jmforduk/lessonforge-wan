import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import LessonsLibrary from './components/LessonsLibrary.jsx'
import EditingSuite from './components/EditingSuite.jsx'
import LessonPlayer from './components/LessonPlayer.jsx'
import CreateLessonModal from './components/CreateLessonModal.jsx'
import EducatorScreen from './components/EducatorScreen.jsx'
import LocationsPanel from './components/LocationsPanel.jsx'
import { getEducators, getLocations, seedDemoDataIfEmpty, getJobs, saveJob, updateJob, clearJobs, getLessons, saveLesson, deleteLesson, deleteJobsByLesson, clearStuckJobs, pruneOrphanJobs, failStaleJobs, clearDemoJobs, exportLessonYAML } from './lib/storage.js'
import { renderShot, renderStill, clearComfyHistory } from './lib/wan.js'
import { enrichWithSAF } from './lib/saf.js'
import { exportLessonPDF } from './lib/exportPDF.js'

const DEFAULT_SETTINGS = {
  llmEndpoint: '', // legacy — Qwen now runs through the backend (/api/agent)
  llmApiKey: '',
  llmModel: 'qwen-plus', // Qwen model for the shot-plan agents
  comfyEndpoint: '', // Alibaba Cloud backend URL (Cloudflare Pages Functions proxy)
  safEndpoint: '',
}

const TABS = ['home', 'lessons', 'educators', 'library']

// Royalty-free sample clips used in Demo Mode so the Lesson Player has
// something to play back when no real render backend is connected.
const DEMO_CLIPS = [
  'https://base44.app/api/apps/6a40ea3eb46ed39c11d0f5c0/files/mp/public/6a40ea3eb46ed39c11d0f5c0/eaed33e23_clip1.mp4',
  'https://base44.app/api/apps/6a40ea3eb46ed39c11d0f5c0/files/mp/public/6a40ea3eb46ed39c11d0f5c0/e49424ba0_clip2.mp4',
]

// Sample stills shown in Demo Mode so the Review & Render queues display real
// imagery (educator-at-lectern / lab / studio) without a render backend.
const DEMO_STILLS = [
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/997d69e89_generated_image.png', // S1 eye / lecture hall
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/81a19b45c_generated_image.png', // S2 neuron firing
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/ab6b988c1_generated_image.png', // S3 3-layer network
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/9bf8da958_generated_image.png', // S4 learning split-screen
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/5bb6f9430_generated_image.png', // S5 recap icons
  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/a332722ad_generated_image.png', // S6 student at laptop
]

// ── Self-demo ('lessonforge') split-screen placeholders ─────────────────────
// Split needs TWO stills per shot: a presenter (LEFT) and a person-free scene
// (RIGHT). The neural DEMO_STILLS above are scene-only and don't fit the
// self-demo, so the split self-demo uses these instead. Julian swaps in bespoke
// assets later — order matches self-demo shots 1..6.
const SELF_DEMO_PRESENTER = 'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/d99ed5fb7_generated_image.png'
const SELF_DEMO_SCENE_STILLS = [
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/9976e2d6b_generated_image.png', // S1 empty studio set
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/f3d19f70f_generated_image.png', // S2 glowing orbs exchanging ideas
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/f0afdcb6b_generated_image.png', // S3 scan / approve frame
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/c44322a8f_generated_image.png', // S4 matching portrait frames
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/4269cd603_generated_image.png', // S5 sound rings
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/64ad1df42_generated_image.png', // S6 launch burst
]


// ── Bespoke "Immune System" demo assets (Julian's FilmForge ZIT stills + Wan
// clips), mapped shot-for-shot by index 1..8. Non-split, single-video shots. ──
const IMMUNE_STILLS = [
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/bbb38012b_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_01_image_01.png', // S1 virus + face
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/d3bb4ec69_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_02_image_01.png', // S2 presenter: innate
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/0f9ca53a0_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_03_image_01.png', // S3 macrophage
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/ea67082d7_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_04_image_01.png', // S4 presenter: adaptive
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/b7629d44c_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_05_image_01.png', // S5 empty stage
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/e07794be2_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_06_image_01.png', // S6 antibodies
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/fcdb75475_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_07_image_01.png', // S7 presenter: total defense
  'https://media.base44.com/images/public/6a4a2ee38043353ec21c98cf/47e23b9ec_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_08_image_01.png', // S8 presenter: outro
]
const IMMUNE_CLIPS = [
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/48160c6ec_1eb12d8d3_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_01_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/0fc486f8d_4fed9de32_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_02_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/b598cfd47_fcd5ca820_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_03_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/da1d735de_a4d848b4b_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_04_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/e50c3d17d_b477780c7_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_05_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/41e18ca15_3a431def2_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_06_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/6d95a810a_ce52087af_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_07_video_01.mp4',
  'https://base44.app/api/apps/6a4a2ee38043353ec21c98cf/files/mp/public/6a4a2ee38043353ec21c98cf/469b07aec_2be7ab9de_lessonforge-immune-1783336254202_lessonforge-immune-1783336254202_08_video_01.mp4',
]

// Pick the right demo asset set for the active plan. Non-split variants map a
// single scene still + single clip per shot; split (self-demo) keeps its own.
function demoAssetsFor(variant) {
  if (variant === 'immune') return { stills: IMMUNE_STILLS, clips: IMMUNE_CLIPS }
  return { stills: DEMO_STILLS, clips: DEMO_CLIPS }
}

export default function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('lf_settings') || '{}') }
      // Migration: earlier builds defaulted llmModel to an OpenAI model.
      // DashScope has no gpt-* models — force any stale OpenAI value to Qwen.
      if (!saved.llmModel || /^gpt[-.]/i.test(saved.llmModel)) saved.llmModel = 'qwen-plus'
      // Legacy OpenAI endpoint is unused now (Qwen runs via the backend).
      if (saved.llmEndpoint && /api\.openai\.com/i.test(saved.llmEndpoint)) saved.llmEndpoint = ''
      return saved
    }
    catch { return DEFAULT_SETTINGS }
  })
  const [showSettings, setShowSettings]     = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [shotPlan, setShotPlan]             = useState(null)
  const [lessons, setLessons]               = useState(() => getLessons())
  const [jobs, setJobs]                     = useState(() => { pruneOrphanJobs(); return failStaleJobs() })
  const [activeTab, setActiveTab]           = useState('home')
  const [lessonSubTab, setLessonSubTab]     = useState('library')
  const [demoMode, setDemoMode]             = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('lf_theme') || 'dark')
  // Cue shows on EVERY startup until the user explicitly opts out (lf_hide_cue='1').
  const [showCue, setShowCue] = useState(() => localStorage.getItem('lf_hide_cue') !== '1')
  const closeCue = () => setShowCue(false)                                   // just this session
  const hideCueForever = () => { setShowCue(false); localStorage.setItem('lf_hide_cue', '1') } // never again
  const startDemoFromCue = () => { if (!demoMode) handleToggleDemo(); setActiveTab('home'); closeCue() }
  const [playerLesson, setPlayerLesson] = useState(null) // lesson currently open in the player

  const [educators, setEducators]             = useState([])
  const [locations, setLocations]             = useState([])
  const [selectedEducatorIds, setSelectedEducatorIds] = useState([])

  useEffect(() => {
    seedDemoDataIfEmpty()
    setEducators(getEducators())
    setLocations(getLocations())
  }, [])

  // Apply + persist theme. 'light' adds the academic skin; default is the F1 dark.
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('lf_theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  const selectedEducators = educators.filter(e => selectedEducatorIds.includes(e.id))

  const saveSettings = (s) => {
    setSettings(s)
    localStorage.setItem('lf_settings', JSON.stringify(s))
    setShowSettings(false)
  }

  const handleToggleDemo = () => {
    setDemoMode(v => !v)
    setShotPlan(null)
  }

  const handleOpenCreateModal = () => {
    setShotPlan(null)
    setShowCreateModal(true)
  }

  // Open an existing saved lesson in the modal for editing / re-rendering.
  const handleEditLesson = (lesson) => {
    setShotPlan(lesson)
    setShowCreateModal(true)
  }

  // Clicking a lesson opens its render items in the Editing Suite (not the editor).
  const handleOpenInSuite = (lesson) => {
    setActiveTab('lessons')
    setLessonSubTab('suite')
  }

  // Remove a saved lesson from the library — also drops its shots' review/render jobs.
  const handleDeleteLesson = (id) => {
    deleteLesson(id)
    deleteJobsByLesson(id)
    setLessons(getLessons())
    setJobs(pruneOrphanJobs())
  }

  const handleShotPlanGenerated = (plan) => {
    setShotPlan(plan)
    // Auto-persist the lesson so it shows up in Home > Recent Lessons
    // without the user having to remember to click "Save".
    const saved = saveLesson(plan)
    setShotPlan(saved) // keep the id so re-saves update in place
    setLessons(getLessons())
  }

  // Keep the persisted lesson in sync when the user edits the shot plan.
  const handleShotPlanUpdate = (plan) => {
    setShotPlan(plan)
    if (plan?.id) {
      saveLesson(plan)
      setLessons(getLessons())
      // Re-stamp any EXISTING jobs for this lesson with layout/split fields the
      // user may have just edited in the shot plan. Without this, a shot toggled
      // to 'split' after it was already sent to review keeps layout:null on its
      // job, so the Editing Suite renders it in normal (single-pane) view.
      const byIndex = new Map((plan.shots || []).map(sh => [sh.index, sh]))
      setJobs(prev => prev.map(j => {
        if (j.lessonId !== plan.id && j.lessonTitle !== plan.lessonTitle) return j
        const sh = byIndex.get(j.shotIndex)
        if (!sh) return j
        const patch = {
          layout: sh.layout || null,
          presenter: sh.presenter,
          sceneRightPrompt: sh.sceneRightPrompt || null,
          scenePrompt: sh.scenePrompt || null,
          presenterPrompt: sh.presenterPrompt || null,
          sceneVideoUrl: sh.sceneVideoUrl || null,
        }
        updateJob(j.id, patch)
        return { ...j, ...patch }
      }))
    }
  }

  // ── Patch a job ──────────────────────────────────────────────────────────────
  const patchJob = (id, patch) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j))
    updateJob(id, patch)
  }

  // ── Review actions ───────────────────────────────────────────────────────────
  const handleApprove = (jobId) => patchJob(jobId, { reviewStatus: 'approved' })
  const handleReject  = (jobId) => patchJob(jobId, { reviewStatus: 'rejected' })
  // Recover a shot stuck at reviewStatus:'generating' (a video render that was
  // interrupted). If it already has a clip it's really done; else drop back to
  // 'approved' so it shows correctly and can be re-rendered.
  const handleResetStuck = (jobId) => {
    const j = jobs.find(x => x.id === jobId)
    if (j && (j.video || j.videoUrl)) patchJob(jobId, { reviewStatus: 'done', statusDetail: null })
    else patchJob(jobId, { reviewStatus: 'approved', status: 'idle', statusDetail: 'Render was interrupted — re-render when ready.', error: null })
  }

  // Retry a single failed preview render (e.g. after starting ComfyUI or fixing
  // the endpoint). In demo mode there's no backend, so just restore demo stills.
  const handleRegeneratePreview = async (jobId) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return
    // Respect the CURRENT mode, not the job's stale isDemo flag. Only restore
    // demo stills when Demo Mode is actually ON right now — otherwise always do
    // a real ComfyUI render so "Render preview" genuinely hits the backend.
    if (demoMode) {
      const idx = (job.shotIndex || 1) - 1
      const { stills } = demoAssetsFor(shotPlan?.variant || 'neural')
      patchJob(jobId, {
        status: 'done', reviewStatus: 'pending_review', statusDetail: 'Ready for review',
        error: null, isDemo: true,
        // Split self-demo: presenter (left) + scene still (right); else scene-only.
        ...((job.layout === 'split')
          ? { sceneImage: SELF_DEMO_SCENE_STILLS[idx % SELF_DEMO_SCENE_STILLS.length], faceswapImage: SELF_DEMO_PRESENTER }
          : { sceneImage: stills[idx % stills.length], faceswapImage: stills[idx % stills.length] }),
      })
      return
    }
    const educator = educators.find(e => e.id === job.educatorId) || selectedEducators[0] || educators[0] || null
    if (!educator?.portrait) { alert('Select an educator with a portrait, then retry.'); return }
    const shot = {
      index: job.shotIndex, title: job.title, type: job.type, duration: job.duration,
      voiceover: job.voiceover, videoPrompt: job.prompt, scenePrompt: job.prompt,
      layout: job.layout,
    }
    patchJob(jobId, { status: 'queued', reviewStatus: 'pending_review', error: null, statusDetail: 'Retrying preview…' })
    await runImageJobs([{ ...job, reviewStatus: 'pending_review' }], [shot], educator, job.lessonSlug || 'lesson', settings)
  }

  // ── Send shots to review (close modal, switch to Lessons > Review) ───────────
  const handleSendToReview = async (shots) => {
    const educator = selectedEducators[0] || educators[0] || null

    setShowCreateModal(false)
    setActiveTab('lessons')
    setLessonSubTab('suite')

    if (demoMode) {
      // Fresh demo each run: wipe any earlier demo shots so the queue only ever
      // shows the lesson the judge just generated (real jobs are untouched).
      const remaining = clearDemoJobs()

      // Pick the demo asset set for THIS plan (bespoke immune assets vs neural).
      const variant = shotPlan?.variant || 'neural'
      const { stills: demoStills, clips: demoClips } = demoAssetsFor(variant)

      const newJobs = shots.map((shot, i) => {
        // Resolve the demo stills up-front, but DON'T attach them yet — they're
        // stashed on _pending* and revealed after a faux render delay so the
        // pipeline actually animates Start -> Render candidate images.
        const split = shot.layout === 'split'
        const sIdx = ((shot.index || i + 1) - 1)
        const sceneStill = split
          ? SELF_DEMO_SCENE_STILLS[sIdx % SELF_DEMO_SCENE_STILLS.length]
          : demoStills[sIdx % demoStills.length]
        const presenterStill = split
          ? SELF_DEMO_PRESENTER
          : demoStills[sIdx % demoStills.length]
        const job = {
          id: `demo_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`,
          shotIndex: shot.index,
          title: shot.title,
          type: shot.type,
          duration: shot.duration,
          lessonId: shotPlan?.id || null,
          lessonTitle: shotPlan?.lessonTitle || 'Lesson',
          prompt: shot.videoPrompt,
          voiceover: shot.voiceover || shot.voiceoverScript || '',
          educatorName: educator?.name || null,
          // Enter the suite mid-render (stage 1 -> 2 in-flight) with NO still yet.
          status: 'building',
          statusDetail: 'Rendering candidate image…',
          reviewStatus: 'pending_review',
          isDemo: true,
          promptId: null,
          sceneImage: null,
          faceswapImage: null,
          // Stashed stills, revealed after the faux delay below.
          _pendingScene: sceneStill,
          _pendingPresenter: presenterStill,
          video: null,
          // Stash the demo clip but keep it hidden until the shot is approved &
          // "rendered" — mirrors the real flow (still first, video post-approval).
          videoUrl: null,
          demoVideoUrl: demoClips[((shot.index || i + 1) - 1) % demoClips.length],
          layout: shot.layout || null,
          presenter: shot.presenter,
          sceneRightPrompt: shot.sceneRightPrompt || null,
          scenePrompt: shot.scenePrompt || null,
          presenterPrompt: shot.presenterPrompt || null,
          sceneVideoUrl: shot.sceneVideoUrl || null, // external right-pane clip (split)
          // Keep presenterUrl null while "rendering" so the presenter pane shows a
          // blank placeholder first; the real value is stashed and revealed below.
          presenterUrl: null,
          _pendingPresenterUrl: shot.presenterUrl || educator?.portrait || (shot.layout === 'split' ? SELF_DEMO_PRESENTER : null),
          presenterBgUrl: shot.presenterBgUrl || null,
          error: null,
          createdAt: new Date().toISOString(),
        }
        saveJob(job)
        return job
      })
      setJobs([...newJobs, ...remaining])

      // Faux render: reveal each shot's candidate still after a short, slightly
      // staggered delay so the Start -> Render candidate images animation plays
      // (in real mode this is the actual Wan still-render round-trip).
      ;(async () => {
        for (const job of newJobs) {
          await sleep(2200 + Math.random() * 1600)
          patchJob(job.id, {
            status: 'done',
            statusDetail: 'Candidate image ready',
            sceneImage: job._pendingScene,
            faceswapImage: job._pendingPresenter,
            presenterUrl: job._pendingPresenterUrl,
            _pendingScene: undefined,
            _pendingPresenter: undefined,
            _pendingPresenterUrl: undefined,
          })
        }
      })()
      return
    }

    if (!educator?.portrait) {
      alert('Please select an educator with a portrait photo first.')
      setActiveTab('educators')
      return
    }

    const lessonSlug = (shotPlan?.lessonTitle || 'lesson')
      .replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)

    // SAF enrichment
    let enrichedShots = shots
    if (settings.safEndpoint?.trim()) {
      try {
        const safResult = await enrichWithSAF(
          { lessonTitle: shotPlan?.lessonTitle || 'Lesson', topic: shotPlan?.synopsis || '',
            audience: '', style: '', tone: '', educators: selectedEducators, shots },
          settings.safEndpoint,
          (msg) => console.log('[SAF]', msg)
        )
        enrichedShots = safResult.shots
      } catch (err) {
        console.warn('[SAF] Enrichment failed, continuing with raw shots:', err.message)
      }
    }

    const newJobs = enrichedShots.map((shot, i) => {
      const job = {
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`,
        shotIndex: shot.index, title: shot.title, type: shot.type, duration: shot.duration,
        lessonId: shotPlan?.id || null,
        lessonTitle: shotPlan?.lessonTitle || 'Lesson',
        prompt: shot.videoPrompt,
        voiceover: shot.voiceover || shot.voiceoverScript || '',
        educatorName: educator.name, educatorId: educator.id, lessonSlug,
        status: 'queued', reviewStatus: 'pending_review', isDemo: false,
        promptId: null, sceneImage: null, faceswapImage: null, video: null, error: null,
        layout: shot.layout || null,
        presenter: shot.presenter,                 // split forces presenter on the left
        sceneRightPrompt: shot.sceneRightPrompt || null, // person-free right-pane prompt
        scenePrompt: shot.scenePrompt || null,
        presenterPrompt: shot.presenterPrompt || null,
        sceneVideoUrl: shot.sceneVideoUrl || null, // external right-pane clip (split)
        presenterUrl: educator?.portrait || null,
        presenterBgUrl: shot.presenterBgUrl || null,
        createdAt: new Date().toISOString(),
      }
      saveJob(job)
      return job
    })

    setJobs(prev => [...newJobs, ...prev])
    runImageJobs(newJobs, enrichedShots, educator, lessonSlug, settings)
  }

  // ── Image-only generation (ZIT + ReActor, pre-review) ───────────────────────
  const runImageJobs = async (jobList, shots, educator, lessonSlug, cfg) => {
    for (let i = 0; i < jobList.length; i++) {
      const job = jobList[i]
      const shot = shots.find(s => s.index === job.shotIndex) || shots[i]
      try {
        const result = await renderStill(
          shot, educator, lessonSlug, cfg.comfyEndpoint,
          (status, detail) => patchJob(job.id, { status, statusDetail: detail }),
          { stillModel: cfg.stillModel || settings.stillModel || undefined }
        )
        const still = result.faceswapImage || result.sceneImage
        if (!still) {
          // Completed with no image — don't leave a blank card that looks "missing".
          patchJob(job.id, {
            status: 'error', reviewStatus: 'pending_review',
            statusDetail: 'No image returned for this shot — re-generate it.',
            error: 'Empty ComfyUI output', promptId: result.promptId,
            completedAt: new Date().toISOString(),
          })
        } else {
          patchJob(job.id, {
            status: 'done', reviewStatus: 'pending_review', statusDetail: 'Ready for review',
            promptId: result.promptId, sceneImage: result.sceneImage,
            faceswapImage: result.faceswapImage,
            identityLocked: result.identityLocked ?? null, // did the qwen-image-edit face-lock fire?
            sceneRightImage: result.sceneRightImage || null, // split right-pane preview still
            completedAt: new Date().toISOString(),
          })
        }
      } catch (err) {
        // A thrown error here almost always means ComfyUI was unreachable
        // (e.g. the default localhost:8188 with nothing running, or a CORS
        // block). Surface it clearly on the card instead of silently dropping
        // back to "pending_review" with an empty thumbnail and no feedback.
        const friendly = /failed to fetch|networkerror|load failed|connect/i.test(err.message || '')
          ? `Couldn't reach the render backend at ${cfg.comfyEndpoint || 'your ComfyUI endpoint'}. Start ComfyUI (or set the endpoint in Settings), then re-generate — or switch on Demo Mode to preview without a backend.`
          : (err.message || 'Preview render failed')
        patchJob(job.id, {
          status: 'error', reviewStatus: 'error',
          statusDetail: friendly, error: friendly,
          completedAt: new Date().toISOString(),
        })
      }
    }
  }

  // ── Render approved shots → LTX video ───────────────────────────────────────
  // Re-render the video for a SINGLE shot (e.g. its Wan/OSS clip URL expired,
  // or it was rendered before a prompt fix and has on-screen text). Flips it to
  // 'approved' and runs the same render path for just that one job.
  const handleRerenderVideo = async (jobId) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return
    const educator = selectedEducators[0] || educators[0] || null
    if (!demoMode && !educator?.portrait) { alert('Please select an educator with a portrait first.'); return }
    patchJob(jobId, { reviewStatus: 'generating', statusDetail: 'Re-rendering video…', video: null, sceneVideo: null, error: null })

    if (demoMode) {
      await sleep(2000)
      patchJob(jobId, { status: 'done', reviewStatus: 'done', statusDetail: 'Complete', completedAt: new Date().toISOString() })
      return
    }
    try {
      const shot = { index: job.shotIndex, title: job.title, type: job.type, duration: job.duration,
        videoPrompt: job.prompt, voiceover: job.voiceover, negativePrompt: job.negativePrompt,
        layout: job.layout, presenter: job.presenter,
        sceneRightPrompt: job.sceneRightPrompt, scenePrompt: job.scenePrompt,
        sceneVideoUrl: job.sceneVideoUrl || null, presenterPrompt: job.presenterPrompt }
      const approvedStill = job.faceswapImage || job.sceneImage || null
      const result = await renderShot(
        { ...shot, reviewStill: approvedStill }, educator, job.lessonSlug || 'lesson', settings.comfyEndpoint,
        (status, detail) => patchJob(job.id, { status, statusDetail: detail }),
        { refImage: approvedStill, ltxCheckpoint: settings.ltxCheckpoint || null }
      )
      patchJob(job.id, {
        status: 'done', reviewStatus: 'done', statusDetail: 'Complete', promptId: result.promptId,
        sceneImage: job.sceneImage || result.sceneImage,
        faceswapImage: job.faceswapImage || result.faceswapImage,
        video: result.video, sceneVideo: result.sceneVideo || null,
        completedAt: new Date().toISOString(),
      })
    } catch (err) {
      patchJob(job.id, { status: 'error', reviewStatus: 'error', statusDetail: err.message, error: err.message })
    }
  }

  const handleRenderApproved = async () => {
    const approvedJobs = jobs.filter(j => j.reviewStatus === 'approved')
    if (approvedJobs.length === 0) return

    const educator = selectedEducators[0] || educators[0] || null
    if (!demoMode && !educator?.portrait) { alert('Please select an educator with a portrait first.'); return }

    approvedJobs.forEach(job => patchJob(job.id, { reviewStatus: 'generating', statusDetail: 'Queued for video render…' }))
    setLessonSubTab('suite')

    if (demoMode) {
      for (const job of approvedJobs) {
        patchJob(job.id, { status: 'generating', statusDetail: 'Simulating AMD video render…' })
        await sleep(2500 + Math.random() * 2000)
        // Only now — after approval + "render" — does the video become available.
        patchJob(job.id, { status: 'done', reviewStatus: 'done', statusDetail: 'Complete',
          videoUrl: job.demoVideoUrl || null, completedAt: new Date().toISOString() })
      }
      return
    }

    // Sweep ComfyUI's history/queue once before the batch so its file browser
    // doesn't mix stale outputs from earlier (unrelated) lessons into this run.
    if (settings.comfyEndpoint) await clearComfyHistory(settings.comfyEndpoint)

    for (const job of approvedJobs) {
      try {
        const shot = { index: job.shotIndex, title: job.title, type: job.type, duration: job.duration,
          videoPrompt: job.prompt, voiceover: job.voiceover, negativePrompt: job.negativePrompt,
          // Split-screen fields — without these the video render forgets it's a
          // split shot and never produces the person-free right-pane clip.
          layout: job.layout, presenter: job.presenter,
          sceneRightPrompt: job.sceneRightPrompt, scenePrompt: job.scenePrompt,
          sceneVideoUrl: job.sceneVideoUrl || null, presenterPrompt: job.presenterPrompt }
        // The approved review still is the strongest consistency reference —
        // feed it to wan2.7-i2v as the first_frame so the video animates the
        // exact look you signed off (the ReActor-faceswap equivalent).
        const approvedStill = job.faceswapImage || job.sceneImage || null
        const result = await renderShot(
          { ...shot, reviewStill: approvedStill }, educator, job.lessonSlug || 'lesson', settings.comfyEndpoint,
          (status, detail) => patchJob(job.id, { status, statusDetail: detail }),
          { refImage: approvedStill, ltxCheckpoint: settings.ltxCheckpoint || null }
        )
        patchJob(job.id, {
          status: 'done', reviewStatus: 'done', statusDetail: 'Complete',
          promptId: result.promptId,
          // Keep the approved IMAGE still in the still slots; video goes to video.
          sceneImage: job.sceneImage || result.sceneImage,
          faceswapImage: job.faceswapImage || result.faceswapImage,
          video: result.video,
          sceneVideo: result.sceneVideo || null, // right-pane person-free clip (split)
          completedAt: new Date().toISOString(),
        })
      } catch (err) {
        patchJob(job.id, { status: 'error', reviewStatus: 'error', statusDetail: err.message, error: err.message })
      }
    }
  }

  // ── PDF export ───────────────────────────────────────────────────────────────
  // Export is driven from the All Lessons list, so we always get a concrete
  // lesson object. Resolve THAT lesson's shots + jobs + educator (not the stale
  // in-editor shotPlan / selectedEducators, which were the old bug).
  const handleExportPDF = (lesson) => {
    if (!lesson) { alert('Open a lesson to export its notes.'); return }
    const plan = lesson.shots ? lesson : { ...lesson, shots: lesson.shots || [] }
    const lessonJobs = jobs
      .filter(j => (j.lessonId === lesson.id || j.lessonTitle === lesson.lessonTitle))
      .filter(j => j.reviewStatus !== 'rejected')
      .sort((a, b) => (a.shotIndex ?? 0) - (b.shotIndex ?? 0))
    // Educator: from a job, then the lesson's own educatorId, then first educator.
    const eduId = lessonJobs.find(j => j.educatorId)?.educatorId
      || lesson.educatorId || (lesson.educatorIds || [])[0]
    const educator = educators.find(e => e.id === eduId) || educators[0] || null
    exportLessonPDF(plan, lessonJobs, educator, settings.comfyEndpoint).catch(err => {
      console.error('[LessonForge] PDF export failed:', err)
      alert('PDF export failed: ' + (err?.message || err))
    })
  }

  // ── Tab badge counts ─────────────────────────────────────────────────────────
  const pendingReviewCount = jobs.filter(j => j.reviewStatus === 'pending_review').length
  const renderDoneCount    = jobs.filter(j => j.reviewStatus === 'done').length

  const TAB_LABELS = {
    home:      'Home',
    lessons:   `Lessons${pendingReviewCount > 0 ? ` · ${pendingReviewCount}` : ''}`,
    educators: 'Educators',
    library:   'Locations',
  }

  const LESSON_SUB_TABS = [
    { id: 'library', label: `All Lessons${lessons.length > 0 ? ` (${lessons.length})` : ''}` },
    { id: 'suite',   label: `Editing Suite${pendingReviewCount > 0 ? ` (${pendingReviewCount})` : ''}` },
  ]

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── First-run welcome cue (modal overlay). Shows once — lf_seen_cue_v2.
          Guides new users: Demo Mode → Dr. Sarah Chen → Immune System. ── */}
      {showCue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
             onClick={closeCue}>
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-gray-950 shadow-2xl overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">👋</span>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Welcome — see it work in 10 seconds</h2>
                <p className="text-xs text-amber-200/80 mt-0.5">No setup, no API key needed.</p>
              </div>
              <button onClick={closeCue} aria-label="Close"
                className="ml-auto text-gray-400 hover:text-white text-xl leading-none w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">×</button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-gray-400">The fastest way to understand LessonForge is to watch a lesson it already built. Just:</p>

              <ol className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center">1</span>
                  <span className="text-sm text-gray-200">Turn on <span className="font-semibold text-amber-300">Demo Mode</span> (top-right — or use the button below).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-sm text-gray-200">In <span className="font-semibold text-white">Create Lesson</span>, pick the educator <span className="font-semibold text-brand-300">Dr. Sarah Chen</span>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-sm text-gray-200">Choose the <span className="font-semibold text-brand-300">“Immune System”</span> sample, then watch the plan, previews and finished clips.</span>
                </li>
              </ol>

              <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                <button onClick={startDemoFromCue}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors">
                  Start the demo →
                </button>
                <button onClick={closeCue}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
                  Explore on my own
                </button>
              </div>
              <div className="mt-3 text-center">
                <button onClick={hideCueForever}
                  className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
                  Don&rsquo;t show this again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Header
        onSettings={() => setShowSettings(true)}
        demoMode={demoMode}
        onToggleDemo={handleToggleDemo}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* App-wide Demo banner — makes it unmistakable that presets are applied
          and manual editing is locked. Click to exit demo. */}
      {demoMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/40">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              DEMO MODE
            </span>
            <span className="text-xs text-amber-200/90 flex-1 min-w-0">
              Preset lessons and sample assets are applied — topic, audience and objectives are locked. No API keys needed.
            </span>
            <button onClick={handleToggleDemo}
              className="text-xs font-semibold text-amber-200 hover:text-white underline underline-offset-2 shrink-0">
              Exit demo
            </button>
          </div>
        </div>
      )}

      {/* ── Main tab bar ── */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-16 z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-2 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'lessons') setLessonSubTab('library') }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-gray-900 text-white border border-b-0 border-gray-800'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lessons sub-tab bar ── */}
      {activeTab === 'lessons' && (
        <div className="border-b border-gray-800/60 bg-gray-900/50 sticky top-[calc(4rem+41px)] z-10">
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 pt-1.5 overflow-x-auto">
            {LESSON_SUB_TABS.map(sub => (
              <button key={sub.id} onClick={() => setLessonSubTab(sub.id)}
                className={`px-4 py-1.5 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  lessonSubTab === sub.id
                    ? 'bg-gray-950 text-brand-400 border border-b-0 border-gray-800'
                    : 'text-gray-600 hover:text-gray-400'
                }`}>
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">

        {/* Home */}
        {activeTab === 'home' && (
          <HomeScreen
            onCreateLesson={handleOpenCreateModal}
            onEditLesson={handleEditLesson}
            onTab={(tab) => {
              // Map stat-tile targets to the correct top-level tab + sub-tab.
              if (tab === 'lessons') { setActiveTab('lessons'); setLessonSubTab('library') }
              else if (tab === 'review') { setActiveTab('lessons'); setLessonSubTab('suite') }
              else if (tab === 'queue')  { setActiveTab('lessons'); setLessonSubTab('suite') }
              else if (tab === 'locations') setActiveTab('library')
              else setActiveTab(tab)
            }}
            educators={educators}
            locations={locations}
            lessons={lessons}
            jobs={jobs}
            demoMode={demoMode}
          />
        )}

        {/* Lessons — Editing Suite (merged Review + Render, per-lesson accordion) */}
        {activeTab === 'lessons' && lessonSubTab === 'suite' && (
          <EditingSuite
            jobs={jobs.filter(j => j.reviewStatus !== undefined)}
            lessons={lessons}
            comfyEndpoint={settings.comfyEndpoint}
            demoMode={demoMode}
            onApprove={handleApprove}
            onReject={handleReject}
            onRegenerate={handleRegeneratePreview}
            onRenderApproved={handleRenderApproved}
            onRerenderVideo={handleRerenderVideo}
            onResetStuck={handleResetStuck}
            onWatchLesson={setPlayerLesson}
            onEditLesson={handleEditLesson}
            onDeleteLesson={handleDeleteLesson}
          />
        )}

        {/* Lessons — All Lessons (manage/create; clicking a lesson opens the suite) */}
        {activeTab === 'lessons' && lessonSubTab === 'library' && (
          <LessonsLibrary
            lessons={lessons}
            demoMode={demoMode}
            onOpenLesson={handleOpenInSuite}
            onEditLesson={handleEditLesson}
            onCreateLesson={handleOpenCreateModal}
            onDeleteLesson={handleDeleteLesson}
            onWatchLesson={setPlayerLesson}
            onExportPDF={handleExportPDF}
          />
        )}

        {/* Educators */}
        {activeTab === 'educators' && (
          <EducatorScreen
            educators={educators}
            setEducators={setEducators}
          />
        )}

        {/* Locations */}
        {activeTab === 'library' && (
          <LocationsPanel
            locations={locations}
            setLocations={setLocations}
          />
        )}

      </main>

      {/* ── Modals ── */}
      <CreateLessonModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        settings={settings}
        demoMode={demoMode}
        educators={educators}
        selectedEducatorIds={selectedEducatorIds}
        setSelectedEducatorIds={setSelectedEducatorIds}
        locations={locations}
        shotPlan={shotPlan}
        onShotPlanGenerated={handleShotPlanGenerated}
        onShotPlanUpdate={handleShotPlanUpdate}
        onSendToReview={handleSendToReview}
      />

      {showSettings && (
        <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}

      {playerLesson && (
        <LessonPlayer
          lesson={playerLesson}
          jobs={jobs}
          comfyEndpoint={settings.comfyEndpoint}
          onClose={() => setPlayerLesson(null)}
          onExport={exportLessonYAML}
        />
      )}
    </div>
  )
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
