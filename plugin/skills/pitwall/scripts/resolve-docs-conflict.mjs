// Resolves the conflicts that `git merge origin/<base>` leaves in append-only docs (plan rows,
// progress logs, changelogs) on an agent branch, the way merge-order 2b describes: every hunk keeps
// both sides, base's lines first, then the branch's · a line both sides hold is kept once · a task
// row (`| <id> | [ ] …` / `[x]`) on both sides is kept once, base's text, ticked if either side ticked.
// Anything it cannot decide is reported and the file is left as it was: two different rows with
// the same first cell and no checkbox (two open questions numbered alike, one status-board line
// changed two ways; log rows that share a date are fine) · diff3 markers.
// Run: node resolve-docs-conflict.mjs <file>…   exit 0 = every file resolved · 1 = see stderr
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HUNK = /^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm;
const TASK_ROW = /^\|\s*([^|]+?)\s*\|\s*\[([ x])\]/; // id + checkbox
const ROW_ID = /^\|\s*([^|]+?)\s*\|/;
const NOT_AN_ID = /^([-: ]+|\d{4}-\d{2}-\d{2})$/; // table separator, or a log date (many rows share one)

const lines = (block) => block.split("\n").filter((l) => l !== "");

/** { text, problems } — text has every hunk resolved when problems is empty */
export const resolveDocsConflict = (input) => {
  const crlf = input.includes("\r\n");
  const text = crlf ? input.replace(/\r\n/g, "\n") : input;
  const problems = [];
  if (/^\|\|\|\|\|\|\| /m.test(text)) problems.push("diff3-style markers (merge.conflictStyle=diff3): resolve by hand");
  const out = text.replace(HUNK, (_, branch, base) => {
    const kept = [];
    const taskAt = new Map(); // id -> index in kept
    const rowAt = new Map(); // id -> line, for rows without a checkbox
    for (const line of [...lines(base), ...lines(branch)]) {
      if (kept.includes(line)) continue;
      const task = TASK_ROW.exec(line);
      if (task) {
        const at = taskAt.get(task[1]);
        if (at === undefined) taskAt.set(task[1], kept.push(line) - 1);
        else if (task[2] === "x") kept[at] = kept[at].replace("[ ]", "[x]");
        continue;
      }
      const id = ROW_ID.exec(line)?.[1];
      if (id && !NOT_AN_ID.test(id)) {
        if (rowAt.has(id)) problems.push(`two rows with the same id: ${rowAt.get(id)}  /  ${line}`);
        rowAt.set(id, line);
      }
      kept.push(line);
    }
    return kept.map((l) => l + "\n").join("");
  });
  const resolved = problems.length ? input : out;
  return { text: crlf && !problems.length ? resolved.replace(/\n/g, "\r\n") : resolved, problems };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let failed = false;
  for (const file of process.argv.slice(2)) {
    const { text, problems } = resolveDocsConflict(readFileSync(file, "utf8"));
    if (problems.length) {
      failed = true;
      for (const p of problems) console.error(`${file}: ${p}`);
    } else writeFileSync(file, text);
  }
  process.exit(failed ? 1 : 0);
}
