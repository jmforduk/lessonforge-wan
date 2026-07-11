import { useState } from 'react'
import { X, Eye, EyeOff, Server, Loader2, CheckCircle2, XCircle, AlertTriangle, Activity, Cloud } from 'lucide-react'
import { testWanBackend } from '../lib/wan.js'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState('idle') // idle | busy | done
  const [testResult, setTestResult] = useState(null)  // { ok, checks:[] }

  const runTest = async () => {
    setTestState('busy'); setTestResult(null)
    const result = await testWanBackend(form.comfyEndpoint)
    setTestResult(result); setTestState('done')
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* ── Qwen agent brain ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Qwen — Shot Plan Agents</h3>
          <div>
            <label className="label">Agent model</label>
            <input className="input" value={form.llmModel || 'qwen-plus'} onChange={e => set('llmModel', e.target.value)}
              placeholder="qwen-plus" />
            <p className="text-xs text-gray-500 mt-1">
              Qwen model on Alibaba Cloud Model Studio that powers the Curriculum / Scene / Prompt agents (e.g. <span className="text-brand-300">qwen-plus</span>, <span className="text-brand-300">qwen-max</span>). Calls run through your Alibaba Cloud backend — no key in the browser.
            </p>
          </div>
        </section>

        {/* ── Wan render backend ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
            <Cloud size={14} /> Wan Video — Alibaba Cloud Backend
          </h3>

          <div>
            <label className="label">Alibaba Cloud backend URL</label>
            <input className="input" value={form.comfyEndpoint || ''} onChange={e => set('comfyEndpoint', e.target.value)}
              placeholder="https://<your-fc-service>.fcapp.run" />
            <p className="text-xs text-gray-500 mt-1">
              The Function Compute web-function endpoint (holds <code className="text-orange-300">DASHSCOPE_API_KEY</code> and exposes <code>/api/agent</code>, <code>/api/video</code>).
            </p>
          </div>

          <div>
            <label className="label">Access token <span className="text-gray-500 font-normal">(optional)</span></label>
            <input className="input" value={form.accessToken || ''} onChange={e => set('accessToken', e.target.value)}
              placeholder="shared secret — leave blank if backend is open" />
            <p className="text-xs text-gray-500 mt-1">
              Sent as <code>X-Access-Token</code> on every backend call. Set the same value as the backend&apos;s <code className="text-orange-300">ACCESS_TOKEN</code> env var to stop strangers using your quota. Leave blank to keep the backend open.
            </p>

            {form.comfyEndpoint && (
              <div className="mt-2">
                <button type="button" onClick={runTest} disabled={testState === 'busy'}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-brand-700 text-brand-300 hover:text-brand-200 hover:border-brand-500 transition-colors disabled:opacity-60">
                  {testState === 'busy'
                    ? <><Loader2 size={12} className="animate-spin" /> Testing…</>
                    : <><Activity size={12} /> Test connection</>}
                </button>

                {testResult && (
                  <div className={`mt-2 rounded-lg border p-2.5 space-y-1.5 ${testResult.ok ? 'border-green-800/60 bg-green-950/30' : 'border-red-900/60 bg-red-950/20'}`}>
                    <p className={`text-xs font-semibold ${testResult.ok ? 'text-green-300' : 'text-red-300'}`}>
                      {testResult.ok ? 'Backend ready — Qwen + Wan reachable on Alibaba Cloud' : 'Backend not ready'}
                    </p>
                    {testResult.checks.map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        {c.ok ? <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" />
                              : <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <span className={`text-xs ${c.ok ? 'text-gray-300' : 'text-red-200'}`}>{c.label}</span>
                          {c.detail && <span className="block text-[11px] text-gray-500 leading-snug">{c.detail}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Wan model <span className="text-gray-500 font-normal">(optional)</span></label>
            <input className="input" value={form.wanModel || ''} onChange={e => set('wanModel', e.target.value)}
              placeholder="wan2.5-t2v-preview" />
            <p className="text-xs text-gray-500 mt-1">
              Defaults to <span className="text-orange-300">wan2.5-t2v-preview</span> (text→video, with audio). Shots with an approved still auto-use <span className="text-orange-300">wan2.6-i2v-flash</span> (image→video) for look consistency + spoken narration.
            </p>
          </div>

          <div>
            <label className="label">Review still model <span className="text-gray-500 font-normal">(optional)</span></label>
            <input className="input" value={form.stillModel || ''} onChange={e => set('stillModel', e.target.value)}
              placeholder="wan2.2-t2i-flash" />
            <p className="text-xs text-gray-500 mt-1">
              The preview image generated for the review gate before the full video render. Defaults to <span className="text-orange-300">wan2.2-t2i-flash</span> (fast); use <span className="text-orange-300">qwen-image</span> for higher-fidelity previews.
            </p>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button onClick={() => onSave(form)} className="btn-primary flex-1">Save Settings</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
