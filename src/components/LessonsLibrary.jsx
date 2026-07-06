/**
 * LessonsLibrary — a list of all previously developed lessons.
 * Each lesson row expands to reveal its full shot plan (shots in order).
 * From here the user can re-open a lesson for editing, export it, or delete it.
 */

import { useState } from 'react'
import {
  ChevronDown, ChevronRight, BookOpen, Film, Clock, Edit3, Trash2,
  FileText, FileDown, Plus, Mic, Sparkles, ArrowRight, PlayCircle, Layers, Lock,
} from 'lucide-react'
import { exportLessonYAML } from '../lib/storage.js'

const TYPE_COLORS = {
  hook:         'bg-purple-900/50 text-purple-300 border-purple-800',
  concept:      'bg-blue-900/50 text-blue-300 border-blue-800',
  demo:         'bg-green-900/50 text-green-300 border-green-800',
  summary:      'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  callToAction: 'bg-red-900/50 text-red-300 border-red-800',
}

export default function LessonsLibrary({ lessons = [], demoMode, onOpenLesson, onEditLesson, onCreateLesson, onDeleteLesson, onWatchLesson, onExportPDF }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  // Newest first for the list itself; shots within each lesson stay in order.
  const ordered = [...lessons].sort(
    (a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0)
  )

  if (ordered.length === 0) {
    return (
      <div className="relative overflow-hidden border border-dashed border-gray-800 rounded-3xl p-10 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-900/60 to-red-900/30 border border-brand-800/50 flex items-center justify-center">
            <Sparkles size={26} className="text-brand-400" />
          </div>
          <p className="text-white font-semibold mb-1">No lessons developed yet</p>
          <p className="text-gray-500 text-sm mb-5">Create a lesson and it will be saved here automatically</p>
          <button onClick={onCreateLesson} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-600 to-orange-500 shadow-lg shadow-red-900/30 hover:scale-[1.02] transition-transform mx-auto">
            <Plus size={16} /> Create Your First Lesson
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen size={18} className="text-brand-400" /> Lesson Library
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{ordered.length} saved lesson{ordered.length !== 1 ? 's' : ''} · click any lesson to view its shot plan</p>
        </div>
        <button
          onClick={onCreateLesson}
          className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white overflow-hidden bg-gradient-to-r from-red-600 to-orange-500 shadow-lg shadow-red-900/40 hover:shadow-red-700/50 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Sparkles size={18} className="relative z-10" />
          <span className="relative z-10">Create Lesson</span>
          <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
        </button>
      </div>

      {/* Lesson list */}
      <div className="space-y-3">
        {ordered.map(lesson => {
          const isOpen = expanded[lesson.id]
          const shots = [...(lesson.shots || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

          return (
            <div key={lesson.id} className={`card overflow-hidden transition-all ${isOpen ? 'border-brand-800/70' : 'hover:border-gray-700'}`}>
              {/* Lesson header row */}
              <div className="flex items-center gap-4">
                <button onClick={() => onOpenLesson ? onOpenLesson(lesson) : toggle(lesson.id)} title="Open in Editing Suite" className="flex items-center gap-4 flex-1 min-w-0 text-left">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-900/60 to-purple-900/30 border border-brand-800/50 flex items-center justify-center shrink-0">
                    <BookOpen size={17} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{lesson.lessonTitle || 'Untitled Lesson'}</p>
                    <p className="text-xs text-gray-500 truncate">{lesson.synopsis || ''}</p>
                  </div>
                </button>

                <div className="hidden sm:flex items-center gap-2 shrink-0 text-xs text-gray-400">
                  {lesson.totalDuration && (
                    <span className="flex items-center gap-1 bg-gray-800/60 px-2.5 py-1 rounded-full">
                      <Clock size={11} className="text-gray-500" /> {lesson.totalDuration}
                    </span>
                  )}
                  <span className="flex items-center gap-1 bg-gray-800/60 px-2.5 py-1 rounded-full">
                    <Film size={11} className="text-gray-500" /> {shots.length} shots
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {onWatchLesson && (
                    <button onClick={() => onWatchLesson(lesson)} title="Watch lesson"
                      className="text-gray-400 hover:text-brand-300 p-1.5 rounded-lg hover:bg-brand-600/15 transition-colors">
                      <PlayCircle size={17} />
                    </button>
                  )}
                  {onOpenLesson && (
                    <button onClick={() => onOpenLesson(lesson)} title="Open in Editing Suite"
                      className="text-gray-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                      <Layers size={15} />
                    </button>
                  )}
                  {!demoMode && (
                    <button onClick={() => onEditLesson(lesson)} title="Edit shot plan"
                      className="text-gray-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                      <Edit3 size={15} />
                    </button>
                  )}
                  {demoMode && (
                    <span title="Locked — Demo preset" className="text-amber-500/70 p-1.5"><Lock size={15} /></span>
                  )}
                  {onExportPDF && (
                    <button onClick={() => onExportPDF(lesson)} title="Export lesson notes (PDF)"
                      className="text-gray-500 hover:text-brand-300 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                      <FileDown size={15} />
                    </button>
                  )}
                  <button onClick={() => exportLessonYAML(lesson)} title="Export YAML"
                    className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    <FileText size={15} />
                  </button>
                  <button onClick={() => { if (confirm(`Delete "${lesson.lessonTitle || 'this lesson'}"?`)) onDeleteLesson(lesson.id) }}
                    title="Delete lesson"
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => toggle(lesson.id)}
                    className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded shot plan */}
              {isOpen && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                  {shots.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No shots in this lesson.</p>
                  )}
                  {shots.map(shot => (
                    <div key={shot.index} className="flex items-start gap-3 rounded-lg bg-gray-950/60 border border-gray-800/70 p-3">
                      <span className="text-xs font-bold text-gray-600 w-7 shrink-0 pt-0.5">#{shot.index}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-white text-sm">{shot.title}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[shot.type] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                            {shot.type}
                          </span>
                          {shot.duration && <span className="text-[11px] text-gray-500">{shot.duration}</span>}
                        </div>
                        {shot.voiceover && (
                          <p className="text-xs text-gray-400 flex items-start gap-1.5 leading-relaxed">
                            <Mic size={11} className="text-gray-600 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{shot.voiceover}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-1">
                    {demoMode ? (
                      <span className="text-xs text-amber-400/80 flex items-center gap-1">
                        <Lock size={12} /> Editing locked — Demo preset
                      </span>
                    ) : (
                      <button onClick={() => onEditLesson(lesson)}
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                        <Edit3 size={12} /> Open full shot plan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
