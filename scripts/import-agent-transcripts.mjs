import fs from "fs";
import os from "os";
import path from "path";

/**
 * Import Cursor Agent transcripts for the *current project* from:
 *
 *   ~/.cursor/projects/<projectKey>/agent-transcripts/*.jsonl
 *
 * and append normalized records into:
 *
 *   - cursor-events.jsonl (matching capture-event.mjs)
 *   - prompt-corpus.jsonl (matching capture-prompt.mjs)
 *
 * Usage (from project root):
 *
 *   node scripts/import-agent-transcripts.mjs
 */

function getHomeDir() {
  return os.platform() === "win32" ? process.env.USERPROFILE || os.homedir() : process.env.HOME || os.homedir();
}

function getTranscriptsDir() {
  const home = getHomeDir();
  const cwd = process.cwd();
  const rel = path.relative(home, cwd).replace(/\\/g, "/");
  const slug = rel.replace(/[\\/]/g, "-");

  const projectsRoot = path.join(home, ".cursor", "projects");
  let chosen = null;
  try {
    const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.endsWith(slug)) {
        chosen = e.name;
        break;
      }
    }
  } catch {
    // ignore
  }

  const projectKey = chosen || slug;
  return path.join(projectsRoot, projectKey, "agent-transcripts");
}

function getEventsPath() {
  // Mirror scripts/capture-event.mjs
  if (process.env.CURSOR_EVENTS_PATH) return process.env.CURSOR_EVENTS_PATH;
  const home = os.platform() === "win32" ? process.env.USERPROFILE : process.env.HOME;
  return `${home || os.homedir()}${os.platform() === "win32" ? "\\" : "/"}cursor-events.jsonl`;
}

function getPromptCorpusPath() {
  // Mirror scripts/capture-prompt.mjs
  if (process.env.PROMPT_CORPUS_PATH) return process.env.PROMPT_CORPUS_PATH;
  const home = os.platform() === "win32" ? process.env.USERPROFILE : process.env.HOME;
  return `${home || os.homedir()}${os.platform() === "win32" ? "\\" : "/"}prompt-corpus.jsonl`;
}

function readJsonlLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return out;
}

function extractTextFromMessage(msg) {
  const content = msg?.message?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

function appendJsonl(filePath, records) {
  if (!records.length) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.appendFileSync(filePath, lines, "utf8");
}

function listJsonlFilesRecursive(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(rootDir, e.name);
    if (e.isDirectory()) {
      out.push(...listJsonlFilesRecursive(full));
    } else if (e.isFile() && e.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
  return out;
}

function importTranscripts() {
  const transcriptsDir = getTranscriptsDir();
  if (!fs.existsSync(transcriptsDir)) {
    console.error("[import-agent-transcripts] No agent-transcripts directory:", transcriptsDir);
    return { events: 0, prompts: 0 };
  }

  const files = listJsonlFilesRecursive(transcriptsDir);

  if (files.length === 0) {
    console.error("[import-agent-transcripts] No *.jsonl transcripts in:", transcriptsDir);
    return { events: 0, prompts: 0 };
  }

  console.log("[import-agent-transcripts] Found transcript files:", files.length);

  const eventRecords = [];
  const promptRecords = [];

  for (const file of files) {
    const conversationId = path.basename(file, ".jsonl");
    const stats = fs.statSync(file);
    const baseTs = new Date(stats.mtimeMs || Date.now()).toISOString();

    const lines = readJsonlLines(file);
    let index = 0;
    for (const msg of lines) {
      const role = msg?.role;
      const text = extractTextFromMessage(msg);
      if (!text) continue;

      // Synthesize a stable-ish timestamp: mtime + small offset
      const tsDate = new Date(stats.mtimeMs + index * 1000);
      const ts = tsDate.toISOString();

      if (role === "user") {
        promptRecords.push({
          conversation_id: conversationId,
          prompt: text.length > 6000 ? text.slice(0, 6000) : text,
          timestamp: ts,
        });

        eventRecords.push({
          event_type: "beforeSubmitPrompt",
          timestamp: ts,
          conversation_id: conversationId,
          model: null,
          prompt_length: text.length,
          source: "agent_transcript_import",
        });
      } else if (role === "assistant") {
        eventRecords.push({
          event_type: "afterAgentResponse",
          timestamp: ts,
          conversation_id: conversationId,
          model: null,
          text_length: text.length,
          source: "agent_transcript_import",
        });
      }

      index += 1;
    }
  }

  const eventsPath = getEventsPath();
  const promptPath = getPromptCorpusPath();

  appendJsonl(eventsPath, eventRecords);
  appendJsonl(promptPath, promptRecords);

  console.log("[import-agent-transcripts] Appended", eventRecords.length, "events →", eventsPath);
  console.log("[import-agent-transcripts] Appended", promptRecords.length, "prompts →", promptPath);

  return { events: eventRecords.length, prompts: promptRecords.length };
}

function main() {
  console.log("[import-agent-transcripts] Project cwd:", process.cwd());

  const result = importTranscripts();

  console.log(
    "[import-agent-transcripts] Done. Imported events:",
    result.events,
    "prompts:",
    result.prompts
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

