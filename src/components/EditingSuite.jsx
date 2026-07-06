/**
 * EditingSuite — the single per-lesson production view.
 *
 * Replaces the old Review + Render-Queue sub-tab split. Clicking a lesson here
 * shows ITS render items (not an edit dialog). Structure:
 *
 *   Lesson accordion (expand / collapse)
 *     └─ per shot: STILL (left)  |  VIDEO (right)  side by side
 *        + status, stage hint, and all actions in one place:
 *          Render preview → Approve/Reject → Render video → Download / Watch
 *
 * The still is the human-in-the-loop review artifact; the video is the final
 * render. Seeing them side by side is exactly what a judge wants: "here's the
 * scene we approved, here's what Wan rendered from it."
 *
 * Approve is GATED: disabled until a still exists (you must SEE the preview
 * before committing to the expensive video render).
 *
 * Props (mirrors ReviewQueue + GenerationQueue so App wiring is unchanged):
 *   jobs, comfyEndpoint, demoMode,
 *   onApprove, onReject, onRegenerate, onRenderApproved, onRerenderVideo,
 *   onExportPDF, onWatchLesson, onEditLesson, onDeleteLesson
 */
import { useState } from 'react'
import {
  CheckCircle, XCircle, Clock, Film, Loader2, ChevronDown, ChevronRight,
  RotateCcw, Download, ZoomIn, X, Pencil, Play, Layers, PlayCircle, Lock, Sparkles,
} from 'lucide-react'
import { comfyFileUrl } from '../lib/wan.js'

const STATUS = {
  pending_review: { label: 'Awaiting review', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  approved:       { label: 'Approved',        color: 'text-green-400',  dot: 'bg-green-400' },
  rejected:       { label: 'Rejected',        color: 'text-red-400',    dot: 'bg-red-400' },
  generating:     { label: 'Rendering…',      color: 'text-brand-400',  dot: 'bg-brand-400' },
  done:           { label: 'Done',            color: 'text-green-400',  dot: 'bg-green-400' },
  error:          { label: 'Error',           color: 'text-red-400',    dot: 'bg-red-400' },
}

export default function EditingSuite({
  jobs = [], comfyEndpoint, demoMode,
  onApprove, onReject, onRegenerate, onRenderApproved, onRerenderVideo, onResetStuck,
  onWatchLesson, onEditLesson, onDeleteLesson,
  lessons = [],
}) {
  const base = (comfyEndpoint || 'http://localhost:8188').replace(/\/$/, '')
  const [expanded, setExpanded] = useState({})
  const [lightbox, setLightbox] = useState(null) // { src, alt } | null

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  // Group jobs into lessons.
  const groups = (() => {
    const map = new Map()
    for (const job of jobs) {
      const key = job.lessonId || job.lessonTitle || 'Untitled Lesson'
      if (!map.has(key)) {
        map.set(key, {
          key,
          lessonId: job.lessonId,
          title: job.lessonTitle || 'Untitled Lesson',
          shots: [],
        })
      }
      map.get(key).shots.push(job)
    }
    const arr = [...map.values()]
    arr.forEach(g => g.shots.sort((a, b) => (a.shotIndex ?? 0) - (b.shotIndex ?? 0)))
    arr.sort((a, b) => a.title.localeCompare(b.title))
    return arr
  })()

  const findLesson = (g) => lessons.find(l => l.id === g.lessonId) || lessons.find(l => l.lessonTitle === g.title)

  // Map a single shot/job to its position in the 4-stage pipeline:
  //   1 = needs still, 2 = still ready / in review, 3 = approved (awaiting video),
  //   4 = video rendered (done). Returns 1..4.
  const RENDERING = ['queued', 'uploading', 'building', 'generating']
  function shotStage(j) {
    // 3-stage pipeline: 1 Start → 2 Render candidate images → 3 Render final video.
    if (j.reviewStatus === 'done' || j.video || j.videoUrl) return 3
    // A candidate image exists (or the shot is approved / mid video-render) →
    // stage 2. 'generating'/'approved' stay at 2 so the pipeline doesn't regress
    // while Wan renders the final clip.
    const hasStill = !!(j.faceswapImage || j.sceneImage)
    if (hasStill || j.reviewStatus === 'approved' || j.reviewStatus === 'generating') return 2
    return 1
  }
  function shotActive(j) {
    // A shot is "in-flight" at its current stage if it's actively rendering —
    // either a still render (status in RENDERING) OR a video render in progress
    // (reviewStatus 'generating' = queued/rendering the final clip; its status
    // may still read 'done' from the still until its turn in the batch).
    return RENDERING.includes(j.status) || j.reviewStatus === 'generating'
  }

  // Aggregate: how many shots have COMPLETED each stage (stage k complete = stage > k,
  // or === k for the final stage). Used to fill the top schematic.
  const allShots = jobs
  const stageCounts = [1, 2, 3].map(k => ({
    stage: k,
    done: allShots.filter(j => shotStage(j) > k || (k === 3 && shotStage(j) === 3)).length,
    active: allShots.filter(j => shotActive(j) && shotStage(j) === k).length,
  }))
  const totalShots = allShots.length

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Layers size={40} className="mx-auto mb-4 opacity-20" />
        <p className="text-lg">Nothing in the suite yet.</p>
        <p className="text-sm mt-1">Create a lesson and send its shots here to review stills and render video.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-brand-400" /> Editing Suite
          </h2>
          <p className="text-sm text-gray-400">Render candidate images, pick the ones you like, then render the final video — one lesson at a time.</p>
        </div>
      </div>

      {/* Pipeline schematic — the 4-stage production flow, now LIVE: each stage
          fills as shots pass through it and shows how many shots are there. */}
      <div className="rounded-xl border border-brand-800/40 bg-brand-950/30 px-4 py-4">
        <p className="text-xs font-semibold text-brand-300 mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-800/60 border border-brand-700 text-brand-200 text-[10px] uppercase tracking-wide">Pipeline</span>
          Where your {totalShots} shot{totalShots !== 1 ? 's are' : ' is'} in the process
        </p>
        <ol className="flex items-start justify-between gap-2">
          {[
            { n: 1, Icon: Sparkles, label: 'Start',                   sub: 'Lesson ready to render' },
            { n: 2, Icon: ZoomIn,   label: 'Render candidate images', sub: 'Preview stills to review' },
            { n: 3, Icon: Film,     label: 'Render final video',      sub: 'Wan renders the clip' },
          ].map((step, idx, arr) => {
            const sc = stageCounts[idx]
            const complete = totalShots > 0 && sc.done === totalShots
            const active = sc.active > 0
            const reached = sc.done > 0 || active
            // Every shot has reached AT LEAST this stage (this node's work is done
            // even if the next stage hasn't started) — used to keep the candidate
            // node illuminated once all stills are in.
            const reachedAllHere = totalShots > 0 && allShots.every(j => shotStage(j) >= step.n)
            const illuminated = complete || (reachedAllHere && !active)
            const nextDone = idx < arr.length - 1 ? stageCounts[idx + 1].done : sc.done
            // Count of shots that have reached AT LEAST this node (its work done).
            const reachedCount = allShots.filter(j => shotStage(j) >= step.n).length
            return (
            <li key={step.n} className="relative flex-1 flex flex-col items-center text-center min-w-0">
              {idx < arr.length - 1 && (() => {
                // Is the NEXT stage actively rendering? If so, animate a flowing
                // stripe along this whole segment (Start -> Render candidate images
                // while shots are being rendered). Otherwise show a static fill
                // proportional to how many shots have PASSED the next stage.
                // Animate this segment while shots are actively rendering AT the
                // source node (idx). e.g. Start->Candidate fills while stage-1
                // shots render their still. (Previously checked idx+1, which is
                // where the shot ARRIVES — always 0 mid-render, so it never ran.)
                const nextActive = stageCounts[idx]?.active > 0
                // Have ALL shots reached the NEXT node? Then this segment is fully
                // travelled → solid full line (even before the next stage starts).
                const nextReachedAll = totalShots > 0 && allShots.every(j => shotStage(j) >= (idx + 2))
                const fillPct = nextReachedAll ? 100 : (totalShots ? (nextDone / totalShots) * 100 : 0)
                return (
                  <>
                    <span className="absolute top-4 left-1/2 w-full h-0.5 bg-brand-800/40" aria-hidden="true" />
                    {nextActive ? (
                      /* Steady gradient (dim at Start, bright at the candidate
                         node) with a soft sheen drifting through — builds toward
                         the node, no flashing reset. */
                      <span className="absolute top-4 left-1/2 h-0.5 w-full overflow-hidden rounded-full pipeline-gradient" aria-hidden="true">
                        <span className="absolute inset-y-0 h-full animate-pipeline-sheen" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="absolute top-4 left-1/2 h-0.5 bg-brand-400 transition-all" aria-hidden="true"
                        style={{ width: `${fillPct}%` }} />
                    )}
                    {/* Hint that the Lesson Application Framework is doing its work
                       on the way from Start -> candidate images (only on this first
                       segment, only while it's actively building). */}
                    {nextActive && (idx === 0 || idx === 1) && (
                      /* Positioned within a segment-width track (left-1/2 w-full),
                         then centered inside it — so the pill lands at the MIDPOINT
                         of the connector, not over the Start node. */
                      <span
                        className="absolute left-1/2 w-full flex items-center justify-center pointer-events-none z-30"
                        style={{ top: '17px', transform: 'translateY(-50%)' }}
                        aria-hidden="false"
                      >
                        <span
                          className="whitespace-nowrap px-2.5 py-1 rounded-full
                                     bg-[#0d2b3a] border border-cyan-400/70 text-cyan-100 text-[10px] font-semibold
                                     tracking-wide flex items-center gap-1.5 shadow-[0_0_14px_rgba(34,211,238,0.55)] animate-rise-in
                                     pointer-events-auto"
                          title={idx === 0
                            ? 'Agentic prompt engineering keeps geometry, lighting and characters consistent across shots'
                            : 'Agents assemble the shot and drive the Wan render into the final clip'}
                        >
                          <Sparkles size={11} className="animate-pulse text-cyan-300" />
                          Agents Working…
                        </span>
                      </span>
                    )}
                  </>
                )
              })()}
              <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                illuminated ? 'bg-brand-500 border-brand-300 text-white shadow-[0_0_14px_2px_rgba(96,165,250,0.65)] ring-2 ring-brand-400/40'
                : active ? 'bg-brand-600 border-brand-300 text-white animate-pulse shadow-[0_0_12px_1px_rgba(96,165,250,0.5)]'
                : reached ? 'bg-brand-900 border-brand-500 text-brand-200'
                : 'bg-gray-900 border-gray-700 text-gray-600'
              }`}>
                {illuminated ? <CheckCircle size={15} /> : <step.Icon size={14} />}
              </span>
              <span className={`relative z-10 mt-2 flex items-center gap-1 text-[11px] font-semibold ${reached ? 'text-gray-100' : 'text-gray-500'}`}>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${reached ? 'bg-brand-700 text-brand-100' : 'bg-gray-800 text-gray-500'}`}>{step.n}</span>
                {step.label}
              </span>
              {/* Live count. Start is the entry point (not a stage shots pass
                  THROUGH), so show a plain total there rather than a misleading
                  "6/6". Stages 2 & 3 show reached/total — how many stills/videos
                  are done. */}
              <span className="text-[10px] mt-1 leading-tight">
                {totalShots > 0 ? (
                  step.n === 1 ? (
                    <span className="text-brand-300 font-semibold">{totalShots} shot{totalShots === 1 ? '' : 's'}</span>
                  ) : (
                    <span className={illuminated ? 'text-brand-300 font-semibold' : reached ? 'text-brand-400 font-medium' : 'text-gray-600'}>
                      {reachedCount}/{totalShots}{active ? ` · ${sc.active} rendering` : ''}
                    </span>
                  )
                ) : (
                  <span className="text-gray-600">{step.sub}</span>
                )}
              </span>
            </li>
          )})}
        </ol>
      </div>

      {/* Lesson accordions */}
      {groups.map(group => {
        const isOpen = expanded[group.key] ?? true
        const total = group.shots.length
        const approved = group.shots.filter(j => j.reviewStatus === 'approved').length
        const doneCount = group.shots.filter(j => j.reviewStatus === 'done').length
        const pending = group.shots.filter(j => (j.reviewStatus || 'pending_review') === 'pending_review').length
        const canRenderApproved = approved > 0
        // Video-render in progress: handleRenderApproved flips reviewStatus to
        // 'generating' the moment you click, so match THAT (matching 'approved'
        // here meant the spinner/section vanished the instant rendering started).
        const renderingVideo = group.shots.filter(j =>
          j.reviewStatus === 'generating'
          || (['queued', 'uploading', 'building', 'generating'].includes(j.status)
              && j.reviewStatus === 'approved')).length
        // Shots that still need a preview still rendered (for "Render all previews").
        const needStill = group.shots.filter(j =>
          (j.reviewStatus || 'pending_review') === 'pending_review'
          && !j.faceswapImage && !j.sceneImage
          && !['queued','uploading','building','generating'].includes(j.status)).length
        // Shots with a still, awaiting review — for "Approve all".
        const approvable = group.shots.filter(j =>
          (j.reviewStatus || 'pending_review') === 'pending_review'
          && (j.faceswapImage || j.sceneImage)).length
        // Per-lesson pipeline position: how many of THIS lesson's shots cleared each stage.
        const gStageCounts = [1, 2, 3].map(k => ({
          done: group.shots.filter(j => shotStage(j) > k || (k === 3 && shotStage(j) === 3)).length,
          active: group.shots.filter(j => shotActive(j) && shotStage(j) === k).length,
        }))
        // The lesson's current stage = the lowest stage not yet complete for all shots.
        const curStageIdx = gStageCounts.findIndex(sc => sc.done < total)
        const lessonStage = curStageIdx === -1 ? 3 : curStageIdx + 1
        const STAGE_LABELS = ['Start', 'Render candidate images', 'Render final video']
        const lessonComplete = gStageCounts[2].done === total && total > 0
        const lesson = findLesson(group)

        return (
          <div key={group.key} className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
            {/* Lesson header row — click to expand/collapse */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/60">
              <button onClick={() => toggle(group.key)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                {isOpen ? <ChevronDown size={18} className="text-gray-400 shrink-0" /> : <ChevronRight size={18} className="text-gray-400 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{group.title}</p>
                  <p className="text-xs text-gray-500">
                    {total} shot{total !== 1 ? 's' : ''} · {doneCount} rendered
                    {renderingVideo > 0 && (
                      <span className="text-brand-400 font-medium"> · <Loader2 size={10} className="inline animate-spin -mt-0.5" /> rendering {renderingVideo}</span>
                    )}
                  </p>
                  {/* Compact per-lesson pipeline position — 3 dots, one per stage. */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {gStageCounts.map((sc, i) => {
                      const stepComplete = sc.done === total && total > 0
                      const isCurrent = !lessonComplete && i + 1 === lessonStage
                      const reached = sc.done > 0 || sc.active > 0 || i + 1 < lessonStage
                      return (
                        <span key={i} className="flex items-center gap-1" title={`${STAGE_LABELS[i]}: ${sc.done}/${total}`}>
                          <span className={`w-2 h-2 rounded-full ${
                            stepComplete ? 'bg-brand-400'
                            : isCurrent ? 'bg-brand-500 ring-2 ring-brand-500/30' + (sc.active > 0 ? ' animate-pulse' : '')
                            : reached ? 'bg-brand-700'
                            : 'bg-gray-700'
                          }`} />
                          {i < gStageCounts.length - 1 && (
                            <span className={`w-4 h-px ${sc.done === total && total > 0 ? 'bg-brand-500/60' : 'bg-gray-700'}`} />
                          )}
                        </span>
                      )
                    })}
                    <span className={`ml-1 text-[10px] font-medium ${lessonComplete ? 'text-brand-300' : 'text-gray-400'}`}>
                      {lessonComplete ? 'Complete' : `Step ${lessonStage}: ${STAGE_LABELS[lessonStage - 1]}`}
                    </span>
                  </div>
                </div>
              </button>

              {/* Lesson-level actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {onWatchLesson && lesson && (
                  <button onClick={() => onWatchLesson(lesson)} title="Watch lesson"
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Play size={15} />
                  </button>
                )}
                {onEditLesson && lesson && !demoMode && (
                  <button onClick={() => onEditLesson(lesson)} title="Edit lesson"
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil size={15} />
                  </button>
                )}
                {onEditLesson && lesson && demoMode && (
                  <span title="Locked — Demo preset" className="p-2 text-amber-500/70">
                    <Lock size={15} />
                  </span>
                )}
                {onDeleteLesson && lesson && (
                  <button onClick={() => { if (confirm(`Delete "${group.title}"?`)) onDeleteLesson(lesson.id) }} title="Delete lesson"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Shots */}
            {isOpen && (
              <div className="p-3 space-y-3">
                {/* Per-lesson batch actions — shown in demo too so you can
                    render-all / approve-all the preset lesson in one click. */}
                {(needStill > 0 || approvable > 0 || renderingVideo > 0 || (canRenderApproved && onRenderApproved)) && (
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    {renderingVideo > 0 && onResetStuck && (
                      <button
                        onClick={() => group.shots
                          .filter(j => j.reviewStatus === 'generating')
                          .forEach(j => onResetStuck(j.id))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 border border-amber-800/70 hover:border-amber-600 transition-colors"
                        title="A video render was interrupted and these shots are stuck 'rendering'. Reset them back to Approved so you can re-render.">
                        <RotateCcw size={13} /> Reset stuck ({renderingVideo})
                      </button>
                    )}
                    {needStill > 0 && onRegenerate && (
                      <button
                        onClick={() => group.shots
                          .filter(j => (j.reviewStatus || 'pending_review') === 'pending_review' && !j.faceswapImage && !j.sceneImage)
                          .forEach(j => onRegenerate(j.id))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-300 border border-brand-800 hover:border-brand-600 transition-colors"
                        title="Render preview stills for every un-rendered shot in this lesson">
                        <RotateCcw size={13} /> Render all previews ({needStill})
                      </button>
                    )}
                    {approvable > 0 && onApprove && (
                      <button
                        onClick={() => group.shots
                          .filter(j => j.reviewStatus === 'pending_review' && (j.faceswapImage || j.sceneImage))
                          .forEach(j => onApprove(j.id))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-400 border border-green-900 hover:border-green-700 transition-colors"
                        title="Approve every reviewed shot in this lesson">
                        <CheckCircle size={13} /> Approve all ({approvable})
                      </button>
                    )}
                    {/* Render-approved lives here at the TOP too so it isn't
                        buried below a long list of shots (the footer copy keeps
                        the live progress text). */}
                    {canRenderApproved && onRenderApproved && (
                      <button
                        onClick={() => onRenderApproved(group.shots)}
                        disabled={renderingVideo > 0 || approved === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        title="Render every approved shot in this lesson into video">
                        {renderingVideo > 0
                          ? (<><Loader2 size={13} className="animate-spin" /> Rendering…</>)
                          : (<><PlayCircle size={13} /> Render approved video ({approved})</>)}
                      </button>
                    )}
                  </div>
                )}
                {group.shots.map(job => {
                  // Safety net: if the job never got a layout stamped (e.g. it was
                  // sent to review before the shot was toggled to split), fall back
                  // to the lesson's shot layout so split still renders correctly.
                  const planShot = (lesson?.shots || []).find(sh => sh.index === job.shotIndex)
                  return (
                    <ShotRow
                      key={job.id} job={job} base={base} demoMode={demoMode}
                      layoutFallback={planShot?.layout || null}
                      onApprove={onApprove} onReject={onReject} onRegenerate={onRegenerate} onRerenderVideo={onRerenderVideo}
                      onLightbox={setLightbox}
                    />
                  )
                })}

                {/* Render-approved footer — shows live progress while building */}
                {(canRenderApproved || renderingVideo > 0) && onRenderApproved && (
                  <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-gray-800">
                    {renderingVideo > 0 ? (
                      <p className="text-xs text-brand-300 flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin" />
                        Rendering video for {renderingVideo} shot{renderingVideo !== 1 ? 's' : ''} on Wan… watch each shot's progress above.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        {approved} approved shot{approved !== 1 ? 's' : ''} ready to render into video.
                      </p>
                    )}
                    <button
                      onClick={() => onRenderApproved(group.shots)}
                      disabled={renderingVideo > 0 || approved === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 hover:scale-[1.02] transition-transform text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                      {renderingVideo > 0
                        ? (<><Loader2 size={16} className="animate-spin" /> Rendering…</>)
                        : (<><PlayCircle size={16} /> Render approved video</>)}
                    </button>
                  </div>
                )}

                {/* Re-render ALL videos for this lesson — refresh stale/expired
                    clips or clips baked with old on-screen text, in one click. */}
                {onRerenderVideo && !demoMode && doneCount > 0 && renderingVideo === 0 && (
                  <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-gray-800">
                    <p className="text-xs text-gray-400">
                      {doneCount} shot{doneCount !== 1 ? 's' : ''} already rendered. Clips expire after a few hours — re-render for fresh playback.
                    </p>
                    <button
                      onClick={() => group.shots.filter(j => j.reviewStatus === 'done').forEach(j => onRerenderVideo(j.id))}
                      title="Render fresh clips for every done shot in this lesson"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-brand-200 bg-brand-900/40 border border-brand-800 hover:bg-brand-900/70 transition-colors text-sm">
                      <RotateCcw size={15} /> Re-render all videos ({doneCount})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2" onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
          <img src={lightbox.src} alt={lightbox.alt} className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

/* ── One shot: STILL (left) | VIDEO (right) side by side ───────────────────── */
function ShotRow({ job, base, demoMode, layoutFallback = null, onApprove, onReject, onRegenerate, onRerenderVideo, onLightbox }) {
  const status = job.reviewStatus || 'pending_review'
  const cfg = STATUS[status] || STATUS.pending_review

  const stillUrl = comfyFileUrl(base, job.faceswapImage) || comfyFileUrl(base, job.sceneImage)
  const videoUrl = comfyFileUrl(base, job.video) || comfyFileUrl(base, job.videoUrl)
  const sceneVideoUrl = comfyFileUrl(base, job.sceneVideo) || (typeof job.sceneVideoUrl === 'string' ? job.sceneVideoUrl : null)
  const sceneRightStill = comfyFileUrl(base, job.sceneRightImage) || comfyFileUrl(base, job.sceneImage)

  const isRendering = ['queued', 'uploading', 'building', 'generating'].includes(job.status) && status !== 'error'
  const stillReady = !!stillUrl
  const isSplit = (job.layout || layoutFallback) === 'split'

  // Split shots carry FOUR assets = two panes, each with a still→video progression:
  //   presenter pane: faceswap still  → talking-head clip
  //   scene pane:     scene still      → scene clip
  // We show them in a tabbed view (Review stills / Final video) so each stays 2-up
  // rather than a cramped 4-column row. Default to Video once any clip exists.
  const presenterStill = comfyFileUrl(base, job.faceswapImage) || comfyFileUrl(base, job.presenterUrl) || comfyFileUrl(base, job.sceneImage)
  const anyVideo = !!(videoUrl || sceneVideoUrl)
  const [tab, setTab] = useState('review') // 'review' | 'final'
  // Auto-advance to the Final tab the first time a clip lands.
  const effectiveTab = anyVideo ? tab : 'review'

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
      {/* Shot header */}
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <span className="text-xs text-gray-500">Shot #{job.shotIndex}</span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'generating' ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </span>
        {job.educatorName && (
          <span className="text-xs bg-blue-900/30 border border-blue-800/40 text-blue-400 px-2 py-0.5 rounded-full">{job.educatorName}</span>
        )}
        {isSplit && (
          <span className="text-xs bg-purple-900/30 border border-purple-800/40 text-purple-300 px-2 py-0.5 rounded-full">split</span>
        )}
        {job.isDemo && (
          <span className="text-xs bg-amber-900/40 border border-amber-800/50 text-amber-400 px-2 py-0.5 rounded-full">demo</span>
        )}
        <span className="font-semibold text-white text-sm ml-1 truncate">{job.title}</span>
      </div>

      {/* ── SPLIT shots: tabbed 2-pane view ──────────────────────────────────
          A split render has FOUR assets (presenter still→clip, scene still→clip).
          Rather than 4 cramped columns, tabs toggle Review-stills vs Final-video,
          each showing the presenter (left) and scene (right) pane. */}
      {isSplit ? (
        <div>
          {/* Tab switcher */}
          <div className="flex items-center gap-1 mb-2 p-0.5 bg-gray-900/60 border border-gray-800 rounded-lg w-fit">
            <button type="button" onClick={() => setTab('review')}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-md transition-colors ${
                effectiveTab === 'review' ? 'bg-brand-900/70 text-brand-200 border border-brand-700' : 'text-gray-400 hover:text-gray-200'
              }`}>
              <ZoomIn size={11} /> Review · stills
            </button>
            <button type="button" onClick={() => anyVideo && setTab('final')} disabled={!anyVideo}
              title={anyVideo ? 'Final rendered clips' : 'Render the video to view final clips'}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-md transition-colors ${
                effectiveTab === 'final' ? 'bg-brand-900/70 text-brand-200 border border-brand-700'
                : anyVideo ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 cursor-not-allowed'
              }`}>
              <Film size={11} /> Final · video
            </button>
            <span className="ml-1 text-[10px] bg-purple-900/30 border border-purple-800/40 text-purple-300 px-2 py-0.5 rounded-full">split · 2 panes</span>
          </div>

          {/* Two panes: presenter (left) | scene (right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PRESENTER pane */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                <Film size={10} /> Presenter · talking head
              </p>
              <div className="aspect-video rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
                {effectiveTab === 'final' ? (
                  videoUrl ? (
                    <video controls src={videoUrl} className="w-full h-full object-contain bg-black" />
                  ) : status === 'generating' ? (
                    <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering on Wan…</span></div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no clip yet</span></div>
                  )
                ) : (
                  presenterStill ? (
                    <button type="button" onClick={() => onLightbox({ src: presenterStill, alt: `Shot ${job.shotIndex} presenter still` })} className="group relative w-full h-full">
                      <img src={presenterStill} alt="presenter still" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity"><ZoomIn size={20} className="text-white" /></span>
                    </button>
                  ) : isRendering ? (
                    <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering still…</span></div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no still yet</span></div>
                  )
                )}
              </div>
              {effectiveTab === 'final' && videoUrl && (
                <a href={videoUrl} download className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1"><Download size={10} /> Download presenter</a>
              )}
            </div>

            {/* SCENE pane */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                <Film size={10} /> Scene · right pane
              </p>
              <div className="aspect-video rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
                {effectiveTab === 'final' ? (
                  sceneVideoUrl ? (
                    <video controls src={sceneVideoUrl} muted loop className="w-full h-full object-contain bg-black" />
                  ) : status === 'generating' ? (
                    <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering scene…</span></div>
                  ) : sceneRightStill ? (
                    // No second video clip — fall back to the approved scene still so the
                    // right pane still shows the scene (split look preserved, no extra render cost).
                    <button type="button" onClick={() => onLightbox({ src: sceneRightStill, alt: `Shot ${job.shotIndex} scene` })} className="group relative w-full h-full">
                      <img src={sceneRightStill} alt="scene" className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-purple-200 px-1.5 py-0.5 rounded">scene still</span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no scene clip yet</span></div>
                  )
                ) : (
                  sceneRightStill ? (
                    <button type="button" onClick={() => onLightbox({ src: sceneRightStill, alt: `Shot ${job.shotIndex} scene still` })} className="group relative w-full h-full">
                      <img src={sceneRightStill} alt="scene still" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-purple-200 px-1.5 py-0.5 rounded">scene preview</span>
                    </button>
                  ) : isRendering ? (
                    <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering scene still…</span></div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no scene still yet</span></div>
                  )
                )}
              </div>
              {effectiveTab === 'final' && sceneVideoUrl && (
                <a href={sceneVideoUrl} download className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1"><Download size={10} /> Download scene</a>
              )}
            </div>
          </div>
        </div>
      ) : (
      /* ── NORMAL shots: STILL | VIDEO ─────────────────────────────────────── */
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* STILL */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
            <ZoomIn size={10} /> Still · review
            {job.identityLocked === true && (
              <span title="Presenter face locked to the portrait via qwen-image-edit" className="ml-1 px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 text-[9px] font-semibold normal-case tracking-normal">face-locked</span>
            )}
            {job.identityLocked === false && (job.faceswapImage || job.sceneImage) && (
              <span title="Face-lock did not run — this still is plain text-to-image and won't match the portrait. Check the presenter has a portrait, then re-render." className="ml-1 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 text-[9px] font-semibold normal-case tracking-normal">no face-lock</span>
            )}
          </p>
          <div className="aspect-video rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
            {stillUrl ? (
              <button type="button" onClick={() => onLightbox({ src: stillUrl, alt: `Shot ${job.shotIndex} still` })} className="group relative w-full h-full">
                <img src={stillUrl} alt={`Shot ${job.shotIndex} still`} className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity"><ZoomIn size={20} className="text-white" /></span>
              </button>
            ) : isRendering ? (
              <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering still…</span></div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no still yet</span></div>
            )}
          </div>
        </div>
        {/* VIDEO */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
            <Film size={10} /> Video · final
          </p>
          <div className="aspect-video rounded-lg overflow-hidden border border-gray-800 bg-gray-900 flex items-center justify-center">
            {videoUrl ? (
              <video controls src={videoUrl} className="w-full h-full object-contain bg-black" />
            ) : status === 'generating' ? (
              <div className="flex flex-col items-center gap-1 text-brand-300"><Loader2 size={20} className="animate-spin" /><span className="text-[10px]">rendering on Wan…</span></div>
            ) : status === 'approved' ? (
              <div className="flex flex-col items-center gap-1 text-gray-500"><PlayCircle size={20} /><span className="text-[10px]">approved — render to fill</span></div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-600"><Film size={20} /><span className="text-[10px]">no clip yet</span></div>
            )}
          </div>
          {videoUrl && (
            <a href={videoUrl} download className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1"><Download size={10} /> Download clip</a>
          )}
        </div>
      </div>
      )}

      {/* Voiceover */}
      {job.voiceover && (
        <p className="text-xs text-gray-400 mt-2.5 italic line-clamp-2">"{job.voiceover}"</p>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="mt-2 bg-red-950/40 border border-red-900/50 rounded-lg px-2.5 py-2">
          <p className="text-xs text-red-300 mb-2">{job.error || job.statusDetail || 'Render failed.'}</p>
          {onRerenderVideo && !demoMode && stillReady && (
            <button onClick={() => onRerenderVideo(job.id)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-900/50 border border-brand-700 text-brand-200 hover:bg-brand-900/80 transition-colors font-medium">
              <RotateCcw size={12} /> Retry render
            </button>
          )}
          {onRegenerate && !stillReady && (
            <button onClick={() => onRegenerate(job.id)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-900/50 border border-brand-700 text-brand-200 hover:bg-brand-900/80 transition-colors font-medium">
              <RotateCcw size={12} /> Retry — render still
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap mt-3">
        {/* Render / re-render preview still */}
        {onRegenerate && status !== 'generating' && status !== 'done' && (
          <button onClick={() => onRegenerate(job.id)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-900/40 border border-brand-800 text-brand-300 hover:bg-brand-900/70 transition-colors font-medium">
            <RotateCcw size={12} /> {stillReady ? 'Re-render still' : 'Render still'}
          </button>
        )}

        {/* Approve — GATED on a still existing */}
        {(status === 'pending_review' || status === 'rejected') && onApprove && (
          <button onClick={() => stillReady && onApprove(job.id)} disabled={!stillReady}
            title={stillReady ? 'Approve for video render' : 'Render a still first — you must see the preview before approving'}
            className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
              stillReady
                ? 'bg-green-900/30 border-green-800 text-green-300 hover:bg-green-900/60'
                : 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
            }`}>
            <CheckCircle size={12} /> Approve
          </button>
        )}

        {/* Reject / un-approve */}
        {(status === 'pending_review' || status === 'approved') && onReject && (
          <button onClick={() => onReject(job.id)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 hover:bg-red-900/40 transition-colors font-medium">
            <XCircle size={12} /> {status === 'approved' ? 'Un-approve' : 'Reject'}
          </button>
        )}

        {/* Re-render video — for DONE shots whose clip is stale/expired or had
            on-screen text from an older render. Mints a fresh clip. */}
        {status === 'done' && onRerenderVideo && !demoMode && (
          <button onClick={() => onRerenderVideo(job.id)}
            title="Render a fresh clip (fixes expired links or old on-screen text)"
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-900/40 border border-brand-800 text-brand-300 hover:bg-brand-900/70 transition-colors font-medium">
            <RotateCcw size={12} /> Re-render video
          </button>
        )}

        {/* Stage hint */}
        {status === 'pending_review' && (
          <span className={`text-[11px] flex items-center gap-1 ${stillReady ? 'text-green-400' : isRendering ? 'text-brand-300' : 'text-yellow-400/90'}`}>
            {stillReady
              ? <><CheckCircle size={11} /> Preview ready — approve to render video.</>
              : isRendering
                ? <><Loader2 size={11} className="animate-spin" /> Rendering still…</>
                : <><Clock size={11} /> Render a still to review it.</>}
          </span>
        )}
      </div>
    </div>
  )
}
