export interface ReleaseArtifactValidation {
  ok: boolean;
  errors: string[];
  setupArtifacts: string[];
  portableArtifacts: string[];
  blockMapArtifacts: string[];
  hasWinUnpacked: boolean;
}

export function validateReleaseArtifactNames(names: string[], productName = "CodexForWorkflow"): ReleaseArtifactValidation {
  const topLevelFiles = names.filter((name) => !name.includes("/") && !name.includes("\\"));
  const exeFiles = topLevelFiles.filter((name) => name.endsWith(".exe"));
  const unexpected = exeFiles.filter((name) => !name.startsWith(`${productName}-`));
  const legacyProductName = ["Codex", "On", "Computer"].join("");
  const legacyKebabName = ["codex", "on", "computer"].join("-");
  const legacyPattern = new RegExp(`${legacyProductName}|${legacyKebabName}|\\bcoc\\b`, "i");
  const oldName = topLevelFiles.filter((name) => legacyPattern.test(name));
  const setupArtifacts = exeFiles.filter((name) => /-setup-win-x64\.exe$/i.test(name));
  const portableArtifacts = exeFiles.filter((name) => /-portable-win-x64\.exe$/i.test(name));
  const blockMapArtifacts = topLevelFiles.filter((name) => /-setup-win-x64\.exe\.blockmap$/i.test(name));
  const hasWinUnpacked = names.some((name) => name === "win-unpacked" || name.startsWith("win-unpacked/") || name.startsWith("win-unpacked\\"));
  const errors = [
    ...unexpected.map((name) => `Unexpected release executable: ${name}`),
    ...oldName.map((name) => `Old product name appears in release output: ${name}`)
  ];

  if (setupArtifacts.length !== 1) {
    errors.push(`Expected exactly one setup artifact, found ${setupArtifacts.length}.`);
  }
  if (portableArtifacts.length !== 1) {
    errors.push(`Expected exactly one portable artifact, found ${portableArtifacts.length}.`);
  }
  if (blockMapArtifacts.length !== 1) {
    errors.push(`Expected exactly one setup blockmap artifact, found ${blockMapArtifacts.length}.`);
  }
  if (!hasWinUnpacked) {
    errors.push("Expected win-unpacked output to be present.");
  }

  return {
    ok: errors.length === 0,
    errors,
    setupArtifacts,
    portableArtifacts,
    blockMapArtifacts,
    hasWinUnpacked
  };
}
