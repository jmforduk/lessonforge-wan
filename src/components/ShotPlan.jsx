import { useState, useEffect } from 'react'
import { Send, Edit3, Check, X, ChevronDown, ChevronUp, Download, FileText, Save, Lock } from 'lucide-react'
import { exportLessonYAML, saveLesson } from '../lib/storage.js'

const TYPE_COLORS = {
  hook:          'bg-purple-900/50 text-purple-300 border-purple-800',
  concept:       'bg-blue-900/50 text-blue-300 border-blue-800',
  demo:          'bg-green-900/50 text-green-300 border-green-800',
  summary:       'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  callToAction:  'bg-red-900/50 text-red-300 border-red-800',
}

export default function ShotPlan({ plan, onSendToComfy, onUpdate, demoMode }) {
  const [expanded, setExpanded] = useState({})
  const [editing, setEditing] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [selected, setSelected] = useState(() => new Set(plan.shots.map(s => s.index)))
  const [savedMsg, setSavedMsg] = useState(false)

  // Re-sync the selection whenever the plan's shot set changes. useState's
  // initialiser only runs ONCE, so switching templates (e.g. neural ↔ self-demo)
  // or re-generating left `selected` stale — the header showed the new shot
  // count while the Send button counted the OLD selection (e.g. "7 shots" but
  // "Send 6"). We reselect every shot in the CURRENT plan, and drop any indices
  // that no longer exist.
  const shotKey = plan.shots.map(s => s.index).join(',')
  useEffect(() => {
    setSelected(new Set(plan.shots.map(s => s.index)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotKey])

  const toggleExpand = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }))
  const toggleSelect = (i) => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const startEdit = (shot) => { setEditing(shot.index); setEditDraft({ ...shot }) }
  const cancelEdit = () => { setEditing(null); setEditDraft({}) }
  const saveEdit = () => {
    onUpdate({ ...plan, shots: plan.shots.map(s => s.index === editing ? editDraft : s) })
    setEditing(null)
  }

  const handleSend = () => {
    const shots = plan.shots.filter(s => selected.has(s.index))
    if (shots.length === 0) return
    onSendToComfy(shots)
  }

  const handleExportYAML = () => exportLessonYAML(plan)

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${plan.lessonTitle?.replace(/\s+/g, '_') || 'lesson'}_shotplan.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const handleSave = () => {
    saveLesson(plan)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Plan header */}
      <div className="card">
        {/* Title + synopsis span the full width so the text wraps naturally
            instead of cramming into a narrow column and ballooning vertically. */}
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white leading-snug">{plan.lessonTitle}</h2>
          <p className="text-gray-400 text-sm mt-1.5 leading-relaxed max-w-3xl">{plan.synopsis}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
            <span>⏱ {plan.totalDuration}</span>
            <span>🎬 {plan.shots.length} shots</span>
            <span>✅ {selected.size} selected</span>
          </div>
        </div>

        {/* Action toolbar — own row, divider above, so buttons never fight the text. */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-800">
          <button onClick={handleSave}
            className={`btn-secondary flex items-center gap-1.5 text-sm transition-all ${savedMsg ? 'text-green-400 border-green-800' : ''}`}>
            <Save size={14} /> {savedMsg ? 'Saved!' : 'Save'}
          </button>
          <button onClick={handleExportYAML} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileText size={14} /> YAML
          </button>
          <button onClick={handleExportJSON} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> JSON
          </button>
        </div>
      </div>

      {/* Shots */}
      <div className="space-y-3">
        {plan.shots.map((shot) => {
          const isExpanded = expanded[shot.index]
          const isEditing = editing === shot.index
          const isSelected = selected.has(shot.index)
          const draft = isEditing ? editDraft : shot

          return (
            <div key={shot.index}
              className={`card transition-all ${isSelected ? 'border-brand-700' : 'opacity-75'}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(shot.index)}
                  className="mt-1 accent-brand-500 w-4 h-4 shrink-0 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-500">#{shot.index}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[shot.type] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                      {shot.type}
                    </span>
                    <span className="text-xs text-gray-500">{shot.duration}</span>
                    {isEditing ? (
                      <input className="input text-sm py-1 flex-1" value={editDraft.title}
                        onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} />
                    ) : (
                      <span className="font-semibold text-white">{shot.title}</span>
                    )}
                  </div>
                  {!isEditing && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{shot.voiceover}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} className="text-green-400 hover:text-green-300 p-1"><Check size={16} /></button>
                      <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-300 p-1"><X size={16} /></button>
                    </>
                  ) : demoMode ? (
                    <span title="Locked — Demo preset" className="text-amber-500/70 p-1"><Lock size={14} /></span>
                  ) : (
                    <button onClick={() => startEdit(shot)} className="text-gray-500 hover:text-gray-300 p-1"><Edit3 size={15} /></button>
                  )}
                  <button onClick={() => toggleExpand(shot.index)} className="text-gray-500 hover:text-gray-300 p-1">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {(isExpanded || isEditing) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                  <div className="space-y-3">
                    <Field label="🎤 Voiceover Script">
                      {isEditing
                        ? <textarea className="input resize-none text-sm" rows={4} value={editDraft.voiceover}
                            onChange={e => setEditDraft(d => ({ ...d, voiceover: e.target.value }))} />
                        : <p className="text-sm text-gray-300">{shot.voiceover}</p>}
                    </Field>
                    <Field label="📝 On-screen Text">
                      {isEditing
                        ? <input className="input text-sm" value={editDraft.onScreenText || ''}
                            onChange={e => setEditDraft(d => ({ ...d, onScreenText: e.target.value }))} />
                        : <p className="text-sm text-gray-300">{shot.onScreenText || '—'}</p>}
                    </Field>
                    <Field label="🎓 Pedagogical Note">
                      <p className="text-sm text-gray-400 italic">{shot.pedagogicalNote}</p>
                    </Field>
                  </div>
                  <div className="space-y-3">
                    <Field label="🎬 Video Prompt (→ Render)">
                      {isEditing
                        ? <textarea className="input resize-none text-sm font-mono" rows={4} value={editDraft.videoPrompt}
                            onChange={e => setEditDraft(d => ({ ...d, videoPrompt: e.target.value }))} />
                        : <p className="text-sm text-gray-300 font-mono bg-gray-950 rounded-lg p-3">{shot.videoPrompt}</p>}
                    </Field>
                    <Field label="🚫 Negative Prompt">
                      {isEditing
                        ? <input className="input text-sm font-mono" value={editDraft.negativePrompt || ''}
                            onChange={e => setEditDraft(d => ({ ...d, negativePrompt: e.target.value }))} />
                        : <p className="text-sm text-gray-400 font-mono">{shot.negativePrompt}</p>}
                    </Field>

                    {/* Layout: normal (presenter embedded) vs split (talking-head
                        left + person-free scene right). Split lets you drop in
                        external footage on the right instead of an auto-render. */}
                    <Field label="🖼️ Layout">
                      {isEditing ? (
                        <div className="flex gap-2">
                          {['normal', 'split'].map(opt => {
                            const active = (editDraft.layout || 'normal') === opt
                            return (
                              <button key={opt} type="button"
                                onClick={() => setEditDraft(d => ({ ...d, layout: opt }))}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${active ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
                                {opt === 'split' ? 'Split-screen' : 'Full scene'}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300">
                          {shot.layout === 'split' ? 'Split-screen (presenter + scene)' : 'Full scene (presenter embedded)'}
                        </p>
                      )}
                    </Field>

                    {/* Right-frame clip URL — only meaningful in split mode. When
                        set, the right pane plays THIS external clip (muted, loop)
                        instead of the auto-rendered person-free scene clip. */}
                    {((isEditing ? editDraft.layout : shot.layout) === 'split') && (
                      <Field label="🎬 Right-frame clip URL (optional)">
                        {isEditing ? (
                          <>
                            <input className="input text-sm font-mono"
                              placeholder="https://…/your-demo-clip.mp4  (leave blank to auto-render a scene clip)"
                              value={editDraft.sceneVideoUrl || ''}
                              onChange={e => setEditDraft(d => ({ ...d, sceneVideoUrl: e.target.value }))} />
                            <p className="text-[11px] text-gray-500 mt-1">
                              Drop in your own footage for the right pane (e.g. a real screen-recording). Blank = we auto-render a person-free scene clip.
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 font-mono break-all">
                            {shot.sceneVideoUrl || '— (auto-rendered scene clip)'}
                          </p>
                        )}
                      </Field>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom send bar */}
      <div className="sticky bottom-4 flex justify-center">
        <button onClick={handleSend} disabled={selected.size === 0}
          className="btn-primary flex items-center gap-2 shadow-xl px-8 py-3 text-base">
          <Send size={16} /> Send {selected.size} shot{selected.size !== 1 ? 's' : ''} for Review
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      {children}
    </div>
  )
}
