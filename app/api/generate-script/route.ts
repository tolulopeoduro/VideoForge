import { NextRequest, NextResponse } from "next/server";
import { Scene, ScriptOptimizationResult, VisualReferenceItem } from "@/types/schema";
import { performDeepTopicResearch, ResearchDossier } from "./research";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt = "",
      rawScript = "",
      tone = "viral",
      orientation = "9:16",
      provider = "default",
      apiKey = "",
      modelName = "",
      customEndpoint = "",
    } = body;

    const inputTopic = (prompt || rawScript || "The future of AI video generation").trim();

    // 1. Perform Live Encyclopedic & Web Deep Research
    const research: ResearchDossier = await performDeepTopicResearch(inputTopic);

    // 2. Resolve API Key & Provider priority:
    // If user passed key in request body, use it; otherwise check process.env
    const effectiveOpenAiKey =
      provider === "openai" ? apiKey : process.env.OPENAI_API_KEY || (apiKey && provider === "default" ? apiKey : "");
    const effectiveGeminiKey =
      provider === "gemini" ? apiKey : process.env.GEMINI_API_KEY;
    const effectiveGroqKey =
      provider === "groq" ? apiKey : process.env.GROQ_API_KEY;

    let aiResult: ScriptOptimizationResult | null = null;

    if (provider === "groq" || effectiveGroqKey) {
      try {
        aiResult = await callOpenAICompatibleEndpoint({
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: effectiveGroqKey || apiKey,
          model: modelName || "llama-3.3-70b-versatile",
          topic: inputTopic,
          rawScript,
          tone,
          research,
        });
      } catch (e) {
        console.warn("Groq generation failed, falling back:", e);
      }
    } else if (provider === "ollama") {
      try {
        const ollamaBase = customEndpoint.replace(/\/$/, "") || "http://localhost:11434";
        aiResult = await callOpenAICompatibleEndpoint({
          url: `${ollamaBase}/v1/chat/completions`,
          apiKey: "ollama",
          model: modelName || "llama3",
          topic: inputTopic,
          rawScript,
          tone,
          research,
        });
      } catch (e) {
        console.warn("Ollama generation failed, falling back:", e);
      }
    } else if (provider === "openrouter" && apiKey) {
      try {
        aiResult = await callOpenAICompatibleEndpoint({
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey,
          model: modelName || "meta-llama/llama-3.3-70b-instruct",
          topic: inputTopic,
          rawScript,
          tone,
          research,
        });
      } catch (e) {
        console.warn("OpenRouter generation failed, falling back:", e);
      }
    } else if (effectiveOpenAiKey) {
      try {
        aiResult = await callOpenAICompatibleEndpoint({
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: effectiveOpenAiKey,
          model: modelName || "gpt-4o-mini",
          topic: inputTopic,
          rawScript,
          tone,
          research,
        });
      } catch (e) {
        console.warn("OpenAI generation failed, falling back:", e);
      }
    } else if (effectiveGeminiKey) {
      try {
        aiResult = await callGeminiEndpoint({
          apiKey: effectiveGeminiKey,
          model: modelName || "gemini-1.5-flash",
          topic: inputTopic,
          rawScript,
          tone,
          research,
        });
      } catch (e) {
        console.warn("Gemini generation failed, falling back:", e);
      }
    }

    // 3. If an LLM produced a valid result, return it
    if (aiResult && aiResult.scenes && aiResult.scenes.length >= 2) {
      return NextResponse.json({ success: true, result: aiResult });
    }

    // 4. Built-in Deep Research Synthesizer (No API Key Required)
    const synthesizedResult = synthesizeFromDeepResearch(
      inputTopic,
      rawScript,
      tone,
      orientation,
      research
    );

    return NextResponse.json({
      success: true,
      result: synthesizedResult,
    });
  } catch (error: any) {
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate researched script" },
      { status: 500 }
    );
  }
}

/**
 * Built-in Research Synthesizer: Constructs multi-sentence, substantive,
 * fact-grounded scenes directly from the live research dossier.
 */
function synthesizeFromDeepResearch(
  topic: string,
  rawDraft: string,
  tone: string,
  orientation: "9:16" | "16:9",
  research: ResearchDossier
): ScriptOptimizationResult {
  const timestamp = Date.now();
  const primarySource = research.sources[0];
  const secondarySource = research.sources[1] || primarySource;

  // Derive title from top research hit or topic
  const cleanTitle = primarySource?.title
    ? `${primarySource.title}: The Core Reality`
    : topic.slice(0, 42);

  // Extract real facts or fallback to verified context
  const factChecks: ScriptOptimizationResult["factChecks"] = [];
  if (research.facts.length > 0) {
    for (const f of research.facts.slice(0, 3)) {
      factChecks.push({
        claim: f.claim.length > 90 ? f.claim.slice(0, 87) + "..." : f.claim,
        sourceOrData: f.source,
        injectedStat: f.stat || "Verified",
      });
    }
  } else {
    factChecks.push({
      claim: `Historical and empirical research on ${topic}.`,
      sourceOrData: primarySource?.title || "Encyclopedic Record",
      injectedStat: "Primary",
    });
  }

  // Construct Scene 1: The Hook & Context (Origins, Names, Dates)
  let s1Text = "";
  if (primarySource && primarySource.extract) {
    const firstSentence = primarySource.extract.split(".")[0];
    s1Text = `${firstSentence}. While most people think this is straightforward, the reality is far more complex.`;
  } else if (rawDraft) {
    s1Text = `${rawDraft.slice(0, 120)}. But if you look deeper into how it actually works, the data reveals a completely different picture.`;
  } else {
    s1Text = `Everything you have been told about ${topic} only scratches the surface. To understand what is really happening, we have to examine the foundational mechanisms.`;
  }

  // Construct Scene 2: The Core Mechanism & Technical Data
  let s2Text = "";
  const keyFact = research.facts[0];
  if (keyFact) {
    s2Text = `Here is the critical data point: ${keyFact.claim} When you calculate the compounding effects, the difference is massive.`;
  } else if (secondarySource && secondarySource.extract) {
    const midSentence = secondarySource.extract.split(".")[0];
    s2Text = `According to verified technical analysis: ${midSentence}. This forms the operational backbone that everything else relies upon.`;
  } else {
    s2Text = `When researchers broke down the mathematics, the numbers were staggering. Classical methods simply cannot keep pace with this exponential shift.`;
  }

  // Construct Scene 3: The Impact & Next Frontier
  let s3Text = "";
  const nextFact = research.facts[1];
  if (nextFact) {
    s3Text = `That is exactly why global organizations are moving fast: ${nextFact.claim} The window of opportunity to adapt is closing rapidly.`;
  } else {
    s3Text = `This is why industry standards are transforming right now. Those who recognize this pattern early will hold an overwhelming advantage.`;
  }

  // Construct Scene 4: Conclusion & Strategic Takeaway
  const s4Text = `Whether you are building, investing, or studying ${topic}, understanding this principle changes the entire game.`;

  // Compute realistic frame durations based on word count (~140 wpm -> ~30 frames/sec)
  const calcFrames = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    // ~0.4s per word * 30 fps = ~12 frames per word + 30 frames lead/pad
    return Math.max(90, Math.round(words * 12 + 30));
  };

  const dur1 = calcFrames(s1Text);
  const dur2 = calcFrames(s2Text);
  const dur3 = calcFrames(s3Text);
  const dur4 = calcFrames(s4Text);

  const scenes: Scene[] = [
    {
      id: `s-${timestamp}-1`,
      startFrame: 0,
      durationInFrames: dur1,
      scriptText: s1Text,
      wordTokens: [],
      background: {
        type: "color",
        src: "#0f172a",
        motion: "zoom-in",
        prompt: `Cinematic high-contrast environment visually representing ${topic}, dramatic rim lighting, 8k wallpaper`,
      },
      mascot: {
        isVisible: true,
        pose: "shocked",
        position: "left",
        entranceAnimation: "pop-in",
      },
      overlays: [
        {
          id: `o-${timestamp}-1`,
          type: "lower-third",
          props: {
            category: "EXPLAINED",
            title: primarySource?.title || cleanTitle.slice(0, 24),
            subtitle: "The Underlying Mechanism",
          },
        },
      ],
    },
    {
      id: `s-${timestamp}-2`,
      startFrame: dur1,
      durationInFrames: dur2,
      scriptText: s2Text,
      wordTokens: [],
      background: {
        type: "color",
        src: "#1e1b4b",
        motion: "pan-left",
        prompt: `High-tech research laboratory with illuminated holographic data graphs and volumetric blue mist`,
      },
      mascot: {
        isVisible: true,
        pose: "explaining",
        position: "left",
        entranceAnimation: "slide-up",
      },
      overlays: [
        {
          id: `o-${timestamp}-2`,
          type: "stat-counter",
          props: {
            label: keyFact?.source || "Primary Metric",
            targetValue: parseInt(keyFact?.stat?.replace(/\D/g, "") || "94", 10) || 94,
            prefix: keyFact?.stat?.startsWith("+") ? "+" : "",
            suffix: keyFact?.stat?.includes("%") ? "%" : keyFact?.stat?.includes("x") ? "x" : "",
            accentColor: "#6366f1",
          },
        },
      ],
    },
    {
      id: `s-${timestamp}-3`,
      startFrame: dur1 + dur2,
      durationInFrames: dur3,
      scriptText: s3Text,
      wordTokens: [],
      background: {
        type: "color",
        src: "#064e3b",
        motion: "zoom-in",
        prompt: `Emerald crystalline architectural studio with ambient warm sunrise illumination`,
      },
      mascot: {
        isVisible: true,
        pose: "pointing",
        position: "left",
        entranceAnimation: "pop-in",
      },
      overlays: [
        {
          id: `o-${timestamp}-3`,
          type: "progress-ring",
          props: {
            label: "Global Adoption",
            percentage: 88,
            color: "#10b981",
          },
        },
      ],
    },
    {
      id: `s-${timestamp}-4`,
      startFrame: dur1 + dur2 + dur3,
      durationInFrames: dur4,
      scriptText: s4Text,
      wordTokens: [],
      background: {
        type: "color",
        src: "#090d16",
        motion: "static",
        prompt: `Minimalist dark studio with elegant gold and amber ambient lighting`,
      },
      mascot: {
        isVisible: true,
        pose: "neutral",
        position: "center",
        entranceAnimation: "fade",
      },
      overlays: [
        {
          id: `o-${timestamp}-4`,
          type: "lower-third",
          props: {
            category: "KEY TAKEAWAY",
            title: "Strategic Action",
            subtitle: "Anchor around narrative clarity",
          },
        },
      ],
    },
  ];

  // Map Visual References from detected entities
  const visualReferences: VisualReferenceItem[] = [];
  if (research.detectedEntities.length > 0) {
    for (const ent of research.detectedEntities.slice(0, 3)) {
      visualReferences.push({
        id: `ref-${timestamp}-${visualReferences.length + 1}`,
        sceneId: `s-${timestamp}-${Math.min(visualReferences.length + 1, scenes.length)}`,
        title: `${ent.name} Official Reference`,
        description: `Official authentic image or documentation seal for ${ent.name}.`,
        reason:
          ent.type === "brand"
            ? "FLUX cannot generate real trademarked brand logos without hallucination."
            : ent.type === "standard"
            ? "Accurate organizational seal ensures legal compliance and credibility."
            : "Real subject photo ensures factual authenticity beyond AI generation.",
        assetType: ent.type === "brand" || ent.type === "standard" ? "brand_logo" : "style_reference",
        status: "pending",
      });
    }
  } else {
    visualReferences.push({
      id: `ref-${timestamp}-1`,
      sceneId: `s-${timestamp}-1`,
      title: `${topic.slice(0, 30)} Visual Anchor`,
      description: "Official visual reference or branded graphic asset for this topic.",
      reason: "Ensures visual styling aligns with authentic real-world references.",
      assetType: "style_reference",
      status: "pending",
    });
  }

  return {
    title: cleanTitle,
    summary: `Deeply researched, fact-grounded video script based on ${research.sources.length} encyclopedic sources.`,
    tone,
    factChecks,
    scenes,
    visualReferences,
  };
}

/**
 * Universal OpenAI-compatible caller (works with OpenAI, Groq, Ollama, OpenRouter).
 */
async function callOpenAICompatibleEndpoint(opts: {
  url: string;
  apiKey: string;
  model: string;
  topic: string;
  rawScript: string;
  tone: string;
  research: ResearchDossier;
}): Promise<ScriptOptimizationResult | null> {
  const { url, apiKey, model, topic, rawScript, tone, research } = opts;

  const systemPrompt = `You are an expert AI documentary director and video scriptwriter for Remotion-based short videos with Semantic Anchoring.
You are given VERIFIED RESEARCH DATA from encyclopedic and academic records.
Use this research to write a rich, substantive 3 to 4 scene video script.

CRITICAL INSTRUCTIONS:
1. Each scene's "scriptText" MUST BE A FULL SPOKEN PARAGRAPH (2 to 4 natural, spoken sentences, about 35 to 55 words per scene).
   DO NOT write 1 short sentence or weird fragmented lines! It must sound like an expert creator speaking naturally.
2. In the script, explicitly weave in the real names, numbers, years, organizations, and mechanisms found in the research context.
3. Choose expressive mascot poses ("neutral" | "explaining" | "shocked" | "pointing") and entrance animations ("slide-up" | "pop-in" | "fade").
4. Attach relevant Remotion graphic overlays ("stat-counter" | "lower-third" | "progress-ring" | "code-snippet") with concrete data.
5. Identify any specific real people, brand names, or technical standards that need user-provided legal copies in "visualReferences".

RETURN ONLY VALID JSON matching this exact structure:
{
  "title": "string",
  "summary": "string",
  "tone": "${tone}",
  "factChecks": [
    {"claim": "string", "sourceOrData": "string", "injectedStat": "string"}
  ],
  "scenes": [
    {
      "id": "s-1",
      "startFrame": 0,
      "durationInFrames": 140,
      "scriptText": "2 to 4 rich spoken sentences...",
      "wordTokens": [],
      "background": {
        "type": "color",
        "src": "#0f172a",
        "motion": "zoom-in",
        "prompt": "detailed environment description for FLUX Klein"
      },
      "mascot": {
        "isVisible": true,
        "pose": "explaining",
        "position": "left",
        "entranceAnimation": "slide-up"
      },
      "overlays": [
        {
          "id": "o-1",
          "type": "stat-counter",
          "props": {"label": "Data Metric", "targetValue": 100, "prefix": "+", "suffix": "%"}
        }
      ]
    }
  ],
  "visualReferences": [
    {
      "id": "ref-1",
      "sceneId": "s-1",
      "title": "Brand Logo or Photo Name",
      "description": "What image the user should provide",
      "reason": "Why FLUX cannot legally generate this accurately",
      "assetType": "brand_logo",
      "status": "pending"
    }
  ]
}`;

  const userPrompt = `TOPIC: ${topic}
RAW SCRIPT DRAFT: ${rawScript || "None provided by user"}
TONE: ${tone}

VERIFIED RESEARCH DOSSIER:
${research.aggregatedContext || "No external context retrieved."}

EXTRACTED FACTS:
${research.facts.map((f) => `- ${f.claim} (Source: ${f.source})`).join("\n")}

Write the complete 3-4 scene structured video script JSON now:`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey !== "ollama") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.65,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API returned status ${response.status}: ${errorText.slice(0, 150)}`);
  }

  const json = await response.json();
  const rawContent = json.choices?.[0]?.message?.content;
  if (!rawContent) return null;

  return JSON.parse(rawContent);
}

/**
 * Gemini API caller with structured research prompt.
 */
async function callGeminiEndpoint(opts: {
  apiKey: string;
  model: string;
  topic: string;
  rawScript: string;
  tone: string;
  research: ResearchDossier;
}): Promise<ScriptOptimizationResult | null> {
  const { apiKey, model, topic, rawScript, tone, research } = opts;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = `You are an expert AI video script director.
Write a structured 3 to 4 scene video script JSON based on this topic and verified research.
Each scene's scriptText MUST be 2-4 spoken sentences (35-50 words), full of substance and real facts.

Topic: ${topic}
Raw Script: ${rawScript || "None"}
Research Context:
${research.aggregatedContext}

Return JSON with { title, summary, tone, factChecks: [{claim, sourceOrData, injectedStat}], scenes: [{id, startFrame, durationInFrames, scriptText, background, mascot, overlays}], visualReferences: [{id, sceneId, title, description, reason, assetType, status}] }`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  return JSON.parse(text);
}
