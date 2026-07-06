import { useState } from 'react'
import { Plus, Trash2, Edit3, Check, X, Users, Upload } from 'lucide-react'
import { saveEducator, deleteEducator } from '../lib/storage.js'

const EMPTY = { name: '', role: '', gender: '', accent: '', appearance: '', voiceStyle: '', onScreenNotes: '', portrait: '' }

export default function EducatorScreen({ educators, setEducators }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePortraitUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('portrait', ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    const educator = { ...form, id: editingId || crypto.randomUUID() }
    const updated = saveEducator(educator)
    setEducators(updated)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY)
  }

  const handleEdit = (ed) => {
    setForm({ ...ed })
    setEditingId(ed.id)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    const updated = deleteEducator(id)
    setEducators(updated)
  }

  const handleCancel = () => { setShowForm(false); setEditingId(null); setForm(EMPTY) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-brand-400" /> Educators
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage your reusable educators here. Pick which ones appear in a lesson from the Create Lesson dialog.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY) }}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> New Educator
          </button>
        </div>
      </div>

      {/* Educator cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {educators.map(ed => {
          return (
            <div key={ed.id}
              className="card transition-all hover:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Portrait or initials avatar */}
                  {ed.portrait ? (
                    <img
                      src={ed.portrait}
                      alt={ed.name}
                      className="w-14 h-14 rounded-full shrink-0 object-cover object-top border-2 border-gray-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-sm font-bold border-2 bg-gray-800 border-gray-700 text-gray-400">
                      {ed.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{ed.name}</p>
                    <p className="text-xs text-brand-400 font-medium">{ed.role}</p>
                    {ed.appearance && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ed.appearance}</p>
                    )}
                    {ed.voiceStyle && (
                      <p className="text-xs text-gray-600 mt-1 italic line-clamp-1">🎤 {ed.voiceStyle}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleEdit(ed)} className="text-gray-600 hover:text-gray-300 p-1 transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(ed.id)} className="text-gray-600 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {educators.length === 0 && !showForm && (
          <div className="col-span-2 text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p>No educators yet. Create your first one above.</p>
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card border-brand-800 space-y-4">
          <h3 className="font-semibold text-white">{editingId ? 'Edit Educator' : 'New Educator'}</h3>

          {/* Portrait upload */}
          <div className="flex items-center gap-4">
            {form.portrait ? (
              <img src={form.portrait} alt="Portrait preview"
                className="w-16 h-16 rounded-full object-cover object-top border-2 border-brand-600" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-600">
                <Upload size={18} />
              </div>
            )}
            <div>
              <label className="label mb-1">Portrait Photo</label>
              <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5 w-fit">
                <Upload size={13} /> Upload image
                <input type="file" accept="image/*" className="hidden" onChange={handlePortraitUpload} />
              </label>
              <p className="text-xs text-gray-600 mt-1">JPG, PNG — shown on the educator card</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name <span className="text-red-400">*</span></label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Sarah Chen" />
            </div>
            <div>
              <label className="label">Role / Title</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Professor of Computer Science" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Gender <span className="text-gray-600 font-normal">(voice + base image)</span></label>
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Unspecified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
            <div>
              <label className="label">Accent <span className="text-gray-600 font-normal">(spoken narration)</span></label>
              <input className="input" value={form.accent} onChange={e => set('accent', e.target.value)}
                placeholder="an English accent" />
              <p className="text-xs text-gray-600 mt-1">Phrase it to read after &ldquo;speaks with&hellip;&rdquo; — e.g. &ldquo;an English accent&rdquo;, &ldquo;a Scottish accent&rdquo;.</p>
            </div>
          </div>
          <div>
            <label className="label">Appearance Description</label>
            <textarea className="input resize-none" rows={2} value={form.appearance}
              onChange={e => set('appearance', e.target.value)}
              placeholder="Professional academic in her 40s, warm smile, dark hair, wearing a smart blazer..." />
            <p className="text-xs text-gray-600 mt-1">Injected into video prompts to keep the presenter consistent across shots.</p>
          </div>
          <div>
            <label className="label">Voice / Delivery Style</label>
            <input className="input" value={form.voiceStyle} onChange={e => set('voiceStyle', e.target.value)}
              placeholder="Clear, measured, enthusiastic — speaks with authority but never condescending" />
          </div>
          <div>
            <label className="label">On-screen Notes</label>
            <input className="input" value={form.onScreenNotes} onChange={e => set('onScreenNotes', e.target.value)}
              placeholder="Use in talking-head shots and whiteboard explanations..." />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} className="btn-primary flex items-center gap-1.5 text-sm">
              <Check size={14} /> {editingId ? 'Save Changes' : 'Add Educator'}
            </button>
            <button onClick={handleCancel} className="btn-secondary flex items-center gap-1.5 text-sm">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
