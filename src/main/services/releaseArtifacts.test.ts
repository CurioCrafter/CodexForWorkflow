import { describe, expect, it } from "vitest";
import { validateReleaseArtifactNames } from "./releaseArtifacts";

describe("validateReleaseArtifactNames", () => {
  it("accepts one setup and one portable CodexForWorkflow executable", () => {
    const result = validateReleaseArtifactNames([
      "CodexForWorkflow-0.1.0-setup-win-x64.exe",
      "CodexForWorkflow-0.1.0-portable-win-x64.exe",
      "CodexForWorkflow-0.1.0-setup-win-x64.exe.blockmap",
      "win-unpacked/CodexForWorkflow.exe"
    ]);

    expect(result.ok).toBe(true);
    expect(result.setupArtifacts).toHaveLength(1);
    expect(result.portableArtifacts).toHaveLength(1);
    expect(result.blockMapArtifacts).toHaveLength(1);
    expect(result.hasWinUnpacked).toBe(true);
  });

  it("rejects stale old-name release artifacts", () => {
    const legacyArtifact = `${["Codex", "On", "Computer"].join("")}-0.1.0-portable-win-x64.exe`;
    const result = validateReleaseArtifactNames([
      "CodexForWorkflow-0.1.0-setup-win-x64.exe",
      "CodexForWorkflow-0.1.0-portable-win-x64.exe",
      legacyArtifact
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Old product name/);
  });

  it("requires blockmap and unpacked app output", () => {
    const result = validateReleaseArtifactNames([
      "CodexForWorkflow-0.1.0-setup-win-x64.exe",
      "CodexForWorkflow-0.1.0-portable-win-x64.exe"
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/blockmap/);
    expect(result.errors.join("\n")).toMatch(/win-unpacked/);
  });
});
