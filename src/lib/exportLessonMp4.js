/**
 * exportLessonMp4 — browser-side "join all shots into one downloadable video".
 *
 * There's no server-side stitching in the MVP; the Lesson Player just plays each
 * shot's clip back-to-back as a playlist. This module produces a SINGLE file the
 * user can download, entirely client-side, by:
 *
 *   1. Drawing each shot's clip (or still) frame-by-frame onto a hidden <canvas>.
 *   2. Piping the canvas video track + each clip's audio track into one
 *      MediaStream, recorded with MediaRecorder.
 *   3. Concatenating shots sequentially (shot 2 starts when shot 1 ends).
 *
 * Caveats (be honest with the user):
 *   - Records in REAL TIME — a 60s lesson takes ~60s to export.
 *   - Output container is WebM (VP9/VP8 + Opus), not a true .mp4. Most players,
 *     Slack, and web upload forms accept it fine; for a real .mp4 use the
 *     server-side ffmpeg concat path (Option B) on the AMD box.
 *   - Stills are held for `stillDwellMs` with the voiceover text drawn on frame.
 *   - Remote clips must be CORS-readable or the canvas taints and recording
 *     fails; ComfyUI must send Access-Control-Allow-Origin (--enable-cors-header).
 *
 * Usage:
 *   const blob = await exportLessonMp4({ playlist, onProgress })
 *   // playlist: [{ index, title, voiceover, videoUrl, image, durationMs? }]
 */

const W = 1280
const H = 720
const STILL_DWELL_MS = 6000

function pickMimeType() {
  const candidates = [
    'video/mp4;codecs=h264,aac',      // Safari may honor this → real .mp4
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return 'video/webm'
}

function extForMime(mime) {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm'
}

// Draw a still (image + wrapped voiceover caption) onto the canvas ctx.
function drawStill(ctx, img, caption) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  if (img) {
    // cover-fit the image
    const ir = img.width / img.height
    const cr = W / H
    let dw, dh, dx, dy
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0 }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2 }
    ctx.drawImage(img, dx, dy, dw, dh)
    // darken lower third for legible caption
    const grad = ctx.createLinearGradient(0, H * 0.6, 0, H)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.75)')
    ctx.fillStyle = grad
    ctx.fillRect(0, H * 0.6, W, H * 0.4)
  }
  if (caption) drawCaption(ctx, caption)
}

function drawCaption(ctx, text) {
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'bottom'
  const maxW = W - 120
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  const shown = lines.slice(-3) // last 3 lines max
  let y = H - 40
  for (let i = shown.length - 1; i >= 0; i--) {
    ctx.fillText(shown[i], 60, y)
    y -= 40
  }
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Draw a media element (video or image) into a target rect with object-fit:cover.
function drawCover(ctx, el, natW, natH, rx, ry, rw, rh) {
  if (!natW || !natH) return
  const ir = natW / natH
  const rr = rw / rh
  let dw, dh, dx, dy
  if (ir > rr) { dh = rh; dw = rh * ir; dx = rx + (rw - dw) / 2; dy = ry }
  else { dw = rw; dh = rw / ir; dx = rx; dy = ry + (rh - dh) / 2 }
  ctx.save()
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip()
  ctx.drawImage(el, dx, dy, dw, dh)
  ctx.restore()
}

// Play a shot's clip(s) onto the canvas, routing audio into `audioDest`.
// NORMAL shot: the presenter clip fills the frame (its audio is the narration).
// SPLIT shot:  presenter clip (with audio) fills the LEFT pane; the scene clip
//              (muted, looping) fills the RIGHT pane. If there's no scene clip,
//              a scene still image is held in the right pane instead.
// The PRESENTER clip always drives timing + audio; the shot ends when it ends.
function playClip(clip, ctx, audioCtx, audioDest) {
  return new Promise((resolve) => {
    const isSplit = clip.layout === 'split' && (clip.sceneVideoUrl || clip.sceneImage)
    const LEFT_W = isSplit ? Math.round(W * 0.5) : W

    // Presenter (drives audio + timing).
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.preload = 'auto'
    v.src = clip.videoUrl
    v.muted = false
    v.playsInline = true

    // Right pane: a scene clip (video) or a still image.
    let sceneVid = null, sceneImg = null
    if (isSplit) {
      if (clip.sceneVideoUrl) {
        sceneVid = document.createElement('video')
        sceneVid.crossOrigin = 'anonymous'
        sceneVid.src = clip.sceneVideoUrl
        sceneVid.muted = true
        sceneVid.loop = true
        sceneVid.playsInline = true
        sceneVid.oncanplay = () => { sceneVid.play().catch(() => {}) }
        sceneVid.onerror = () => { sceneVid = null }
      } else if (clip.sceneImage) {
        sceneImg = new Image()
        sceneImg.crossOrigin = 'anonymous'
        sceneImg.src = clip.sceneImage
        sceneImg.onerror = () => { sceneImg = null }
      }
    }

    let srcNode = null
    let raf = 0
    let settled = false
    let watchdog = 0
    let stallTimer = 0

    const cleanup = (reason) => {
      if (settled) return
      settled = true
      if (reason) console.log(`[export] shot ${clip.index}: end (${reason})`)
      cancelAnimationFrame(raf)
      clearTimeout(watchdog)
      clearInterval(stallTimer)
      // Do NOT disconnect the source node synchronously — a race with the
      // MediaRecorder can drop the tail of the audio. Pause the element; the
      // audio graph flushes on its own.
      try { v.pause() } catch {}
      try { sceneVid && sceneVid.pause() } catch {}
      resolve()
    }

    // Wire audio as soon as we CAN (metadata), regardless of decode success, so
    // narration always records even if the video frame later stalls.
    const wireAudio = () => {
      if (srcNode) return
      try {
        srcNode = audioCtx.createMediaElementSource(v)
        srcNode.connect(audioDest)
      } catch { /* no audio track / already wired — fine */ }
    }
    v.onloadedmetadata = wireAudio

    // Start playback once we have enough data. If play() rejects (autoplay /
    // decode), still try to run on whatever frames we get rather than aborting
    // the whole shot (which is what caused later shots to vanish).
    const tryPlay = () => {
      wireAudio()
      v.play().catch(err => {
        console.warn(`[export] shot ${clip.index}: play() rejected —`, err?.name || err)
      })
    }
    v.oncanplay = tryPlay
    v.oncanplaythrough = tryPlay

    v.onended = () => cleanup('ended')
    v.onerror = () => {
      // A failed clip should NOT kill the export. Hold its still (or black) for
      // a sensible dwell so the audio/timeline stays intact, then move on.
      console.warn(`[export] shot ${clip.index}: video error, code`, v.error?.code)
      if (!settled) {
        const fallbackMs = Math.max(2000, (clip.durationMs || 4000))
        setTimeout(() => cleanup('error-fallback'), fallbackMs)
      }
    }

    // ── Watchdog: absolute max per shot so nothing can hang the recorder. ──
    const MAX_SHOT_MS = 20000
    watchdog = setTimeout(() => cleanup('watchdog'), MAX_SHOT_MS)

    // ── Stall guard: if the clip is playing but currentTime stops advancing
    //    (a decode stall that would otherwise record silence/black), bail. ──
    let lastT = -1, stalls = 0
    stallTimer = setInterval(() => {
      if (settled) return
      // Once metadata gives us a real duration, end at duration as a backstop
      // for browsers where 'ended' doesn't fire on captured streams.
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime >= v.duration - 0.08) {
        cleanup('duration-reached'); return
      }
      if (!v.paused) {
        if (Math.abs(v.currentTime - lastT) < 0.01) {
          if (++stalls >= 6) cleanup('stalled') // ~1.5s of no progress
        } else stalls = 0
        lastT = v.currentTime
      }
    }, 250)

    const draw = () => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      // LEFT / full: presenter
      if (v.readyState >= 2 && v.videoWidth) {
        drawCover(ctx, v, v.videoWidth, v.videoHeight, 0, 0, LEFT_W, H)
      } else if (clip.presenterUrl && presenterFallback && presenterFallback.complete) {
        drawCover(ctx, presenterFallback, presenterFallback.naturalWidth, presenterFallback.naturalHeight, 0, 0, LEFT_W, H)
      }
      // RIGHT: scene clip or still
      if (isSplit) {
        const RX = LEFT_W, RW = W - LEFT_W
        if (sceneVid && sceneVid.readyState >= 2) {
          drawCover(ctx, sceneVid, sceneVid.videoWidth, sceneVid.videoHeight, RX, 0, RW, H)
        } else if (sceneImg && sceneImg.complete && sceneImg.naturalWidth) {
          drawCover(ctx, sceneImg, sceneImg.naturalWidth, sceneImg.naturalHeight, RX, 0, RW, H)
        }
        // thin divider
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(LEFT_W - 1, 0, 2, H)
      }
      // Caption the narration so a black/stalled frame still reads as content.
      raf = requestAnimationFrame(draw)
    }

    // Preload a presenter still so a stalled LEFT pane shows the face, not black.
    let presenterFallback = null
    if (clip.presenterUrl) {
      presenterFallback = new Image()
      presenterFallback.crossOrigin = 'anonymous'
      presenterFallback.src = clip.presenterUrl
      presenterFallback.onerror = () => { presenterFallback = null }
    }

    draw()
  })
}

// Hold a still on the canvas for `ms`, with its caption.
function holdStill(img, caption, ctx, ms) {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      drawStill(ctx, img, caption)
      if (performance.now() - start >= ms) return resolve()
      requestAnimationFrame(tick)
    }
    tick()
  })
}

export async function exportLessonMp4({ playlist, stillDwellMs = STILL_DWELL_MS, onProgress = () => {} } = {}) {
  if (!playlist || playlist.length === 0) throw new Error('Nothing to export — this lesson has no shots.')

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)

  // Audio graph: every clip's audio → this destination → recorded track.
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const audioCtx = new AudioCtx()
  const audioDest = audioCtx.createMediaStreamDestination()

  // Combined stream = canvas video + mixed audio.
  const canvasStream = canvas.captureStream(30)
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ])

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }

  const done = new Promise((resolve) => { recorder.onstop = resolve })
  recorder.start(250)
  // Some browsers suspend the AudioContext until a user gesture; this runs from
  // a click handler so resume() should succeed.
  try { await audioCtx.resume() } catch {}

  for (let i = 0; i < playlist.length; i++) {
    const shot = playlist[i]
    onProgress({ index: i, total: playlist.length, title: shot.title, phase: 'rendering' })
    if (shot.videoUrl) {
      await playClip(shot, ctx, audioCtx, audioDest)
    } else {
      const img = await loadImage(shot.image)
      await holdStill(img, shot.voiceover, ctx, shot.durationMs || stillDwellMs)
    }
  }

  onProgress({ index: playlist.length, total: playlist.length, phase: 'finalizing' })
  recorder.stop()
  await done
  try { audioCtx.close() } catch {}

  const blob = new Blob(chunks, { type: mimeType })
  return { blob, ext: extForMime(mimeType), mimeType }
}

// Convenience: run the export and trigger a browser download.
export async function downloadLessonMp4({ playlist, filename = 'lesson', onProgress } = {}) {
  const { blob, ext } = await exportLessonMp4({ playlist, onProgress })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { ext }
}
