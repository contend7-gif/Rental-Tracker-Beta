import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const electronBuilderCli = path.join(rootDir, "node_modules", "electron-builder", "cli.js");
// electron-builder 26.8.1 emits Node DEP0190 from app-builder-lib on Node 24.
const nodeOptions = [process.env.NODE_OPTIONS, "--disable-warning=DEP0190"].filter(Boolean).join(" ");

const child = spawn(process.execPath, [electronBuilderCli, ...process.argv.slice(2)], {
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
