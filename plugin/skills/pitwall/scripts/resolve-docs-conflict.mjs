// Resolves the conflicts that `git merge origin/<base>` leaves in append-only docs (plan rows,
// progress logs, changelogs) on an agent branch, the way merge-order 2b describes: every hunk keeps
// both sides, base's lines first, then the branch's · a line both sides hold is kept once · a task
// row (`| <id> | [ ] …` / `[x]`) on both sides is kept once, ticked if either side ticked; when its
// text differs, the side that changed it from the merge base (git's stage 1) wins.
// Anything it cannot decide is reported and the file is left as it was: two different rows with
// the same first cell and no checkbox (two open questions numbered alike, one status-board line
// changed two ways; log rows that share a date are fine) · a task row whose text both sides changed,
// or with no merge base to tell which side did · diff3 markers.
// Run: node resolve-docs-conflict.mjs <file>…   exit 0 = every file resolved · 1 = see stderr
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HUNK = /^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm;
const TASK_ROW = /^\|\s*([^|]+?)\s*\|\s*\[([ x])\]/; // id + checkbox
const ROW_ID = /^\|\s*([^|]+?)\s*\|/;
const NOT_AN_ID = /^([-: ]+|\d{4}-\d{2}-\d{2})$/; // table separator, or a log date (many rows share one)

const lines = (block) => block.split("\n").filter((l) => l !== "");
const untick = (line) => line.replace("[x]", "[ ]"); // the first box is the row's (TASK_ROW)

/** { text, problems } — text has every hunk resolved when problems is empty · ancestor = the merge base's file */
export const resolveDocsConflict = (input, ancestor = "") => {
  const crlf = input.includes("\r\n");
  const text = crlf ? input.replace(/\r\n/g, "\n") : input;
  const problems = [];
  const baseRow = new Map(); // id -> the merge base's row, unticked
  for (const line of lines(ancestor.replace(/\r\n/g, "\n"))) {
    const id = TASK_ROW.exec(line)?.[1];
    if (id) baseRow.set(id, untick(line));
  }
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
        if (at === undefined) {
          taskAt.set(task[1], kept.push(line) - 1);
          continue;
        }
        const ticked = task[2] === "x" || TASK_ROW.exec(kept[at])[2] === "x";
        let row = kept[at];
        if (untick(row) !== untick(line)) {
          const was = baseRow.get(task[1]);
          if (was === untick(row)) row = line; // only the branch changed the text
          else if (was !== untick(line)) {
            problems.push(`task row ${task[1]} changed on both sides, or no merge base to tell which: ${row}  /  ${line}`);
          }
        }
        kept[at] = ticked ? row.replace("[ ]", "[x]") : row;
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
    let ancestor = ""; // stage 1 of the unmerged index entry; none outside a merge or for a new file
    try {
      ancestor = execFileSync("git", ["show", `:1:./${basename(file)}`], {
        cwd: dirname(resolve(file)),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {}
    const { text, problems } = resolveDocsConflict(readFileSync(file, "utf8"), ancestor);
    if (problems.length) {
      failed = true;
      for (const p of problems) console.error(`${file}: ${p}`);
    } else writeFileSync(file, text);
  }
  process.exit(failed ? 1 : 0);
}
