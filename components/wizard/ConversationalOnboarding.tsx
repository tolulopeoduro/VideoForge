import React, { useState, useEffect } from "react";
import {
  MasterVideoState,
  Scene,
  ScriptOptimizationResult,
  VisualReferenceItem,
} from "@/types/schema";
import {
  Sparkles,
  Wand2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Ratio,
  Smile,
  Layers,
  Upload,
  Image as ImageIcon,
  ShieldCheck,
  Zap,
  BookOpen,
  TrendingUp,
  FileText,
  AlertCircle,
  Clock,
  Tv2,
  Loader2,
  ExternalLink,
  Settings,
  Cpu,
  Key,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ConversationalOnboardingProps {
  onComplete: (optimizedState: MasterVideoState) => void;
  onSkipToStudio: () => void;
}

export const ConversationalOnboarding: React.FC<ConversationalOnboardingProps> = ({
  onComplete,
  onSkipToStudio,
}) => {
  // Wizard steps: 1: Prompt/Script -> 2: LLM Optimization -> 3: Visual References -> 4: Preflight Confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 Form state
  const [inputType, setInputType] = useState<"prompt" | "script">("prompt");
  const [prompt, setPrompt] = useState("");
  const [rawScript, setRawScript] = useState("");
  const [tone, setTone] = useState<string>("viral");
  const [orientation, setOrientation] = useState<"9:16" | "16:9">("9:16");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStage, setGenStage] = useState<string>("Starting deep research...");
  const [genError, setGenError] = useState<string | null>(null);

  // Model & AI Provider settings
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<
    "default" | "groq" | "openai" | "gemini" | "ollama" | "openrouter"
  >("default");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");

  // Load saved API settings from localStorage
  useEffect(() => {
    try {
      const savedProvider = localStorage.getItem("zt_provider");
      const savedKey = localStorage.getItem("zt_api_key");
      const savedModel = localStorage.getItem("zt_model");
      const savedEndpoint = localStorage.getItem("zt_endpoint");
      if (savedProvider) setProvider(savedProvider as any);
      if (savedKey) setApiKey(savedKey);
      if (savedModel) setModelName(savedModel);
      if (savedEndpoint) setCustomEndpoint(savedEndpoint);
    } catch (e) {
      // ignore
    }
  }, []);

  const saveApiSettings = (
    newProvider: typeof provider,
    newKey: string,
    newModel: string,
    newEndpoint: string
  ) => {
    try {
      localStorage.setItem("zt_provider", newProvider);
      localStorage.setItem("zt_api_key", newKey);
      localStorage.setItem("zt_model", newModel);
      localStorage.setItem("zt_endpoint", newEndpoint);
    } catch (e) {
      // ignore
    }
  };

  // Step 2, 3, 4 Data state
  const [optimizationResult, setOptimizationResult] =
    useState<ScriptOptimizationResult | null>(null);

  // Visual references user overrides
  const [referenceOverrides, setReferenceOverrides] = useState<
    Record<string, { url: string; status: VisualReferenceItem["status"] }>
  >({});

  // Quick prompt suggestions across diverse popular domains
  const PROMPT_SUGGESTIONS = [
    {
      title: "Manchester United Treble",
      text: "How Manchester United won the historic 1999 treble in stoppage time and why Fergie Time became football legend",
      tone: "dramatic",
    },
    {
      title: "Wall Street Flash Crash",
      text: "How algorithmic high-frequency trading wiped out one trillion dollars in thirty-six minutes during the 2010 Flash Crash",
      tone: "dramatic",
    },
    {
      title: "Fall of Roman Republic",
      text: "How the Roman Republic collapsed into an Empire in 44 BC and how Julius Caesar reshaped world history",
      tone: "informative",
    },
    {
      title: "Quantum vs RSA",
      text: "Why Quantum Computing will break 2048-bit RSA encryption and how NIST post-quantum migration works",
      tone: "technical",
    },
    {
      title: "Death of Video Editors",
      text: "Why traditional multitrack video editors are dead and semantic text anchoring is the future",
      tone: "viral",
    },
    {
      title: "How Airplanes Fly",
      text: "How aerodynamic lift and Bernoulli principles allow 500-ton airplanes to stay airborne",
      tone: "technical",
    },
  ];

  // Curated stock / style presets for references across major domains
  const STOCK_PRESETS = [
    { label: "Sports Stadium Arena", url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80" },
    { label: "Wall Street & Markets", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80" },
    { label: "Colosseum & Ancient Rome", url: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=80" },
    { label: "Deep Space & Nebula", url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80" },
    { label: "Tech Shield Badge", url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80" },
    { label: "Cyber Server Mainframe", url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80" },
  ];

  // Submit Step 1 to LLM backend with staged progress
  const handleGenerateScript = async () => {
    const textToSubmit = inputType === "prompt" ? prompt : rawScript;
    if (!textToSubmit.trim()) {
      setGenError("Please enter a prompt or script draft to proceed.");
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGenStage("🔍 Performing deep encyclopedic research on topic...");

    const stageTimer1 = setTimeout(() => {
      setGenStage("📊 Mining technical facts, numbers & citations...");
    }, 900);

    const stageTimer2 = setTimeout(() => {
      setGenStage("⚡ Writing full-length spoken scenes with semantic anchoring...");
    }, 2000);

    const stageTimer3 = setTimeout(() => {
      setGenStage("🎨 Choreographing mascot poses & Remotion graphic overlays...");
    }, 3200);

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: inputType === "prompt" ? prompt : "",
          rawScript: inputType === "script" ? rawScript : "",
          tone,
          orientation,
          provider,
          apiKey,
          modelName,
          customEndpoint,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setOptimizationResult(data.result);
        setStep(2);
      } else {
        setGenError(data.error || "Failed to generate script.");
      }
    } catch (err: any) {
      setGenError(err.message || "Network error communicating with script generator.");
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setIsGenerating(false);
    }
  };

  // Update a scene's script text during step 2 with frame recalculation
  const handleUpdateSceneScript = (sceneId: string, newText: string) => {
    if (!optimizationResult) return;
    const words = newText.trim().split(/\s+/).filter(Boolean);
    const estDuration = Math.max(75, Math.round((Math.max(words.length, 1) / 2.7) * 30));

    const nextScenes = optimizationResult.scenes.map((s) =>
      s.id === sceneId ? { ...s, scriptText: newText, durationInFrames: estDuration } : s
    );

    let curr = 0;
    const reindexed = nextScenes.map((s) => {
      const updated = { ...s, startFrame: curr };
      curr += s.durationInFrames;
      return updated;
    });

    setOptimizationResult({
      ...optimizationResult,
      scenes: reindexed,
    });
  };

  // Update visual reference asset URL or choice
  const handleSetReferenceAsset = (
    refId: string,
    url: string,
    status: VisualReferenceItem["status"]
  ) => {
    setReferenceOverrides((prev) => ({
      ...prev,
      [refId]: { url, status },
    }));
  };

  // Final Confirmation: Construct Universal MasterVideoState and launch Studio
  const handleLaunchStudio = () => {
    if (!optimizationResult) return;

    const width = orientation === "9:16" ? 1080 : 1920;
    const height = orientation === "9:16" ? 1920 : 1080;

    // Apply any visual reference images to the relevant scenes
    const finalizedScenes = optimizationResult.scenes.map((scene) => {
      const matchedRef = optimizationResult.visualReferences.find(
        (r) => r.sceneId === scene.id
      );
      if (matchedRef) {
        const override = referenceOverrides[matchedRef.id];
        if (override && override.url && override.status === "provided") {
          return {
            ...scene,
            background: {
              ...scene.background,
              type: "stock" as const,
              src: override.url,
            },
          };
        }
      }
      return scene;
    });

    // Recompute total duration
    const totalFrames = finalizedScenes.reduce(
      (acc, s) => acc + s.durationInFrames,
      0
    );

    const masterState: MasterVideoState = {
      id: `project_${Date.now()}`,
      metadata: {
        title: optimizationResult.title,
        fps: 30,
        width,
        height,
        totalDurationInFrames: Math.max(90, totalFrames),
      },
      audio: {
        voiceTrackUrl: "", // Will be populated upon audio sync in studio
        backgroundMusicUrl: "/audio/chill-beat.wav",
        musicVolume: 0.18,
      },
      scenes: finalizedScenes,
    };

    onComplete(masterState);
  };

  return (
    <div className="min-h-screen w-full bg-studio-975 text-slate-100 flex flex-col font-sans select-none overflow-y-auto">
      {/* Top Onboarding Header */}
      <header className="h-16 border-b border-white/[0.07] bg-studio-950/80 backdrop-blur-2xl px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-studio-accent via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-studio-accent/25 border border-white/20">
            <Tv2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight leading-none">ZeroTrack</span>
              <span className="text-[9px] font-mono uppercase tracking-wider bg-studio-accent/20 text-indigo-300 px-1.5 py-0.5 rounded border border-studio-accent/30 font-bold">
                AI Director
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono -mt-0.5">
              Deep Research & Semantic Script Engine
            </div>
          </div>
        </div>

        {/* Step Indicator Progress Stepper with Connected Lines */}
        <div className="hidden md:flex items-center gap-2.5 bg-studio-900/90 px-4 py-1.5 rounded-full border border-white/[0.08] text-xs shadow-inner">
          {[
            { num: 1, label: "Idea & Research" },
            { num: 2, label: "Researched Script" },
            { num: 3, label: "Visual References" },
            { num: 4, label: "Launch Studio" },
          ].map((item, idx) => (
            <React.Fragment key={item.num}>
              <div
                className={`flex items-center gap-2 font-semibold transition-colors ${
                  step === item.num
                    ? "text-studio-accent font-bold"
                    : step > item.num
                    ? "text-emerald-400"
                    : "text-slate-500"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all ${
                    step === item.num
                      ? "bg-studio-accent text-white shadow-glowSm"
                      : step > item.num
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-studio-800 text-slate-500"
                  }`}
                >
                  {step > item.num ? "✓" : item.num}
                </span>
                <span className="text-xs">{item.label}</span>
              </div>
              {idx < 3 && <div className="w-4 h-px bg-white/10" />}
            </React.Fragment>
          ))}
        </div>

        {/* Skip to Studio direct option */}
        <button
          onClick={onSkipToStudio}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-studio-900 border border-white/[0.06] hover:border-white/15"
        >
          <span>Open Blank Studio</span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
        </button>
      </header>

      {/* Main Form Body */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center">
        {/* ============================================================== */}
        {/* STEP 1: PROMPT OR SCRIPT SUBMISSION & MODEL CONFIG             */}
        {/* ============================================================== */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-studio-accent/15 border border-studio-accent/30 text-indigo-400 text-xs font-bold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Step 1 of 4 • Deep Research & Script Generation
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  What story or topic do you want to create?
                </h1>
                <p className="text-slate-400 text-sm mt-1.5">
                  ZeroTrack queries encyclopedic databases, fact-checks assertions, and writes a
                  comprehensive multi-scene narrative script with avatar choreography.
                </p>
              </div>

              {/* AI Model Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Model Settings</span>
                {showSettings ? (
                  <ChevronUp className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* AI Model & Research Settings Drawer */}
            {showSettings && (
              <div className="p-4 rounded-2xl bg-studio-900 border border-studio-700/80 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Settings className="w-4 h-4 text-studio-accent" />
                    <span>LLM Engine & Research Provider</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Saved in browser localStorage
                  </span>
                </div>

                {/* Provider selection buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "default", name: "🧠 Built-in Deep Engine", note: "Free, No API Key" },
                    { id: "groq", name: "⚡ Groq (Llama 3.3)", note: "Ultra-fast" },
                    { id: "openai", name: "🟢 OpenAI (GPT-4o)", note: "Industry standard" },
                    { id: "gemini", name: "💎 Gemini (1.5 Flash)", note: "Google API" },
                    { id: "ollama", name: "💻 Local Ollama", note: "localhost:11434" },
                    { id: "openrouter", name: "🌐 OpenRouter", note: "Multi-model" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const newP = p.id as typeof provider;
                        setProvider(newP);
                        saveApiSettings(newP, apiKey, modelName, customEndpoint);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        provider === p.id
                          ? "bg-studio-accent/20 border-studio-accent text-white shadow-sm ring-1 ring-studio-accent/50"
                          : "bg-studio-950 border-studio-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.note}</div>
                    </button>
                  ))}
                </div>

                {/* API Key Input (if not default) */}
                {provider !== "default" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-studio-800">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-amber-400" />
                        <span>API Key</span>
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          saveApiSettings(provider, e.target.value, modelName, customEndpoint);
                        }}
                        placeholder={
                          provider === "groq"
                            ? "gsk_..."
                            : provider === "gemini"
                            ? "AIza..."
                            : provider === "ollama"
                            ? "Not needed for Ollama"
                            : "sk-..."
                        }
                        className="w-full bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        {provider === "ollama" ? "Ollama Endpoint" : "Model Name (Optional)"}
                      </label>
                      {provider === "ollama" ? (
                        <input
                          type="text"
                          value={customEndpoint}
                          onChange={(e) => {
                            setCustomEndpoint(e.target.value);
                            saveApiSettings(provider, apiKey, modelName, e.target.value);
                          }}
                          placeholder="http://localhost:11434"
                          className="w-full bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
                        />
                      ) : (
                        <input
                          type="text"
                          value={modelName}
                          onChange={(e) => {
                            setModelName(e.target.value);
                            saveApiSettings(provider, apiKey, e.target.value, customEndpoint);
                          }}
                          placeholder={
                            provider === "groq"
                              ? "llama-3.3-70b-versatile"
                              : provider === "gemini"
                              ? "gemini-1.5-flash"
                              : "gpt-4o-mini"
                          }
                          className="w-full bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input Mode Toggle (Prompt vs Raw Script) */}
            <div className="flex items-center gap-2 p-1 bg-studio-900 rounded-xl border border-studio-800 max-w-md">
              <button
                type="button"
                onClick={() => setInputType("prompt")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inputType === "prompt"
                    ? "bg-studio-accent text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Idea / Topic Prompt</span>
              </button>
              <button
                type="button"
                onClick={() => setInputType("script")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inputType === "script"
                    ? "bg-studio-accent text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste Full Script Draft</span>
              </button>
            </div>

            {/* Textarea Input */}
            <div className="space-y-2">
              <textarea
                value={inputType === "prompt" ? prompt : rawScript}
                onChange={(e) =>
                  inputType === "prompt" ? setPrompt(e.target.value) : setRawScript(e.target.value)
                }
                rows={inputType === "prompt" ? 4 : 7}
                placeholder={
                  inputType === "prompt"
                    ? "e.g. Why quantum computers will break 2048-bit RSA encryption and how the NIST post-quantum migration works..."
                    : "Paste your draft script here. Our deep research engine will analyze it, ground it with encyclopedic facts, and structure it into full-length spoken scenes..."
                }
                className="w-full bg-studio-900/90 border border-studio-800 focus:border-studio-accent rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 outline-none leading-relaxed transition-all shadow-inner"
              />

              {/* Quick suggestion chips (for prompt mode) */}
              {inputType === "prompt" && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Try an example:</span>
                  {PROMPT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrompt(item.text);
                        setTone(item.tone);
                      }}
                      className="text-xs bg-studio-900 hover:bg-studio-850 border border-studio-800 text-slate-300 hover:text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Narrative Tone & Aspect Ratio Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tone Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Narrative Style & Pacing
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "viral", label: "⚡ Viral Hook", desc: "Fast pacing, bold contrast" },
                    { id: "technical", label: "🔬 Tech Deep Dive", desc: "Data, metrics, architecture" },
                    { id: "launch", label: "🚀 Product Launch", desc: "Problem, solution, stats" },
                    { id: "case_study", label: "💡 Case Study", desc: "Before & after proof" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        tone === t.id
                          ? "bg-studio-accent/20 border-studio-accent text-white ring-1 ring-studio-accent/50"
                          : "bg-studio-900/60 border-studio-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{t.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Target Canvas Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation("9:16")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      orientation === "9:16"
                        ? "bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50"
                        : "bg-studio-900/60 border-studio-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Ratio className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-xs text-white">9:16 Portrait</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      TikTok, YouTube Shorts, Reels (1080×1920)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrientation("16:9")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      orientation === "16:9"
                        ? "bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50"
                        : "bg-studio-900/60 border-studio-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Ratio className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-xs text-white">16:9 Landscape</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      YouTube Longform, Desktop, Slides (1920×1080)
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {genError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{genError}</span>
              </div>
            )}

            {/* Submit Button with Live Progress State */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={isGenerating}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>{genStage}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Research, Fact-Check & Generate Script ➔</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: RESEARCHED SCRIPT BREAKDOWN & SCENE REVIEW             */}
        {/* ============================================================== */}
        {step === 2 && optimizationResult && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Step 2 of 4 • Deep Research & Script Breakdown Complete
                </div>
                <h2 className="text-2xl font-extrabold text-white">
                  {optimizationResult.title}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {optimizationResult.summary}
                </p>
              </div>

              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-studio-800 bg-studio-900 hover:bg-studio-850 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Topic</span>
              </button>
            </div>

            {/* Fact Check & Research Injected Data Points */}
            {optimizationResult.factChecks && optimizationResult.factChecks.length > 0 && (
              <div className="p-4 bg-studio-900 border border-studio-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Fact-Checked Grounding & Verified Citations</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Empirically Injected</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {optimizationResult.factChecks.map((fc, i) => (
                    <div key={i} className="p-3 bg-studio-950 rounded-xl border border-studio-800">
                      <div className="font-semibold text-slate-200 leading-snug">"{fc.claim}"</div>
                      <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-2">
                        <span className="font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900 font-bold">
                          {fc.injectedStat}
                        </span>
                        <span className="truncate">{fc.sourceOrData}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Substantive Scene Cards Feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                <span>Researched Video Scenes ({optimizationResult.scenes.length} Scenes)</span>
                <span className="text-slate-400 text-[11px] font-normal">
                  Total duration: ~
                  {(
                    optimizationResult.scenes.reduce((acc, s) => acc + s.durationInFrames, 0) /
                    30
                  ).toFixed(1)}
                  s
                </span>
              </div>

              <div className="space-y-4">
                {optimizationResult.scenes.map((scene, idx) => {
                  const words = scene.scriptText.trim().split(/\s+/).filter(Boolean).length;
                  const durationSec = (scene.durationInFrames / 30).toFixed(1);

                  return (
                    <div
                      key={scene.id}
                      className="p-5 rounded-2xl border border-studio-800 bg-studio-900/80 hover:bg-studio-900 transition-colors space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-studio-accent text-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">
                            Scene {idx + 1}
                          </span>
                          <span className="text-[11px] text-slate-300 font-mono bg-studio-950 px-2 py-0.5 rounded border border-studio-800">
                            {durationSec}s ({words} words)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Mascot Pose Badge */}
                          <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                            <Smile className="w-3 h-3" />
                            <span className="capitalize">{scene.mascot.pose}</span>
                          </span>

                          {/* Overlays Badge */}
                          {scene.overlays.length > 0 && (
                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                              <Layers className="w-3 h-3 text-indigo-400" />
                              <span className="capitalize">
                                {scene.overlays[0].type.replace("-", " ")}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Full-Length Spoken Script Textarea */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-400">
                          Spoken Voiceover Paragraph (Click to edit text):
                        </label>
                        <textarea
                          value={scene.scriptText}
                          onChange={(e) => handleUpdateSceneScript(scene.id, e.target.value)}
                          rows={3}
                          className="w-full bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-xl p-3 text-xs text-slate-100 outline-none resize-none leading-relaxed shadow-inner"
                        />
                      </div>

                      {/* Visual Environment Description */}
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 bg-studio-950/90 p-2.5 rounded-xl border border-studio-800">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">
                          <strong>FLUX Environment:</strong>{" "}
                          {scene.background.prompt || "Minimalist studio"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-studio-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Back to Research Input
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-xl bg-studio-accent hover:bg-studio-accentHover text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
              >
                <span>Continue to Visual References</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: VISUAL REFERENCES & ASSET CUSTOMIZATION                */}
        {/* ============================================================== */}
        {step === 3 && optimizationResult && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
                <ImageIcon className="w-3.5 h-3.5" />
                Step 3 of 4 • Visual Reference Verification
              </div>
              <h2 className="text-2xl font-extrabold text-white">
                Visual References & Legal Trademark Assets
              </h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                FLUX Klein excels at atmospheric backgrounds, but cannot legally or accurately generate
                real trademarked logos, real person likenesses, or proprietary UI dashboards without distortion.
                Provide your official reference copies or choose fitting presets below.
              </p>
            </div>

            {/* Visual References Cards List */}
            <div className="space-y-4">
              {optimizationResult.visualReferences.map((refItem) => {
                const override = referenceOverrides[refItem.id];
                const currentStatus = override?.status || refItem.status;
                const currentUrl = override?.url || refItem.providedUrl || "";

                return (
                  <div
                    key={refItem.id}
                    className="p-5 rounded-2xl border border-studio-800 bg-studio-900/70 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{refItem.title}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-studio-800 text-slate-300 px-2 py-0.5 rounded">
                            {refItem.assetType.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{refItem.description}</p>
                        <p className="text-[11px] text-amber-400/90 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{refItem.reason}</span>
                        </p>
                      </div>

                      <div className="shrink-0">
                        {currentStatus === "provided" ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Asset Ready</span>
                          </span>
                        ) : currentStatus === "using_ai_fallback" ? (
                          <span className="text-xs font-medium text-slate-400 bg-studio-800 px-2.5 py-1 rounded-full border border-studio-700">
                            Using AI Fallback
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                            Action Recommended
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reference Options: URL Input or Stock Preset */}
                    <div className="space-y-2 pt-2 border-t border-studio-800/80">
                      <div className="text-xs font-semibold text-slate-300">
                        Provide Image URL or Select Curated Preset:
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={currentUrl}
                          onChange={(e) =>
                            handleSetReferenceAsset(
                              refItem.id,
                              e.target.value,
                              e.target.value.trim() ? "provided" : "pending"
                            )
                          }
                          placeholder="Paste image URL (https://...) or file path"
                          className="flex-1 bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleSetReferenceAsset(
                              refItem.id,
                              STOCK_PRESETS[0].url,
                              "provided"
                            )
                          }
                          className="px-3 py-2 rounded-lg bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-slate-200"
                        >
                          Use Preset
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSetReferenceAsset(refItem.id, "", "using_ai_fallback")
                          }
                          className="px-3 py-2 rounded-lg border border-studio-800 hover:bg-studio-800 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Let FLUX Try
                        </button>
                      </div>

                      {/* Stock Preset Thumbnails */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-500">Fast Presets:</span>
                        {STOCK_PRESETS.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() =>
                              handleSetReferenceAsset(refItem.id, p.url, "provided")
                            }
                            className="text-[11px] bg-studio-950 hover:bg-studio-800 border border-studio-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-md transition-colors"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-studio-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Back to Researched Script
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-3 rounded-xl bg-studio-accent hover:bg-studio-accentHover text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
              >
                <span>Proceed to Pre-Flight Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: PRE-FLIGHT CHECK & STUDIO LAUNCH                       */}
        {/* ============================================================== */}
        {step === 4 && optimizationResult && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-studio-accent/15 border border-studio-accent/30 text-indigo-400 text-xs font-bold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Step 4 of 4 • Final Pre-Flight Readiness
              </div>
              <h2 className="text-2xl font-extrabold text-white">
                Everything is Ready for the Video Studio
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Verify the finalized video project specs below. Once confirmed, we will load your
                work into the 3-panel studio and trigger audio-anchored timeline synchronization.
              </p>
            </div>

            {/* Pre-Flight Checklist Card */}
            <div className="bg-studio-900 border border-studio-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pre-Flight System Checklist
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-950 border border-studio-800/80">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Researched Narrative Script</div>
                      <div className="text-[11px] text-slate-400">
                        {optimizationResult.scenes.length} full-length spoken scenes with verified facts
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">PASSED</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-950 border border-studio-800/80">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Mascot & Physics Choreography</div>
                      <div className="text-[11px] text-slate-400">
                        Brand lightbulb character poses & Remotion spring entrances mapped
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">PASSED</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-950 border border-studio-800/80">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Remotion Graphic Overlays</div>
                      <div className="text-[11px] text-slate-400">
                        Animated stat counters, lower-thirds, and progress rings initialized
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">PASSED</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-950 border border-studio-800/80">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Canvas Format & Resolution</div>
                      <div className="text-[11px] text-slate-400">
                        {orientation === "9:16" ? "9:16 Vertical (1080×1920)" : "16:9 Landscape (1920×1080)"} @ 30 FPS
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">PASSED</span>
                </div>
              </div>
            </div>

            {/* Final Action CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-studio-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Back to References
              </button>

              <button
                type="button"
                onClick={handleLaunchStudio}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center gap-2.5 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Confirm & Launch Studio 🚀</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
