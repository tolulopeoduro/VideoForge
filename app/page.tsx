"use client";

import React, { useState } from "react";
import { MasterVideoState, PipelineProgressEvent } from "@/types/schema";
import { DEFAULT_DEMO_STATE } from "@/remotion/Root";
import { Navbar } from "@/components/Navbar";
import { LeftScriptPanel } from "@/components/panels/LeftScriptPanel";
import { CenterPlayerPanel } from "@/components/panels/CenterPlayerPanel";
import { RightInspectorPanel } from "@/components/panels/RightInspectorPanel";
import { SyncProgressModal } from "@/components/modals/SyncProgressModal";
import { ExportModal } from "@/components/modals/ExportModal";

export default function StudioPage() {
  const [state, setState] = useState<MasterVideoState>(DEFAULT_DEMO_STATE);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    DEFAULT_DEMO_STATE.scenes[0]?.id || "scene-1"
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncEvent, setSyncEvent] = useState<PipelineProgressEvent | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Trigger Python Child Process Pipeline via IPC
  const handleTriggerSync = async () => {
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
          scenes: state.scenes,
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

  return (
    <div className="h-screen w-screen flex flex-col bg-studio-950 overflow-hidden font-sans">
      {/* Top Studio Navigation */}
      <Navbar
        state={state}
        onUpdateState={setState}
        onTriggerSync={handleTriggerSync}
        onOpenExport={() => setIsExportModalOpen(true)}
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
          onTriggerSync={handleTriggerSync}
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
