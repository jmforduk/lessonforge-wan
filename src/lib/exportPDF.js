/**
 * LessonForge PDF Export
 * 
 * Generates a complete, print-ready lesson pack containing:
 *   - Cover page (title, educator, synopsis)
 *   - Shot-by-shot breakdown with faceswap stills
 *   - Full voiceover transcript
 *   - Student handout / key takeaways
 * 
 * Uses browser's native print API with a styled HTML document
 * (no external PDF libraries needed — works offline/in demo mode).
 */

/**
 * Fetch an image URL and convert to base64 for embedding in the PDF.
 * Falls back gracefully if CORS blocks the fetch.
 */
async function urlToBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Build and print a PDF lesson pack.
 * 
 * @param {object} plan        - Shot plan (lessonTitle, synopsis, shots, etc.)
 * @param {Array}  jobs        - Review queue jobs (include faceswap stills, voiceovers)
 * @param {object} educator    - Educator object (name, role, portrait)
 * @param {string} comfyBase   - ComfyUI base URL for resolving image URLs
 */
export async function exportLessonPDF(plan, jobs, educator, comfyBase) {
  const base = (comfyBase || 'http://localhost:8188').replace(/\/$/, '')
  const title = plan?.lessonTitle || 'Lesson Plan'
  const synopsis = plan?.synopsis || ''
  const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  // Resolve a job's still image to something usable in the print doc. Jobs can
  // carry an image as EITHER a plain URL string (demo / Wan / CDN assets) OR a
  // legacy ComfyUI {filename,subfolder,type} object. Prefer the scene still,
  // fall back to the faceswap/presenter still.
  const resolveImgSrc = (job) => {
    const pick = job.sceneImage || job.faceswapImage || null
    if (!pick) return null
    if (typeof pick === 'string') return pick                    // plain URL or data: URL
    if (pick.filename) {                                          // legacy ComfyUI object
      return `${base}/view?filename=${encodeURIComponent(pick.filename)}&subfolder=${pick.subfolder || ''}&type=${pick.type || 'output'}`
    }
    return null
  }

  // Pre-fetch each image as base64 so it survives the print popup. Cross-origin
  // CDN URLs will fail the fetch (CORS) — in that case we keep the raw URL and
  // let the print window load it directly (works for public https assets).
  const shotData = await Promise.all(
    (jobs || []).map(async (job) => {
      const src = resolveImgSrc(job)
      const imgBase64 = await urlToBase64(src)
      return { job, imgBase64: imgBase64 || src || null }
    })
  )

  // Educator portrait
  const educatorPortrait = educator?.portrait
    ? educator.portrait  // already base64 data URL from localStorage
    : null

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(title)} — LessonForge</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #1a1a2e;
      background: #fff;
      font-size: 11pt;
      line-height: 1.6;
    }

    /* ── Page layout ── */
    .page { page-break-after: always; padding: 48px 56px; min-height: 100vh; }
    .page:last-child { page-break-after: avoid; }

    /* ── Cover page ── */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0d1a3a 100%);
      color: white;
      padding: 64px;
    }
    .cover-wan-bar {
      width: 64px; height: 4px;
      background: linear-gradient(90deg, #ea580c, #ff6b00);
      margin-bottom: 32px;
      border-radius: 2px;
    }
    .cover h1 { font-size: 32pt; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .cover .synopsis { font-size: 12pt; color: #aaa; max-width: 540px; line-height: 1.7; margin-bottom: 40px; }
    .cover .meta { font-size: 10pt; color: #666; }
    .cover .meta span { color: #ea580c; font-weight: 600; }
    .cover-educator {
      display: flex; align-items: center; gap: 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px 20px;
      margin-top: 40px;
      width: fit-content;
    }
    .cover-educator img {
      width: 56px; height: 56px;
      border-radius: 50%;
      object-fit: cover;
      object-position: top;
      border: 2px solid #ea580c;
    }
    .cover-educator .avatar-placeholder {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: #ea580c22;
      border: 2px solid #ea580c;
      display: flex; align-items: center; justify-content: center;
      font-size: 18pt; font-weight: 700; color: #ea580c;
    }
    .cover-educator .name { font-weight: 600; font-size: 11pt; }
    .cover-educator .role { font-size: 9pt; color: #888; }
    .cover-logo {
      margin-top: auto;
      padding-top: 40px;
      font-size: 9pt;
      color: #444;
    }
    .cover-logo strong { color: #ea580c; }

    /* ── Section headers ── */
    .section-header {
      display: flex; align-items: center; gap: 10px;
      border-bottom: 2px solid #ea580c;
      padding-bottom: 8px;
      margin-bottom: 24px;
    }
    .section-header h2 { font-size: 16pt; font-weight: 700; color: #1a1a2e; }
    .section-number {
      width: 28px; height: 28px;
      background: #ea580c;
      color: white;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: 700;
      flex-shrink: 0;
    }

    /* ── Shot breakdown ── */
    .shot-card {
      border: 1px solid #e8e8e8;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .shot-card:nth-child(odd) { background: #fafafa; }
    .shot-header {
      display: flex; align-items: flex-start; gap: 16px;
      margin-bottom: 14px;
    }
    .shot-image {
      width: 120px; height: 90px;
      border-radius: 8px;
      object-fit: cover;
      object-position: top;
      border: 1px solid #ddd;
      flex-shrink: 0;
    }
    .shot-image-placeholder {
      width: 120px; height: 90px;
      border-radius: 8px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      display: flex; align-items: center; justify-content: center;
      color: #aaa; font-size: 10pt;
      flex-shrink: 0;
    }
    .shot-meta { flex: 1; }
    .shot-number {
      font-size: 8pt; font-weight: 600;
      color: #ea580c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .shot-title { font-size: 13pt; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
    .shot-type-badge {
      display: inline-block;
      font-size: 8pt; font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      border: 1px solid;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .type-hook         { background: #f3e8ff; color: #7c3aed; border-color: #c4b5fd; }
    .type-concept      { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
    .type-demo         { background: #dcfce7; color: #166534; border-color: #86efac; }
    .type-summary      { background: #fef9c3; color: #854d0e; border-color: #fde047; }
    .type-calltoaction { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

    .shot-body { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-label {
      font-size: 8pt; font-weight: 600;
      color: #888; text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-value { font-size: 10pt; color: #333; line-height: 1.6; }
    .prompt-box {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 8px 10px;
      font-family: monospace;
      font-size: 9pt;
      color: #555;
      line-height: 1.5;
    }

    /* ── Transcript ── */
    .transcript-item { margin-bottom: 24px; page-break-inside: avoid; }
    .transcript-shot-label {
      font-size: 9pt; font-weight: 700;
      color: #ea580c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .transcript-text {
      font-size: 11pt;
      line-height: 1.8;
      color: #1a1a2e;
      border-left: 3px solid #e4e4e4;
      padding-left: 16px;
    }

    /* ── Student handout ── */
    .handout-box {
      border: 2px dashed #ea580c;
      border-radius: 10px;
      padding: 24px 28px;
      margin-bottom: 24px;
    }
    .handout-box h3 { font-size: 13pt; font-weight: 700; margin-bottom: 12px; color: #1a1a2e; }
    .handout-box ul { padding-left: 20px; }
    .handout-box li { margin-bottom: 8px; font-size: 10.5pt; line-height: 1.6; }
    .key-term {
      display: inline-block;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 9pt;
      font-weight: 600;
      margin: 2px;
      color: #856404;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 8pt;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 32px 40px; }
      .cover { padding: 48px; }
    }
  </style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════ -->
<!-- COVER PAGE -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-wan-bar"></div>
  <h1>${escHtml(title)}</h1>
  <p class="synopsis">${escHtml(synopsis)}</p>

  ${educatorPortrait || educator ? `
  <div class="cover-educator">
    ${educatorPortrait
      ? `<img src="${educatorPortrait}" alt="${escHtml(educator?.name || '')}" />`
      : `<div class="avatar-placeholder">${escHtml((educator?.name || 'E').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase())}</div>`
    }
    <div>
      <div class="name">${escHtml(educator?.name || '')}</div>
      <div class="role">${escHtml(educator?.role || '')}</div>
    </div>
  </div>` : ''}

  <div class="meta" style="margin-top: 32px;">
    Generated by <span>LessonForge</span> &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; ${jobs.length} shot${jobs.length !== 1 ? 's' : ''}
  </div>
  <div class="cover-logo">
    Powered by <strong>AMD Instinct</strong> GPU Infrastructure &nbsp;·&nbsp; LTX-2
  </div>
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 2 — SHOT BREAKDOWN -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page">
  <div class="section-header">
    <div class="section-number">1</div>
    <h2>Shot Breakdown</h2>
  </div>

  ${shotData.map(({ job, imgBase64 }) => {
    const typeClass = 'type-' + (job.type || 'concept').toLowerCase().replace(/\s+/g, '')
    return `
    <div class="shot-card">
      <div class="shot-header">
        ${imgBase64
          ? `<img class="shot-image" src="${imgBase64}" alt="Shot ${job.shotIndex}" />`
          : `<div class="shot-image-placeholder">No image</div>`
        }
        <div class="shot-meta">
          <div class="shot-number">Shot ${job.shotIndex} &nbsp;·&nbsp; ${escHtml(job.duration || '')}</div>
          <div class="shot-title">${escHtml(job.title || '')}</div>
          <span class="shot-type-badge ${typeClass}">${escHtml(job.type || 'concept')}</span>
        </div>
      </div>
      <div class="shot-body">
        <div>
          <div class="field-label">🎤 Voiceover Script</div>
          <div class="field-value">${escHtml(job.voiceover || '—')}</div>
        </div>
        <div>
          <div class="field-label">🎬 Video Prompt</div>
          <div class="prompt-box">${escHtml(job.prompt || '—')}</div>
        </div>
      </div>
    </div>`
  }).join('')}

  <div class="footer">
    <span>${escHtml(title)}</span>
    <span>LessonForge · Shot Breakdown</span>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 3 — FULL TRANSCRIPT -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page">
  <div class="section-header">
    <div class="section-number">2</div>
    <h2>Full Voiceover Transcript</h2>
  </div>

  ${shotData.map(({ job }) => `
  <div class="transcript-item">
    <div class="transcript-shot-label">Shot ${job.shotIndex} — ${escHtml(job.title || '')}</div>
    <div class="transcript-text">${escHtml(job.voiceover || '—')}</div>
  </div>
  `).join('')}

  <div class="footer">
    <span>${escHtml(title)}</span>
    <span>LessonForge · Full Transcript</span>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════ -->
<!-- PAGE 4 — STUDENT HANDOUT -->
<!-- ══════════════════════════════════════════════════════ -->
<div class="page">
  <div class="section-header">
    <div class="section-number">3</div>
    <h2>Student Handout</h2>
  </div>

  <div class="handout-box">
    <h3>📚 Learning Objectives</h3>
    <ul>
      ${(plan?.shots || jobs).map((s, i) => `<li>${escHtml(s.title || s.lessonTitle || `Objective ${i+1}`)}</li>`).join('')}
    </ul>
  </div>

  <div class="handout-box">
    <h3>📝 Key Takeaways</h3>
    <ul>
      ${shotData.map(({ job }) => job.voiceover
        ? `<li>${escHtml(firstSentence(job.voiceover))}</li>`
        : ''
      ).filter(Boolean).join('')}
    </ul>
  </div>

  <div class="handout-box" style="border-color: #1d4ed8;">
    <h3>✏️ Notes</h3>
    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 8px;">
      ${Array(8).fill(0).map(() =>
        `<div style="height: 24px; border-bottom: 1px solid #e0e0e0;"></div>`
      ).join('')}
    </div>
  </div>

  <div class="footer">
    <span>${escHtml(title)}</span>
    <span>LessonForge · Student Handout</span>
  </div>
</div>

</body>
</html>`

  // Open in a new window and trigger print
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Please allow pop-ups to export the PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    setTimeout(() => {
      win.focus()
      win.print()
    }, 500)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstSentence(text) {
  if (!text) return ''
  const match = text.match(/[^.!?]+[.!?]/)
  return match ? match[0].trim() : text.slice(0, 120)
}
