import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targets = process.argv.slice(2);
const defaultTargets = ["dist", "release"];

for (const target of targets.length > 0 ? targets : defaultTargets) {
  const resolved = path.resolve(root, target);
  if (!resolved.startsWith(root) || resolved === root) {
    throw new Error(`Refusing to clean outside workspace: ${target}`);
  }
  await rm(resolved, { recursive: true, force: true });
  console.log(`cleaned ${path.relative(root, resolved)}`);
}
