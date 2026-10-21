// Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { overlaps, parseRows, pickBatch } from "../plugin/skills/pitwall/scripts/pick-batch.mjs";

const script = fileURLToPath(new URL("../plugin/skills/pitwall/scripts/pick-batch.mjs", import.meta.url));
const rows = (obj) => new Map(Object.entries(obj).map(([id, files]) => [id, { ticked: false, files }]));
const q = (...ids) => ({ queue: ids.map((id) => ({ id })) });

{
  // Two rows with no shared file are both picked
  const r = pickBatch(q("A", "B"), rows({ A: ["src/a.mjs"], B: ["src/b.mjs"] }), { parallel: 2 });
  assert.deepEqual(r.batch, ["A", "B"]);
  assert.deepEqual(r.skipped, []);
}

{
  // A shared code file: only the first is picked, the second says which file and with whom
  const r = pickBatch(q("A", "B"), rows({ A: ["src/a.mjs", "src/x.mjs"], B: ["src/x.mjs"] }), { parallel: 2 });
  assert.deepEqual(r.batch, ["A"]);
  assert.deepEqual(r.skipped, [{ id: "B", reason: "shares src/x.mjs with A" }]);
}

{
  // A shared CHANGELOG.md on the profile's resolve-yourself list does not count
  const files = { A: ["CHANGELOG.md", "src/a.mjs"], B: ["CHANGELOG.md", "src/b.mjs"] };
  assert.deepEqual(pickBatch(q("A", "B"), rows(files), { parallel: 2, shared: ["CHANGELOG.md"] }).batch, ["A", "B"]);
  assert.deepEqual(pickBatch(q("A", "B"), rows(files), { parallel: 2 }).batch, ["A"], "without the shared list it does");
}

{
  // The cap stops the batch; the rest waits for the next lap
  const r = pickBatch(q("A", "B"), rows({ A: ["a"], B: ["b"] }), { parallel: 1 });
  assert.deepEqual(r.batch, ["A"]);
  assert.deepEqual(r.skipped, [{ id: "B", reason: "batch full (parallel 1)" }]);
  assert.deepEqual(pickBatch(q("A", "B"), rows({ A: ["a"], B: ["b"] })).batch, ["A"], "parallel defaults to 1");
}

{
  // waitFor: not merged → skipped; done.merged true → picked; a ticked row counts as merged too
  const plan = rows({ A: ["a"], B: ["b"], C: ["c"] });
  const state = { queue: [{ id: "A" }, { id: "B", waitFor: ["A"] }], done: [] };
  const open = pickBatch(state, plan, { parallel: 2 });
  assert.deepEqual(open.batch, ["A"]);
  assert.deepEqual(open.skipped, [{ id: "B", reason: "waitFor A not merged" }]);
  const merged = pickBatch({ ...state, done: [{ id: "A", merged: true }], queue: [{ id: "B", waitFor: ["A"] }] }, plan, { parallel: 2 });
  assert.deepEqual(merged.batch, ["B"]);
  const unmerged = pickBatch({ queue: [{ id: "B", waitFor: ["A"] }], done: [{ id: "A", merged: false }] }, plan);
  assert.deepEqual(unmerged.batch, [], "done without merged is not merged");
  const ticked = new Map([...plan, ["A", { ticked: true, files: ["a"] }]]);
  assert.deepEqual(pickBatch({ queue: [{ id: "B", waitFor: ["A"] }] }, ticked).batch, ["B"]);
  const two = pickBatch({ queue: [{ id: "C", waitFor: ["A", "B"] }], done: [{ id: "A", merged: true }] }, plan);
  assert.deepEqual(two.skipped, [{ id: "C", reason: "waitFor B not merged" }]);
}

{
  // blocked / done / parked / ticked / no row / open PR each skip with a reason; repeat gets past done and parked
  const plan = new Map([
    ...rows({ A: ["a"], B: ["b"], C: ["c"], E: ["e"], F: ["f"], G: ["g"] }),
    ["D", { ticked: true, files: ["d"] }],
  ]);
  const state = {
    queue: [{ id: "A", blocked: true }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "X" }, { id: "E" }, { id: "F", repeat: 3 }, { id: "G", repeat: 2 }],
    done: [{ id: "B", merged: true }, { id: "F", merged: true }],
    parked: [{ id: "C" }, { id: "G" }],
  };
  const r = pickBatch(state, plan, { parallel: 9, openBranches: ["agent/E-slug"] });
  assert.deepEqual(r.skipped, [
    { id: "A", reason: "blocked" },
    { id: "B", reason: "done" },
    { id: "C", reason: "parked" },
    { id: "D", reason: "plan row ticked" },
    { id: "X", reason: "no plan row" },
    { id: "E", reason: "open PR agent/E-slug" },
  ]);
  assert.deepEqual(r.batch, ["F", "G"]);
}

{
  // firstTask is considered first, then the rest in queue order
  const plan = rows({ A: ["x"], B: ["x"], C: ["c"] });
  const r = pickBatch({ queue: [{ id: "A" }, { id: "B" }, { id: "C" }], firstTask: "B" }, plan, { parallel: 2 });
  assert.deepEqual(r.batch, ["B", "C"]);
  assert.deepEqual(r.skipped, [{ id: "A", reason: "shares x with B" }]);
}

{
  // Longest id wins for an open PR: agent/2.7a-x belongs to 2.7a, so row 2.7 is still pickable
  const plan = rows({ "2.7": ["a"], "2.7a": ["b"] });
  const r = pickBatch(q("2.7", "2.7a"), plan, { parallel: 2, openBranches: ["agent/2.7a-adapter"] });
  assert.deepEqual(r.batch, ["2.7"]);
  assert.deepEqual(r.skipped, [{ id: "2.7a", reason: "open PR agent/2.7a-adapter" }]);
  assert.deepEqual(pickBatch(q("A"), rows({ A: ["a"] }), { openBranches: ["feat/A-human", "agent/A"] }).batch, ["A"], "other prefixes and `<id>` without `-` do not count");
  assert.deepEqual(pickBatch(q("A"), rows({ A: ["a"] }), { openBranches: ["x/A-y"], prefix: "x/" }).batch, [], "--prefix is honoured");
}

{
  // Glob against path, and glob against glob
  assert.ok(overlaps("site/src/content/guides/*", "site/src/content/guides/a.md"));
  assert.ok(overlaps("site/src/content/guides/a.md", "site/src/content/guides/*"));
  assert.ok(!overlaps("site/src/content/guides/*", "site/src/content/guides/sub/a.md"), "`*` stays inside one segment");
  assert.ok(overlaps("site/**", "site/src/content/guides/sub/a.md"), "`**` goes any depth");
  assert.ok(overlaps("site/**/a.md", "site/a.md"), "`**/` also matches no directory");
  assert.ok(overlaps("src/?.mjs", "src/a.mjs"));
  assert.ok(!overlaps("src/?.mjs", "src/ab.mjs"));
  assert.ok(!overlaps("src/a.mjs", "src/b.mjs"));
  assert.ok(overlaps("./src/a.mjs", "src/a.mjs"));
  assert.ok(overlaps("site/src/*", "site/src/content/**"), "two globs with nested prefixes count as overlapping");
  assert.ok(!overlaps("docs/*", "site/*"), "two globs with different roots do not");
  const r = pickBatch(q("A", "B"), rows({ A: ["site/src/content/guides/*"], B: ["site/src/content/guides/a.md"] }), { parallel: 2 });
  assert.deepEqual(r.skipped, [{ id: "B", reason: "shares site/src/content/guides/a.md with A" }]);
}

{
  // A shared glob drops matching files, and a row with no backticks has no files
  const plan = parseRows(
    [
      "| 1 | [ ] task | `a.md` | done |",
      "| 2 | [ ] sample run | none (sample repo) | done |",
      "| 3 | [ ] sample run | none (sample repo) | done |",
      "| 4 | [x] task with `\\|` pipe | `x \\| y`, `b.md` | done |",
    ].join("\n"),
  );
  assert.deepEqual(plan.get("2"), { ticked: false, files: [] });
  assert.deepEqual(plan.get("4"), { ticked: true, files: ["x \\| y", "b.md"] }, "an escaped pipe stays inside its cell");
  assert.deepEqual(pickBatch(q("2", "3"), plan, { parallel: 2 }).batch, ["2", "3"]);
  assert.deepEqual(pickBatch(q("1", "2"), rows({ 1: ["docs/a.md"], 2: ["docs/b.md"] }), { parallel: 2, shared: ["docs/*.md"] }).batch, ["1", "2"]);
}

{
  // A files cell without backticks is a comma list (not "no files"); a folder holds the files inside it
  const plan = parseRows("| 1 | [ ] task | src/a.ts, src/b.ts | done |\n| 2 | [ ] task | `src/b.ts` | done |");
  assert.deepEqual(plan.get("1").files, ["src/a.ts", "src/b.ts"]);
  assert.deepEqual(pickBatch(q("1", "2"), plan, { parallel: 2 }).batch, ["1"]);
  assert.ok(overlaps("plugin/x/", "plugin/x/a.mjs"));
  assert.ok(overlaps("plugin/x", "plugin/x/sub/a.mjs"));
  assert.ok(!overlaps("plugin/x", "plugin/xy/a.mjs"), "a sibling with a longer name is not inside");
}

{
  // Tasks still running in a worker hold their files and a slot of the cap
  const plan = rows({ A: ["a"], B: ["a"], C: ["c"], D: ["d"] });
  const r = pickBatch({ queue: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }], running: true, workers: [{ id: "A" }] }, plan, { parallel: 2 });
  assert.deepEqual(r.batch, ["C"]);
  assert.deepEqual(r.skipped, [
    { id: "A", reason: "running" },
    { id: "B", reason: "shares a with A" },
    { id: "D", reason: "batch full (parallel 2)" },
  ]);
}

{
  // The CLI: reads the state, the plan, the profile (parallel + the resolve-yourself globs) and the PR list
  const dir = mkdtempSync(join(tmpdir(), "pick-batch-"));
  const file = (name, text) => (writeFileSync(join(dir, name), text), join(dir, name));
  const plan = file(
    "PLAN.md",
    [
      "| P1 | [ ] one | `src/a.mjs`, `CHANGELOG.md` | d |",
      "| P2 | [ ] two | `src/b.mjs`, `CHANGELOG.md` | d |",
      "| P3 | [ ] three | `src/c.mjs` | d |",
      "| P4 | [ ] four | `src/d.mjs` | d |",
      "",
    ].join("\n"),
  );
  const state = file("state.json", JSON.stringify(q("P1", "P2", "P3", "P4")));
  const prs = file("prs.json", JSON.stringify([{ headRefName: "agent/P3-three" }]));
  const profile = (extra) =>
    file(
      "agent-loop.md",
      [
        "# profile",
        "Run work in parallel: lint and test (prose, never a value).",
        "## git",
        "| | |",
        "|---|---|",
        "| resolve conflicts yourself | `CHANGELOG.md` (the `## Unreleased` section only) · everything else → a human |",
        "## agents per task",
        extra,
        "## repo rules",
        "parallel: 7",
        "",
      ].join("\n"),
    );
  const run = (...args) => spawnSync("node", [script, "--state", state, "--prs", prs, ...args, plan], { encoding: "utf8" });

  const two = run("--profile", profile("parallel: 3"));
  assert.equal(two.status, 0);
  assert.equal(two.stdout, "P1\nP2\nP4\n", "parallel 3 from the profile, CHANGELOG.md shared, P3 has an open PR");
  assert.equal(two.stderr, "# P3 open PR agent/P3-three\n");

  assert.equal(run("--profile", profile("no value here")).stdout, "P1\n", "missing parallel = 1");
  assert.equal(run("--profile", profile("parallel: 3"), "--parallel", "1").stdout, "P1\n", "--parallel overrides the profile");
  assert.equal(run().stdout, "P1\n", "no profile = parallel 1");

  const bad = run("--profile", profile("parallel: 0"));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /whole number/);
  assert.equal(run("--parallel", "x").status, 2);

  assert.equal(spawnSync("node", [script, "--state", state], { encoding: "utf8" }).status, 2, "no plan file → usage");
  assert.equal(spawnSync("node", [script, plan], { encoding: "utf8" }).status, 2, "no --state → usage");
}
