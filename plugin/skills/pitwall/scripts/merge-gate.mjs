// Judges one PR for auto merge (SPEC: Auto merge, gates 1-3 and the always-human kinds) and prints `MERGE` or
// `HOLD <gate>: <reason>` · checked in this order, the first failing one wins:
//   pr: the PR is a draft, or its state is not OPEN
//   always-human: a changed file that can loosen a gate or run code in CI (anything under `.github/`, `.githooks/` or
//     `.husky/`, `lefthook*`, `.pre-commit-config.yaml`, any `package.json`, `Makefile`, CODEOWNERS, lint / tsc configs,
//     any path containing `baseline`, the profile file, and the script / config files the profile's `checks (level A)`
//     code block runs) · or no Always park check by the independent verifier at the current patch-id: state `verified`
//     must hold an entry `item: "always-park"`, `method: "verifier"`, `evidence: "none"` (the verifier found no money /
//     price / fee, permissions / security, user data or delete topic) · any other evidence holds and is quoted
//   1: the latest `verified` entry with `item: "verdict"`, `method: "verifier"` at the PR's current patch-id says
//     VERIFIED (matched by `pr`, or by `branch` when the entry's `pr` is null) · a writer or pair-run entry never counts ·
//     PARTIAL with no open box left in "Not done yet" prints `re-verify` (the signal for the lap to run the verifier again)
//   2: "Not done yet" exists and has no open `- [ ]` box
//   3: every check outside the profile's `ignored checks` is green, at least one concluded SUCCESS, and each started after
//     the last commit and after the last retarget (`base_ref_changed`), so it ran on the current head and the current base
// Not checked here: that the PR targets the dev branch (the dev-branch model is the lap's job, M3), gates 4-6 (fresh dev
// branch, read back MERGED, stop / brake)
// Run: node merge-gate.mjs --state <state.json> [--profile .claude/agent-loop.md] <pr number>
//   needs gh (PR JSON, timeline) and a git checkout with origin fetched (changed files, patch-id) · run it in the checkout
//   for tests / offline use only: [--pr-json <file>] [--base-changed-at <iso>] [--patch-id <id>] (M3 calls without them)
//   --pr-json = `gh pr view <n> --json number,headRefName,headRefOid,baseRefName,body,files,statusCheckRollup,commits,isDraft,state`
//     output (default: that command)
//   --base-changed-at = default: the newest `base_ref_changed` event of `gh api repos/{owner}/{repo}/issues/<n>/timeline`
//   --patch-id = default: the stable patch-id of `git diff <merge-base with origin/<base>> <head>` without the profile's
//     `resolve conflicts yourself` files (the command of `/pitwall:gauge` "Independent verifier"), on what the caller
//     has fetched
//   changed files = `git diff --no-renames --name-only <merge-base> <head>` joined with the PR JSON's `files` (gh caps
//     that list and shows a rename by its new path only)
//   prints one line · exit 0 = MERGE, 1 = HOLD, 2 = bad arguments (usage on stderr), 3 = something could not be read
//   or checked (message on stderr, nothing on stdout: never a MERGE when a check was skipped)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CELLS = /(?<!\\)\|/; // a table cell border; `\|` inside a cell is text
const GREEN = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const SCRIPT_FILE = /\.(sh|mjs|cjs|js|ts|py|rb|json|ya?ml|toml)$/i;
const PR_FIELDS = "number,headRefName,headRefOid,baseRefName,body,files,statusCheckRollup,commits,isDraft,state";
const NOT_DONE_YET = /^not done yet(?![a-z0-9])/i;
const OPEN_BOX = /^\s*(?:[-*+]|\d+[.)])\s+\[ \]/;

// folders (as a path segment), file names and file name prefixes that can loosen a gate or run code in CI
const HUMAN_DIRS = new Set([".github", ".githooks", ".husky"]);
const HUMAN_NAMES = new Set(["package.json", "makefile", ".pre-commit-config.yaml", "codeowners"]);
const HUMAN_NAME_PREFIXES = ["lefthook", ".lefthook", "eslint", ".eslintrc", "tsconfig", ".rubocop"];
// what a check runner reads: a profile check command that starts it makes these files always-human (`**/` = any folder)
const NPM_RUNNERS = new Set(["npm", "npx", "pnpm", "yarn", "bun"]);
const RUNNER_FILES = {
  make: ["**/Makefile"],
  gmake: ["**/Makefile"],
  pytest: ["**/pytest.ini", "**/pyproject.toml", "**/setup.cfg", "**/conftest.py"],
  cargo: ["**/Cargo.toml"],
};

const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
const oneLine = (s, max = 80) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t;
};
const at = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** lines of a `## <name>` section, heading matched like doctor.sh (`## checks`, or `## checks (more words)`) */
const section = (text, name) => {
  let on = false;
  const out = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("## ")) {
      const h = line.slice(3).toLowerCase();
      on = h === name || h.startsWith(`${name} `);
    } else if (on) out.push(line);
  }
  return out;
};

/** the backticked tokens of the cells after the label cell of the profile's `<label>` row in `## git` */
const gitRowTokens = (profile, label) => {
  const row = section(profile, "git").find((l) => l.startsWith("|") && l.split(CELLS)[1]?.includes(label));
  if (!row) return [];
  return [...row.split(CELLS).slice(2).join("|").matchAll(/`([^`]+)`/g)].map((t) => t[1].trim());
};

/** the globs of the `resolve conflicts yourself` row (as pick-batch.mjs reads them) */
export const profileShared = (profile) =>
  gitRowTokens(profile, "resolve conflicts yourself").filter((t) => t && !/\s/.test(t) && !t.startsWith("#"));

/** the check names of the `ignored checks` row (`none` = no backticked token = empty) */
export const profileIgnored = (profile) => gitRowTokens(profile, "ignored checks").filter(Boolean);

/** paths that are always-human because the profile's `checks (level A)` code block runs them: the script / config files
 * it names (`scripts/check-english.sh`; a glob, a flag, a package name and a folder are not files: only a token that ends
 * in a script / config extension counts), and the config of each runner it starts (`npm` / `npx` / `pnpm` / `yarn` /
 * `bun` → `package.json`, and `<dir>/package.json` for `--prefix <dir>` · `make` → `Makefile` · `pytest` → its config
 * files · `cargo` → `Cargo.toml`) · quotes, `;`, `&&` and `||` around a token are dropped */
export const profileCheckFiles = (profile) => {
  const found = [];
  let inBlock = false;
  for (const line of section(profile, "checks")) {
    if (line.trimStart().startsWith("```")) {
      inBlock = !inBlock;
      continue;
    }
    if (!inBlock) continue;
    const tokens = line
      .replace(/(^|\s)#.*$/, "")
      .replace(/&&|\|\||;/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^["'`]+|["'`]+$/g, ""))
      .filter(Boolean);
    tokens.forEach((token, i) => {
      if (NPM_RUNNERS.has(token)) found.push("**/package.json");
      else if (RUNNER_FILES[token]) found.push(...RUNNER_FILES[token]);
      if (token === "--prefix" && tokens[i + 1]) found.push(`${norm(tokens[i + 1])}/package.json`);
      else if (token.startsWith("--prefix=") && token.length > 9) found.push(`${norm(token.slice(9))}/package.json`);
      if (!/^[-@<$#]/.test(token) && !/[*?:]/.test(token) && SCRIPT_FILE.test(token)) found.push(norm(token));
    });
  }
  return [...new Set(found)];
};

/** why a changed file is always-human, or null · case-insensitive, over-holding only costs a human merge */
const humanReason = (file, humanPaths) => {
  const lower = file.toLowerCase();
  const parts = lower.split("/");
  const name = parts[parts.length - 1];
  if (parts.slice(0, -1).some((d) => HUMAN_DIRS.has(d))) return `${file} is CI, hook or repo-owner config`;
  if (HUMAN_NAMES.has(name) || HUMAN_NAME_PREFIXES.some((p) => name.startsWith(p))) return `${file} is a check, hook or lint config`;
  if (lower.includes("baseline")) return `${file} is a baseline file`;
  for (const p of humanPaths) {
    if (p.startsWith("**/") ? name === p.slice(3) : lower === p || lower.startsWith(`${p}/`)) return `${file} is a check or profile file`;
  }
  return null;
};

/** the lines of every "Not done yet" section of a PR body (any heading level, any case, up to the next heading of the same
 * or a higher level; a `#` line inside a code fence is not a heading) · null when the body has none */
const notDoneYet = (body) => {
  let level = 0; // heading level of the section being read, 0 = not in one
  let fence = false;
  let found = false;
  const lines = [];
  for (const line of body.replace(/\r/g, "").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      if (NOT_DONE_YET.test(h[2].trim())) {
        level = h[1].length;
        found = true;
      } else if (level && h[1].length <= level) level = 0;
    } else if (level) lines.push(line);
  }
  return found ? lines : null;
};

/** { merge: true } | { merge: false, gate: "pr" | "always-human" | "1" | "2" | "3", reason } */
export const judge = (pr, { verified = [], patchId, baseChangedAt = null, alwaysHumanPaths = [], ignoredChecks = [] } = {}) => {
  if (!patchId) throw new Error("judge needs the PR's patch-id");
  for (const key of ["files", "statusCheckRollup", "commits"]) {
    if (!Array.isArray(pr[key])) throw new Error(`PR JSON has no \`${key}\` array`);
  }
  if (pr.files.some((f) => typeof f?.path !== "string")) throw new Error("PR JSON has a `files` entry with no path");
  if (typeof pr.body !== "string") throw new Error("PR JSON has no `body` string");
  if (typeof pr.isDraft !== "boolean" || typeof pr.state !== "string") throw new Error("PR JSON has no `isDraft` / `state`");
  if (!Array.isArray(verified)) throw new Error("`verified` is not an array");
  const hold = (gate, reason) => ({ merge: false, gate, reason: oneLine(reason, 200) });
  const short = patchId.slice(0, 12);

  // pr: a draft or a closed / merged PR is not for the gate
  if (pr.isDraft) return hold("pr", "draft");
  if (pr.state !== "OPEN") return hold("pr", `state ${pr.state}`);

  // the entries of the independent verifier at this patch-id for this PR (`pr`, or `branch` when `pr` is null)
  const mine = verified.filter(
    (e) =>
      e?.method === "verifier" &&
      e.patchId === patchId &&
      (e.pr != null ? e.pr === pr.number : e.branch != null && e.branch === pr.headRefName),
  );

  // always-human: files that loosen a gate, then the verifier's Always park answer
  const humanPaths = alwaysHumanPaths.map((p) => norm(p).toLowerCase());
  for (const { path } of pr.files) {
    const file = norm(path);
    const reason = humanReason(file, humanPaths);
    if (reason) return hold("always-human", reason);
  }
  const park = mine.filter((e) => e.item === "always-park").pop();
  if (!park) return hold("always-human", `no Always park check by the verifier at patch ${short}`);
  if (park.evidence !== "none") return hold("always-human", oneLine(park.evidence, 150) || "empty Always park evidence");

  // 2 is read now: gate 1 uses it to tell "run the verifier again" from "work left"
  const notDone = notDoneYet(pr.body);
  const open = notDone?.find((l) => OPEN_BOX.test(l));

  // 1: the latest verifier verdict at the current patch-id says VERIFIED
  const latest = mine.filter((e) => e.item === "verdict").pop();
  if (!latest) return hold("1", `no verdict at patch ${short}`);
  if (latest.evidence !== "VERIFIED") {
    if (latest.evidence === "PARTIAL" && notDone && !open) return hold("1", `re-verify — verdict PARTIAL at patch ${short}, no box left`);
    return hold("1", `verdict ${latest.evidence} at patch ${short}`);
  }

  // 2: "Not done yet" exists and has no open box
  if (!notDone) return hold("2", "no Not done yet section");
  if (open) return hold("2", oneLine(open.replace(OPEN_BOX, "").trim()));

  // 3: green CI that ran on the current head and the current base
  const commitTimes = pr.commits.map((c) => at(c.committedDate));
  if (!commitTimes.length || commitTimes.some((t) => t === null)) throw new Error("PR JSON has no usable commit dates");
  const commitAt = Math.max(...commitTimes);
  const baseAt = baseChangedAt == null ? null : at(baseChangedAt);
  if (baseChangedAt != null && baseAt === null) throw new Error(`bad base-changed-at: ${baseChangedAt}`);
  const checks = pr.statusCheckRollup.filter((c) => !ignoredChecks.includes(c.name ?? c.context));
  if (!checks.length) return hold("3", "no CI checks");
  const cutoff = Math.max(commitAt, baseAt ?? 0);
  const reasonStale = baseAt !== null && baseAt > commitAt ? "ran before the retarget" : "ran before the last commit";
  let succeeded = 0;
  for (const c of checks) {
    const name = c.name ?? c.context;
    const isRun = c.__typename ? c.__typename === "CheckRun" : "status" in c;
    const done = isRun ? c.status === "COMPLETED" : c.state !== "PENDING" && c.state !== "EXPECTED";
    if (!done) return hold("3", `${name} pending`);
    const result = isRun ? c.conclusion : c.state;
    if (!GREEN.has(result)) return hold("3", `${name} failing`);
    const started = at(c.startedAt);
    if (started === null) return hold("3", `${name} has no start time to compare with the last commit`);
    if (started < cutoff) return hold("3", `${name} ${reasonStale}`);
    if (result === "SUCCESS") succeeded += 1;
  }
  if (!succeeded) return hold("3", "no successful check");
  return { merge: true };
};

export const format = (r) => (r.merge ? "MERGE" : `HOLD ${r.gate}: ${r.reason}`);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const usage = () => {
    console.error(
      "usage: merge-gate.mjs --state <state.json> [--profile .claude/agent-loop.md] <pr number>   (tests / offline only: [--pr-json <file>] [--base-changed-at <iso>] [--patch-id <id>])",
    );
    process.exit(2);
  };
  const args = process.argv.slice(2);
  const take = (flag) => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    const value = args.splice(i, 2)[1];
    return value ?? usage();
  };
  const stateFile = take("--state");
  const profileFile = take("--profile") ?? ".claude/agent-loop.md";
  const prJsonFile = take("--pr-json");
  const baseArg = take("--base-changed-at");
  const patchArg = take("--patch-id");
  if (!stateFile || args.length !== 1 || !/^[1-9][0-9]*$/.test(args[0])) usage();
  const number = Number(args[0]);

  try {
    const run = (cmd, argv, input) => execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 28, input, stdio: ["pipe", "pipe", "pipe"] });
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    if (state.verified !== undefined && !Array.isArray(state.verified)) throw new Error("state `verified` is not an array");
    const profile = readFileSync(profileFile, "utf8");
    const pr = JSON.parse(prJsonFile ? readFileSync(prJsonFile, "utf8") : run("gh", ["pr", "view", String(number), "--json", PR_FIELDS]));
    if (pr.number !== number) throw new Error(`PR JSON is for #${pr.number}, not #${number}`);
    if (!Array.isArray(pr.files)) throw new Error("PR JSON has no `files` array");
    if (pr.files.some((f) => typeof f?.path !== "string")) throw new Error("PR JSON has a `files` entry with no path");

    let baseChangedAt = baseArg ?? null;
    if (baseArg === undefined) {
      const out = run("gh", ["api", `repos/{owner}/{repo}/issues/${number}/timeline`, "--paginate", "--jq", '.[] | select(.event == "base_ref_changed") | .created_at']);
      const times = out.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const t of times) if (at(t) === null) throw new Error(`bad timeline time: ${t}`);
      baseChangedAt = times.sort((a, b) => at(b) - at(a))[0] ?? null;
    }

    // the changed files and the patch-id both come from git, on what the caller has fetched
    const mergeBase = run("git", ["merge-base", `origin/${pr.baseRefName}`, pr.headRefOid]).trim();
    const changed = run("git", ["diff", "--no-renames", "--name-only", "-z", mergeBase, pr.headRefOid]).split("\0").filter(Boolean);
    pr.files = [...new Set([...changed, ...pr.files.map((f) => f.path)])].map((path) => ({ path }));

    let patchId = patchArg;
    if (patchId === undefined) {
      const diff = (excludes) => run("git", ["diff", mergeBase, pr.headRefOid, "--", ".", ...excludes.map((g) => `:(exclude)${g}`)]);
      // a PR that changes only the resolve-yourself files → its whole diff (gauge "Independent verifier")
      let text = diff(profileShared(profile));
      if (!text.trim()) text = diff([]);
      patchId = run("git", ["patch-id", "--stable"], text).trim().split(/\s+/)[0];
      if (!patchId) throw new Error("the PR has an empty diff, no patch-id");
    }

    const result = judge(pr, {
      verified: state.verified ?? [],
      patchId,
      baseChangedAt,
      alwaysHumanPaths: [...new Set([".claude/agent-loop.md", norm(profileFile), ...profileCheckFiles(profile)])],
      ignoredChecks: profileIgnored(profile),
    });
    console.log(format(result));
    process.exit(result.merge ? 0 : 1);
  } catch (e) {
    console.error(`merge-gate: ${e.message}`);
    process.exit(3);
  }
}
