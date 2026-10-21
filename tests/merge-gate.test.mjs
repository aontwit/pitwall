// Run: npm test
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { format, judge, profileCheckFiles, profileIgnored, profileShared } from "../plugin/skills/pitwall/scripts/merge-gate.mjs";

const script = fileURLToPath(new URL("../plugin/skills/pitwall/scripts/merge-gate.mjs", import.meta.url));

const PATCH = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const COMMIT = "2026-10-21T10:00:00Z";
const run = (name, startedAt = "2026-10-21T10:05:00Z", extra = {}) => ({
  __typename: "CheckRun",
  name,
  workflowName: "ci",
  status: "COMPLETED",
  conclusion: "SUCCESS",
  startedAt,
  completedAt: "2026-10-21T10:06:00Z",
  ...extra,
});
const pr = (over = {}) => ({
  number: 7,
  headRefName: "agent/M2-x",
  headRefOid: "abc",
  baseRefName: "main",
  body: "## Summary\n\nx\n\n## Not done yet (before merge)\n\n- [x] done\n\n## Decisions\n\n- [ ] not a gate\n",
  files: [{ path: "plugin/skills/pitwall/scripts/a.mjs" }],
  statusCheckRollup: [run("check"), run("doctor-macos")],
  commits: [{ oid: "abc", committedDate: COMMIT }],
  ...over,
});
const verdict = (over = {}) => ({ pr: 7, branch: "agent/M2-x", headSha: "abc", patchId: PATCH, method: "verifier", verifier: "x", item: "verdict", level: "A", evidence: "VERIFIED", at: "2026-10-21", ...over });
const opts = (over = {}) => ({ verified: [verdict()], patchId: PATCH, ...over });

{
  // VERIFIED at this patch-id + no open box + green CI on the current head → MERGE
  const r = judge(pr(), opts());
  assert.deepEqual(r, { merge: true });
  assert.equal(format(r), "MERGE");
}

{
  // Gate 1: PARTIAL / FAIL hold, and say which
  const partial = judge(pr(), opts({ verified: [verdict({ evidence: "PARTIAL" })] }));
  assert.equal(partial.merge, false);
  assert.equal(partial.gate, "1");
  assert.equal(format(partial), `HOLD 1: verdict PARTIAL at patch ${PATCH.slice(0, 12)}`);
  assert.match(format(judge(pr(), opts({ verified: [verdict({ evidence: "FAIL" })] }))), /^HOLD 1: verdict FAIL at patch /);
}

{
  // Gate 1: a verdict at an older patch-id is stale; no verdict at all and no state entries hold too
  const stale = judge(pr(), opts({ verified: [verdict({ patchId: "0000000000000000" })] }));
  assert.equal(format(stale), `HOLD 1: no verdict at patch ${PATCH.slice(0, 12)}`);
  assert.equal(judge(pr(), opts({ verified: [] })).gate, "1");
  assert.equal(judge(pr(), { patchId: PATCH }).gate, "1", "verified defaults to empty");
  // an entry that is not a verdict (a pair-run item) is no verdict
  assert.equal(judge(pr(), opts({ verified: [verdict({ item: "wallet popup" })] })).gate, "1");
  // a verdict of another PR is no verdict
  assert.equal(judge(pr(), opts({ verified: [verdict({ pr: 8, branch: "agent/other" })] })).gate, "1");
}

{
  // Gate 1: the latest verdict at this patch-id wins, in array order, either way round
  assert.equal(judge(pr(), opts({ verified: [verdict({ evidence: "FAIL" }), verdict()] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [verdict(), verdict({ evidence: "PARTIAL" })] })).gate, "1");
}

{
  // Gate 1: matched by branch when `pr` is null (a verdict recorded before `gh pr create`)
  assert.equal(judge(pr(), opts({ verified: [verdict({ pr: null })] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [verdict({ pr: null, branch: "agent/other" })] })).gate, "1");
}

{
  // Gate 2: one `- [ ]` in "Not done yet" holds and quotes the box
  const body = "## Not done yet (before merge)\n\n- [x] ✅ local\n- [ ] ⏳ case 1: a human clicks the wallet popup, then confirms the payment on the second screen of the flow\n";
  const r = judge(pr({ body }), opts());
  assert.equal(r.gate, "2");
  assert.match(r.reason, /^⏳ case 1: a human clicks the wallet popup/);
  assert.ok(r.reason.length <= 83, "trimmed to about 80 characters");
  assert.match(format(r), /^HOLD 2: /);
}

{
  // Gate 2: a ticked box does not hold · a `- [ ]` in another section does not hold · no such section does not hold
  assert.equal(judge(pr({ body: "## Not done yet (before merge)\n\n- [x] done\n- [X] done\n" }), opts()).merge, true);
  assert.equal(judge(pr({ body: "## Decisions\n\n- [ ] confirm\n\n## Not done yet\n\n- [x] ok\n\n## Notes\n\n- [ ] later\n" }), opts()).merge, true);
  assert.equal(judge(pr({ body: "no sections\n- [ ] x" }), opts()).merge, true);
  assert.equal(judge(pr({ body: null }), opts()).merge, true);
  // CRLF bodies read the same
  assert.equal(judge(pr({ body: "## Not done yet\r\n\r\n- [ ] x\r\n" }), opts()).gate, "2");
}

{
  // Gate 3: a failing check holds and names the check
  const failing = pr({ statusCheckRollup: [run("check"), run("doctor-macos", undefined, { conclusion: "FAILURE" })] });
  assert.equal(format(judge(failing, opts())), "HOLD 3: doctor-macos failing");
  // cancelled / timed out are not green either
  assert.match(format(judge(pr({ statusCheckRollup: [run("check", undefined, { conclusion: "CANCELLED" })] }), opts())), /^HOLD 3: check failing$/);
}

{
  // Gate 3: a pending check holds
  const pending = pr({ statusCheckRollup: [run("check"), run("build", undefined, { status: "IN_PROGRESS", conclusion: "" })] });
  assert.equal(format(judge(pending, opts())), "HOLD 3: build pending");
  const queued = pr({ statusCheckRollup: [run("build", undefined, { status: "QUEUED", conclusion: "" })] });
  assert.equal(format(judge(queued, opts())), "HOLD 3: build pending");
}

{
  // Gate 3: NEUTRAL and SKIPPED are green
  const ok = pr({ statusCheckRollup: [run("a", undefined, { conclusion: "NEUTRAL" }), run("b", undefined, { conclusion: "SKIPPED" })] });
  assert.equal(judge(ok, opts()).merge, true);
}

{
  // Gate 3: a check that started before the retarget holds · so does one that started before the last commit
  const beforeRetarget = judge(pr(), opts({ baseChangedAt: "2026-10-21T10:30:00Z" }));
  assert.equal(format(beforeRetarget), "HOLD 3: check ran before the retarget");
  assert.equal(judge(pr(), opts({ baseChangedAt: "2026-10-21T10:01:00Z" })).merge, true, "a retarget before the run is fine");
  const newCommit = pr({ commits: [{ oid: "1", committedDate: COMMIT }, { oid: "2", committedDate: "2026-10-21T10:20:00Z" }] });
  assert.equal(format(judge(newCommit, opts())), "HOLD 3: check ran before the last commit");
  // the later cutoff names the reason
  assert.match(format(judge(newCommit, opts({ baseChangedAt: "2026-10-21T10:10:00Z" }))), /ran before the last commit$/);
  assert.match(format(judge(newCommit, opts({ baseChangedAt: "2026-10-21T10:40:00Z" }))), /ran before the retarget$/);
  // commit order in the array does not matter
  const reversed = pr({ commits: [{ oid: "2", committedDate: "2026-10-21T10:20:00Z" }, { oid: "1", committedDate: COMMIT }] });
  assert.equal(judge(reversed, opts()).gate, "3");
}

{
  // Gate 3: an ignored failing check does not hold · ignoring needs the name to match · a StatusContext works too
  const failing = pr({ statusCheckRollup: [run("check"), run("lint", undefined, { conclusion: "FAILURE" })] });
  assert.equal(judge(failing, opts({ ignoredChecks: ["lint"] })).merge, true);
  assert.equal(judge(failing, opts({ ignoredChecks: ["other"] })).gate, "3");
  const ctx = (state) => ({ __typename: "StatusContext", context: "ci/legacy", state, startedAt: "2026-10-21T10:05:00Z" });
  assert.equal(judge(pr({ statusCheckRollup: [run("check"), ctx("SUCCESS")] }), opts()).merge, true);
  assert.equal(format(judge(pr({ statusCheckRollup: [ctx("FAILURE")] }), opts())), "HOLD 3: ci/legacy failing");
  assert.equal(format(judge(pr({ statusCheckRollup: [ctx("PENDING")] }), opts())), "HOLD 3: ci/legacy pending");
  assert.equal(judge(pr({ statusCheckRollup: [ctx("ERROR")] }), opts({ ignoredChecks: ["ci/legacy"] })).gate, "3", "all checks ignored → none left");
}

{
  // Gate 3: no checks (or none after ignoring) → HOLD 3: no CI checks · a check with no start time cannot be placed
  assert.equal(format(judge(pr({ statusCheckRollup: [] }), opts())), "HOLD 3: no CI checks");
  assert.equal(format(judge(pr({ statusCheckRollup: undefined }), opts())), "HOLD 3: no CI checks");
  assert.equal(format(judge(pr({ statusCheckRollup: [run("check")] }), opts({ ignoredChecks: ["check"] }))), "HOLD 3: no CI checks");
  assert.match(format(judge(pr({ statusCheckRollup: [run("check", undefined, { startedAt: "" })] }), opts())), /^HOLD 3: check has no start time/);
}

{
  // Always human: a change under .github/workflows/ holds even with every gate passed, and comes first
  const r = judge(pr({ files: [{ path: "README.md" }, { path: ".github/workflows/ci.yml" }] }), opts());
  assert.equal(r.gate, "always-human");
  assert.match(format(r), /^HOLD always-human: .*\.github\/workflows\/ci\.yml/);
  assert.equal(judge(pr({ files: [{ path: ".github/workflows/ci.yml" }] }), opts({ verified: [] })).gate, "always-human", "before gate 1");
  assert.equal(judge(pr({ files: [{ path: ".github\\workflows\\ci.yml" }] }), opts()).gate, "always-human", "backslash paths too");
  assert.equal(judge(pr({ files: [{ path: ".github/ISSUE_TEMPLATE/a.md" }] }), opts()).merge, true, "other .github files are fine");
}

{
  // Always human: a baseline file (by name) · a profile-named path (a file or a folder) · a path that only looks like one
  assert.match(format(judge(pr({ files: [{ path: "lint/eslint-baseline.json" }] }), opts())), /^HOLD always-human: lint\/eslint-baseline\.json/);
  assert.equal(judge(pr({ files: [{ path: "docs/BASELINE.md" }] }), opts()).gate, "always-human", "case-insensitive");
  const named = opts({ alwaysHumanPaths: ["scripts/check-english.sh", ".claude/agent-loop.md", "ci"] });
  assert.match(format(judge(pr({ files: [{ path: "scripts/check-english.sh" }] }), named)), /^HOLD always-human: scripts\/check-english\.sh/);
  assert.equal(judge(pr({ files: [{ path: ".claude/agent-loop.md" }] }), named).gate, "always-human");
  assert.equal(judge(pr({ files: [{ path: "ci/deep/x.yml" }] }), named).gate, "always-human", "a listed folder holds its files");
  assert.equal(judge(pr({ files: [{ path: "scripts/check-english.shx" }, { path: "cinema/a.md" }] }), named).merge, true);
}

{
  // Always human: a body line `Always human:` (the marker for an Always park topic) holds and quotes the line
  const body = "## Summary\n\nx\n\nAlways human: touches the payment fee\n\n## Not done yet\n\n- [x] ok\n";
  const r = judge(pr({ body }), opts());
  assert.equal(r.gate, "always-human");
  assert.match(r.reason, /Always human: touches the payment fee/);
  assert.equal(judge(pr({ body: "  Always human: x\r\n" }), opts()).gate, "always-human");
  assert.equal(judge(pr({ body: "We said Always human: no\n" }), opts()).merge, true, "only a line that starts with it");
}

{
  // a judge call without a patch-id cannot check gate 1
  assert.throws(() => judge(pr(), { verified: [verdict()] }), /patch-id/);
  // no commits to date the checks against
  assert.throws(() => judge(pr({ commits: [] }), opts()), /commit dates/);
  assert.throws(() => judge(pr(), opts({ baseChangedAt: "not a date" })), /base-changed-at/);
}

const PROFILE = `# Agent loop

## git

| | |
|---|---|
| base | \`main\` |
| resolve conflicts yourself | \`PLAN.md\`, \`CHANGELOG.md\` (the \`## Unreleased\` section only — keep both entries) · everything else → a human |
| ignored checks | \`lint\`, \`doctor-macos\` — known flaky |

## checks (level A)

\`\`\`bash
npm ci --prefix site                                  # when site/package-lock.json changes
npm test                                              # node --test tests/*.test.mjs
bash scripts/check-english.sh
bash scripts/check-commit-msg.sh --all
npm run build --prefix site
npx -y @anthropic-ai/claude-code@2.1.294 plugin validate ./plugin --strict
node tools/gate.mjs --flag ./plugin
\`\`\`

\`scripts/not-in-block.sh\` is prose.

## level B

| | |
|---|---|
| dev server | \`npm run dev\` |
`;

{
  // Profile reading
  assert.deepEqual(profileShared(PROFILE), ["PLAN.md", "CHANGELOG.md"]);
  assert.deepEqual(profileIgnored(PROFILE), ["lint", "doctor-macos"]);
  assert.deepEqual(profileIgnored("## git\n\n| | |\n|---|---|\n| ignored checks | none |\n"), []);
  assert.deepEqual(profileIgnored("## git\n\n| | |\n|---|---|\n| base | `main` |\n"), [], "no row = none");
  // only files the code block runs: not globs, flags, packages, folders or comments
  assert.deepEqual(profileCheckFiles(PROFILE), ["scripts/check-english.sh", "scripts/check-commit-msg.sh", "tools/gate.mjs"]);
  assert.deepEqual(profileCheckFiles("## repo\n\nx\n"), []);
}

// ---- CLI: files only, no network ----

const dir = mkdtempSync(join(tmpdir(), "merge-gate-"));
const put = (name, value) => {
  const file = join(dir, name);
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
};
const cli = (...argv) => spawnSync(process.execPath, [script, ...argv], { encoding: "utf8" });
const profileFile = put("agent-loop.md", PROFILE);
const stateFile = put("state.json", { verified: [verdict()] });
const prFile = put("pr.json", pr());
const base = ["--state", stateFile, "--profile", profileFile, "--pr-json", prFile, "--patch-id", PATCH, "--base-changed-at", "2026-10-21T10:01:00Z"];

{
  // VERIFIED + no boxes + green → `MERGE`, exit 0
  const r = cli(...base, "7");
  assert.equal(r.stdout, "MERGE\n");
  assert.equal(r.status, 0, r.stderr);
}

{
  // a failing check holds, exit 1 · a check the profile ignores does not
  const failing = put("failing.json", pr({ statusCheckRollup: [run("check"), run("build", undefined, { conclusion: "FAILURE" })] }));
  const r = cli(...base.map((a) => (a === prFile ? failing : a)), "7");
  assert.equal(r.stdout, "HOLD 3: build failing\n");
  assert.equal(r.status, 1);
  const ignored = put("ignored.json", pr({ statusCheckRollup: [run("check"), run("lint", undefined, { conclusion: "FAILURE" })] }));
  assert.equal(cli(...base.map((a) => (a === prFile ? ignored : a)), "7").stdout, "MERGE\n", "`lint` is in the profile's ignored checks");
}

{
  // a stale patch-id → HOLD 1 · a retarget after the check started → HOLD 3
  const r = cli(...base.map((a) => (a === PATCH ? "ffffffffffffffffffff" : a)), "7");
  assert.equal(r.stdout, "HOLD 1: no verdict at patch ffffffffffff\n");
  assert.equal(r.status, 1);
  const late = cli(...base.map((a) => (a === "2026-10-21T10:01:00Z" ? "2026-10-21T11:00:00Z" : a)), "7");
  assert.equal(late.stdout, "HOLD 3: check ran before the retarget\n");
  assert.equal(late.status, 1);
}

{
  // the profile adds always-human paths: its own file and the scripts of its checks block
  const ours = put("ours.json", pr({ files: [{ path: "scripts/check-english.sh" }] }));
  const r = cli(...base.map((a) => (a === prFile ? ours : a)), "7");
  assert.match(r.stdout, /^HOLD always-human: scripts\/check-english\.sh/);
  assert.equal(r.status, 1);
  const profileEdit = put("edit.json", pr({ files: [{ path: ".claude/agent-loop.md" }] }));
  assert.match(cli(...base.map((a) => (a === prFile ? profileEdit : a)), "7").stdout, /^HOLD always-human: \.claude\/agent-loop\.md/);
  const wf = put("wf.json", pr({ files: [{ path: ".github/workflows/ci.yml" }] }));
  assert.match(cli(...base.map((a) => (a === prFile ? wf : a)), "7").stdout, /^HOLD always-human: /);
}

{
  // a body with an open box → HOLD 2
  const box = put("box.json", pr({ body: "## Not done yet (before merge)\n\n- [ ] ⏳ case 2: needs the dev env\n" }));
  const r = cli(...base.map((a) => (a === prFile ? box : a)), "7");
  assert.equal(r.stdout, "HOLD 2: ⏳ case 2: needs the dev env\n");
  assert.equal(r.status, 1);
}

{
  // bad arguments → usage on stderr, exit 2, nothing on stdout
  for (const argv of [[], ["7"], ["--state", stateFile], ["--state", stateFile, "x"], ["--state", stateFile, "0"], ["--state", stateFile, "7", "8"], ["--state"]]) {
    const r = cli(...argv);
    assert.equal(r.status, 2, argv.join(" "));
    assert.match(r.stderr, /^usage: merge-gate\.mjs/);
    assert.equal(r.stdout, "");
  }
}

{
  // anything unreadable → non-zero, never a MERGE: a missing state, profile or PR file, bad JSON, the wrong PR number
  const bad = put("bad.json", "{ nope");
  const swap = (from, to) => base.map((a) => (a === from ? to : a));
  for (const argv of [
    swap(stateFile, join(dir, "missing.json")),
    swap(stateFile, bad),
    swap(profileFile, join(dir, "missing.md")),
    swap(prFile, join(dir, "missing.json")),
    swap(prFile, bad),
    swap("2026-10-21T10:01:00Z", "not a date"),
  ]) {
    const r = cli(...argv, "7");
    assert.equal(r.status, 3);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^merge-gate: /);
  }
  const wrongPr = cli(...base, "8");
  assert.equal(wrongPr.status, 3);
  assert.match(wrongPr.stderr, /PR JSON is for #7, not #8/);
  const notArray = put("notarray.json", { verified: {} });
  assert.equal(cli(...swap(stateFile, notArray), "7").status, 3);
}

{
  // the default patch-id: the stable patch-id of the diff against the merge-base with origin/<base>, without the
  // profile's resolve-yourself files (a local repo, no network)
  const git = (cwd, ...argv) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...argv], { cwd, encoding: "utf8" });
  const origin = join(dir, "origin.git");
  const work = join(dir, "work");
  git(dir, "init", "-q", "--bare", "-b", "main", origin);
  git(dir, "clone", "-q", origin, work);
  git(work, "checkout", "-q", "-b", "main");
  writeFileSync(join(work, "a.txt"), "one\ntwo\nthree\n");
  writeFileSync(join(work, "PLAN.md"), "plan\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-q", "-b", "agent/M2-x");
  writeFileSync(join(work, "a.txt"), "one\ntwo changed\nthree\n");
  git(work, "commit", "-q", "-am", "code");
  const withPlan = () => {
    writeFileSync(join(work, "PLAN.md"), "plan\ntick\n");
    git(work, "commit", "-q", "-am", "plan");
    return git(work, "rev-parse", "HEAD").trim();
  };
  const head1 = git(work, "rev-parse", "HEAD").trim();
  const expected = (head, excludes) =>
    execFileSync("git", ["patch-id", "--stable"], {
      input: git(work, "diff", git(work, "merge-base", "origin/main", head).trim(), head, "--", ".", ...excludes),
      encoding: "utf8",
    }).split(/\s+/)[0];
  const head2 = withPlan();
  const id = expected(head1, [":(exclude)PLAN.md"]);
  assert.match(id, /^[0-9a-f]{40}$/);
  assert.equal(expected(head2, [":(exclude)PLAN.md"]), id, "a PLAN.md-only commit keeps the patch-id");
  assert.notEqual(expected(head2, []), id, "...but the whole diff would not");

  const gateAt = (head, fileName) => {
    const state = put(`${fileName}-state.json`, { verified: [verdict({ patchId: id })] });
    const prJson = put(`${fileName}-pr.json`, pr({ headRefOid: head }));
    return spawnSync(process.execPath, [script, "--state", state, "--profile", profileFile, "--pr-json", prJson, "--base-changed-at", "2026-10-21T10:01:00Z", "7"], { cwd: work, encoding: "utf8" });
  };
  const same = gateAt(head2, "same");
  assert.equal(same.stdout, "MERGE\n", same.stderr);
  assert.equal(same.status, 0);
  // a code change makes the verdict stale
  writeFileSync(join(work, "a.txt"), "one\ntwo changed again\nthree\n");
  git(work, "commit", "-q", "-am", "more code");
  const stale = gateAt(git(work, "rev-parse", "HEAD").trim(), "stale");
  assert.match(stale.stdout, /^HOLD 1: no verdict at patch /);
  assert.equal(stale.status, 1);
}

console.log("merge-gate: ok");
