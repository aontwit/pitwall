// Ticks the plan rows whose agent PR has merged, so task PRs never edit the plan file (#29): a row
// `| <id> | [ ] …` is done once a merged PR's head is `<prefix><id>-<slug>`, the longest id winning
// (`agent/2.7a-x` is row 2.7a, not 2.7) · `--log` also appends one Progress log row per newly
// ticked row, under the file's `## Progress log` table (profile `tracker: none` only) · `--skip`
// leaves rows alone that are still in the queue (a `repeat` that has not reached its target).
// Run: node plan-sync.mjs [--dry] [--log] [--skip <id,…>] [--prefix agent/] [--prs <json>] <plan file>…
//   --prs = a file with `gh pr list --state merged --json number,headRefName,title,mergedAt` output
//   (default: that command, limit 1000) · --dry = print, write nothing
//   prints one line per ticked row `<id> #<pr>` · exit 0 always unless the arguments are wrong
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TASK_ROW = /^\|\s*([^|]+?)\s*\|\s*\[([ x])\]/; // id + checkbox, as resolve-docs-conflict.mjs
const LOG_HEADING = /^##\s+Progress log\s*$/;

/** { text, ticked: [{ id, pr }] } — ticks unticked rows whose id has a merged PR */
export const syncPlan = (input, prs, { prefix = "agent/", skip = [], log = false } = {}) => {
  const crlf = input.includes("\r\n");
  const lines = (crlf ? input.replace(/\r\n/g, "\n") : input).split("\n");
  const ids = lines.map((l) => TASK_ROW.exec(l)?.[1]).filter(Boolean);
  const byId = new Map(); // id -> the PR that merged it (newest wins)
  for (const pr of [...prs].sort((a, b) => String(a.mergedAt).localeCompare(String(b.mergedAt)))) {
    const id = ids
      .filter((i) => pr.headRefName.startsWith(`${prefix}${i}-`))
      .sort((a, b) => b.length - a.length)[0];
    if (id) byId.set(id, pr);
  }
  const ticked = [];
  for (let at = 0; at < lines.length; at++) {
    const m = TASK_ROW.exec(lines[at]);
    if (!m || m[2] === "x" || skip.includes(m[1]) || !byId.has(m[1])) continue;
    lines[at] = lines[at].replace("[ ]", "[x]");
    ticked.push({ id: m[1], pr: byId.get(m[1]) });
  }
  if (log && ticked.length) {
    const head = lines.findIndex((l) => LOG_HEADING.test(l));
    if (head >= 0) {
      let end = head + 1; // after the last table line of the log
      while (end < lines.length && (lines[end] === "" || lines[end].startsWith("|"))) end++;
      while (end > head + 1 && lines[end - 1] === "") end--;
      const rows = ticked.map(
        ({ id, pr }) => `| ${String(pr.mergedAt).slice(0, 10)} | ${id} ${pr.title} | #${pr.number} | see PR |`,
      );
      lines.splice(end, 0, ...rows);
    }
  }
  const out = lines.join("\n");
  return { text: crlf ? out.replace(/\n/g, "\r\n") : out, ticked };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args.splice(at, 2)[1];
  };
  const flag = (f) => (args.includes(f) ? (args.splice(args.indexOf(f), 1), true) : false);
  const dry = flag("--dry");
  const log = flag("--log");
  const skip = (take("--skip") ?? "").split(",").filter(Boolean);
  const prefix = take("--prefix") ?? "agent/";
  const prsFile = take("--prs");
  if (!args.length || args.some((a) => a.startsWith("--"))) {
    console.error("usage: plan-sync.mjs [--dry] [--log] [--skip <id,…>] [--prefix agent/] [--prs <json>] <plan file>…");
    process.exit(2);
  }
  const prs = JSON.parse(
    prsFile
      ? readFileSync(prsFile, "utf8")
      : execFileSync("gh", ["pr", "list", "--state", "merged", "--limit", "1000", "--json", "number,headRefName,title,mergedAt"], {
          encoding: "utf8",
        }),
  );
  for (const file of args) {
    const { text, ticked } = syncPlan(readFileSync(file, "utf8"), prs, { prefix, skip, log });
    for (const { id, pr } of ticked) console.log(`${id} #${pr.number}`);
    if (!dry && ticked.length) writeFileSync(file, text);
  }
}
