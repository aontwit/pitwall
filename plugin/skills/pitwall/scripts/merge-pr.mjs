// Merges one PR into the dev branch for auto merge (SPEC: Auto merge) · the only merge command the loop may run: the lap's
// PR sync calls it (`lap.md` section 10), never a worker, and no agent runs `gh pr merge` itself
// Refuses, in this order, and never merges when:
//   profile: the `git` section has no single `merge: auto` (missing = human) · the `dev branch` row is missing, `none`,
//     not a usable branch name, has glob characters, differs from the `base` row, or looks like main / master /
//     release* / prod* (read as `doctor.sh` reads them; doctor also checks the branch is on origin, here the PR's base
//     below must equal it, and a PR base exists on GitHub)
//   gate 6: state `stopRequested` is set (`/pitwall:stop` or `/pitwall:brake`)
//   pr: the PR is a draft, not OPEN, its base is not the dev branch, or its head branch is the `branch` of a state
//     `workers[]` entry (a worker still holds it: workers never merge, and nothing merges under them)
//   gates 1-3 and always-human: `merge-gate.mjs` (same folder) on the same state and profile does not print `MERGE`
//     (it runs again here as the last check right before the merge: cheap, one more node call) · the PR's head after
//     the gate is not the head read before it (merge-gate reads the PR itself, so the head must not move in between)
// Then runs exactly `gh pr merge <n> --merge --match-head-commit <head oid>` (a merge commit that GitHub refuses when
// the head is no longer the judged one · never `--admin`, `--auto`, `--squash`, `--rebase` or `--delete-branch`) and
// reads the PR back with `gh pr view <n> --json state,mergedAt,baseRefName` (gate 5), whatever the merge command
// returned · read back merged into any branch but the dev branch → FAILED, loud: a human must look
// Run: node merge-pr.mjs --state <state.json> <pr number>   (in the loop checkout, origin fetched; profile =
//   `.claude/agent-loop.md` there)
//   prints one line · `MERGED #<n>` exit 0 · `REFUSED: <reason>` exit 1 (nothing merged) · usage on stderr exit 2 ·
//   `FAILED: <reason>` exit 3 (something could not be read, or the merge did not read back as MERGED)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PROFILE = ".claude/agent-loop.md";
const CELLS = /(?<!\\)\|/; // a table cell border; `\|` inside a cell is text
const GATE = join(dirname(fileURLToPath(import.meta.url)), "merge-gate.mjs");

const oneLine = (s, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t;
};

/** lines of the `## git` section, heading matched like doctor.sh (`## git`, or `## git (more words)`) */
const gitSection = (text) => {
  let on = false;
  const out = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("## ")) {
      const h = line.slice(3).toLowerCase();
      on = h === "git" || h.startsWith("git ");
    } else if (on) out.push(line);
  }
  return out;
};

/** the value cell of the git table row whose label cell is exactly `<label>` (doctor.sh `row_cell`) */
const rowCell = (lines, label) => {
  const row = lines.find((l) => new RegExp(`^\\| *${label} *\\|`).test(l));
  return row ? (row.split(CELLS)[2] ?? "") : null;
};
const firstTick = (cell) => /`([^`]*)`/.exec(cell ?? "")?.[1].trim() ?? "";

/** the dev branch the profile allows auto merge into, or { refuse } · `checkRef(name)` = true when git takes it as a
 * branch name (`git check-ref-format --branch`) */
export const devBranch = (profile, checkRef) => {
  const git = gitSection(profile);
  // `merge:` only where a value starts (line, backtick or cell start), so `pre-merge: x` in a hooks row is no value
  const values = git.flatMap((l) => [...l.matchAll(/(?:^|[`|]) *merge: *`? *([^\s`|,;)]*)/g)].map((m) => m[1]));
  if (values.length > 1) return { refuse: `profile has ${values.length} \`merge:\` values in the git section` };
  if (values[0] !== "auto") return { refuse: `profile says \`merge: ${values[0] ?? "human"}\`, not \`merge: auto\`` };
  const baseCell = rowCell(git, "base");
  const devCell = rowCell(git, "dev branch");
  if (`${baseCell}${devCell}`.includes("{{")) return { refuse: "profile still has a {{...}} placeholder in the base or dev branch row" };
  const base = firstTick(baseCell);
  const dev = firstTick(devCell);
  if (!base) return { refuse: "profile has no base in backticks in the git table" };
  if (!dev || dev.toLowerCase() === "none") return { refuse: "profile has no dev branch in backticks in the git table" };
  if (/[*?[\\]/.test(dev)) return { refuse: `dev branch \`${dev}\` has glob characters` };
  if (dev.startsWith("-") || dev.includes("@{") || !checkRef(dev)) return { refuse: `dev branch \`${dev}\` is not a valid branch name` };
  if (dev !== base) return { refuse: `dev branch \`${dev}\` is not the base \`${base}\`` };
  if (/^(main|master)$|^(release|prod)/i.test(dev)) return { refuse: `dev branch \`${dev}\` looks like the main or a release line` };
  return { dev };
};

/** spawnSync-shaped runner: (cmd, argv) → { status, stdout, stderr } · never a shell, never a prompt */
export const defaultRun = (cmd, argv) => {
  const r = spawnSync(cmd, argv, {
    encoding: "utf8",
    maxBuffer: 1 << 26,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "", stderr: r.error ? r.error.message : (r.stderr ?? "") };
};

/** { code: 0 | 1 | 3, line } · `state` = the parsed state file, `stateFile` = its path (passed on to merge-gate) */
export const mergePr = ({ number, profile, state, stateFile, run = defaultRun, gate = GATE }) => {
  const refused = (reason) => ({ code: 1, line: `REFUSED: ${oneLine(reason)}` });
  const failed = (reason) => ({ code: 3, line: `FAILED: ${oneLine(reason)}` });
  const n = String(number);

  // profile: merge: auto, dev branch = the base
  const target = devBranch(profile, (name) => run("git", ["check-ref-format", "--branch", name]).status === 0);
  if (target.refuse) return refused(target.refuse);
  const { dev } = target;

  // gate 6
  if (state?.stopRequested) return refused("stop / brake is set (state stopRequested), no merges (gate 6)");

  // pr: open, not a draft, into the dev branch, not held by a worker
  const view = (fields) => {
    const r = run("gh", ["pr", "view", n, "--json", fields]);
    if (r.status !== 0) return { error: `gh pr view #${n}: ${r.stderr || `exit ${r.status}`}` };
    try {
      const json = JSON.parse(r.stdout);
      return json && typeof json === "object" ? { json } : { error: `gh pr view #${n} printed no JSON object` };
    } catch {
      return { error: `gh pr view #${n} printed no JSON` };
    }
  };
  const before = view("number,baseRefName,headRefName,headRefOid,isDraft,state");
  if (before.error) return failed(before.error);
  const pr = before.json;
  if (pr.number !== Number(number)) return failed(`gh pr view returned #${pr.number}, not #${n}`);
  if (typeof pr.isDraft !== "boolean") return failed(`gh pr view #${n} gave no isDraft, cannot tell a draft from a ready PR`);
  if (typeof pr.headRefOid !== "string" || !/^[0-9a-f]{7,64}$/.test(pr.headRefOid)) return failed(`gh pr view #${n} gave no head commit`);
  if (pr.baseRefName !== dev) return refused(`#${n} targets \`${pr.baseRefName}\`, not the dev branch \`${dev}\``);
  if (pr.isDraft) return refused(`#${n} is a draft`);
  if (pr.state !== "OPEN") return refused(`#${n} is ${pr.state}`);
  const workers = Array.isArray(state?.workers) ? state.workers : [];
  if (workers.some((w) => w?.branch === pr.headRefName)) return refused(`#${n}'s branch \`${pr.headRefName}\` is held by a worker (state workers[])`);

  // gates 1-3 and always-human, right before the merge, then the head must still be the one read above
  const judged = run(process.execPath, [gate, "--state", stateFile, "--profile", PROFILE, n]);
  const verdict = judged.stdout.trim();
  if (judged.status === 1 && verdict.startsWith("HOLD ")) return refused(verdict);
  if (judged.status !== 0 || verdict !== "MERGE") return failed(`merge-gate could not judge #${n}: ${judged.stderr || verdict || `exit ${judged.status}`}`);
  const now = view("headRefOid,state");
  if (now.error) return failed(now.error);
  if (now.json.headRefOid !== pr.headRefOid) return refused(`#${n}'s head moved while it was judged (${pr.headRefOid.slice(0, 7)} → ${String(now.json.headRefOid).slice(0, 7)})`);

  // the merge: a merge commit of the judged head, nothing else
  const head = pr.headRefOid;
  const merge = run("gh", ["pr", "merge", n, "--merge", "--match-head-commit", head]);

  // gate 5: read it back, whatever the merge command said
  const back = view("state,mergedAt,baseRefName");
  const after = back.json ?? null;
  const why = merge.status === 0 ? "" : ` · gh pr merge: ${merge.stderr || `exit ${merge.status}`}`;
  if (after?.state === "MERGED" && after.baseRefName !== dev)
    return failed(`#${n} MERGED into \`${after.baseRefName}\`, not the dev branch \`${dev}\` — a human must look at it now`);
  if (after?.state === "MERGED") return { code: 0, line: `MERGED #${n}` };
  if (!after) return failed(`#${n} could not be read back after the merge${why}`);
  return failed(`#${n} reads back as ${after.state}, not MERGED${why}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const usage = () => {
    console.error("usage: merge-pr.mjs --state <state.json> <pr number>   (in the loop checkout; reads .claude/agent-loop.md)");
    process.exit(2);
  };
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== "--state" || !args[1] || !/^[1-9][0-9]*$/.test(args[2])) usage();
  const [, stateFile, number] = args;
  let result;
  try {
    const profile = readFileSync(PROFILE, "utf8");
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    result = mergePr({ number: Number(number), profile, state, stateFile });
  } catch (e) {
    result = { code: 3, line: `FAILED: ${oneLine(e.message)}` };
  }
  console.log(result.line);
  process.exit(result.code);
}
