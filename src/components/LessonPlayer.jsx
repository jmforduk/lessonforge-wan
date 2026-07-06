/**
 * LessonPlayer — a "watch the finished lesson" modal.
 *
 * Plays a lesson's shots back-to-back like a finished video: each shot shows its
 * rendered clip (videoUrl) when available, otherwise its still image with the
 * voiceover as a caption. Auto-advances to the next shot when a clip ends (or
 * after a dwell time for stills). Gives judges a polished end-to-end payoff:
 * generate → review → render → WATCH.
 *
 * Props:
 *   lesson  — the lesson record ({ id, lessonTitle, shots: [...] })
 *   jobs    — all render jobs; we match by lessonId + shotIndex to pull
 *             videoUrl / sceneImage / faceswapImage per shot.
 *   onClose — close the player.
 *   onExport(lesson) — optional; export the lesson (YAML).
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { comfyFileUrl } from '../lib/wan.js'
import { downloadLessonMp4 } from '../lib/exportLessonMp4.js'
import { X, ChevronLeft, ChevronRight, Play, Pause, Mic, Film, ImageIcon, Download, Columns2, Clapperboard, Loader2, Volume2 } from 'lucide-react'

const STILL_DWELL_MS = 6000 // how long to hold a still before auto-advancing

export default function LessonPlayer({ lesson, jobs = [], comfyEndpoint, onClose, onExport }) {
  const base = comfyEndpoint?.replace(/\/$/, '') || 'http://localhost:8188'
  // Resolve a media field that may be a plain URL (demo jobs) OR a ComfyUI file
  // object (real renders) into a usable URL.
  const mediaUrl = (v) => (v == null ? null : typeof v === 'string' ? v : comfyFileUrl(base, v))
  // Build an ordered playlist: one entry per shot, enriched with its job media.
  const playlist = useMemo(() => {
    const shots = [...(lesson?.shots || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    return shots.map(shot => {
      const job = jobs.find(j => j.lessonId === lesson.id && j.shotIndex === shot.index)
        || jobs.find(j => j.shotIndex === shot.index && (j.lessonTitle === lesson.lessonTitle))
      return {
        index: shot.index,
        title: shot.title,
        type: shot.type,
        duration: shot.duration,
        voiceover: shot.voiceover || shot.voiceoverScript || '',
        // Real renders store the clip in job.video (a ComfyUI file object); demo
        // jobs store a ready URL in job.videoUrl. Resolve either into a URL.
        videoUrl: mediaUrl(job?.videoUrl || job?.video),
        // Right-frame scene: prefer the person-free ZIT scene still over the
        // faceswap (which is the presenter). External clip via shot.sceneVideoUrl.
        image: mediaUrl(job?.sceneImage || job?.faceswapImage),
        sceneVideoUrl: mediaUrl(shot.sceneVideoUrl || job?.sceneVideoUrl || job?.sceneVideo) || null,
        layout: shot.layout || job?.layout || null,
        // presenter (left column) — dedicated presenter still, then faceswap, then shot fallback
        presenterUrl: mediaUrl(job?.presenterUrl || job?.faceswapImage) || shot.presenterUrl || null,
        presenterBgUrl: mediaUrl(job?.presenterBgUrl) || shot.presenterBgUrl || null,
      }
    })
  }, [lesson, jobs, base])

  // Debug: show what URL each shot resolved to (video vs still) so we can see
  // if the video link is present but not loading (e.g. CORS / mixed content).
  useEffect(() => {
    console.log('[LessonForge] player playlist:', playlist.map(s => ({
      shot: s.index, hasVideo: !!s.videoUrl, videoUrl: s.videoUrl, image: s.image
    })))
  }, [playlist])

  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [mutedFallback, setMutedFallback] = useState(false) // browser blocked autoplay-with-sound; playing muted
  const [videoError, setVideoError] = useState(false)       // clip URL failed to load (e.g. expired OSS link)
  const [exporting, setExporting] = useState(null) // null | { index, total, title, phase }

  const handleDownloadVideo = async () => {
    if (exporting) return
    // Pause live playback so the two don't fight over the same media elements.
    setPlaying(false)
    try {
      const items = playlist.map(p => ({
        index: p.index, title: p.title, voiceover: p.voiceover,
        videoUrl: p.videoUrl, image: p.image,
        // Split shots carry a second (scene) clip for the right pane — pass it
        // through so the exporter can composite presenter-left + scene-right.
        layout: p.layout,
        sceneVideoUrl: p.sceneVideoUrl || null,
        // p.image already resolves to the person-free scene still; p.presenterUrl
        // is the presenter still. Give the exporter both for the split fallback.
        sceneImage: p.image || null,
        presenterUrl: p.presenterUrl || p.image || null,
      }))
      const safeName = (lesson.lessonTitle || 'lesson').replace(/[^\w\-]+/g, '_').slice(0, 60)
      const { ext } = await downloadLessonMp4({
        playlist: items,
        filename: safeName,
        onProgress: (p) => setExporting(p),
      })
      setExporting(null)
      if (ext !== 'mp4') {
        // Let the caller surface a note; keep it quiet here.
        console.log('[LessonForge] exported lesson as .' + ext + ' (browser codec).')
      }
    } catch (e) {
      console.error('[LessonForge] video export failed:', e)
      alert('Video export failed: ' + (e?.message || e) + '\n\nTip: Wan clips are served from Alibaba Cloud OSS with expiring URLs — re-render if a link has expired.')
      setExporting(null)
    }
  }
  const videoRef = useRef(null)
  const stillTimer = useRef(null)
  // Sticky across shots: once the user unmutes (or a gesture unlocks audio),
  // every later shot plays WITH sound instead of silently falling back to muted.
  const audioUnlocked = useRef(false)

  const shot = playlist[current]
  const hasVideo = !!shot?.videoUrl
  // Split-screen only when a SEPARATE scene clip exists (e.g. presenter can't
  // physically be in the scene). Our normal pipeline embeds the presenter in
  // the scene, so a plain rendered clip must play FULL-FRAME, not be squeezed
  // into a 38%% presenter column with a still hogging the rest.
  const isSplit  = shot?.layout === 'split' && !!(shot?.sceneVideoUrl || shot?.image)

  // Reset per-shot playback flags when the current shot changes.
  useEffect(() => { setVideoError(false); if (!audioUnlocked.current) setMutedFallback(false) }, [current])

  const go = (next) => {
    if (next < 0 || next >= playlist.length) { setPlaying(false); return }
    setCurrent(next)
  }

  // Auto-advance logic: video uses onEnded; stills use a timer.
  useEffect(() => {
    clearTimeout(stillTimer.current)
    const v = videoRef.current
    if (!playing) {
      // Paused: actually stop the video too (previously this returned early and
      // left a playing <video> running).
      if (v) v.pause()
      return
    }
    if (hasVideo) {
      if (v) {
        // Wan clips carry a native audio track, so the browser BLOCKS
        // autoplay-with-sound until a user gesture. Try unmuted; if blocked,
        // fall back to muted + show the unmute hint. Once audio is unlocked
        // (user tapped unmute earlier), keep sound ON for every later shot.
        v.muted = false
        v.play().then(() => { audioUnlocked.current = true; setMutedFallback(false) })
          .catch(() => {
            // If the user already unlocked audio this session, a later shot
            // shouldn't be blocked — but guard anyway by retrying muted.
            v.muted = true
            setMutedFallback(true)
            v.play().catch(() => {})
          })
      }
    } else {
      stillTimer.current = setTimeout(() => {
        if (current < playlist.length - 1) setCurrent(current + 1)
        else setPlaying(false)
      }, STILL_DWELL_MS)
    }
    return () => clearTimeout(stillTimer.current)
  }, [current, playing, hasVideo, playlist.length])

  // Keyboard: ← → to navigate, space to toggle play, esc to close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(current + 1)
      else if (e.key === 'ArrowLeft') go(current - 1)
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!shot) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-lg truncate">{lesson.lessonTitle || 'Lesson'}</h2>
            <p className="text-xs text-gray-400">
              Shot {current + 1} of {playlist.length} · {shot.title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDownloadVideo} disabled={!!exporting}
              title="Join all shots into one downloadable video (records in real time)"
              className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {exporting
                ? <><Loader2 size={14} className="animate-spin" /> {exporting.phase === 'finalizing' ? 'Finalizing…' : `Recording ${exporting.index + 1}/${exporting.total}`}</>
                : <><Clapperboard size={14} /> Download video</>}
            </button>
            {onExport && (
              <button onClick={() => onExport(lesson)}
                className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                <Download size={14} /> Export
              </button>
            )}
            <button onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stage */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-gray-800 aspect-video">
          {isSplit ? (
            /* ── Split-screen: presenter talking-head (38%) | scene (62%) ──
               The RENDERED clip is the educator talking-head → plays LEFT (with
               audio). The RIGHT shows the scene: an external clip if provided,
               else the scene still, else a placeholder. ── */
            <div className="w-full h-full flex">
              {/* Left — presenter talking-head (the rendered clip) */}
              <div className="relative h-full basis-[38%] shrink-0 border-r border-gray-800 bg-gray-950 overflow-hidden">
                {hasVideo ? (
                  <video
                    ref={videoRef}
                    key={shot.videoUrl}
                    src={shot.videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay={playing}
                    playsInline
                    onEnded={() => go(current + 1)}
                    onClick={() => setPlaying(p => !p)}
                  />
                ) : shot.presenterUrl ? (
                  <img src={shot.presenterUrl} alt="Presenter"
                    className="relative w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center text-gray-700">
                    <Mic size={28} />
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wide text-gray-300 bg-black/60 rounded px-1.5 py-0.5 backdrop-blur">
                  Presenter
                </span>
                {!hasVideo && shot.presenterUrl && (
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide text-gray-200 bg-black/60 rounded px-1.5 py-0.5 backdrop-blur">
                    Still · no clip yet
                  </span>
                )}
              </div>
              {/* Right — lesson scene (external clip or scene still) */}
              <div className="relative h-full flex-1 bg-black">
                {shot.sceneVideoUrl ? (
                  <video
                    key={shot.sceneVideoUrl}
                    src={shot.sceneVideoUrl}
                    className="w-full h-full object-cover"
                    autoPlay={playing}
                    muted
                    loop
                    playsInline
                  />
                ) : shot.image ? (
                  <img src={shot.image} alt={shot.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                    <Film size={36} />
                    <p className="text-sm px-4 text-center">Scene frame — render a still or drop in a clip here.</p>
                  </div>
                )}
                <span className="absolute bottom-2 right-2 text-[10px] uppercase tracking-wide text-gray-300 bg-black/60 rounded px-1.5 py-0.5 backdrop-blur">
                  Scene
                </span>
              </div>
            </div>
          ) : hasVideo ? (
            <video
              ref={videoRef}
              key={shot.videoUrl}
              src={shot.videoUrl}
              className="w-full h-full object-cover"
              autoPlay={playing}
              playsInline
              onEnded={() => go(current + 1)}
              onError={() => setVideoError(true)}
              onClick={() => setPlaying(p => !p)}
            />
          ) : shot.image ? (
            <img src={shot.image} alt={shot.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2">
              <Film size={40} />
              <p className="text-sm">No media yet — render this shot to watch it here.</p>
            </div>
          )}

          {/* Clip URL failed to load (Wan/OSS links expire) — offer a clear fix. */}
          {hasVideo && videoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 text-center px-6">
              <Film size={36} className="text-gray-500" />
              <p className="text-sm text-gray-200 font-medium">This clip's link has expired</p>
              <p className="text-xs text-gray-400 max-w-xs">Wan clips are served from Alibaba Cloud with time-limited URLs. Re-render this shot in the Editing Suite to get a fresh clip.</p>
            </div>
          )}

          {/* Media-type chip */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-xs text-gray-200 backdrop-blur">
            {isSplit ? <><Columns2 size={12} /> Split screen</> : hasVideo ? <><Film size={12} /> Video</> : <><ImageIcon size={12} /> Still preview</>}
          </div>

          {/* Autoplay-with-sound was blocked → we're playing muted; let the user restore audio. */}
          {hasVideo && mutedFallback && (
            <button
              onClick={() => { const v = videoRef.current; if (v) { v.muted = false; audioUnlocked.current = true; setMutedFallback(false); v.play().catch(() => {}) } }}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-xs font-medium text-white backdrop-blur shadow-lg">
              <Volume2 size={13} /> Tap to unmute
            </button>
          )}

          {/* Voiceover caption */}
          {shot.voiceover && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-12">
              <p className="text-gray-100 text-sm leading-relaxed flex items-start gap-2">
                <Mic size={13} className="text-brand-400 mt-1 shrink-0" />
                <span>{shot.voiceover}</span>
              </p>
            </div>
          )}

          {/* Prev / Next overlays */}
          {current > 0 && (
            <button onClick={() => go(current - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors">
              <ChevronLeft size={22} />
            </button>
          )}
          {current < playlist.length - 1 && (
            <button onClick={() => go(current + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors">
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* Controls + progress dots */}
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setPlaying(p => !p)}
            className="p-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white transition-colors shrink-0">
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div className="flex-1 flex items-center gap-1.5">
            {playlist.map((p, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); setPlaying(true) }}
                title={`Shot ${i + 1}: ${p.title}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? 'bg-brand-400 flex-[2]' : 'bg-gray-700 hover:bg-gray-500 flex-1'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">{current + 1}/{playlist.length}</span>
        </div>
      </div>
    </div>
  )
}
