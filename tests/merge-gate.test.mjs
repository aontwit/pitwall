// Run: npm test
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
const BODY = "## Summary\n\nx\n\n## Not done yet (before merge)\n\n- [x] done\n\n## Decisions\n\n- [ ] not a gate\n";
const pr = (over = {}) => ({
  number: 7,
  headRefName: "agent/M2-x",
  headRefOid: "abc",
  baseRefName: "main",
  body: BODY,
  files: [{ path: "plugin/skills/pitwall/scripts/a.mjs" }],
  statusCheckRollup: [run("check"), run("doctor-macos")],
  commits: [{ oid: "abc", committedDate: COMMIT }],
  isDraft: false,
  state: "OPEN",
  ...over,
});
const entry = (over = {}) => ({ pr: 7, branch: "agent/M2-x", headSha: "abc", patchId: PATCH, method: "verifier", verifier: "x", item: "verdict", level: "A", evidence: "VERIFIED", at: "2026-10-21", ...over });
const verdict = (over = {}) => entry(over);
const park = (over = {}) => entry({ item: "always-park", evidence: "none", ...over });
const opts = (over = {}) => ({ verified: [park(), verdict()], patchId: PATCH, ...over });
const withBody = (body, extra = {}) => judge(pr({ body }), opts(extra));
const files = (...paths) => pr({ files: paths.map((path) => ({ path })) });

{
  // VERIFIED at this patch-id + Always park answer `none` + no open box + green CI on the current head → MERGE
  const r = judge(pr(), opts());
  assert.deepEqual(r, { merge: true });
  assert.equal(format(r), "MERGE");
}

{
  // Gate 1: FAIL holds and says which · PARTIAL with a box still open is plain, with no re-verify hint
  assert.match(format(judge(pr(), opts({ verified: [park(), verdict({ evidence: "FAIL" })] }))), /^HOLD 1: verdict FAIL at patch /);
  const open = "## Not done yet (before merge)\n\n- [ ] ⏳ case 1: x\n";
  const partial = withBody(open, { verified: [park(), verdict({ evidence: "PARTIAL" })] });
  assert.equal(partial.gate, "1");
  assert.equal(format(partial), `HOLD 1: verdict PARTIAL at patch ${PATCH.slice(0, 12)}`);
}

{
  // Gate 1: PARTIAL, a "Not done yet" section and no box left → the re-verify line (the signal for M3)
  const r = judge(pr(), opts({ verified: [park(), verdict({ evidence: "PARTIAL" })] }));
  assert.equal(format(r), `HOLD 1: re-verify — verdict PARTIAL at patch ${PATCH.slice(0, 12)}, no box left`);
  // no section at all is not "no box left": plain PARTIAL
  const noSection = withBody("no sections", { verified: [park(), verdict({ evidence: "PARTIAL" })] });
  assert.equal(format(noSection), `HOLD 1: verdict PARTIAL at patch ${PATCH.slice(0, 12)}`);
  // FAIL never asks for a re-verify, and gate 1 never accepts PARTIAL
  assert.doesNotMatch(format(judge(pr(), opts({ verified: [park(), verdict({ evidence: "FAIL" })] }))), /re-verify/);
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ evidence: "PARTIAL" })] })).merge, false);
}

{
  // Gate 1: a verdict at an older patch-id is stale; no verdict at all and no state entries hold too
  const stale = judge(pr(), opts({ verified: [park(), verdict({ patchId: "0000000000000000" })] }));
  assert.equal(format(stale), `HOLD 1: no verdict at patch ${PATCH.slice(0, 12)}`);
  assert.equal(judge(pr(), opts({ verified: [park()] })).gate, "1");
  // an entry that is not a verdict (a pair-run item) is no verdict
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ item: "wallet popup" })] })).gate, "1");
  // a verdict of another PR is no verdict · a set `pr` is not overruled by a matching branch
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ pr: 8, branch: "agent/other" })] })).gate, "1");
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ pr: 8 })] })).gate, "1");
}

{
  // Gate 1: only the independent verifier counts · a writer or pair-run verdict is ignored
  for (const method of ["writer", "pair run", undefined]) {
    const r = judge(pr(), opts({ verified: [park(), verdict({ method })] }));
    assert.equal(format(r), `HOLD 1: no verdict at patch ${PATCH.slice(0, 12)}`, String(method));
  }
  // ...also when it comes after the verifier's VERIFIED, or says FAIL
  assert.equal(judge(pr(), opts({ verified: [park(), verdict(), verdict({ method: "writer", evidence: "FAIL" })] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ method: "writer" }), verdict({ evidence: "PARTIAL" })] })).gate, "1");
}

{
  // Gate 1: the latest verdict at this patch-id wins, in array order, either way round
  assert.equal(judge(pr(), opts({ verified: [park(), verdict({ evidence: "FAIL" }), verdict()] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [park(), verdict(), verdict({ evidence: "PARTIAL" })] })).gate, "1");
  assert.equal(judge(pr(), opts({ verified: [park(), verdict(), verdict({ evidence: "FAIL" })] })).gate, "1");
}

{
  // Gate 1 and the Always park entry: matched by branch when `pr` is null (recorded before `gh pr create`)
  assert.equal(judge(pr(), opts({ verified: [park({ pr: null }), verdict({ pr: null })] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [park({ pr: null }), verdict({ pr: null, branch: "agent/other" })] })).gate, "1");
  assert.equal(judge(pr(), opts({ verified: [park({ pr: null, branch: "agent/other" }), verdict()] })).gate, "always-human");
}

{
  // Owner answer, Always park: no verifier entry → hold, with the patch-id · the entry's evidence must be `none`
  const none = judge(pr(), opts({ verified: [verdict()] }));
  assert.equal(none.gate, "always-human");
  assert.equal(format(none), `HOLD always-human: no Always park check by the verifier at patch ${PATCH.slice(0, 12)}`);
  assert.equal(judge(pr(), { patchId: PATCH }).gate, "always-human", "verified defaults to empty");
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: "none" }), verdict()] })).merge, true);
  // any other evidence holds and is quoted
  assert.equal(format(judge(pr(), opts({ verified: [park({ evidence: "payment" }), verdict()] }))), "HOLD always-human: payment");
  assert.equal(format(judge(pr(), opts({ verified: [park({ evidence: "deletes user data (src/a.ts)" }), verdict()] }))), "HOLD always-human: deletes user data (src/a.ts)");
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: "None " }), verdict()] })).gate, "always-human", "exact `none` only");
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: "" }), verdict()] })).gate, "always-human");
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: undefined }), verdict()] })).gate, "always-human");
}

{
  // Always park: an entry by another method does not count · neither does one at another patch-id or for another PR
  for (const method of ["writer", "pair run", undefined]) {
    assert.equal(judge(pr(), opts({ verified: [park({ method }), verdict()] })).gate, "always-human", String(method));
  }
  assert.equal(judge(pr(), opts({ verified: [park({ patchId: "0000000000000000" }), verdict()] })).gate, "always-human");
  assert.equal(judge(pr(), opts({ verified: [park({ pr: 8, branch: "agent/other" }), verdict()] })).gate, "always-human");
  // the latest verifier entry wins, either way round · a writer entry after it changes nothing
  assert.equal(judge(pr(), opts({ verified: [park(), park({ evidence: "payment" }), verdict()] })).gate, "always-human");
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: "payment" }), park(), verdict()] })).merge, true);
  assert.equal(judge(pr(), opts({ verified: [park(), park({ method: "writer", evidence: "payment" }), verdict()] })).merge, true);
  // it is read before gate 1: a PR the verifier flagged holds as always-human even with no verdict yet
  assert.equal(judge(pr(), opts({ verified: [park({ evidence: "payment" })] })).gate, "always-human");
  assert.equal(judge(pr(), opts({ verified: [park()] })).gate, "1");
  // the body marker of the first version is gone: a line `Always human:` changes nothing
  assert.equal(withBody(`${BODY}\nAlways human: touches the payment fee\n`).merge, true);
}

{
  // Gate 2: one `- [ ]` in "Not done yet" holds and quotes the box
  const body = "## Not done yet (before merge)\n\n- [x] ✅ local\n- [ ] ⏳ case 1: a human clicks the wallet popup, then confirms the payment on the second screen of the flow\n";
  const r = withBody(body);
  assert.equal(r.gate, "2");
  assert.match(r.reason, /^⏳ case 1: a human clicks the wallet popup/);
  assert.ok(r.reason.length <= 83, "trimmed to about 80 characters");
  assert.match(format(r), /^HOLD 2: /);
}

{
  // Gate 2: a ticked box does not hold · a `- [ ]` in another section does not hold
  assert.equal(withBody("## Not done yet (before merge)\n\n- [x] done\n- [X] done\n").merge, true);
  assert.equal(withBody("## Decisions\n\n- [ ] confirm\n\n## Not done yet\n\n- [x] ok\n\n## Notes\n\n- [ ] later\n").merge, true);
  // an empty "Not done yet" section is a section with no box
  assert.equal(withBody("## Not done yet (before merge)\n\nnone\n").merge, true);
  // CRLF bodies read the same
  assert.equal(withBody("## Not done yet\r\n\r\n- [ ] x\r\n").gate, "2");
}

{
  // Gate 2: no "Not done yet" section holds (a body with no sections, an empty body, a box outside any section)
  assert.equal(format(withBody("no sections\n- [ ] x")), "HOLD 2: no Not done yet section");
  assert.equal(format(withBody("")), "HOLD 2: no Not done yet section");
  assert.equal(format(withBody("## Summary\n\nx\n\n## Verify\n\n| a | b |\n")), "HOLD 2: no Not done yet section");
  // a heading that only starts like it is not it
  assert.equal(withBody("## Not done yetish\n\n- [x] a\n").gate, "2");
}

{
  // Gate 2: the heading may be lowercase, at any level, and indented · the box may use `+`, `*`, `1.`, `1)` and indent
  for (const heading of ["## not done yet", "# Not Done Yet (before merge)", "### Not done yet", "###### NOT DONE YET", "   ## Not done yet"]) {
    assert.equal(withBody(`${heading}\n\n- [ ] x\n`).gate, "2", heading);
    assert.equal(withBody(`${heading}\n\n- [x] x\n`).merge, true, heading);
  }
  for (const box of ["+ [ ] x", "* [ ] x", "1. [ ] x", "12) [ ] x", "  - [ ] x", "\t- [ ] x"]) {
    assert.equal(withBody(`## Not done yet\n\n${box}\n`).gate, "2", box);
  }
  assert.equal(format(withBody("## Not done yet\n\n+ [ ] ⏳ case 2: dev env\n")), "HOLD 2: ⏳ case 2: dev env");
  assert.equal(withBody("## Not done yet\n\n-[ ] x\n\n[ ] y\n").merge, true, "not a list item, not a box");
}

{
  // Gate 2: the section runs to the next heading of the same or a higher level, a deeper one stays inside it, and a `#`
  // line inside a code fence is not a heading
  assert.equal(withBody("## Not done yet\n\n### Level C\n\n- [ ] x\n").gate, "2", "a ### inside it is part of it");
  assert.equal(withBody("### Not done yet\n\n- [x] a\n\n### Notes\n\n- [ ] later\n").merge, true);
  assert.equal(withBody("### Not done yet\n\n- [x] a\n\n## Notes\n\n- [ ] later\n").merge, true);
  assert.equal(withBody("## Not done yet\n\n```bash\n# a comment\n```\n\n- [ ] x\n").gate, "2", "a fenced # line does not end it");
  // two sections of that name are both read
  assert.equal(withBody("## Not done yet\n\n- [x] a\n\n## Notes\n\nx\n\n## Not done yet\n\n- [ ] b\n").gate, "2");
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
  // Gate 3: NEUTRAL and SKIPPED do not hold next to a SUCCESS · but a set with no SUCCESS holds
  const ok = pr({ statusCheckRollup: [run("a"), run("b", undefined, { conclusion: "NEUTRAL" }), run("c", undefined, { conclusion: "SKIPPED" })] });
  assert.equal(judge(ok, opts()).merge, true);
  const skipped = pr({ statusCheckRollup: [run("a", undefined, { conclusion: "SKIPPED" }), run("b", undefined, { conclusion: "SKIPPED" })] });
  assert.equal(format(judge(skipped, opts())), "HOLD 3: no successful check");
  const neutral = pr({ statusCheckRollup: [run("a", undefined, { conclusion: "NEUTRAL" }), run("b", undefined, { conclusion: "SKIPPED" })] });
  assert.equal(format(judge(neutral, opts())), "HOLD 3: no successful check");
  // an ignored check does not count as the success
  assert.equal(format(judge(pr({ statusCheckRollup: [run("lint"), run("b", undefined, { conclusion: "SKIPPED" })] }), opts({ ignoredChecks: ["lint"] }))), "HOLD 3: no successful check");
  // a failing check is still reported first
  assert.equal(format(judge(pr({ statusCheckRollup: [run("a", undefined, { conclusion: "SKIPPED" }), run("b", undefined, { conclusion: "FAILURE" })] }), opts())), "HOLD 3: b failing");
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
  assert.equal(judge(pr({ statusCheckRollup: [ctx("SUCCESS")] }), opts()).merge, true, "a lone successful status counts as the success");
}

{
  // Gate 3: no checks (or none after ignoring) → HOLD 3: no CI checks · a check with no start time cannot be placed
  assert.equal(format(judge(pr({ statusCheckRollup: [] }), opts())), "HOLD 3: no CI checks");
  assert.equal(format(judge(pr({ statusCheckRollup: [run("check")] }), opts({ ignoredChecks: ["check"] }))), "HOLD 3: no CI checks");
  assert.match(format(judge(pr({ statusCheckRollup: [run("check", undefined, { startedAt: "" })] }), opts())), /^HOLD 3: check has no start time/);
}

{
  // PR state: a draft, a closed or a merged PR holds with the gate `pr`, before every other gate
  assert.equal(format(judge(pr({ isDraft: true }), opts())), "HOLD pr: draft");
  assert.equal(format(judge(pr({ state: "CLOSED" }), opts())), "HOLD pr: state CLOSED");
  assert.equal(format(judge(pr({ state: "MERGED" }), opts())), "HOLD pr: state MERGED");
  assert.equal(judge(pr({ isDraft: true, files: [{ path: ".github/workflows/ci.yml" }] }), opts({ verified: [] })).gate, "pr");
}

{
  // Always human: a change under .github/ holds even with every gate passed, and comes first
  const r = judge(pr({ files: [{ path: "README.md" }, { path: ".github/workflows/ci.yml" }] }), opts());
  assert.equal(r.gate, "always-human");
  assert.match(format(r), /^HOLD always-human: .*\.github\/workflows\/ci\.yml/);
  assert.equal(judge(pr({ files: [{ path: ".github/workflows/ci.yml" }] }), opts({ verified: [] })).gate, "always-human", "before gate 1");
  assert.equal(judge(pr({ files: [{ path: ".github\\workflows\\ci.yml" }] }), opts()).gate, "always-human", "backslash paths too");
  // the whole folder: actions, CODEOWNERS, templates
  for (const path of [".github/actions/x.yml", ".github/actions/setup/action.yml", ".github/CODEOWNERS", ".github/ISSUE_TEMPLATE/a.md", "sub/.github/workflows/b.yml"]) {
    assert.equal(judge(files(path), opts()).gate, "always-human", path);
  }
  assert.equal(judge(files("docs/github/a.md", "README.github.md"), opts()).merge, true, "only a folder named .github");
}

{
  // Always human: hooks, hook managers, package.json, Makefile, CODEOWNERS, lint / tsc configs (any folder, any case)
  for (const path of [
    ".githooks/pre-push",
    ".husky/pre-commit",
    "lefthook.yml",
    "lefthook-local.yml",
    ".pre-commit-config.yaml",
    "package.json",
    "site/package.json",
    "Makefile",
    "tools/makefile",
    "CODEOWNERS",
    "docs/CODEOWNERS",
    "eslint.config.js",
    ".eslintrc.cjs",
    "web/tsconfig.json",
    "tsconfig.base.json",
    ".rubocop.yml",
  ]) {
    const r = judge(files(path), opts());
    assert.equal(r.gate, "always-human", path);
    assert.ok(r.reason.startsWith(path), r.reason);
  }
  assert.equal(judge(files("src/package.js", "src/make.ts", "docs/tsconfig-notes", "src/lefthooks.md"), opts()).gate, "always-human", "a name prefix is enough (over-holding is fine)");
  assert.equal(judge(files("src/package.js", "src/make.ts", "src/pre-push.ts"), opts()).merge, true);
}

{
  // Always human: a path containing `baseline`, anywhere in the lowercased path, not only the name
  assert.match(format(judge(files("lint/eslint-baseline.json"), opts())), /^HOLD always-human: lint\/eslint-baseline\.json/);
  assert.equal(judge(files("docs/BASELINE.md"), opts()).gate, "always-human", "case-insensitive");
  assert.equal(judge(files("lint-baselines/a.json"), opts()).gate, "always-human", "a folder name");
  assert.equal(judge(files("Baselines/x/a.txt"), opts()).gate, "always-human");
  assert.equal(judge(files("base/line.md"), opts()).merge, true);
}

{
  // Always human: a profile-named path (a file, a folder, or `**/name` in any folder) · a path that only looks like one
  const named = opts({ alwaysHumanPaths: ["scripts/check-english.sh", ".claude/agent-loop.md", "ci", "**/pytest.ini", "./tools\\gate.mjs"] });
  assert.match(format(judge(files("scripts/check-english.sh"), named)), /^HOLD always-human: scripts\/check-english\.sh/);
  assert.equal(judge(files(".claude/agent-loop.md"), named).gate, "always-human");
  assert.equal(judge(files(".CLAUDE/Agent-Loop.md"), named).gate, "always-human", "case-insensitive");
  assert.equal(judge(files("ci/deep/x.yml"), named).gate, "always-human", "a listed folder holds its files");
  assert.equal(judge(files("api/pytest.ini"), named).gate, "always-human", "`**/` = any folder");
  assert.equal(judge(files("pytest.ini"), named).gate, "always-human");
  assert.equal(judge(files("tools/gate.mjs"), named).gate, "always-human", "a profile path is normalised too");
  assert.equal(judge(files("scripts/check-english.shx", "cinema/a.md", "my-pytest.ini", "x/pytest.ini.bak"), named).merge, true);
}

{
  // A judge call that cannot check something throws: no patch-id, no commit dates, a bad date
  assert.throws(() => judge(pr(), { verified: [park(), verdict()] }), /patch-id/);
  assert.throws(() => judge(pr({ commits: [] }), opts()), /commit dates/);
  assert.throws(() => judge(pr({ commits: [{ oid: "1" }] }), opts()), /commit dates/);
  assert.throws(() => judge(pr(), opts({ baseChangedAt: "not a date" })), /base-changed-at/);
  assert.throws(() => judge(pr(), opts({ verified: {} })), /not an array/);
}

{
  // Missing keys are not "empty": `files`, `body`, `statusCheckRollup` and `commits` must be there, `files` of paths
  for (const key of ["files", "statusCheckRollup", "commits"]) {
    for (const value of [undefined, null, {}, "x"]) {
      assert.throws(() => judge(pr({ [key]: value }), opts()), new RegExp(`\`${key}\``), `${key}=${JSON.stringify(value)}`);
    }
  }
  for (const value of [undefined, null, [], 3]) assert.throws(() => judge(pr({ body: value }), opts()), /`body`/);
  assert.throws(() => judge(pr({ files: [{}] }), opts()), /no path/);
  assert.throws(() => judge(pr({ files: [null] }), opts()), /no path/);
  assert.throws(() => judge(pr({ isDraft: undefined }), opts()), /isDraft/);
  assert.throws(() => judge(pr({ state: undefined }), opts()), /state/);
  assert.equal(judge(pr({ files: [] }), opts()).merge, true, "an empty list is a list");
  assert.equal(judge(pr({ body: "" }), opts()).gate, "2", "an empty body is a body");
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
  // the code block: its script files, and the config of each runner it starts · not globs, flags, packages, folders,
  // comments or prose
  assert.deepEqual(profileCheckFiles(PROFILE), [
    "**/package.json",
    "site/package.json",
    "scripts/check-english.sh",
    "scripts/check-commit-msg.sh",
    "tools/gate.mjs",
  ]);
  assert.deepEqual(profileCheckFiles("## repo\n\nx\n"), []);
  // `npm test` → package.json (a profile check path that holds a PR changing it, in any folder)
  const npmOnly = "## checks\n\n```\nnpm test\n```\n";
  assert.deepEqual(profileCheckFiles(npmOnly), ["**/package.json"]);
  assert.equal(judge(files("api/package.json"), opts({ alwaysHumanPaths: profileCheckFiles(npmOnly) })).gate, "always-human");
}

{
  // Runners: pnpm / yarn / bun, `--prefix <dir>` and `--prefix=<dir>`, make, pytest, cargo · quotes and `;` `&&` `||` dropped
  const code = (...lines) => `## checks (level A)\n\n\`\`\`sh\n${lines.join("\n")}\n\`\`\`\n`;
  assert.deepEqual(profileCheckFiles(code("pnpm lint", "yarn run x", "bun run x")), ["**/package.json"]);
  assert.deepEqual(profileCheckFiles(code("npm run build --prefix=web/app")), ["**/package.json", "web/app/package.json"]);
  assert.deepEqual(profileCheckFiles(code("make test")), ["**/Makefile"]);
  assert.deepEqual(profileCheckFiles(code("python -m pytest -q")), ["**/pytest.ini", "**/pyproject.toml", "**/setup.cfg", "**/conftest.py"]);
  assert.deepEqual(profileCheckFiles(code("cargo test --all")), ["**/Cargo.toml"]);
  assert.deepEqual(profileCheckFiles(code('bash -c "npm ci && make all; cargo build || true"')), ["**/package.json", "**/Makefile", "**/Cargo.toml"]);
  assert.deepEqual(profileCheckFiles(code("bash 'scripts/a.sh'; bash \"scripts/b.sh\"&&bash scripts/c.sh||bash ./scripts/d.sh")), ["scripts/a.sh", "scripts/b.sh", "scripts/c.sh", "scripts/d.sh"]);
  assert.deepEqual(profileCheckFiles(code("# npm test is only a comment", "echo hi # make")), []);
  assert.equal(judge(files("api/conftest.py"), opts({ alwaysHumanPaths: profileCheckFiles(code("pytest")) })).gate, "always-human");
  assert.equal(judge(files("Cargo.toml"), opts({ alwaysHumanPaths: profileCheckFiles(code("cargo test")) })).gate, "always-human");
  assert.equal(judge(files("src/lib.rs"), opts({ alwaysHumanPaths: profileCheckFiles(code("cargo test")) })).merge, true);
}

// ---- CLI: a local git repo, no network ----

const dir = mkdtempSync(join(tmpdir(), "merge-gate-"));
const put = (name, value) => {
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
};

// origin + a work repo (the origin has the base, so `origin/main` exists): branch agent/M2-x changes a.txt and PLAN.md,
// agent/rename moves a CI workflow out of `.github/`, agent/baseline adds a baseline file
const git = (cwd, ...argv) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...argv], { cwd, encoding: "utf8" });
const origin = join(dir, "origin.git");
const work = join(dir, "work");
git(dir, "init", "-q", "--bare", "-b", "main", origin);
git(dir, "init", "-q", "-b", "main", work);
git(work, "remote", "add", "origin", origin);
mkdirSync(join(work, ".github", "workflows"), { recursive: true });
writeFileSync(join(work, "a.txt"), "one\ntwo\nthree\n");
writeFileSync(join(work, "PLAN.md"), "plan\n");
writeFileSync(join(work, ".github", "workflows", "ci.yml"), "name: ci\n");
git(work, "add", "-A");
git(work, "commit", "-q", "-m", "base");
git(work, "push", "-q", "origin", "main");
const sha = (ref) => git(work, "rev-parse", ref).trim();

git(work, "checkout", "-q", "-b", "agent/rename");
mkdirSync(join(work, "docs"));
git(work, "mv", ".github/workflows/ci.yml", "docs/ci.yml");
git(work, "commit", "-q", "-m", "move");
const headRename = sha("HEAD");

git(work, "checkout", "-q", "-b", "agent/baseline", "main");
mkdirSync(join(work, "lint-baselines"));
writeFileSync(join(work, "lint-baselines", "a.json"), "{}\n");
git(work, "add", "-A");
git(work, "commit", "-q", "-m", "baseline");
const headBaseline = sha("HEAD");

git(work, "checkout", "-q", "-b", "agent/M2-x", "main");
writeFileSync(join(work, "a.txt"), "one\ntwo changed\nthree\n");
git(work, "commit", "-q", "-am", "code");
const head1 = sha("HEAD");
writeFileSync(join(work, "PLAN.md"), "plan\ntick\n");
git(work, "commit", "-q", "-am", "plan");
const head2 = sha("HEAD");

const cli = (...argv) => spawnSync(process.execPath, [script, ...argv], { cwd: work, encoding: "utf8" });
const profileFile = put("agent-loop.md", PROFILE);
const stateFile = put("state.json", { verified: [park(), verdict()] });
const prAt = (head, over = {}) => pr({ headRefOid: head, ...over });
const prFile = put("pr.json", prAt(head2));
const base = ["--state", stateFile, "--profile", profileFile, "--pr-json", prFile, "--patch-id", PATCH, "--base-changed-at", "2026-10-21T10:01:00Z"];
const swap = (from, to) => base.map((a) => (a === from ? to : a));
const withPr = (value, name) => swap(prFile, put(name, value));

{
  // VERIFIED + Always park `none` + no boxes + green → `MERGE`, exit 0
  const r = cli(...base, "7");
  assert.equal(r.stdout, "MERGE\n");
  assert.equal(r.status, 0, r.stderr);
}

{
  // a failing check holds, exit 1 · a check the profile ignores does not
  const r = cli(...withPr(prAt(head2, { statusCheckRollup: [run("check"), run("build", undefined, { conclusion: "FAILURE" })] }), "failing.json"), "7");
  assert.equal(r.stdout, "HOLD 3: build failing\n");
  assert.equal(r.status, 1);
  const ignored = prAt(head2, { statusCheckRollup: [run("check"), run("lint", undefined, { conclusion: "FAILURE" })] });
  assert.equal(cli(...withPr(ignored, "ignored.json"), "7").stdout, "MERGE\n", "`lint` is in the profile's ignored checks");
  assert.equal(cli(...withPr(prAt(head2, { statusCheckRollup: [run("a", undefined, { conclusion: "SKIPPED" })] }), "skipped.json"), "7").stdout, "HOLD 3: no successful check\n");
}

{
  // a stale patch-id → HOLD 1 · a retarget after the check started → HOLD 3
  const r = cli(...swap(PATCH, "ffffffffffffffffffff"), "7");
  assert.equal(r.stdout, "HOLD always-human: no Always park check by the verifier at patch ffffffffffff\n");
  assert.equal(r.status, 1);
  const stale = put("state-stale.json", { verified: [park({ patchId: "ffffffffffffffffffff" }), verdict({ patchId: "0" })] });
  const r1 = cli(...swap(stateFile, stale).map((a) => (a === PATCH ? "ffffffffffffffffffff" : a)), "7");
  assert.equal(r1.stdout, "HOLD 1: no verdict at patch ffffffffffff\n");
  assert.equal(r1.status, 1);
  const late = cli(...swap("2026-10-21T10:01:00Z", "2026-10-21T11:00:00Z"), "7");
  assert.equal(late.stdout, "HOLD 3: check ran before the retarget\n");
  assert.equal(late.status, 1);
}

{
  // the owner answer through the CLI: no entry, evidence `payment`, an entry by `writer`
  const state = (verified) => swap(stateFile, put("state-park.json", { verified }));
  assert.match(cli(...state([verdict()]), "7").stdout, /^HOLD always-human: no Always park check by the verifier at patch /);
  const payment = cli(...state([park({ evidence: "payment" }), verdict()]), "7");
  assert.equal(payment.stdout, "HOLD always-human: payment\n");
  assert.equal(payment.status, 1);
  assert.match(cli(...state([park({ method: "writer" }), verdict()]), "7").stdout, /^HOLD always-human: no Always park check/);
  // a state with no `verified` key = no entries
  assert.match(cli(...swap(stateFile, put("state-empty.json", {})), "7").stdout, /^HOLD always-human: no Always park check/);
}

{
  // the profile adds always-human paths: its own file and the scripts of its checks block (the PR JSON lists them; git does not)
  const ours = cli(...withPr(prAt(head2, { files: [{ path: "scripts/check-english.sh" }] }), "ours.json"), "7");
  assert.match(ours.stdout, /^HOLD always-human: scripts\/check-english\.sh/);
  assert.equal(ours.status, 1);
  assert.match(cli(...withPr(prAt(head2, { files: [{ path: ".claude/agent-loop.md" }] }), "edit.json"), "7").stdout, /^HOLD always-human: \.claude\/agent-loop\.md/);
  assert.match(cli(...withPr(prAt(head2, { files: [{ path: ".github/workflows/ci.yml" }] }), "wf.json"), "7").stdout, /^HOLD always-human: /);
  assert.match(cli(...withPr(prAt(head2, { files: [{ path: "api/package.json" }] }), "pkg.json"), "7").stdout, /^HOLD always-human: api\/package\.json/);
}

{
  // the changed files come from git, not only from the PR JSON: an empty `files` list does not hide a baseline file,
  // and a rename shows its old path (gh lists the new one only)
  const baseline = cli(...withPr(prAt(headBaseline, { files: [] }), "baseline.json"), "7");
  assert.equal(baseline.stdout, "HOLD always-human: lint-baselines/a.json is a baseline file\n");
  assert.equal(baseline.status, 1);
  const renamed = cli(...withPr(prAt(headRename, { files: [{ path: "docs/ci.yml" }] }), "rename.json"), "7");
  assert.equal(renamed.stdout, "HOLD always-human: .github/workflows/ci.yml is CI, hook or repo-owner config\n");
  assert.equal(renamed.status, 1);
}

{
  // a body with an open box → HOLD 2 · no such section → HOLD 2 · a draft → HOLD pr
  const box = cli(...withPr(prAt(head2, { body: "## Not done yet (before merge)\n\n- [ ] ⏳ case 2: needs the dev env\n" }), "box.json"), "7");
  assert.equal(box.stdout, "HOLD 2: ⏳ case 2: needs the dev env\n");
  assert.equal(box.status, 1);
  assert.equal(cli(...withPr(prAt(head2, { body: "x" }), "nosection.json"), "7").stdout, "HOLD 2: no Not done yet section\n");
  const draft = cli(...withPr(prAt(head2, { isDraft: true }), "draft.json"), "7");
  assert.equal(draft.stdout, "HOLD pr: draft\n");
  assert.equal(draft.status, 1);
  assert.equal(cli(...withPr(prAt(head2, { state: "CLOSED" }), "closed.json"), "7").stdout, "HOLD pr: state CLOSED\n");
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
  // anything unreadable → non-zero, never a MERGE: a missing state, profile or PR file, bad JSON, the wrong PR number,
  // a PR JSON with a missing key, a head git does not know, no origin/<base>
  const bad = put("bad.json", "{ nope");
  const cases = [
    swap(stateFile, join(dir, "missing.json")),
    swap(stateFile, bad),
    swap(profileFile, join(dir, "missing.md")),
    swap(prFile, join(dir, "missing.json")),
    swap(prFile, bad),
    swap("2026-10-21T10:01:00Z", "not a date"),
    swap(stateFile, put("notarray.json", { verified: {} })),
    withPr(prAt("0000000000000000000000000000000000000000"), "nohead.json"),
    withPr(prAt(head2, { baseRefName: "nobranch" }), "nobase.json"),
  ];
  for (const key of ["files", "body", "statusCheckRollup", "commits", "isDraft", "state"]) {
    const { [key]: _gone, ...rest } = prAt(head2);
    cases.push(withPr(rest, `no-${key}.json`));
  }
  cases.push(withPr(prAt(head2, { files: [{}] }), "nopath.json"));
  for (const argv of cases) {
    const r = cli(...argv, "7");
    assert.equal(r.status, 3, argv.join(" "));
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^merge-gate: /);
  }
  const wrongPr = cli(...base, "8");
  assert.equal(wrongPr.status, 3);
  assert.match(wrongPr.stderr, /PR JSON is for #7, not #8/);
  const noFiles = cli(...withPr({ ...prAt(head2), files: undefined }, "files-undefined.json"), "7");
  assert.match(noFiles.stderr, /`files`/);
}

{
  // the default patch-id: the stable patch-id of the diff against the merge-base with origin/<base>, without the
  // profile's resolve-yourself files
  const expected = (head, excludes) =>
    execFileSync("git", ["patch-id", "--stable"], {
      input: git(work, "diff", git(work, "merge-base", "origin/main", head).trim(), head, "--", ".", ...excludes),
      encoding: "utf8",
    }).split(/\s+/)[0];
  const id = expected(head1, [":(exclude)PLAN.md"]);
  assert.match(id, /^[0-9a-f]{40}$/);
  assert.equal(expected(head2, [":(exclude)PLAN.md"]), id, "a PLAN.md-only commit keeps the patch-id");
  assert.notEqual(expected(head2, []), id, "...but the whole diff would not");

  const gateAt = (head, fileName) => {
    const state = put(`${fileName}-state.json`, { verified: [park({ patchId: id }), verdict({ patchId: id })] });
    const prJson = put(`${fileName}-pr.json`, prAt(head));
    return cli("--state", state, "--profile", profileFile, "--pr-json", prJson, "--base-changed-at", "2026-10-21T10:01:00Z", "7");
  };
  const same = gateAt(head2, "same");
  assert.equal(same.stdout, "MERGE\n", same.stderr);
  assert.equal(same.status, 0);
  // a code change makes the verdict stale
  writeFileSync(join(work, "a.txt"), "one\ntwo changed again\nthree\n");
  git(work, "commit", "-q", "-am", "more code");
  const stale = gateAt(sha("HEAD"), "stale");
  assert.match(stale.stdout, /^HOLD always-human: no Always park check by the verifier at patch /);
  assert.equal(stale.status, 1);
}

console.log("merge-gate: ok");
