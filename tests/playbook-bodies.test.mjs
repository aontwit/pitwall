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

// lap.md section 9 (lead mode) and pick-batch.mjs stay in step: every flag the lead passes is in the script's usage
// line, and the state key the script reads worker entries from is the one lap.md copies `workers[]` into
const pickBatch = readFileSync("plugin/skills/pitwall/scripts/pick-batch.mjs", "utf8");
const usage = /usage: pick-batch\.mjs ([^"]+)/.exec(pickBatch)?.[1];
const call = /`node <pitwall dir>\/scripts\/pick-batch\.mjs ([^`]+)`/.exec(playbook("lap"))?.[1];
assert.ok(usage, "pick-batch.mjs has a usage line");
assert.ok(call, "lap.md quotes the pick-batch.mjs command");
const flags = (text) => [...text.matchAll(/--[a-z-]+/g)].map((m) => m[0]);
for (const flag of flags(call)) assert.ok(flags(usage).includes(flag), `lap.md passes ${flag}, pick-batch.mjs has no such flag`);
const key = /Array\.isArray\(state\.(\w+)\)/.exec(pickBatch)?.[1];
assert.ok(key, "pick-batch.mjs reads the worker entries from one state key");
assert.ok(playbook("lap").includes(`\`${key}[]\` = one entry per task a worker holds`), `lap.md names the state key pick-batch reads (\`${key}[]\`)`);

console.log("OK: playbook bodies");
