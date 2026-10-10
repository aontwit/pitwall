// Pulls what the human typed (and, with --assistant, what the agent told them) out of this
// project's Claude Code transcripts, one line per message, for the /secretary skill to group.
//
//   node scripts/secretary-scan.mjs [--since YYYY-MM-DD | --since auto] [--assistant] [--mark] [--dir <transcripts>]
//
// --since auto = from the last --mark (state in <dir>/secretary.json, per machine like the transcripts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ASSISTANT_MAX = 240;

// Transcripts hold whatever was pasted — tokens must never reach a report.
const SECRET = /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*|\b(?:sk|pk|ghp|gho|xox[abp])[-_][\w-]{16,}|\b[a-f0-9]{64}\b/gi;
export const redact = (text) => text.replace(SECRET, "[secret]");

const stripTags = (text) =>
  text.replace(/<(system-reminder|ide_selection|ide_opened_file)>[\s\S]*?<\/\1>/g, "").trim();

/** `<command-name>/queue</command-name><command-args>x</command-args>` → `/queue x`; other `<…>` envelopes → null. */
const commandText = (text) => {
  const name = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1];
  if (!name) return null;
  const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1] ?? "";
  return `${name.trim()} ${args.trim()}`.trim();
};

const userText = (content) => {
  if (typeof content === "string") {
    if (content.startsWith("<")) return commandText(content);
    return stripTags(content) || null;
  }
  if (!Array.isArray(content) || content.some((part) => part?.type === "tool_result")) return null;
  const text = content
    .filter((part) => part?.type === "text" && !part.text.startsWith("<"))
    .map((part) => stripTags(part.text))
    .join(" ")
    .trim();
  const images = content.filter((part) => part?.type === "image").length;
  if (!text) return images ? `[${images} image]` : null;
  return images ? `${text} [+${images} image]` : text;
};

const assistantText = (content) => {
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  return text ? text.slice(0, ASSISTANT_MAX) : null;
};

/**
 * Transcript JSONL lines → `{ at, session, who: "U" | "A", text }`. Skips tool traffic, meta / compact
 * summaries, subagent (sidechain) turns and records already seen (a resumed session replays history).
 */
export const extractTurns = (lines, { assistant = false, since = "", seen = new Set() } = {}) => {
  const turns = [];
  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.isMeta || record.isSidechain || record.isCompactSummary) continue;
    if ((record.timestamp ?? "") < since) continue;
    if (record.uuid && seen.has(record.uuid)) continue;
    const content = record.message?.content;
    const text =
      record.type === "user" ? userText(content) : record.type === "assistant" && assistant ? assistantText(content) : null;
    if (!text) continue;
    if (record.uuid) seen.add(record.uuid);
    turns.push({
      at: (record.timestamp ?? "").slice(0, 16),
      session: (record.sessionId ?? "").slice(0, 8),
      who: record.type === "user" ? "U" : "A",
      text: redact(text).replace(/\s+/g, " "),
    });
  }
  return turns;
};

const main = () => {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args[at + 1];
  };
  const dir = flag("--dir") ?? join(homedir(), ".claude", "projects", process.cwd().replace(/[^a-zA-Z0-9]/g, "-"));
  const stateFile = join(dir, "secretary.json");
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
  const sinceArg = flag("--since");
  const since = sinceArg === "auto" ? (state.lastMark ?? "") : (sinceArg ?? "");

  const seen = new Set();
  const turns = readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      extractTurns(readFileSync(join(dir, name), "utf8").split("\n"), { assistant: args.includes("--assistant"), since, seen })
    )
    .sort((a, b) => a.at.localeCompare(b.at));

  const sessions = new Set(turns.map((turn) => turn.session)).size;
  console.log(`# ${turns.length} messages · ${sessions} sessions · since ${since || "start"} · ${dir}`);
  for (const turn of turns) console.log(`${turn.at} ${turn.session} ${turn.who} ${turn.text}`);

  if (args.includes("--mark")) {
    writeFileSync(stateFile, JSON.stringify({ ...state, lastMark: new Date().toISOString() }, null, 2));
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
