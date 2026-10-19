// Run: npm test — every PR-body shape a playbook prescribes passes check-pr-body.mjs (#30).
// The shapes are read from the playbooks themselves, so changing either side alone fails here (#26).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkPrBody } from "../plugin/skills/pitwall/scripts/check-pr-body.mjs";

const playbook = (name) => readFileSync(`plugin/skills/pitwall/playbooks/${name}.md`, "utf8");
const body = (verifyLine) => ["## What", "x", "", "## Verify", "| Check | Result |", "|---|---|", verifyLine, ""].join("\n");

// opening-a-pr.md: the verifier row template, placeholders filled as the lead would
const template = /`(\| Verifier \|[^`]+\|)`/.exec(playbook("opening-a-pr"))?.[1];
assert.ok(template, "opening-a-pr.md quotes the verifier row");
const row = template
  .replace("<subagent> <model>", "pitwall-agent sonnet")
  .replace("<7-char headSha>", "abc1234")
  .replace("<12-char patchId>", "0123456789ab")
  .replace("<VERIFIED / PARTIAL>", "VERIFIED");
assert.doesNotMatch(row, /[<>]/, `every placeholder filled: ${row}`);
assert.deepEqual(checkPrBody(body(row)).problems, [], "task PR: the prescribed verifier row passes");

// plan.md: the example Plan PR line
const planLine = /e\.g\. `(Plan PR[^`]+)`/.exec(playbook("plan"))?.[1];
assert.ok(planLine, "plan.md quotes an example Plan PR line");
assert.deepEqual(checkPrBody(body(planLine)).problems, [], "plan PR: the prescribed line passes");

// and a body with neither still fails, so the two passes above mean something
assert.equal(checkPrBody(body("| a | ✅ |")).ok, false);

console.log("OK: playbook bodies");
