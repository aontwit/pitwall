// Run: npm test
import assert from "node:assert/strict";

import { syncPlan } from "../plugin/skills/pitwall/scripts/plan-sync.mjs";

const row = (id, box) => `| ${id} | [${box}] task ${id} | files | done when |`;
const pr = (number, headRefName, mergedAt = "2026-10-19T10:00:00Z") => ({ number, headRefName, title: `t${number}`, mergedAt });

{
  // Two sibling PRs merged; neither touched the plan, so it still shows both rows unticked
  const plan = ["## Tasks", row("1.1", " "), row("1.2", " "), row("1.3", " "), ""].join("\n");
  const { text, ticked } = syncPlan(plan, [pr(5, "agent/1.1-clock"), pr(6, "agent/1.2-rng"), pr(7, "feat/1.3-human")]);
  assert.equal(text, ["## Tasks", row("1.1", "x"), row("1.2", "x"), row("1.3", " "), ""].join("\n"));
  assert.deepEqual(ticked.map((t) => t.id), ["1.1", "1.2"], "only agent branches count");
}

{
  // Longest id wins: agent/2.7a-… is row 2.7a, and row 2.7 stays open
  const { ticked } = syncPlan([row("2.7", " "), row("2.7a", " ")].join("\n"), [pr(8, "agent/2.7a-adapter")]);
  assert.deepEqual(ticked.map((t) => t.id), ["2.7a"]);
}

{
  // A repeat still in the queue is skipped; an already ticked row is left alone
  const { text, ticked } = syncPlan([row("3.1", " "), row("3.2", "x")].join("\n"), [pr(9, "agent/3.1-lint"), pr(10, "agent/3.2-x")], {
    skip: ["3.1"],
  });
  assert.deepEqual(ticked, []);
  assert.equal(text, [row("3.1", " "), row("3.2", "x")].join("\n"));
}

{
  // --log appends under the Progress log table, before the next section; CRLF survives
  const plan = ["## Tasks", row("1.1", " "), "", "## Progress log", "", "| Date | Task | PR | Evidence |", "|---|---|---|---|", "", "## Notes", ""].join(
    "\r\n",
  );
  const { text } = syncPlan(plan, [pr(5, "agent/1.1-clock", "2026-10-18T23:00:00Z")], { log: true });
  assert.equal(
    text,
    ["## Tasks", row("1.1", "x"), "", "## Progress log", "", "| Date | Task | PR | Evidence |", "|---|---|---|---|", "| 2026-10-18 | 1.1 t5 | #5 | see PR |", "", "## Notes", ""].join(
      "\r\n",
    ),
  );
}
