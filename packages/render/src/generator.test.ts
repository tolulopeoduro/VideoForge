import { describe, expect, it } from "vitest";
import {
  applyChecked,
  applyPatches,
  canOverwrite,
  createEmptyProject,
  validateProject,
} from "@vf/schema";
import {
  buildGenerateFromScriptOp,
  buildRegenerateSceneOp,
  catalogAssetsRecord,
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
});
