/**
 * HomeScreen — Landing/dashboard for LessonForge.
 * Shows recent lessons, quick stats, and a prominent Create Lesson CTA.
 */

import { Zap, Film, Users, MapPin, ChevronRight, Plus, Cpu, BookOpen, Clock, Sparkles, ArrowRight, Box, Lightbulb, UserCheck, Move3d, Layers, Wand2 } from 'lucide-react'
import academicHero from '../assets/academic-hero.png'
import filmHero from '../assets/film-hero.png'

export default function HomeScreen({ onCreateLesson, onEditLesson, onTab, educators, locations, lessons = [], jobs, demoMode }) {
  const recentLessons = lessons.slice(0, 3)
  const completedVideos = jobs.filter(j => j.reviewStatus === 'done').length
  const pendingReview   = jobs.filter(j => j.reviewStatus === 'pending_review').length
  const rendering       = jobs.filter(j => j.reviewStatus === 'rendering' || j.status === 'generating').length

  return (
    <div className="space-y-8">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="lf-hero relative overflow-hidden rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 sm:p-12 animate-rise-in">
        {/* Brand accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-700" />

        {/* Animated GPU grid */}
        <div className="absolute inset-0 gpu-grid pointer-events-none" />

        {/* Drifting glow blobs */}
        <div className="absolute -top-10 right-10 w-72 h-72 bg-red-600/15 rounded-full blur-3xl pointer-events-none animate-float-glow" />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-brand-600/15 rounded-full blur-3xl pointer-events-none animate-float-glow-slow" />
        <div className="absolute top-1/3 -left-10 w-44 h-44 bg-orange-500/10 rounded-full blur-2xl pointer-events-none animate-float-glow" />

        {/* Sweeping shimmer */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none animate-sweep" />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5 bg-red-950/60 border border-red-900/60 rounded-full px-3 py-1 backdrop-blur-sm">
                <Cpu size={12} className="text-orange-400" />
                <span className="text-xs font-semibold text-orange-300 tracking-wide">Qwen + Wan · Alibaba Cloud</span>
              </div>
              <div className="flex items-center gap-1.5 bg-green-950/50 border border-green-900/50 rounded-full px-3 py-1 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping-soft" />
                <span className="text-xs font-semibold text-green-300">{rendering > 0 ? `${rendering} rendering` : 'Cloud online'}</span>
              </div>
              {demoMode && (
                <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-400">Demo Mode</span>
                </div>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.05] mb-4 tracking-tight">
              Educator Video Lessons,<br />
              <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 bg-clip-text text-transparent animate-hue-shift">
                Directed by Qwen, Rendered by Wan
              </span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-xl leading-relaxed">
              An autonomous <span className="text-orange-400 font-semibold">AI Showrunner</span>: a <span className="text-orange-400 font-semibold">Qwen</span> multi-agent
              pipeline plans the script &amp; shots, then <span className="text-orange-400 font-semibold">Wan</span> generates each
              clip — voice, motion and character consistency — all on Alibaba Cloud.
            </p>

            {/* Stack spec chips */}
            <div className="flex flex-wrap gap-1.5 mt-5">
              {['Qwen-Plus agents', 'Wan 2.7 T2V/I2V', 'Native audio + voice', 'Function Compute'].map((spec, i) => (
                <span key={spec}
                  className="text-[11px] font-medium bg-orange-950/40 border border-orange-900/50 text-orange-300 px-2.5 py-1 rounded-full backdrop-blur-sm animate-rise-in"
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                  {spec}
                </span>
              ))}
            </div>

            {/* CTA row */}
            <div className="flex items-center gap-3 mt-7">
              <button
                onClick={onCreateLesson}
                className="group relative inline-flex items-center gap-2 text-base px-7 py-3.5 rounded-xl font-semibold text-white overflow-hidden bg-gradient-to-r from-red-600 to-orange-500 shadow-lg shadow-red-900/40 hover:shadow-red-700/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles size={18} className="relative z-10" />
                <span className="relative z-10">Create Lesson</span>
                <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
              </button>
              <span className="text-xs text-gray-500 hidden sm:block">Topic in → production-ready video out</span>
            </div>
          </div>

          {/* Hero side visual — academic photo (light) ── */}
          <div className="lf-light-only shrink-0 hidden lg:block w-64">
            <div className="relative animate-rise-in" style={{ animationDelay: '0.3s' }}>
              <div className="absolute -inset-3 bg-gradient-to-br from-amber-200/40 to-transparent rounded-3xl blur-2xl" />
              <img
                src={academicHero}
                alt="Graduation mortarboard resting on scholarly books"
                className="relative w-full rounded-2xl border border-[#d8d1c2] shadow-lg shadow-[#2b251a]/10 object-cover"
              />
            </div>
          </div>

          {/* Hero side visual — cinematic "teaching film" key art (dark/F1) ── */}
          <div className="lf-dark-only shrink-0 hidden lg:block w-72">
            <div className="relative animate-rise-in" style={{ animationDelay: '0.35s' }}>
              <div className="absolute -inset-4 bg-gradient-to-br from-orange-600/25 via-brand-600/10 to-purple-600/20 rounded-3xl blur-2xl animate-float-glow-slow" />
              <img
                src={filmHero}
                alt="A film clapperboard and reel merged with a book — AI-generated teaching films"
                className="relative w-full rounded-2xl border border-gray-800 shadow-2xl shadow-black/50 object-cover"
              />
              {/* subtle sheen sweep across the art */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute top-0 -left-1/3 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sweep" />
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full px-2 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-green-400" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                Generating lessons
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Lessons"        value={lessons.length}   icon={<BookOpen size={16} />} accent="brand"  delay={0}    onClick={() => onTab('lessons')} />
        <StatCard label="Educators"      value={educators.length} icon={<Users size={16} />} accent="purple" delay={0.06} onClick={() => onTab('educators')} />
        <StatCard label="Locations"      value={locations.length} icon={<MapPin size={16} />} accent="purple" delay={0.12} onClick={() => onTab('locations')} />
        <StatCard label="Pending Review" value={pendingReview}    icon={<Clock size={16} />} accent="yellow" delay={0.18} onClick={() => onTab('review')} highlight={pendingReview > 0} />
        <StatCard label="Videos Done"    value={completedVideos}  icon={<Film size={16} />} accent="green"  delay={0.24} onClick={() => onTab('queue')} />
      </div>

      {/* ── Lesson Application Framework ─────────────────────────────────────── */}
      <div className="card relative overflow-hidden animate-rise-in delay-200">
        <div className="absolute -top-20 -left-16 w-64 h-64 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-16 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Left: headline */}
          <div className="lg:w-2/5 shrink-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 mb-3">
              <Sparkles size={12} className="text-brand-400" />
              <span className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider">Agentic Intelligence</span>
            </div>
            <h2 className="text-xl font-bold text-white leading-snug">
              Lesson Application Framework
            </h2>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              The <span className="text-white font-medium">agentic brain</span> of every lesson. A crew of
              autonomous agents reason over the
              <span className="text-white font-medium"> entire video at once</span>, applying
              <span className="text-brand-300 font-medium"> expert prompt engineering &amp; optimisation</span> across geometry, lighting,
              characters and positioning so every frame stays flawlessly coherent. They solve the
              <span className="text-white font-medium"> state-drift problem</span> that breaks long-form video — turning
              raw compute into lessons students actually <span className="text-white font-medium">remember</span>.
            </p>
            <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
              <Cpu size={12} className="text-brand-400" /> Qwen multi-agent pipeline · Wan video on Alibaba Cloud
            </p>
          </div>

          {/* Right: what it optimises */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            {[
              { icon: <Box size={16} />,       title: 'Geometry',    sub: 'Consistent scale, depth & framing across shots' },
              { icon: <Lightbulb size={16} />, title: 'Lighting',    sub: 'Unified key, mood & colour temperature' },
              { icon: <UserCheck size={16} />, title: 'Characters',  sub: 'Stable identity, wardrobe & faces throughout' },
              { icon: <Move3d size={16} />,    title: 'Positioning', sub: 'Coherent blocking & eyelines shot-to-shot' },
            ].map((c, i) => (
              <div key={c.title}
                className="rounded-xl border border-gray-800 bg-gray-900/50 p-3.5 hover:border-brand-700/60 transition-colors animate-rise-in"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
                <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/50 flex items-center justify-center text-brand-400 mb-2">
                  {c.icon}
                </div>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Prompt engineering callout — full width */}
        <div className="relative mt-5 rounded-xl border border-brand-700/50 bg-brand-900/20 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-800/50 border border-brand-700/50 flex items-center justify-center text-brand-300 shrink-0">
            <Wand2 size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Automated Prompt Engineering</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              A dedicated agent rewrites every shot into model-ready prompts — structured for
              <span className="text-brand-300 font-medium"> Wan 2.7</span>, tuned for consistency, and stripped of artifacts.
              No prompt expertise needed: just describe the lesson, the agents handle the craft.
            </p>
          </div>
        </div>

        {/* Footer strip: the state-continuity payoff */}
        <div className="relative mt-5 pt-4 border-t border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-900/30 border border-green-800/40 flex items-center justify-center text-green-400 shrink-0">
            <Layers size={15} />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            <span className="text-white font-medium">Continuity-aware state:</span> the agents carry scene memory
            forward so a lesson holds together as one seamless take — no flicker, no drifting faces, no resetting backgrounds.
            The result is a distraction-free, broadcast-quality experience that keeps every student engaged.
          </p>
        </div>
      </div>

      {/* ── Pipeline overview ────────────────────────────────────────────────── */}
      <div className="card relative overflow-hidden animate-rise-in delay-150">
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center justify-center gap-2">
          <Zap size={14} className="text-red-400" />
          Production Pipeline
        </h2>
        {(() => {
          const steps = [
            { step: '01', label: 'Create Lesson',    sub: 'Topic, educator & locations', dot: 'bg-brand-500',  ring: 'ring-brand-500/30' },
            { step: '02', label: 'LAF Agents',       sub: 'Agentic prompt engineering',  dot: 'bg-cyan-500',   ring: 'ring-cyan-500/30' },
            { step: '03', label: 'Image Generation', sub: 'Educator-consistent stills',      dot: 'bg-purple-500', ring: 'ring-purple-500/30' },
            { step: '04', label: 'Review & Approve', sub: 'Human in the loop',           dot: 'bg-yellow-500', ring: 'ring-yellow-500/30' },
            { step: '05', label: 'Video Render',     sub: 'Wan 2.7 video',               dot: 'bg-green-500',  ring: 'ring-green-500/30' },
            { step: '06', label: 'Export',           sub: 'Video + PDF lesson pack',     dot: 'bg-orange-500', ring: 'ring-orange-500/30' },
          ]
          return (
            <>
              {/* Mobile: clean vertical timeline */}
              <ol className="sm:hidden space-y-0 w-fit mx-auto">
                {steps.map((s, i, arr) => (
                  <li key={s.step} className="relative flex gap-3 pb-5 last:pb-0">
                    {/* connector line */}
                    {i < arr.length - 1 && (
                      <span className="absolute left-[17px] top-9 bottom-0 w-px bg-gradient-to-b from-gray-700 to-gray-800" />
                    )}
                    <div className={`relative z-10 shrink-0 w-9 h-9 rounded-full ${s.dot} bg-opacity-15 ring-1 ${s.ring} flex items-center justify-center`}>
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className="absolute -top-1 -right-1 text-[9px] font-bold text-gray-600">{s.step}</span>
                    </div>
                    <div className="pt-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{s.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Desktop: horizontal flow — dot centered over its label */}
              <div className="hidden sm:flex items-start justify-center">
                {steps.map((s, i, arr) => (
                  <div key={s.step} className="relative flex flex-col items-center flex-1 group">
                    {/* connector: spans the gap to the next dot, vertically centered on the dot row */}
                    {i < arr.length - 1 && (
                      <span className="absolute top-[18px] left-1/2 w-full h-px -translate-y-1/2 bg-gradient-to-r from-gray-700 to-gray-800" />
                    )}
                    {/* dot (above the line via z-10) */}
                    <div className={`relative z-10 w-9 h-9 rounded-full ${s.dot} bg-opacity-15 ring-1 ${s.ring} flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span className="absolute -top-1 -right-1 text-[9px] font-bold text-gray-600">{s.step}</span>
                    </div>
                    <div className="mt-3 text-center px-2">
                      <p className="text-sm font-semibold text-white">{s.label}</p>
                      <p className="text-xs text-gray-500">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </div>

      {/* ── Recent lessons ───────────────────────────────────────────────────── */}
      {recentLessons.length > 0 && (
        <div className="space-y-3 animate-rise-in delay-300">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} className="text-brand-400" /> Recent Lessons
            </h2>
            <button onClick={onCreateLesson} className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              <Plus size={12} /> New lesson
            </button>
          </div>
          <div className="space-y-2">
            {recentLessons.map((lesson, i) => (
              <div key={lesson.id}
                className="group card flex items-center gap-4 cursor-pointer hover:border-brand-700/70 hover:bg-gray-900/80 transition-all animate-rise-in"
                style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                onClick={() => onEditLesson(lesson)}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-900/60 to-purple-900/30 border border-brand-800/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen size={17} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate group-hover:text-brand-200 transition-colors">{lesson.lessonTitle || 'Untitled Lesson'}</p>
                  <p className="text-xs text-gray-500 truncate">{lesson.synopsis || ''}</p>
                </div>
                <div className="text-xs text-gray-400 shrink-0 flex items-center gap-1.5 bg-gray-800/60 px-2.5 py-1 rounded-full">
                  <Film size={11} className="text-gray-500" />
                  {lesson.shots?.length || 0} shots
                </div>
                <ChevronRight size={15} className="text-gray-700 shrink-0 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {recentLessons.length === 0 && (
        <div className="relative overflow-hidden border border-dashed border-gray-800 rounded-3xl p-10 text-center animate-rise-in delay-300">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-900/60 to-red-900/30 border border-brand-800/50 flex items-center justify-center">
              <Sparkles size={26} className="text-brand-400" />
            </div>
            <p className="text-white font-semibold mb-1">No lessons yet</p>
            <p className="text-gray-500 text-sm mb-5">Turn any topic into a production-ready video lesson</p>
            <button onClick={onCreateLesson} className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 shadow-lg shadow-red-900/30 hover:scale-[1.02] transition-transform mx-auto">
              <Plus size={16} /> Create Your First Lesson
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const ACCENTS = {
  brand:  { icon: 'text-brand-400',  glow: 'from-brand-600/20',  hover: 'group-hover:text-brand-400',  val: 'text-white' },
  purple: { icon: 'text-purple-400', glow: 'from-purple-600/20', hover: 'group-hover:text-purple-400', val: 'text-white' },
  green:  { icon: 'text-green-400',  glow: 'from-green-600/20',  hover: 'group-hover:text-green-400',  val: 'text-white' },
  yellow: { icon: 'text-yellow-400', glow: 'from-yellow-600/20', hover: 'group-hover:text-yellow-400', val: 'text-white' },
}

function StatCard({ label, value, icon, onClick, highlight, accent = 'brand', delay = 0 }) {
  const a = ACCENTS[accent] || ACCENTS.brand
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}s` }}
      className={`group relative card text-left overflow-hidden hover:border-gray-700 hover:-translate-y-0.5 transition-all cursor-pointer animate-rise-in ${highlight ? 'border-yellow-800/60 bg-yellow-950/10' : ''}`}
    >
      {/* corner glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${a.glow} to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className={`relative flex items-center gap-2 mb-2 ${highlight ? 'text-yellow-400' : `text-gray-500 ${a.hover}`} transition-colors`}>
        <span className={highlight ? 'text-yellow-400' : a.icon}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`relative text-3xl font-bold tabular-nums ${highlight ? 'text-yellow-400' : a.val}`}>{value}</p>
    </button>
  )
}
