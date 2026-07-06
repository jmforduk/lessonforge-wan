/**
 * CreateLessonModal — wraps LessonForm + ShotPlan in a full-screen dialog.
 * Triggered from the Home CTA or Lessons tab.
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import LessonForm from './LessonForm.jsx'
import ShotPlan from './ShotPlan.jsx'

export default function CreateLessonModal({
  open,
  onClose,
  settings,
  demoMode,
  educators,
  selectedEducatorIds,
  setSelectedEducatorIds,
  locations,
  shotPlan,
  onShotPlanGenerated,
  onShotPlanUpdate,
  onSendToReview,
}) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSend = (shots) => {
    onSendToReview(shots)
    onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-6 px-4"
    >
      <div className="relative w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl flex flex-col">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-950 rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Create Lesson</h2>
            <p className="text-xs text-gray-500 mt-0.5">Generate an AI-powered shot plan for your lesson</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div className="overflow-y-auto px-6 py-6 space-y-6 max-h-[calc(100vh-10rem)]">
          <LessonForm
            settings={settings}
            onShotPlanGenerated={onShotPlanGenerated}
            demoMode={demoMode}
            educators={educators}
            selectedEducatorIds={selectedEducatorIds}
            setSelectedEducatorIds={setSelectedEducatorIds}
            locations={locations}
            compact={true}
          />

          {shotPlan && (
            <ShotPlan
              plan={shotPlan}
              onSendToComfy={handleSend}
              onUpdate={onShotPlanUpdate}
              demoMode={demoMode}
            />
          )}
        </div>
      </div>
    </div>
  )
}
