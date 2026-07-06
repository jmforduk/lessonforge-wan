/**
 * Returns a realistic fake shot plan instantly — no API key needed.
 * Used in Demo Mode so judges / reviewers can try the full UI flow.
 */
// Talking-head still of the demo educator (Dr. Sarah Chen) for the left column.
const DEMO_PRESENTER = 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/c050c4a91_generated_image.png'

// Presenter filmed *on location* — used when a backdrop location is chosen so the
// demo reads as an authentic setting instead of a floating studio portrait.
const DEMO_PRESENTER_ON_LOCATION = {
  lecture_hall: 'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/1f7f5773f_generated_image.png',
  gpu_lab:      'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/c81986f78_generated_image.png',
  studio_dark:  'https://media.base44.com/images/public/6a40ea3eb46ed39c11d0f5c0/be7382bef_generated_image.png',
}

// ── Default demo: "Introduction to Neural Networks" ──────────────────────────
function neuralNetworksPlan() {
  return {
    lessonTitle: "Introduction to Neural Networks",
    totalDuration: "4 minutes",
    synopsis: "A cinematic introduction to how neural networks learn, designed for undergraduate computer science students. The lesson builds from biological inspiration through to practical applications, leaving students with a clear mental model of the technology powering modern AI.",
    shots: [
      {
        index: 1,
        type: "hook",
        sceneRightPrompt: "A slow cinematic push down a long aisle of tall glowing server racks in a modern data centre, rows of soft red and blue indicator lights receding into the distance, cool reflections on a polished floor. Empty environment, no people. Photorealistic, cinematic 4K.",
        title: "The Question That Started It All",
        duration: "30s",
        voiceover: "What if a machine could learn the way you do — not from rules, but from experience? In the next four minutes, you'll understand exactly how that's possible, and why it's changing everything.",
        videoPrompt: "Cinematic close-up of a human eye reflecting streams of glowing data, transitioning to a wide shot of a futuristic lecture hall bathed in cool blue light. Neural network visualisations float in the air like constellations. Camera slowly pulls back. 4K, photorealistic, cinematic depth of field.",
        negativePrompt: "blurry, low quality, text watermark, cartoonish, oversaturated, noise",
        onScreenText: "What does it mean for a machine to learn?",
        pedagogicalNote: "The hook creates cognitive tension with a provocative question, activating prior curiosity and priming students for the concept introduction."
      },
      {
        index: 2,
        presenter: false, // abstract animation — narrator is voice-only, no face in frame
        type: "concept",
        title: "Biological Inspiration",
        duration: "45s",
        voiceover: "Your brain contains roughly 86 billion neurons. Each one is simple — it either fires or it doesn't. But connected together, they produce everything you think, feel, and remember. Artificial neural networks borrow this exact idea.",
        videoPrompt: "Macro photography of a glowing neuron firing, synaptic connections lighting up in sequence like a cascade of stars. Warm golden light, slow motion, extreme close-up transitioning to a wider network view. Then a smooth morph to a digital equivalent — glowing nodes and edges in a dark space. Cinematic, 4K.",
        negativePrompt: "blurry, text overlay, low quality, cartoonish, harsh lighting",
        onScreenText: "86 billion neurons → one idea: connection",
        pedagogicalNote: "Anchoring the artificial concept to biological reality reduces cognitive load and leverages students' prior knowledge of biology."
      },
      {
        index: 3,
        presenter: false, // abstract animation — narrator is voice-only, no face in frame
        type: "concept",
        title: "Layers: Input, Hidden, Output",
        duration: "60s",
        voiceover: "An artificial neural network is organised in layers. The input layer receives raw data — an image, a sentence, a number. Hidden layers find patterns — edges, shapes, meaning. The output layer makes a decision. Training is simply adjusting the connections until the decisions are good ones.",
        videoPrompt: "Clean 3D animation of a neural network with three visible layers, nodes glowing as data passes through. Input layer receives glowing pixels of a small image. Middle layers light up sequentially showing pattern detection. Output layer pulses brightly to mark a decision. Dark background, electric blue and purple accent colours, smooth camera orbit. 4K, cinematic.",
        negativePrompt: "blurry, cluttered, busy background, text heavy, low resolution",
        onScreenText: "Input → Hidden Layers → Output",
        pedagogicalNote: "Visualising data flow through the network builds a correct and durable mental model before introducing the mathematics."
      },
      {
        index: 4,
        presenter: false, // abstract animation — narrator is voice-only, no face in frame
        type: "demo",
        title: "Learning in Action",
        duration: "60s",
        voiceover: "Here's the magic. The network makes a guess. It checks if it was right. If not, it adjusts every connection — just slightly — to do better next time. Do this millions of times and the network learns. This process is called backpropagation, and it's the engine behind almost every AI you've ever used.",
        videoPrompt: "Split-screen cinematic sequence: left side shows a neural network making predictions — nodes lighting up, a wrong guess shown in red. Right side shows connection weights adjusting, glowing lines shifting from red to green as accuracy improves. Abstract glowing bars in the corner shift and settle to suggest improvement over time. Dark, dramatic lighting, 4K photorealistic render.",
        negativePrompt: "blurry, oversimplified, cartoonish, bright background, low detail",
        onScreenText: "Guess → Check → Adjust → Repeat",
        pedagogicalNote: "The demo concretises the abstract training loop and introduces backpropagation in intuitive language before formal definition."
      },
      {
        index: 5,
        presenter: false, // empty data-centre dolly — no people in frame
        type: "summary",
        title: "What You Now Know",
        duration: "30s",
        voiceover: "So — neural networks are inspired by the brain, built from layers of connected nodes, and trained by repeatedly adjusting those connections based on feedback. Simple idea. Profound results.",
        videoPrompt: "Elegant motion graphics recap: three glowing symbols appear sequentially — a brain, a set of connected nodes, a looping arrow — with no words. Clean dark background, minimal design, soft light. Camera slowly zooms out to reveal all three side by side. Cinematic grade, 4K.",
        negativePrompt: "cluttered, text-heavy, low quality, bright harsh colours",
        onScreenText: "Brain-inspired · Layered · Learned from feedback",
        pedagogicalNote: "Spaced retrieval summary reinforces the three core concepts and prepares students for the call to action."
      },
      {
        index: 6,
        type: "callToAction",
        sceneRightPrompt: "Abstract animation on a smooth deep-blue studio background lit with soft gradients and gentle bokeh highlights: a warm ring of light gently pulses outward in a welcoming rhythm, inviting the viewer in. Empty environment, no people, no text. Clean, modern, cinematic 4K.",
        title: "Your Next Step",
        duration: "15s",
        voiceover: "Now that you understand the architecture — build one. Head to the course portal and try the interactive neural network lab. See for yourself how the connections learn.",
        videoPrompt: "Motivated student at a glowing laptop in a dark studio environment, glowing node patterns reflecting in their eyes. Camera pushes in slowly. Warm accent lighting, cinematic bokeh background, professional grade. 4K.",
        negativePrompt: "blurry, stock photo look, flat lighting, low energy",
        onScreenText: "Try the interactive lab → course portal",
        pedagogicalNote: "Immediate actionable next step closes the loop and drives engagement with the hands-on component of the course."
      }
    ]
  }
}

// ── Self-referential demo: "LessonForge, explained by LessonForge" ───────────
// Doubles as the hackathon submission video. Presenter walks through the actual
// pipeline; the right-hand scene shows the real UI / LAF agents / AMD telemetry.
function lessonForgeExplainerPlan() {
  return {
    lessonTitle: "LessonForge, Explained by LessonForge",
    // Hand-authored, jargon-free, fully-renderable plan. It must NEVER be sent
    // through the LLM generator or overwritten — regenerating just re-emits this
    // exact plan (with wardrobe pinning + voiceover-driven timing applied).
    // Updated for the Wan / Alibaba Cloud build: showcases the two-stage review
    // gate, presenter face-lock consistency, and native spoken narration.
    locked: true,
    isBespoke: true,
    totalDuration: "3 minutes",
    synopsis: "A short walkthrough of how one lesson brief becomes a finished, consistent teaching video — planned by AI, previewed as a still you approve, then rendered as a talking video with the same presenter and a spoken voice throughout. This very lesson was made that way. Prepare once, personalise for every student.",
    shots: [
      {
        index: 1,
        type: "hook",
        sceneRightPrompt: "A slow cinematic push through a bright modern studio: soft glowing light panels, gentle blue and warm highlights, a clean empty set with cameras softly out of focus. Empty environment, no people, no text. Cinematic 4K.",
        title: "This Lesson Made Itself",
        duration: "25s",
        voiceover: "Everything you're watching — including this explanation — was generated by AI from a single lesson a teacher wrote. No film crew, no editing. Here's how it works.",
        videoPrompt: "A friendly teacher stands alone in a bright modern studio, speaking warmly to camera, one hand gesturing openly. Soft cinematic key light, gentle blue and warm tones, shallow depth of field, clean uncluttered background. Photorealistic, cinematic 4K.",
        negativePrompt: "blurry, low quality, cartoonish, cluttered, second person",
        onScreenText: "One brief becomes a full lesson",
        pedagogicalNote: "A self-referential hook creates immediate intrigue and demonstrates the product's capability before a single feature is named."
      },
      {
        index: 2,
        type: "concept",
        sceneRightPrompt: "Abstract animation in a dark studio space: several softly glowing orbs of light arranged in a ring, pulses of light travelling between them along fine glowing threads and building into one smooth flowing stream. Deep blue and warm gold light. Empty environment, no people, no text. Cinematic 4K.",
        title: "One Brief In, A Whole Lesson Out",
        duration: "35s",
        voiceover: "It starts with one brief: a topic, an audience, a tone. From there an AI planner writes the whole lesson — the opening hook, the key ideas, a worked example, the recap and the close — and breaks it into short shots ready to film.",
        videoPrompt: "Abstract animation in a dark studio space: several softly glowing orbs of light arranged in a ring, gentle pulses of light travelling back and forth between them along fine glowing threads as if exchanging ideas, building into one smooth flowing stream. Deep blue and warm gold light, calm elegant motion. Empty environment, no people. Cinematic 4K.",
        negativePrompt: "blurry, laggy, low resolution, people, faces",
        onScreenText: "An AI planner writes the whole lesson",
        pedagogicalNote: "Grounds the abstract 'AI planning' claim in a concrete, calm visual metaphor the viewer can follow."
      },
      {
        index: 3,
        type: "concept",
        sceneRightPrompt: "Abstract animation on a dark background: a single glowing rectangular frame of light floats forward, a soft sweeping light-bar passes across it as if scanning and checking it, and a calm ring of light settles around it in approval. Deep blue and white glow. Empty environment, no people, no text. Cinematic 4K.",
        title: "Preview First, Then Render",
        duration: "40s",
        voiceover: "Nothing expensive happens straight away. First you see a quick still of every shot — the scene, the framing, the presenter. You approve the ones that look right and reject the ones that don't. Only then does the full video render. You stay in control, and nothing is wasted.",
        videoPrompt: "Abstract animation on a dark background: a single glowing rectangular frame of light floats forward, a soft sweeping light-bar passes across it as if scanning and checking it, and a calm ring of light settles around it in approval. Minimal and elegant, deep blue and white glow, smooth motion. Empty environment, no people. Cinematic 4K.",
        negativePrompt: "cluttered, low quality, inconsistent style, people, faces",
        onScreenText: "Approve the still, then render the video",
        pedagogicalNote: "Names the two-stage review gate — the human-in-the-loop cost control that differentiates this from one-shot generators."
      },
      {
        index: 4,
        type: "demo",
        sceneRightPrompt: "Abstract animation on a dark background: a row of identical glowing portrait frames of light lined up in perfect sequence, each one lighting up in turn to show they all match, connected by a steady thread of light. Deep blue and warm gold glow. Empty environment, no people, no text. Cinematic 4K.",
        title: "The Same Face, Every Shot",
        duration: "40s",
        voiceover: "Long AI videos usually drift — the face changes, the room shifts, the person you started with slowly becomes someone else. Here the presenter is locked to one portrait, so it's the same person, shot after shot, from the opening line to the very end.",
        videoPrompt: "A warm, consistent presenter stands centre-frame in a softly lit modern studio, turning her head slightly and settling to face the camera with a steady confident expression, as if the same portrait has come to life. Even soft key light, gentle blue background glow, clean and uncluttered. Photorealistic, cinematic 4K.",
        negativePrompt: "different person, second person, morphing face, distorted features, crowd",
        onScreenText: "One presenter, locked across every shot",
        pedagogicalNote: "Names the specific failure mode (identity drift) before showing the fix, making the consistency feature legible to a technical judge."
      },
      {
        index: 5,
        type: "summary",
        sceneRightPrompt: "Abstract animation on a dark background: gentle concentric rings of light ripple outward from a single soft point as if sound is radiating, pulsing calmly in time. Deep blue and warm gold glow, smooth motion. Empty environment, no people, no text. Cinematic 4K.",
        title: "It Even Speaks For Itself",
        duration: "25s",
        voiceover: "And it isn't silent. Each finished shot comes back as a talking video — the presenter delivers the script out loud in a natural voice, so the lesson is ready to watch the moment it renders. One brief in; a narrated video and a printable handout out.",
        videoPrompt: "A friendly presenter stands in a bright modern studio speaking directly to camera with clear, expressive lip movement and an engaged, animated delivery, as if mid-sentence explaining something. Soft cinematic lighting, warm and blue tones, clean background. Photorealistic, cinematic 4K.",
        negativePrompt: "silent, still, frozen, second person, cluttered, low quality",
        onScreenText: "Narrated video plus a printable handout",
        pedagogicalNote: "Highlights native spoken narration and the handout output, crystallising the end-to-end result into one memorable line."
      },
      {
        index: 6,
        type: "callToAction",
        sceneRightPrompt: "Abstract animation on a dark background: a glowing play-triangle of light forms inside a soft rounded frame, then a burst of light particles fans outward as if being sent out to the world. Deep blue and warm gold glow. Empty environment, no people, no text. Cinematic 4K.",
        title: "Try It Yourself",
        duration: "15s",
        voiceover: "This whole lesson was built with no setup and no accounts. Type a topic, preview the shots, approve them, and watch your first narrated lesson appear. Give it a try.",
        videoPrompt: "A friendly presenter stands centre-frame against a smooth deep-blue studio background lit with soft gradients and gentle bokeh highlights, smiling warmly and giving an encouraging open-handed gesture inviting the viewer in. Clean, modern, confident. Photorealistic, cinematic 4K.",
        negativePrompt: "blurry, flat lighting, stock-photo look, low energy, second person",
        onScreenText: "Try LessonForge — free, no setup",
        pedagogicalNote: "A frictionless, zero-setup call to action converts judge curiosity into a hands-on trial immediately."
      }
    ]
  }
}


// ── Bespoke demo: "How the Immune System Fights a Virus" ─────────────────────
// Hand-authored, LOCKED, non-split. Bespoke ZIT stills + Wan clips (built by
// Julian in FilmForge) are mapped shot-for-shot in App.jsx (IMMUNE_STILLS /
// IMMUNE_CLIPS) by shot index 1..8. Narration is written as HEARD AUDIO; the
// on-frame titles the assets already carry are echoed in onScreenText only.
function immuneSystemPlan() {
  return {
    variant: 'immune',
    locked: true,
    lessonTitle: "How the Immune System Fights a Virus",
    totalDuration: "4 minutes",
    synopsis: "A cinematic walkthrough of how the body defends itself against a virus \u2014 from the first fast, general response of innate immunity through to the slow, precise, antibody-driven adaptive response. Built for secondary-school and early-undergraduate biology students, it leaves viewers with a clear two-layer mental model of immune defence.",
    shots: [
      {
        index: 1,
        type: "hook",
        title: "A Virus Arrives",
        duration: "20s",
        voiceover: "Every day, viruses try to get into your body. This one is about to meet a defence system so layered, so precise, that most of the time you never even notice the fight.",
        videoPrompt: "A single stylised virus particle drifts through the air toward the side profile of a smooth white human face, faint glowing hexagonal patterns on the wall behind, soft warm light on a wooden floor. Photorealistic 3D render, shallow depth of field, cinematic.",
        negativePrompt: "text, words, captions, subtitles, labels, watermark, logo, low quality, blurry, extra people",
        onScreenText: "How your body fights a virus",
        pedagogicalNote: "A concrete threat opens a curiosity gap: how does the body stop this?"
      },
      {
        index: 2,
        presenter: true,
        type: "concept",
        title: "Innate Immunity \u2014 Fast & General",
        duration: "35s",
        voiceover: "Your first line of defence is innate immunity. It is fast and it is general \u2014 it does not care which virus this is, it simply attacks anything that looks foreign, within minutes.",
        videoPrompt: "A professional female science presenter in a dark navy suit stands facing camera, mid-explanation, gesturing with both hands, in a bright modern studio. Warm confident delivery. Photorealistic, cinematic key light.",
        negativePrompt: "second person, duplicate presenter, text artefacts, garbled text, watermark, low quality, blurry",
        onScreenText: "Innate Immunity = Fast & General",
        pedagogicalNote: "Naming the two systems early gives students a scaffold to hang detail on."
      },
      {
        index: 3,
        presenter: false,
        type: "concept",
        title: "The Macrophage Raises the Alarm",
        duration: "35s",
        voiceover: "A cell called a macrophage patrols your tissues. When it meets the virus, it swallows it \u2014 and then it raises the alarm, releasing chemical signals that call in reinforcements.",
        videoPrompt: "Cinematic microscopic scene: a large translucent immune cell on the left extends toward a small red virus particle in the centre, while a second glowing cell on the right pulses as it sends out signal molecules. Deep blue background, soft bioluminescent glow. Photorealistic 3D, no people.",
        negativePrompt: "text, words, captions, labels, diagram labels, watermark, people, faces, low quality, blurry",
        onScreenText: "Macrophage = Alarm Raiser",
        pedagogicalNote: "A single concrete character (the macrophage) makes an abstract signalling cascade tangible."
      },
      {
        index: 4,
        presenter: true,
        type: "concept",
        title: "Adaptive Immunity \u2014 Slow & Specific",
        duration: "35s",
        voiceover: "If the threat gets through, a second system takes over: adaptive immunity. It is slower to start, but it is exquisitely specific \u2014 built to recognise this exact virus and nothing else.",
        videoPrompt: "The same female presenter in a dark navy suit stands facing camera holding up two simple physical props \u2014 a blue shield in one hand and a Y-shaped object in the other. Bright modern studio, warm smile, cinematic soft light.",
        negativePrompt: "second person, duplicate presenter, garbled text, watermark, low quality, blurry",
        onScreenText: "Adaptive Immunity = Slow & Specific",
        pedagogicalNote: "Contrast (fast/general vs slow/specific) is the core comparison the lesson is built around."
      },
      {
        index: 5,
        presenter: true,
        type: "transition",
        title: "The Response Ramps Up",
        duration: "20s",
        voiceover: "Now the adaptive response ramps up. Special cells read the virus, copy its shape, and start building a weapon tuned precisely to it.",
        videoPrompt: "A clean empty modern presentation studio with a softly lit circular stage, faint blue technical line-work glowing on a curved backdrop, warm spotlight from above. No people, no text. Photorealistic 3D render, cinematic.",
        negativePrompt: "text, words, captions, labels, watermark, people, faces, low quality, blurry",
        onScreenText: "",
        pedagogicalNote: "A calm empty-stage beat gives students a moment to consolidate before the payoff shot."
      },
      {
        index: 6,
        presenter: false,
        type: "concept",
        title: "Antibodies Neutralise the Virus",
        duration: "35s",
        voiceover: "That weapon is the antibody. Your body mass-produces these Y-shaped proteins, and they lock onto the virus, sticking to it so it can no longer infect your cells.",
        videoPrompt: "A friendly stylised scene: a large purple Y-shaped antibody floats on the left, a small factory on the right emits a stream of tiny Y-shapes that latch onto small red virus particles in the middle, pastel blue sky background with soft clouds. Photorealistic 3D animation style, no people.",
        negativePrompt: "text, words, captions, labels, watermark, people, faces, low quality, blurry",
        onScreenText: "Antibodies = Virus Neutralizers",
        pedagogicalNote: "The factory metaphor conveys scale (mass production) without on-frame text."
      },
      {
        index: 7,
        presenter: true,
        type: "synthesis",
        title: "Two Layers, One Total Defence",
        duration: "30s",
        voiceover: "So your defence works in two layers. Innate immunity buys time with a fast, general attack. Adaptive immunity finishes the job with precision. Together, they are a total defence.",
        videoPrompt: "The female presenter in a dark navy suit stands facing camera with arms open in an inviting gesture, bright studio, warm confident smile. Photorealistic, cinematic soft light.",
        negativePrompt: "second person, duplicate presenter, garbled text, watermark, low quality, blurry",
        onScreenText: "Innate + Adaptive = Total Defense",
        pedagogicalNote: "Synthesis shot reunites the two threads into the single mental model to retain."
      },
      {
        index: 8,
        presenter: true,
        type: "outro",
        title: "Keep Learning, Stay Healthy",
        duration: "20s",
        voiceover: "That is how your body wins a fight you never see. Keep learning about it \u2014 and stay healthy.",
        videoPrompt: "The female presenter in a dark navy suit stands facing camera, relaxed and smiling warmly, in a bright studio with a softly lit bookshelf to one side. Photorealistic, cinematic warm light.",
        negativePrompt: "second person, duplicate presenter, garbled text, watermark, low quality, blurry",
        onScreenText: "Keep Learning. Stay Healthy.",
        pedagogicalNote: "A warm sign-off closes the emotional arc and prompts continued curiosity."
      }
    ]
  }
}

const PLANS = {
  neural: neuralNetworksPlan,
  lessonforge: lessonForgeExplainerPlan,
  immune: immuneSystemPlan,
}

export function getDemoShotPlan({ splitScreen = false, variant = 'neural', backdrop = null, educator = null } = {}) {
  const build = PLANS[variant] || PLANS.neural
  const plan = build()

  // The self-demo ('lessonforge') is HARD-CODED to split-screen — it's authored
  // to show a talking-head presenter (left) beside the lesson scene (right), so
  // it must always render split regardless of the create-form toggle.
  if (variant === 'lessonforge') splitScreen = true

  if (splitScreen) {
    plan.layout = 'split'
    // Describe the backdrop so a real render places the presenter *in* the room
    // rather than against a flat studio wall.
    const backdropDesc = backdrop?.description || backdrop?.name
    // Pin the presenter's gender + appearance so the base image matches the
    // selected educator (before faceswap) instead of a random person.
    const g = (educator?.gender || '').toLowerCase()
    const genderWord = g === 'female' ? 'woman' : g === 'male' ? 'man' : 'presenter'
    const look = (educator?.appearance || '').trim()
    const wardrobe = (educator?.wardrobe || '').trim()
    const outfit = wardrobe ? ` wearing exactly the same outfit in every shot: ${wardrobe},` : ''
    const who = look ? `a ${genderWord}, ${look},${outfit}` : `the presenter,${outfit}`
    const presenterPrompt = backdropDesc
      ? `Head-and-shoulders talking-head of ${who} facing camera, mid-speech, standing in ${backdropDesc}. The location is softly out of focus behind them; cinematic depth of field, soft key light. No lesson graphics or text.`
      : `Head-and-shoulders talking-head of ${who} facing camera, mid-speech, clean neutral studio backdrop, soft blue rim light. No lesson graphics.`
    plan.presenterBackdrop = backdrop ? { slug: backdrop.slug, name: backdrop.name, image: backdrop.image || null } : null
    // Prefer a presenter still actually filmed in the chosen location; fall back
    // to the location image behind the neutral portrait for custom locations.
    const onLocation = backdrop ? DEMO_PRESENTER_ON_LOCATION[backdrop.slug] : null
    // Use the selected educator's portrait so the shown presenter matches who is
    // selected; fall back to the on-location still, then the generic demo still.
    const presenterUrl = educator?.portrait || onLocation || DEMO_PRESENTER
    const presenterBgUrl = onLocation ? null : (backdrop?.image || null)
    plan.shots = plan.shots.map(shot => ({
      ...shot,
      layout: 'split',
      // Left column: presenter talking head. Right column: an EXPLICIT person-free
      // right-pane prompt (schematics / abstract scene). Fall back to videoPrompt
      // only if no dedicated right-pane prompt was authored.
      presenter: true, // split ALWAYS renders the presenter on the left, even if the shot was authored presenter-free
      presenterPrompt,
      scenePrompt: shot.sceneRightPrompt || shot.videoPrompt,
      sceneRightPrompt: shot.sceneRightPrompt || shot.videoPrompt,
      presenterUrl,
      // Only layer the location behind the presenter for custom locations that
      // lack a pre-composited on-location still.
      presenterBgUrl,
    }))
  }

  return plan
}
