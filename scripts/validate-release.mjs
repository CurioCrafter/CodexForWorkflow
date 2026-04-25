import { readdir } from "node:fs/promises";
import path from "node:path";

const releaseDir = path.join(process.cwd(), "release");
const entries = await readEntries(releaseDir);
const topLevel = entries.filter((name) => !name.includes("/") && !name.includes("\\"));
const executables = topLevel.filter((name) => name.endsWith(".exe"));
const setup = executables.filter((name) => /CodexForWorkflow-.*-setup-win-x64\.exe$/i.test(name));
const portable = executables.filter((name) => /CodexForWorkflow-.*-portable-win-x64\.exe$/i.test(name));
const blockmap = topLevel.filter((name) => /CodexForWorkflow-.*-setup-win-x64\.exe\.blockmap$/i.test(name));
const legacyProductName = ["Codex", "On", "Computer"].join("");
const legacyKebabName = ["codex", "on", "computer"].join("-");
const stale = topLevel.filter((name) => new RegExp(`${legacyProductName}|${legacyKebabName}|\\bcoc\\b`, "i").test(name));
const unexpectedExe = executables.filter((name) => !name.startsWith("CodexForWorkflow-"));
const errors = [];

if (setup.length !== 1) {
  errors.push(`Expected exactly one setup artifact, found ${setup.length}.`);
}
if (portable.length !== 1) {
  errors.push(`Expected exactly one portable artifact, found ${portable.length}.`);
}
if (blockmap.length !== 1) {
  errors.push(`Expected exactly one setup blockmap artifact, found ${blockmap.length}.`);
}
if (!entries.includes("win-unpacked")) {
  errors.push("Expected win-unpacked output directory.");
}
for (const name of stale) {
  errors.push(`Stale old-name artifact found: ${name}`);
}
for (const name of unexpectedExe) {
  errors.push(`Unexpected release executable found: ${name}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`release artifacts valid: ${setup[0]}, ${portable[0]}`);

async function readEntries(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    result.push(entry.name);
  }
  return result;
}
