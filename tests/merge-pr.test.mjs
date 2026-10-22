// Run: npm test — merge-pr.mjs with a fake runner in place of gh, git and merge-gate: no network, nothing merged
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { devBranch, mergePr } from "../plugin/skills/pitwall/scripts/merge-pr.mjs";

const script = fileURLToPath(new URL("../plugin/skills/pitwall/scripts/merge-pr.mjs", import.meta.url));
const GATE = "/fake/merge-gate.mjs";
const HEAD = "abc1234def5678abc1234def5678abc1234def56";

const profile = ({ merge = "`merge: auto`", base = "`dev`", dev = "`dev`" } = {}) =>
  [
    "# Agent loop",
    "",
    "## git",
    "",
    "| | |",
    "|---|---|",
    `| base | ${base} — PRs target it |`,
    `| merge | ${merge} |`,
    `| dev branch | ${dev} |`,
    "| hooks | `pre-merge: lefthook` |",
    "",
    "## checks (level A)",
    "",
    "merge: human (prose outside the git section is no value)",
    "",
  ].join("\n");

const ok = (json) => ({ status: 0, stdout: typeof json === "string" ? json : JSON.stringify(json) });
const prView = (over = {}) => ok({ number: 7, baseRefName: "dev", headRefName: "agent/M3-x", headRefOid: HEAD, isDraft: false, state: "OPEN", ...over });
const readBack = (over = {}) => ok({ state: "MERGED", mergedAt: "2026-10-22T10:00:00Z", baseRefName: "dev", ...over });

/** a runner that answers like gh / git / merge-gate and records every call · `pr` = the first view, `after` = the head
 * check after the gate, `back` = the read-back */
const fake = ({ pr = prView(), after = ok({ headRefOid: HEAD, state: "OPEN" }), gate = { status: 0, stdout: "MERGE\n" }, merge = { status: 0 }, back = readBack(), refOk = true } = {}) => {
  const calls = [];
  const run = (cmd, argv) => {
    calls.push([cmd, ...argv]);
    const done = (r) => ({ status: 0, stdout: "", stderr: "", ...r });
    if (cmd === "git" && argv[0] === "check-ref-format") return done({ status: refOk ? 0 : 1 });
    if (cmd === process.execPath && argv[0] === GATE) return done(gate);
    if (cmd === "gh" && argv[0] === "pr" && argv[1] === "view" && argv[4] === "state,mergedAt,baseRefName") return done(back);
    if (cmd === "gh" && argv[0] === "pr" && argv[1] === "view" && argv[4] === "headRefOid,state") return done(after);
    if (cmd === "gh" && argv[0] === "pr" && argv[1] === "view") return done(pr);
    if (cmd === "gh" && argv[0] === "pr" && argv[1] === "merge") return done(merge);
    throw new Error(`unexpected call: ${cmd} ${argv.join(" ")}`);
  };
  return { run, calls };
};
const merges = (calls) => calls.filter((c) => c[0] === "gh" && c[2] === "merge");
const attempt = (over = {}, runner = fake()) => ({
  ...mergePr({ number: 7, profile: profile(), state: { running: true }, stateFile: "/state.json", gate: GATE, run: runner.run, ...over }),
  calls: runner.calls,
});

{
  // every gate passes → exactly `gh pr merge 7 --merge --match-head-commit <head>`, read back MERGED → exit 0
  const r = attempt();
  assert.equal(r.line, "MERGED #7");
  assert.equal(r.code, 0);
  assert.deepEqual(merges(r.calls), [["gh", "pr", "merge", "7", "--merge", "--match-head-commit", HEAD]], "the exact argv passed to gh");
  for (const call of r.calls) {
    for (const flag of ["--admin", "--auto", "--squash", "--rebase", "--delete-branch", "-d"]) assert.ok(!call.includes(flag), `never ${flag}: ${call.join(" ")}`);
  }
  // merge-gate ran right before the merge, on the same state and the profile, and the head was read again after it
  const gateAt = r.calls.findIndex((c) => c[1] === GATE);
  const mergeAt = r.calls.findIndex((c) => c[2] === "merge");
  assert.deepEqual(r.calls[gateAt], [process.execPath, GATE, "--state", "/state.json", "--profile", ".claude/agent-loop.md", "7"]);
  assert.deepEqual(r.calls[gateAt + 1], ["gh", "pr", "view", "7", "--json", "headRefOid,state"]);
  assert.equal(mergeAt, gateAt + 2);
  assert.deepEqual(r.calls.at(-1), ["gh", "pr", "view", "7", "--json", "state,mergedAt,baseRefName"], "gate 5: the PR is read back last");
}

{
  // a PR whose base is not the dev branch is refused, and gh pr merge is never called
  for (const base of ["main", "agent/M2-parent", "release/1.0"]) {
    const r = attempt({}, fake({ pr: prView({ baseRefName: base }) }));
    assert.equal(r.line, `REFUSED: #7 targets \`${base}\`, not the dev branch \`dev\``);
    assert.equal(r.code, 1);
    assert.deepEqual(merges(r.calls), []);
    assert.ok(!r.calls.some((c) => c[1] === GATE), "refused before merge-gate");
  }
}

{
  // the profile: `merge: human`, no merge row, two values, and every dev-branch row doctor fails → refused, no gh call at all
  const cases = [
    [{ merge: "`merge: human`" }, /`merge: human`, not `merge: auto`/],
    [{ merge: "none here" }, /`merge: human`, not `merge: auto`/],
    [{ merge: "`merge: auto` · `merge: human`" }, /2 `merge:` values/],
    [{ dev: "`none`" }, /no dev branch/],
    [{ dev: "dev" }, /no dev branch/],
    [{ dev: "`next`" }, /`next` is not the base `dev`/],
    [{ base: "`main`", dev: "`main`" }, /looks like the main or a release line/],
    [{ base: "`release-2`", dev: "`release-2`" }, /looks like the main or a release line/],
    [{ base: "`dev*`", dev: "`dev*`" }, /glob characters/],
    [{ base: "no backticks", dev: "`dev`" }, /no base/],
    [{ dev: "`{{dev branch}}`" }, /placeholder/],
  ];
  for (const [over, why] of cases) {
    const r = attempt({ profile: profile(over) });
    assert.match(r.line, /^REFUSED: /, JSON.stringify(over));
    assert.match(r.line, why, JSON.stringify(over));
    assert.equal(r.code, 1);
    assert.ok(!r.calls.some((c) => c[0] === "gh"), `no gh call: ${JSON.stringify(over)}`);
  }
  // a name git refuses as a branch
  const badRef = attempt({ profile: profile({ base: "`dev..x`", dev: "`dev..x`" }) }, fake({ refOk: false }));
  assert.match(badRef.line, /^REFUSED: dev branch `dev\.\.x` is not a valid branch name/);
  assert.equal(devBranch(profile(), () => true).dev, "dev");
}

{
  // a draft, a closed or an already merged PR → refused, never merged · no `isDraft` at all → failed, with a clear message
  for (const [over, why] of [[{ isDraft: true }, "#7 is a draft"], [{ state: "CLOSED" }, "#7 is CLOSED"], [{ state: "MERGED" }, "#7 is MERGED"]]) {
    const r = attempt({}, fake({ pr: prView(over) }));
    assert.equal(r.line, `REFUSED: ${why}`);
    assert.equal(r.code, 1);
    assert.deepEqual(merges(r.calls), []);
  }
  const noDraft = attempt({}, fake({ pr: prView({ isDraft: undefined }) }));
  assert.equal(noDraft.line, "FAILED: gh pr view #7 gave no isDraft, cannot tell a draft from a ready PR");
  assert.equal(noDraft.code, 3);
  const noHead = attempt({}, fake({ pr: prView({ headRefOid: undefined }) }));
  assert.equal(noHead.line, "FAILED: gh pr view #7 gave no head commit");
  assert.deepEqual(merges(noHead.calls), []);
}

{
  // gate 6: stop / brake set (any truthy value) → refused before any gh call
  for (const stopRequested of [true, 1, "yes"]) {
    const r = attempt({ state: { running: false, stopRequested } });
    assert.match(r.line, /^REFUSED: stop \/ brake is set/, String(stopRequested));
    assert.equal(r.code, 1);
    assert.ok(!r.calls.some((c) => c[0] === "gh"));
  }
  assert.equal(attempt({ state: { stopRequested: false } }).code, 0);
}

{
  // a PR whose branch a worker holds (state workers[]) → refused before merge-gate
  const r = attempt({ state: { workers: [{ id: "M4", branch: "agent/M4-y" }, { id: "M3", branch: "agent/M3-x" }] } });
  assert.equal(r.line, "REFUSED: #7's branch `agent/M3-x` is held by a worker (state workers[])");
  assert.equal(r.code, 1);
  assert.ok(!r.calls.some((c) => c[1] === GATE));
  assert.equal(attempt({ state: { workers: [{ id: "M4", branch: "agent/M4-y" }] } }).code, 0, "another worker's branch does not block");
}

{
  // merge-gate holds → refused with its line · it cannot judge, or exits 0 without MERGE → failed · never merged
  const held = attempt({}, fake({ gate: { status: 1, stdout: "HOLD 3: check pending\n" } }));
  assert.equal(held.line, "REFUSED: HOLD 3: check pending");
  assert.equal(held.code, 1);
  assert.deepEqual(merges(held.calls), []);
  const broken = attempt({}, fake({ gate: { status: 3, stdout: "", stderr: "merge-gate: no origin/dev" } }));
  assert.equal(broken.line, "FAILED: merge-gate could not judge #7: merge-gate: no origin/dev");
  assert.equal(broken.code, 3);
  assert.deepEqual(merges(broken.calls), []);
  const odd = attempt({}, fake({ gate: { status: 0, stdout: "OK\n" } }));
  assert.equal(odd.line, "FAILED: merge-gate could not judge #7: OK");
  assert.equal(odd.code, 3);
  assert.deepEqual(merges(odd.calls), []);
}

{
  // the head moved between the first view and the end of the gate → refused, never merged
  const moved = attempt({}, fake({ after: ok({ headRefOid: "fff0000fff0000fff0000fff0000fff0000fff00", state: "OPEN" }) }));
  assert.equal(moved.line, "REFUSED: #7's head moved while it was judged (abc1234 → fff0000)");
  assert.equal(moved.code, 1);
  assert.deepEqual(merges(moved.calls), []);
  const unreadable = attempt({}, fake({ after: { status: 1, stdout: "", stderr: "network" } }));
  assert.equal(unreadable.line, "FAILED: gh pr view #7: network");
  assert.deepEqual(merges(unreadable.calls), []);
}

{
  // gate 5: read back not MERGED → FAILED exit 3, with gh's error when the merge command failed
  const open = attempt({}, fake({ back: readBack({ state: "OPEN", mergedAt: null }) }));
  assert.equal(open.line, "FAILED: #7 reads back as OPEN, not MERGED");
  assert.equal(open.code, 3);
  const refused = attempt({}, fake({ merge: { status: 1, stderr: "Pull request is not mergeable" }, back: readBack({ state: "OPEN", mergedAt: null }) }));
  assert.equal(refused.line, "FAILED: #7 reads back as OPEN, not MERGED · gh pr merge: Pull request is not mergeable");
  assert.equal(refused.code, 3);
  const unread = attempt({}, fake({ back: { status: 1, stdout: "", stderr: "network" } }));
  assert.match(unread.line, /^FAILED: #7 could not be read back after the merge/);
  assert.equal(unread.code, 3);
  // merged, but into another branch (the base moved under it) → FAILED, loud
  const elsewhere = attempt({}, fake({ back: readBack({ baseRefName: "main" }) }));
  assert.equal(elsewhere.line, "FAILED: #7 MERGED into `main`, not the dev branch `dev` — a human must look at it now");
  assert.equal(elsewhere.code, 3);
  // the merge command failed but the PR reads back MERGED into the dev branch (a timeout after GitHub merged) → MERGED
  const late = attempt({}, fake({ merge: { status: 1, stderr: "timeout" } }));
  assert.equal(late.line, "MERGED #7");
  assert.equal(late.code, 0);
}

{
  // gh pr view exits non-zero, prints no JSON, or returns another PR → failed before any merge
  const down = attempt({}, fake({ pr: { status: 1, stdout: "", stderr: "HTTP 502" } }));
  assert.equal(down.line, "FAILED: gh pr view #7: HTTP 502");
  assert.equal(down.code, 3);
  assert.ok(!down.calls.some((c) => c[1] === GATE));
  const empty = attempt({}, fake({ pr: ok("") }));
  assert.match(empty.line, /^FAILED: gh pr view #7 printed no JSON/);
  assert.equal(empty.code, 3);
  const other = attempt({}, fake({ pr: prView({ number: 8 }) }));
  assert.match(other.line, /^FAILED: gh pr view returned #8, not #7/);
  assert.deepEqual(merges(other.calls), []);
}

{
  // the code (comments left out) never names `--admin` / `--auto` as an argument, and has one merge call
  const source = readFileSync(script, "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join("\n");
  const banned = /["'`]--(admin|auto|squash|rebase|delete-branch)["'`]/.exec(source);
  assert.equal(banned, null, `merge-pr.mjs passes ${banned?.[0]}`);
  assert.equal([...source.matchAll(/"pr", "merge"/g)].length, 1);
  assert.match(source, /run\("gh", \["pr", "merge", n, "--merge", "--match-head-commit", head\]\)/);
}

{
  // the CLI: bad arguments → usage, exit 2 · `merge: human` → refused before any gh call (none on PATH is needed)
  const dir = mkdtempSync(join(tmpdir(), "merge-pr-"));
  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, ".claude", "agent-loop.md"), profile({ merge: "`merge: human`" }));
  writeFileSync(join(dir, "state.json"), "{}");
  const cli = (...argv) => spawnSync(process.execPath, [script, ...argv], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: "" } });
  for (const argv of [[], ["7"], ["--state", "state.json"], ["--state", "state.json", "x"], ["--state", "state.json", "0"], ["--state", "state.json", "7", "8"], ["7", "--state", "state.json"]]) {
    const r = cli(...argv);
    assert.equal(r.status, 2, argv.join(" "));
    assert.match(r.stderr, /^usage: merge-pr\.mjs/);
    assert.equal(r.stdout, "");
  }
  const human = cli("--state", "state.json", "7");
  assert.equal(human.stdout, "REFUSED: profile says `merge: human`, not `merge: auto`\n");
  assert.equal(human.status, 1);
  const noState = cli("--state", "missing.json", "7");
  assert.match(noState.stdout, /^FAILED: /);
  assert.equal(noState.status, 3);
}

console.log("merge-pr: ok");
