// Run: npm test
import assert from "node:assert/strict";

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
