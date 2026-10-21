// Judges one PR for auto merge (SPEC: Auto merge, gates 1-3 and the always-human kinds) and prints `MERGE` or
// `HOLD <gate>: <reason>` · checked in this order, the first failing one wins:
//   always-human: a changed file under `.github/workflows/`, one of the paths the profile names (the profile file and
//     the script / config files in its `checks (level A)` code block), a file whose name contains `baseline`, or a PR
//     body line that starts with `Always human:` (the marker for an Always park topic)
//   1: the latest `verified` entry with `item: "verdict"` at the PR's current patch-id (matched by `pr` or `branch`)
//     says VERIFIED
//   2: no `- [ ]` box left in the body's `## Not done yet` section
//   3: every check outside the profile's `ignored checks` is green, and each started after the last commit and after
//     the last retarget (`base_ref_changed`), so it ran on the current head and the current base
// Gates 4-6 (fresh dev branch, read back MERGED, stop / brake) belong to the lap that merges, not to this script.
// Run: node merge-gate.mjs --state <state.json> [--profile .claude/agent-loop.md] [--pr-json <file>] [--base-changed-at <iso>] [--patch-id <id>] <pr number>
//   --pr-json = `gh pr view <n> --json number,headRefName,headRefOid,baseRefName,body,files,statusCheckRollup,commits`
//     output (default: that command)
//   --base-changed-at = default: the newest `base_ref_changed` event of `gh api repos/{owner}/{repo}/issues/<n>/timeline`
//   --patch-id = default: the stable patch-id of `git diff <merge-base with origin/<base>> <head>` without the profile's
//     `resolve conflicts yourself` files (the command of `/pitwall:gauge` "Independent verifier"), on what the caller
//     has fetched
//   prints one line · exit 0 = MERGE, 1 = HOLD, 2 = bad arguments (usage on stderr), 3 = something could not be read
//   or checked (message on stderr, nothing on stdout: never a MERGE when a check was skipped)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CELLS = /(?<!\\)\|/; // a table cell border; `\|` inside a cell is text
const GREEN = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const SCRIPT_FILE = /\.(sh|mjs|cjs|js|ts|py|rb|json|ya?ml|toml)$/i;

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

/** files the profile's `checks (level A)` code block runs (`scripts/check-english.sh`) · a glob, a flag, a package
 * name and a folder are not files: only a token that ends in a script / config extension counts */
export const profileCheckFiles = (profile) => {
  const found = [];
  let inBlock = false;
  for (const line of section(profile, "checks")) {
    if (line.trimStart().startsWith("```")) {
      inBlock = !inBlock;
      continue;
    }
    if (!inBlock) continue;
    for (const token of line.replace(/\s#.*$/, "").split(/\s+/)) {
      if (token && !/^[-@<$#]/.test(token) && !/[*?:]/.test(token) && SCRIPT_FILE.test(token)) found.push(norm(token));
    }
  }
  return [...new Set(found)];
};

const inNotDoneYet = (body) => {
  let on = false;
  const lines = [];
  for (const line of String(body ?? "").replace(/\r/g, "").split("\n")) {
    if (line.startsWith("## ")) on = line.startsWith("## Not done yet");
    else if (on) lines.push(line);
  }
  return lines;
};

/** { merge: true } | { merge: false, gate: "always-human" | "1" | "2" | "3", reason } */
export const judge = (pr, { verified = [], patchId, baseChangedAt = null, alwaysHumanPaths = [], ignoredChecks = [] } = {}) => {
  if (!patchId) throw new Error("judge needs the PR's patch-id");
  const hold = (gate, reason) => ({ merge: false, gate, reason: oneLine(reason, 200) });

  // always-human
  const humanPaths = alwaysHumanPaths.map(norm);
  for (const { path } of pr.files ?? []) {
    const file = norm(path);
    const name = file.split("/").pop().toLowerCase();
    if (file.startsWith(".github/workflows/")) return hold("always-human", `${file} changes a CI workflow`);
    if (humanPaths.some((p) => file === p || file.startsWith(`${p}/`))) return hold("always-human", `${file} is a check or profile file`);
    if (name.includes("baseline")) return hold("always-human", `${file} is a baseline file`);
  }
  const marker = String(pr.body ?? "").replace(/\r/g, "").split("\n").find((l) => /^\s*Always human:/.test(l));
  if (marker) return hold("always-human", `PR body says "${oneLine(marker, 120)}"`);

  // 1: a VERIFIED verdict at the current patch-id
  const verdicts = verified.filter(
    (e) => e.item === "verdict" && e.patchId === patchId && ((e.pr != null && e.pr === pr.number) || (e.branch != null && e.branch === pr.headRefName)),
  );
  const latest = verdicts[verdicts.length - 1];
  if (!latest) return hold("1", `no verdict at patch ${patchId.slice(0, 12)}`);
  if (latest.evidence !== "VERIFIED") return hold("1", `verdict ${latest.evidence} at patch ${patchId.slice(0, 12)}`);

  // 2: no open box in "Not done yet"
  const open = inNotDoneYet(pr.body).find((l) => /^\s*[-*]\s+\[ \]/.test(l));
  if (open) return hold("2", oneLine(open.replace(/^\s*[-*]\s+\[ \]\s*/, "")));

  // 3: green CI that ran on the current head and the current base
  const commitTimes = (pr.commits ?? []).map((c) => at(c.committedDate));
  if (!commitTimes.length || commitTimes.some((t) => t === null)) throw new Error("PR JSON has no usable commit dates");
  const commitAt = Math.max(...commitTimes);
  const baseAt = baseChangedAt == null ? null : at(baseChangedAt);
  if (baseChangedAt != null && baseAt === null) throw new Error(`bad base-changed-at: ${baseChangedAt}`);
  const checks = (pr.statusCheckRollup ?? []).filter((c) => !ignoredChecks.includes(c.name ?? c.context));
  if (!checks.length) return hold("3", "no CI checks");
  const cutoff = Math.max(commitAt, baseAt ?? 0);
  const reasonStale = baseAt !== null && baseAt > commitAt ? "ran before the retarget" : "ran before the last commit";
  for (const c of checks) {
    const name = c.name ?? c.context;
    const isRun = c.__typename ? c.__typename === "CheckRun" : "status" in c;
    const done = isRun ? c.status === "COMPLETED" : c.state !== "PENDING" && c.state !== "EXPECTED";
    if (!done) return hold("3", `${name} pending`);
    if (!GREEN.has(isRun ? c.conclusion : c.state)) return hold("3", `${name} failing`);
    const started = at(c.startedAt);
    if (started === null) return hold("3", `${name} has no start time to compare with the last commit`);
    if (started < cutoff) return hold("3", `${name} ${reasonStale}`);
  }
  return { merge: true };
};

export const format = (r) => (r.merge ? "MERGE" : `HOLD ${r.gate}: ${r.reason}`);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const usage = () => {
    console.error(
      "usage: merge-gate.mjs --state <state.json> [--profile .claude/agent-loop.md] [--pr-json <file>] [--base-changed-at <iso>] [--patch-id <id>] <pr number>",
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
    const run = (cmd, argv, input) => execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 28, input });
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    if (state.verified !== undefined && !Array.isArray(state.verified)) throw new Error("state `verified` is not an array");
    const profile = readFileSync(profileFile, "utf8");
    const pr = JSON.parse(
      prJsonFile
        ? readFileSync(prJsonFile, "utf8")
        : run("gh", ["pr", "view", String(number), "--json", "number,headRefName,headRefOid,baseRefName,body,files,statusCheckRollup,commits"]),
    );
    if (pr.number !== number) throw new Error(`PR JSON is for #${pr.number}, not #${number}`);

    let baseChangedAt = baseArg ?? null;
    if (baseArg === undefined) {
      const out = run("gh", ["api", `repos/{owner}/{repo}/issues/${number}/timeline`, "--paginate", "--jq", '.[] | select(.event == "base_ref_changed") | .created_at']);
      const times = out.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const t of times) if (at(t) === null) throw new Error(`bad timeline time: ${t}`);
      baseChangedAt = times.sort((a, b) => at(b) - at(a))[0] ?? null;
    }

    let patchId = patchArg;
    if (patchId === undefined) {
      const mergeBase = run("git", ["merge-base", `origin/${pr.baseRefName}`, pr.headRefOid]).trim();
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
