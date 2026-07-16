import { existsSync } from "node:fs";
import path from "node:path";

function resolveStorageRoot(configured: string): string {
  if (path.isAbsolute(configured)) return configured;
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.resolve(dir, configured);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(configured);
}

console.log("resolveStorageRoot('./storage') =", resolveStorageRoot("./storage"));
console.log("cwd is:", process.cwd());
