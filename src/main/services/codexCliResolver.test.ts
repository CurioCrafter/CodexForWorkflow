import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCmdStartArgs, buildCodexArgs, resolveCodexCli } from "./codexCliResolver";

describe("resolveCodexCli", () => {
  it("prefers explicit env overrides", () => {
    const files = new Set(["C:\\tools\\node.exe", "C:\\tools\\codex.js"]);
    const resolved = resolveCodexCli({
      platform: "win32",
      env: {
        CODEX_NODE_EXE: "C:\\tools\\node.exe",
        CODEX_CLI_JS: "C:\\tools\\codex.js"
      },
      fileExists: (candidate) => files.has(candidate)
    });

    expect(resolved.executable).toBe("C:\\tools\\node.exe");
    expect(buildCodexArgs(resolved, ["login", "status"])).toEqual([
      "C:\\tools\\codex.js",
      "login",
      "status"
    ]);
  });

  it("resolves the npm global Codex install path", () => {
    const appData = "C:\\Users\\andre\\AppData\\Roaming";
    const nodePath = "C:\\Program Files\\nodejs\\node.exe";
    const codexPath = path.join(appData, "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
    const files = new Set([nodePath, codexPath]);

    const resolved = resolveCodexCli({
      platform: "win32",
      env: { APPDATA: appData, PATH: "C:\\Program Files\\nodejs" },
      fileExists: (candidate) => files.has(candidate)
    });

    expect(resolved.executable).toBe(nodePath);
    expect(resolved.codexJs).toBe(codexPath);
  });

  it("reports missing CLI candidates", () => {
    expect(() =>
      resolveCodexCli({
        platform: "win32",
        env: { APPDATA: "C:\\Users\\andre\\AppData\\Roaming" },
        fileExists: () => false
      })
    ).toThrow(/Codex CLI JS entrypoint not found/);
  });

  it("builds a cmd start command with quoted Windows paths", () => {
    const resolved = {
      executable: "C:\\Program Files\\nodejs\\node.exe",
      argsPrefix: ["C:\\Users\\andre\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"],
      nodeExe: "C:\\Program Files\\nodejs\\node.exe",
      codexJs: "C:\\Users\\andre\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js",
      diagnostics: ""
    };

    expect(buildCmdStartArgs(resolved, ["login"])).toContain("\"C:\\Program Files\\nodejs\\node.exe\"");
    expect(buildCmdStartArgs(resolved, ["login"]).join(" ")).not.toContain(" codex ");
  });
});
