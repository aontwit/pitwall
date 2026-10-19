// Run: npm test
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveDocsConflict } from "../plugin/skills/pitwall/scripts/resolve-docs-conflict.mjs";

// A conflict as `git merge origin/<base>` leaves it on the agent branch: HEAD = branch, then base
const conflict = (branch, base) =>
  ["head", "<<<<<<< HEAD", ...branch, "=======", ...base, ">>>>>>> origin/main", "tail", ""].join("\n");

const row = (id, box, task = `task ${id}`) => `| ${id} | [${box}] ${task} | files | done when |`;

{
  const { text, problems } = resolveDocsConflict(
    conflict(["| 2026-10-11 | 1.2 rng | agent PR | 9 passed |"], ["| 2026-10-10 | 1.1 clock | agent PR | 12 passed |"]),
  );
  assert.deepEqual(problems, []);
  assert.equal(
    text,
    "head\n| 2026-10-10 | 1.1 clock | agent PR | 12 passed |\n| 2026-10-11 | 1.2 rng | agent PR | 9 passed |\ntail\n",
    "log lines: both kept, base's first",
  );
}

{
  // Each side ticked its own row; the other side still shows it unticked
  const { text, problems } = resolveDocsConflict(conflict([row("1.1", " "), row("1.2", "x")], [row("1.1", "x"), row("1.2", " ")]));
  assert.deepEqual(problems, []);
  assert.equal(text, `head\n${row("1.1", "x")}\n${row("1.2", "x")}\ntail\n`, "same task row once, ticked if either side ticked");
}

{
  const { text, problems } = resolveDocsConflict(
    conflict(["| 2026-10-11 | 1.3 content | agent PR | 7 passed |"], ["| 2026-10-11 | 1.2 rng | agent PR | 9 passed |"]),
  );
  assert.deepEqual(problems, [], "log rows may share a date");
  assert.equal(text.split("\n").length, 5, "both log rows kept");
}

{
  // Two branches changed the same status-board line in different ways: a human merges them
  const { problems } = resolveDocsConflict(conflict(["| [1](p1.md) | core | 🔨 in progress |"], ["| [1](p1.md) | core | ✅ done |"]));
  assert.equal(problems.length, 1, "same first cell, different line, no checkbox, not a date: refused");
}

{
  const { text } = resolveDocsConflict(conflict(["same line", "branch only"], ["same line"]));
  assert.equal(text, "head\nsame line\nbranch only\ntail\n", "a line both sides hold is kept once");
}

{
  const { text } = resolveDocsConflict(conflict(["a"], ["b"]).replace(/\n/g, "\r\n"));
  assert.equal(text, "head\r\nb\r\na\r\ntail\r\n", "CRLF files stay CRLF");
}

{
  // Two open questions got the same number on two branches: a human or the playbook renumbers them
  const q = (n, text) => `| ${n} | ${text} | G1 |`;
  const { problems } = resolveDocsConflict(conflict([q(2, "branch question")], [q(2, "base question")]));
  assert.equal(problems.length, 1, "same id on two rows without a checkbox is refused");
  assert.match(problems[0], /\| 2 \|/, "the problem names the row");
}

{
  const { problems } = resolveDocsConflict(
    ["<<<<<<< HEAD", "a", "||||||| merged common ancestors", "o", "=======", "b", ">>>>>>> x", ""].join("\n"),
  );
  assert.equal(problems.length, 1, "diff3-style markers are refused, not guessed");
}

{
  const { text, problems } = resolveDocsConflict("no conflict here\n");
  assert.deepEqual([text, problems], ["no conflict here\n", []], "a clean file is unchanged");
}

{
  // Issue #25: base ticked 3.4, the branch added a Plan correction to 3.5 · the merge base had neither
  const was = [row("3.4", " ", "Task four"), row("3.5", " ", "Task five")];
  const fixed = row("3.5", " ", "Task five. Plan correction (row 3.5 PR): c.gd changed too");
  const hunk = conflict([was[0], fixed], [row("3.4", "x", "Task four"), was[1]]);
  const { text, problems } = resolveDocsConflict(hunk, was.join("\n"));
  assert.deepEqual(problems, []);
  assert.equal(text, `head\n${row("3.4", "x", "Task four")}\n${fixed}\ntail\n`, "the branch's text edit is kept");

  const unsure = resolveDocsConflict(hunk);
  assert.equal(unsure.text, hunk, "no merge base: the file is left as it was");
  assert.match(unsure.problems.join("\n"), /task row 3\.5 changed on both sides, or no merge base/, "and the row is reported");

  // The other way round: base got the correction (an earlier merge), the branch only ticked 3.4
  const back = resolveDocsConflict(conflict([row("3.4", "x", "Task four"), was[1]], [was[0], fixed]), was.join("\n"));
  assert.equal(back.text, `head\n${row("3.4", "x", "Task four")}\n${fixed}\ntail\n`, "base's text edit is kept too");

  const both = resolveDocsConflict(conflict([row("3.5", "x", "Task five, branch")], [row("3.5", " ", "Task five, base")]), was.join("\n"));
  assert.equal(both.problems.length, 1, "both sides changed the text: refused");
}

{
  // The CLI reads the merge base from git's index (stage 1) during a real `git merge`
  const dir = mkdtempSync(join(tmpdir(), "pitwall-resolve-"));
  const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdio: "pipe" });
  const plan = join(dir, "plan.md");
  const write = (...rows) => writeFileSync(plan, ["# Plan", ...rows, ""].join("\n"));
  try {
    git("init", "-q", "-b", "main");
    git("config", "core.autocrlf", "false"); // Windows: keep the file LF
    write(row("3.4", " ", "Task four"), row("3.5", " ", "Task five"));
    git("add", ".");
    git("commit", "-qm", "base");
    git("checkout", "-qb", "agent");
    write(row("3.4", " ", "Task four"), row("3.5", " ", "Task five. Plan correction: c.gd too"));
    git("commit", "-qam", "branch");
    git("checkout", "-q", "main");
    write(row("3.4", "x", "Task four"), row("3.5", " ", "Task five"));
    git("commit", "-qam", "tick");
    git("checkout", "-q", "agent");
    assert.notEqual(spawnSync("git", ["merge", "-q", "main"], { cwd: dir }).status, 0, "the repro conflicts");
    const script = join(import.meta.dirname, "../plugin/skills/pitwall/scripts/resolve-docs-conflict.mjs");
    const r = spawnSync(process.execPath, [script, plan], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      readFileSync(plan, "utf8"),
      ["# Plan", row("3.4", "x", "Task four"), row("3.5", " ", "Task five. Plan correction: c.gd too"), ""].join("\n"),
      "CLI: base's tick and the branch's text both survive",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
