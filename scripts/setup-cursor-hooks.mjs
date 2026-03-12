#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import url from "url";

function log(msg) {
  process.stdout.write(`[setup-cursor-hooks] ${msg}\n`);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
    log(`Created directory: ${p}`);
  }
}

function backupIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const backup = path.join(dir, `${base}.bak-${stamp}`);
  fs.copyFileSync(targetPath, backup);
  log(`Existing ${base} backed up to ${backup}`);
}

function main() {
  const home = os.platform() === "win32" ? process.env.USERPROFILE || os.homedir() : process.env.HOME || os.homedir();
  const cursorRoot = path.join(home, ".cursor");
  const cursorScripts = path.join(cursorRoot, "scripts");

  const thisFile = url.fileURLToPath(import.meta.url);
  const repoScripts = path.dirname(thisFile);
  const repoRoot = path.resolve(repoScripts, "..");
  const hooksTemplate = path.join(repoRoot, "hooks", "hooks.json");

  if (!fs.existsSync(hooksTemplate)) {
    log(`ERROR: hooks template not found at ${hooksTemplate}`);
    process.exit(1);
  }

  ensureDir(cursorRoot);
  ensureDir(cursorScripts);

  const targetHooks = path.join(cursorRoot, "hooks.json");
  backupIfExists(targetHooks);
  fs.copyFileSync(hooksTemplate, targetHooks);
  log(`Wrote hooks.json → ${targetHooks}`);

  const scriptNames = [
    "capture-event.mjs",
    "capture-thinking.mjs",
    "capture-prompt.mjs",
    "capture-response-to-txt.mjs",
    "test.sh",
  ];

  for (const name of scriptNames) {
    const src = path.join(repoScripts, name);
    const dst = path.join(cursorScripts, name);
    if (!fs.existsSync(src)) {
      log(`WARN: source script not found, skipped: ${src}`);
      continue;
    }
    fs.copyFileSync(src, dst);
    if (name.endsWith(".sh")) {
      try {
        fs.chmodSync(dst, 0o755);
      } catch {
        // ignore chmod errors
      }
    }
    log(`Copied ${name} → ${dst}`);
  }

  log("Done. Restart Cursor so hooks take effect.");
  log("You can safely re-run this script; it will back up existing hooks.json first.");
}

main();

