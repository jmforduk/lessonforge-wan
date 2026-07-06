import { useState } from 'react'
import { Plus, Trash2, Edit3, Check, X, MapPin } from 'lucide-react'
import { saveLocation, deleteLocation } from '../lib/storage.js'

const EMPTY = { slug: '', name: '', group: '', description: '', details: '', lighting: '', image: '' }

export default function LocationsPanel({ locations, setLocations }) {
  const [showForm, setShowForm] = useState(false)
  const [editingSlug, setEditingSlug] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const handleSave = () => {
    if (!form.slug.trim() || !form.description.trim()) return
    const location = {
      ...form,
      slug: slugify(form.slug),
      details: form.details ? form.details.split('\n').map(s => s.trim()).filter(Boolean) : [],
      lighting: form.lighting ? form.lighting.split('\n').map(s => s.trim()).filter(Boolean) : [],
    }
    const updated = saveLocation(location)
    setLocations(updated)
    setShowForm(false)
    setEditingSlug(null)
    setForm(EMPTY)
  }

  const handleEdit = (loc) => {
    setForm({
      ...loc,
      details: Array.isArray(loc.details) ? loc.details.join('\n') : loc.details || '',
      lighting: Array.isArray(loc.lighting) ? loc.lighting.join('\n') : loc.lighting || '',
    })
    setEditingSlug(loc.slug)
    setShowForm(true)
  }

  const handleDelete = (slug) => {
    const updated = deleteLocation(slug)
    setLocations(updated)
  }

  const handleCancel = () => { setShowForm(false); setEditingSlug(null); setForm(EMPTY) }

  // Group locations
  const grouped = locations.reduce((acc, loc) => {
    const g = loc.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(loc)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <MapPin size={16} className="text-red-400" /> Locations
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Use <code className="bg-gray-800 px-1 rounded text-gray-300">@slug</code> in your lesson narrative to inject a location's visual description into video prompts.
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingSlug(null); setForm(EMPTY) }}
          className="btn-secondary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> New Location
        </button>
      </div>

      {/* Grouped location list */}
      {Object.entries(grouped).map(([group, locs]) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group}</p>
          {locs.map(loc => (
            <div key={loc.slug} className="card py-3 flex items-start gap-3">
              {loc.image ? (
                <img src={loc.image} alt={loc.name}
                  className="w-20 h-14 rounded-lg object-cover border border-gray-800 shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-lg border border-gray-800 bg-gray-900/50 flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-gray-700" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-red-300 font-mono">@{loc.slug}</code>
                  <span className="text-sm font-medium text-white">{loc.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{loc.description}</p>
                {loc.lighting?.length > 0 && (
                  <p className="text-xs text-gray-600 mt-0.5 italic">💡 {loc.lighting.join(' · ')}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleEdit(loc)} className="text-gray-600 hover:text-gray-300 p-1 transition-colors">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => handleDelete(loc.slug)} className="text-gray-600 hover:text-red-400 p-1 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {locations.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-600 border border-dashed border-gray-800 rounded-xl text-sm">
          <MapPin size={24} className="mx-auto mb-2 opacity-30" />
          No locations yet. Add one to use @slug in your narratives.
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="card border-red-900/50 space-y-4">
          <h4 className="font-semibold text-white text-sm">{editingSlug ? 'Edit Location' : 'New Location'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Slug <span className="text-red-400">*</span></label>
              <input className="input font-mono text-sm" value={form.slug}
                onChange={e => set('slug', e.target.value)}
                placeholder="gpu_lab" disabled={!!editingSlug} />
              <p className="text-xs text-gray-600 mt-1">Used as @{form.slug || 'slug'} in narratives</p>
            </div>
            <div>
              <label className="label">Display Name</label>
              <input className="input text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="WAN Research Lab" />
            </div>
            <div>
              <label className="label">Group</label>
              <input className="input text-sm" value={form.group} onChange={e => set('group', e.target.value)} placeholder="Technology" />
            </div>
          </div>
          <div>
            <label className="label">Visual Description <span className="text-red-400">*</span></label>
            <textarea className="input resize-none text-sm" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="A cutting-edge AI research laboratory packed with GPU servers and glowing rack lights..." />
          </div>
          <div>
            <label className="label">Thumbnail Image URL <span className="text-xs font-normal text-gray-600">(optional)</span></label>
            <div className="flex items-start gap-3">
              <input className="input text-sm flex-1" value={form.image}
                onChange={e => set('image', e.target.value)}
                placeholder="https://..." />
              {form.image && (
                <img src={form.image} alt="preview"
                  className="w-20 h-14 rounded-lg object-cover border border-gray-800 shrink-0" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Details <span className="text-xs font-normal text-gray-600">(one per line)</span></label>
              <textarea className="input resize-none text-sm font-mono" rows={3} value={form.details}
                onChange={e => set('details', e.target.value)}
                placeholder={"rows of GPU server racks\nglowing amber accent LEDs\nmultiple ultrawide monitors"} />
            </div>
            <div>
              <label className="label">Lighting <span className="text-xs font-normal text-gray-600">(one per line)</span></label>
              <textarea className="input resize-none text-sm font-mono" rows={3} value={form.lighting}
                onChange={e => set('lighting', e.target.value)}
                placeholder={"dramatic blue and red rack lighting\ncool white overhead strip lights\nmonitor glow as fill light"} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary flex items-center gap-1.5 text-sm">
              <Check size={14} /> {editingSlug ? 'Save Changes' : 'Add Location'}
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
