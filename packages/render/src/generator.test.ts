import { describe, expect, it } from "vitest";
import {
  applyChecked,
  applyPatches,
  canOverwrite,
  createEmptyProject,
  validateProject,
} from "@vf/schema";
import {
  assignSequentialShotsForScenes,
  buildGenerateFromScriptOp,
  buildRegenerateSceneOp,
  buildSearchQueriesForIntent,
  catalogAssetsRecord,
  extractSceneIntent,
} from "../../../apps/web/src/generator";

describe("script-to-video generator ops", () => {
  it("generates a multi-scene first cut via a single batch op and preserves user-modified clips on regeneration", () => {
    const empty = {
      ...createEmptyProject({ id: "gen-test", title: "Gen Test" }),
      assets: catalogAssetsRecord(),
    };

    const script =
      "Our team starts every morning with a quick planning session. Revenue grew steadily throughout the year.";
    const op = buildGenerateFromScriptOp(empty, script);
    const firstCut = applyChecked(empty, op, { actor: "ai" });

    expect(validateProject(firstCut.next)).toEqual([]);
    expect(firstCut.next.scenes.length).toBe(2);
    expect(firstCut.next.clips.ai_v_scene_1).toBeDefined();
    expect(firstCut.next.clips.ai_v_scene_2).toBeDefined();
    expect(firstCut.next.clips.ai_v_scene_1!.source!.assetId).toBe("stock_office");
    expect(firstCut.next.clips.ai_v_scene_2!.source!.assetId).toBe("stock_chart");

    // Undo restores the exact starting state
    expect(applyPatches(firstCut.next, firstCut.inverse)).toEqual(empty);

    // User manually swaps the shot on scene 1 -> marks userModified = true
    const userEdited = applyChecked(
      firstCut.next,
      {
        type: "replaceMedia",
        clipId: "ai_v_scene_1",
        assetId: "stock_city",
        in: 0,
      },
      { actor: "user" },
    ).next;

    expect(userEdited.clips.ai_v_scene_1!.provenance.userModified).toBe(true);
    expect(canOverwrite(userEdited, userEdited.clips.ai_v_scene_1!)).toBe(false);

    // Regenerating scene 1 returns null because its media clip is protected (canOverwrite = false)
    expect(buildRegenerateSceneOp(userEdited, "scene_1")).toBeNull();

    // Regenerating scene 2 succeeds because its media clip is untouched AI work
    const regenScene2Op = buildRegenerateSceneOp(userEdited, "scene_2");
    expect(regenScene2Op).not.toBeNull();
    const afterRegen2 = applyChecked(userEdited, regenScene2Op!, { actor: "ai" }).next;
    expect(validateProject(afterRegen2)).toEqual([]);
    expect(afterRegen2.clips.ai_v_scene_1!.source!.assetId).toBe("stock_city");
    expect(afterRegen2.clips.ai_v_scene_2!.source!.assetId).not.toBe("stock_chart");
    expect(afterRegen2.clips.ai_v_scene_2!.provenance.userModified).toBe(false);
  });

  it("enriches narration into visual B-roll intents, builds clean search queries, and applies clip-local Ken Burns keyframes", () => {
    const intent = extractSceneIntent("Revenue grew steadily throughout the year.");
    expect(intent.abstract).toContain("financial growth");
    expect(intent.keywords).toContain("chart");
    expect(intent.keywords).not.toContain("grew");
    expect(intent.keywords).not.toContain("steadily");
    expect(intent.avoid).toContain("watermark");

    const queries = buildSearchQueriesForIntent(intent, "Revenue grew steadily throughout the year.");
    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries[0]).toBe("chart growth");

    const s1 = extractSceneIntent("Our team starts every morning with a quick planning session.");
    const s2 = extractSceneIntent("Our collaborative office team meets daily to support colleagues.");
    const assigned = assignSequentialShotsForScenes([
      { id: "scene_1", intent: s1 },
      { id: "scene_2", intent: s2 },
    ]);
    expect(assigned.get("scene_1")?.spec.assetId).toBe("stock_office");
    // Sequential assignment avoids reusing stock_office on back-to-back scenes
    expect(assigned.get("scene_2")?.spec.assetId).not.toBe("stock_office");

    const empty = {
      ...createEmptyProject({ id: "gen-ken-burns", title: "Ken Burns Test" }),
      assets: catalogAssetsRecord(),
    };
    const cut = applyChecked(
      empty,
      buildGenerateFromScriptOp(empty, "Revenue grew steadily throughout the year."),
      { actor: "ai" },
    ).next;
    const vClip = cut.clips.ai_v_scene_1!;
    expect("keys" in vClip.transform.scale).toBe(true);
    if ("keys" in vClip.transform.scale) {
      expect(vClip.transform.scale.keys[0]?.t).toBe(0);
      expect(vClip.transform.scale.keys[1]?.t).toBe(vClip.duration);
    }
  });

  it("opens the matching sidebar panel when a media, voice, or text clip is selected and resolves stock thumbnails", async () => {
    const { useEditor } = await import("../../../apps/web/src/store");
    const { resolveAssetThumbnailUrl } = await import("../../../apps/web/src/mediaCache");

    const state = useEditor.getState();
    // Clicking a video clip on v1 opens the "clip" panel
    state.selectClipAndOpenPanel("ai_v_scene_1");
    expect(useEditor.getState().activePanel).toBe("clip");

    // Clicking a voice clip on a1 opens the "voice" panel
    state.selectClipAndOpenPanel("voice_scene_1");
    expect(useEditor.getState().activePanel).toBe("voice");

    // Clicking a text clip on t1 opens the "text" panel
    state.selectClipAndOpenPanel("ai_t_scene_1");
    expect(useEditor.getState().activePanel).toBe("text");

    // Stock thumbnail URL resolution for live stock assets
    expect(resolveAssetThumbnailUrl("pxv_12345")).toBe("/api/assets/pxv_12345/thumb");
    expect(resolveAssetThumbnailUrl("pxi_98765")).toBe("/api/assets/pxi_98765/thumb");
    expect(resolveAssetThumbnailUrl("wiki_54321")).toBe("/api/assets/wiki_54321/thumb");
  });
});
