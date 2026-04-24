import { existsSync } from "node:fs";
import path from "node:path";

export interface CodexCliResolution {
  executable: string;
  argsPrefix: string[];
  nodeExe: string;
  codexJs: string;
  diagnostics: string;
}

export interface ResolveCodexCliOptions {
  env?: NodeJS.ProcessEnv;
  fileExists?: (candidate: string) => boolean;
  platform?: NodeJS.Platform;
}

export function resolveCodexCli(options: ResolveCodexCliOptions = {}): CodexCliResolution {
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const platform = options.platform ?? process.platform;
  const diagnostics: string[] = [];

  const codexJsCandidates = [
    env.CODEX_CLI_JS,
    env.APPDATA
      ? path.join(env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js")
      : undefined,
    env.USERPROFILE
      ? path.join(
          env.USERPROFILE,
          "AppData",
          "Roaming",
          "npm",
          "node_modules",
          "@openai",
          "codex",
          "bin",
          "codex.js"
        )
      : undefined
  ].filter(Boolean) as string[];

  const codexJs = firstExisting(codexJsCandidates, fileExists);
  if (!codexJs) {
    throw new Error(`Codex CLI JS entrypoint not found. Checked: ${codexJsCandidates.join(", ")}`);
  }

  if (env.CODEX_CLI_JS) {
    diagnostics.push(`CODEX_CLI_JS=${env.CODEX_CLI_JS}`);
  }

  const nodeCandidates = [
    env.CODEX_NODE_EXE,
    ...pathNodeCandidates(env.PATH, platform),
    platform === "win32" ? "C:\\Program Files\\nodejs\\node.exe" : undefined,
    !process.versions.electron ? process.execPath : undefined
  ].filter(Boolean) as string[];

  const nodeExe = firstExisting(nodeCandidates, fileExists) ?? nodeCandidates[0];
  if (!nodeExe) {
    throw new Error("Node executable not found for launching Codex CLI.");
  }

  if (env.CODEX_NODE_EXE) {
    diagnostics.push(`CODEX_NODE_EXE=${env.CODEX_NODE_EXE}`);
  }

  diagnostics.push(`Codex CLI=${codexJs}`);
  diagnostics.push(`Node=${nodeExe}`);

  return {
    executable: nodeExe,
    argsPrefix: [codexJs],
    nodeExe,
    codexJs,
    diagnostics: diagnostics.join("\n")
  };
}

export function buildCodexArgs(resolution: CodexCliResolution, args: string[]): string[] {
  return [...resolution.argsPrefix, ...args];
}

export function buildCmdStartArgs(resolution: CodexCliResolution, args: string[]): string[] {
  return [
    "/d",
    "/s",
    "/c",
    "start",
    "\"\"",
    quoteForCmd(resolution.executable),
    quoteForCmd(resolution.codexJs),
    ...args.map(quoteForCmd)
  ];
}

function firstExisting(
  candidates: string[],
  fileExists: (candidate: string) => boolean
): string | undefined {
  return candidates.find((candidate) => candidate.trim().length > 0 && fileExists(candidate));
}

function pathNodeCandidates(rawPath: string | undefined, platform: NodeJS.Platform): string[] {
  if (!rawPath) {
    return [];
  }

  const delimiter = platform === "win32" ? ";" : ":";
  const nodeName = platform === "win32" ? "node.exe" : "node";
  return rawPath
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.join(entry, nodeName));
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
