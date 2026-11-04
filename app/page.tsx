"use client";

import React, { useState } from "react";
import { MasterVideoState, PipelineProgressEvent, Scene } from "@/types/schema";
import { DEFAULT_DEMO_STATE } from "@/remotion/Root";
import { Navbar } from "@/components/Navbar";
import { LeftScriptPanel } from "@/components/panels/LeftScriptPanel";
import { CenterPlayerPanel } from "@/components/panels/CenterPlayerPanel";
import { RightInspectorPanel } from "@/components/panels/RightInspectorPanel";
import { SyncProgressModal } from "@/components/modals/SyncProgressModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { ConversationalOnboarding } from "@/components/wizard/ConversationalOnboarding";

export default function StudioPage() {
  // Conversational Wizard is shown first, before user enters studio
  const [viewMode, setViewMode] = useState<"wizard" | "studio">("wizard");

  const [state, setState] = useState<MasterVideoState>(DEFAULT_DEMO_STATE);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    DEFAULT_DEMO_STATE.scenes[0]?.id || "scene-1"
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncEvent, setSyncEvent] = useState<PipelineProgressEvent | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Trigger Python Child Process Pipeline via IPC
  const handleTriggerSync = async (scenesToSync?: Scene[]) => {
    const scenes = scenesToSync || state.scenes;
    setIsSyncing(true);
    setIsSyncModalOpen(true);
    setSyncEvent({
      type: "progress",
      stage: "synthesizing_speech",
      percent: 5,
      message: "Initiating Python child process IPC...",
    });

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          voiceId: state.audio.voiceId || "af_heart",
          voiceSpeed: state.audio.voiceSpeed || 1.12,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Pipeline response error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: PipelineProgressEvent = JSON.parse(line.trim());
            setSyncEvent(event);

            // On completion, update the Universal Video State
            if (event.type === "complete" && event.scenes) {
              setState((prev) => ({
                ...prev,
                metadata: {
                  ...prev.metadata,
                  totalDurationInFrames:
                    event.totalDurationInFrames ?? prev.metadata.totalDurationInFrames,
                },
                audio: {
                  ...prev.audio,
                  voiceTrackUrl: event.audioUrl ?? prev.audio.voiceTrackUrl,
                },
                scenes: event.scenes!,
              }));
            }
          } catch (e) {
            console.warn("Failed to parse event stream chunk:", line);
          }
        }
      }
    } catch (err: any) {
      setSyncEvent({
        type: "error",
        error: err.message || "Failed to communicate with Python pipeline",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Called when the user completes the 4-step conversational wizard
  const handleOnboardingComplete = (optimizedState: MasterVideoState) => {
    setState(optimizedState);
    if (optimizedState.scenes.length > 0) {
      setSelectedSceneId(optimizedState.scenes[0].id);
    }
    setViewMode("studio");
    // Trigger speech synthesis & timing lock for the new scenes
    handleTriggerSync(optimizedState.scenes);
  };

  // 1. If in conversational onboarding mode, show the 4-step wizard
  if (viewMode === "wizard") {
    return (
      <ConversationalOnboarding
        onComplete={handleOnboardingComplete}
        onSkipToStudio={() => setViewMode("studio")}
      />
    );
  }

  // 2. Otherwise render the 3-panel studio
  return (
    <div className="h-screen w-screen flex flex-col bg-studio-950 overflow-hidden font-sans">
      {/* Top Studio Navigation */}
      <Navbar
        state={state}
        onUpdateState={setState}
        onTriggerSync={() => handleTriggerSync()}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenWizard={() => setViewMode("wizard")}
        isSyncing={isSyncing}
        isExporting={false}
      />

      {/* The 3-Panel Studio Layout */}
      <div className="flex-1 flex w-full overflow-hidden">
        {/* Left Panel (30%): Script & Scene Feed */}
        <LeftScriptPanel
          state={state}
          selectedSceneId={selectedSceneId}
          onSelectScene={setSelectedSceneId}
          onUpdateState={setState}
          onTriggerSync={() => handleTriggerSync()}
          isSyncing={isSyncing}
        />

        {/* Center Panel (45%): Remotion Player */}
        <CenterPlayerPanel
          state={state}
          selectedSceneId={selectedSceneId}
          onSelectScene={setSelectedSceneId}
        />

        {/* Right Panel (25%): Inspector & Modifiers */}
        <RightInspectorPanel
          state={state}
          selectedSceneId={selectedSceneId}
          onUpdateState={setState}
        />
      </div>

      {/* IPC Pipeline Progress Modal */}
      <SyncProgressModal
        isOpen={isSyncModalOpen}
        event={syncEvent}
        onClose={() => setIsSyncModalOpen(false)}
      />

      {/* Export MP4 Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        state={state}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
