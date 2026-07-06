/**
 * Calls an OpenAI-compatible LLM to generate a structured shot plan
 * for an educational video lesson.
 */
export async function generateShotPlan({ topic, objectives, audience, duration, style, tone, educators, resolvedObjectives, splitScreen = false }, settings) {
  // Qwen calls go through the Alibaba Cloud backend (holds the DashScope key).
  const backend = (settings.comfyEndpoint || '').replace(/\/$/, '')
  const model = settings.llmModel || 'qwen-plus'
  if (!backend) throw new Error('No backend set. Add your Alibaba Cloud backend URL in Settings — the Qwen agents run through it.')

  // Build educator context string
  const educatorContext = educators?.length > 0
    ? `\nPRESENTER(S):\n${educators.map(e =>
        `- ${e.name} (${e.role}): ${e.appearance}${e.wardrobe ? `. Outfit (identical in EVERY shot): ${e.wardrobe}` : ''}${e.voiceStyle ? `. Voice: ${e.voiceStyle}` : ''}${e.onScreenNotes ? `. Notes: ${e.onScreenNotes}` : ''}`
      ).join('\n')}\nIMPORTANT: Weave the presenter's appearance into every talking-head/intro/summary videoPrompt AND presenterPrompt. Their look AND their outfit MUST be identical in every single shot — describe the exact same clothing each time (never change blazer→lab coat, etc.). Consistent face, hair, and costume across all shots.`
    : ''

  const SPLIT_SCHEMA = splitScreen
    ? `\n      "layout": "split",\n      "presenterPrompt": "string (talking-head prompt: JUST the presenter framed for the LEFT 30% column — head-and-shoulders, looking at camera, neutral studio backdrop, no lesson graphics)",\n      "scenePrompt": "string (the lesson visual for the RIGHT 70% column — the scene/diagram/reenactment WITHOUT the presenter appearing in it)",`
    : ''

  const splitDirective = splitScreen
    ? `\nLAYOUT: SPLIT-SCREEN. Every shot uses a two-column composite — the presenter (talking head) fills the LEFT 30% and the lesson visual fills the RIGHT 70%. For EACH shot you MUST provide:\n- "layout": "split"\n- "presenterPrompt": the presenter alone, head-and-shoulders, facing camera, clean neutral studio backdrop, NO lesson graphics behind them.\n- "scenePrompt": the lesson visual ONLY — the scene, diagram, animation or reenactment — and CRUCIALLY the presenter must NOT appear in it.\nKeep "videoPrompt" as a full-frame fallback that combines both. Keep the presenter's appearance consistent across all presenterPrompts.`
    : ''

  const systemPrompt = `You are an expert educational video producer. You create structured shot plans for faculty and educational content creators. Your shot plans are clear, pedagogically sound, and optimised for AI video generation.

CRITICAL RULE FOR videoPrompt / presenterPrompt / scenePrompt / onScreenText: every visual prompt MUST describe a CONCRETE, REAL-WORLD, filmable scene that a text-to-video model can actually render — real people, places, objects, actions, lighting and camera. NEVER reference software UIs, dashboards, app screens, screen-recordings, product names, brand names, internal frameworks, or invented acronyms — a model cannot draw those and will hallucinate gibberish (fake documents, meaningless text on whiteboards). Teach the concept through real imagery, not through pictures of software. Keep onScreenText to short plain-language phrases with no product jargon or acronyms. IMPORTANT — the video model CANNOT render legible text: never ask for on-frame words, letters, numbers, labels, captions, signage, handwriting, whiteboards with writing, or labelled diagrams/charts/graphs. Convey ideas through objects, actions, colour and light instead. Any words for the viewer belong ONLY in the onScreenText field (composited as an overlay), never described inside videoPrompt/scenePrompt/presenterPrompt.

Return ONLY valid JSON — no markdown fences, no explanation. The JSON must match this schema exactly:
{
  "lessonTitle": "string",
  "totalDuration": "string (e.g. '4 minutes')",
  "synopsis": "string (2-3 sentences)",
  "shots": [
    {
      "index": 1,
      "type": "hook|concept|demo|summary|callToAction",
      "title": "string (short scene name)",
      "duration": "string (e.g. '30s')",
      "voiceover": "string (the narration script for this shot)",
      "videoPrompt": "string (detailed cinematic prompt for an AI video generator — describe visuals, camera, lighting, style)",${SPLIT_SCHEMA}
      "negativePrompt": "string (what to avoid in the video)",
      "onScreenText": "string or null (any text overlay or captions)",
      "pedagogicalNote": "string (why this shot is here — learning purpose)"
    }
  ]
}`

  const userPrompt = `Create an educational video lesson shot plan with these parameters:

Topic: ${topic}
Learning Objectives: ${resolvedObjectives || objectives}
Target Audience: ${audience}
Desired Duration: ${duration}
Visual Style: ${style}
Tone: ${tone}${educatorContext}${splitDirective}

Generate ${estimateShotCount(duration)} shots. Make the video prompts highly detailed and cinematic — they will be sent directly to Wan (Tongyi Wanxiang) on Alibaba Cloud for video generation.`

  const res = await fetch(`${backend}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Qwen agent error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from LLM')

  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse shot plan JSON from LLM response')
  }
}

function estimateShotCount(duration) {
  const mins = parseFloat(duration) || 3
  if (mins <= 2) return '4–5'
  if (mins <= 5) return '6–8'
  if (mins <= 10) return '9–12'
  return '12–16'
}
