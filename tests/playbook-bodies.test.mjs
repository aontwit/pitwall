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

// lap.md section 10 (auto merge) and the two merge scripts stay in step: every flag the lap passes is in the script's
// usage line, merges go through merge-pr.mjs only (a line that names `gh pr merge` also names the script), and
// merge-pr.mjs calls merge-gate.mjs with flags merge-gate has
const scriptText = (name) => readFileSync(`plugin/skills/pitwall/scripts/${name}`, "utf8");
const usageOf = (name) => new RegExp(`usage: ${name.replace(".", "\\.")} ([^"]+)`).exec(scriptText(name))?.[1];
for (const name of ["merge-pr.mjs", "merge-gate.mjs"]) {
  const calls = [...playbook("lap").matchAll(new RegExp(`\`node <pitwall dir>/scripts/${name.replace(".", "\\.")} ([^\`]+)\``, "g"))].map((m) => m[1]);
  assert.ok(usageOf(name), `${name} has a usage line`);
  assert.ok(calls.length, `lap.md quotes the ${name} command`);
  for (const flag of calls.flatMap(flags)) assert.ok(flags(usageOf(name)).includes(flag), `lap.md passes ${flag}, ${name} has no such flag`);
}
for (const line of playbook("lap").split("\n").filter((l) => l.includes("gh pr merge")))
  assert.ok(line.includes("merge-pr.mjs"), `lap.md names \`gh pr merge\` outside the merge-pr.mjs rule: ${line.slice(0, 120)}`);
const gateArgv = /run\(process\.execPath, \[gate, ([^\]]+)\]/.exec(scriptText("merge-pr.mjs"))?.[1];
assert.ok(gateArgv, "merge-pr.mjs runs merge-gate.mjs");
for (const flag of flags(gateArgv)) assert.ok(flags(usageOf("merge-gate.mjs")).includes(flag), `merge-pr.mjs passes ${flag}, merge-gate.mjs has no such flag`);

// the Always park answer: the gauge verifier section asks it and records the entry merge-gate.mjs reads
const gauge = readFileSync("plugin/skills/gauge/SKILL.md", "utf8");
const verifierSection = gauge.slice(gauge.indexOf("## Independent verifier"), gauge.indexOf("## When verify misses"));
assert.ok(verifierSection.includes("`Always park: none`"), "gauge's verifier section names the `Always park: none` line");
for (const field of ['item: "always-park"', 'method: "verifier"', 'evidence: "none"'])
  assert.ok(verifierSection.includes(field), `gauge records the Always park entry with ${field}`);
assert.match(scriptText("merge-gate.mjs"), /e\.item === "always-park"/, "merge-gate.mjs reads `item: \"always-park\"`");
assert.match(scriptText("merge-gate.mjs"), /park\.evidence !== "none"/, "merge-gate.mjs passes only `evidence: \"none\"`");
assert.ok(readFileSync("plugin/agents/pitwall-agent.md", "utf8").includes("`Always park: none`"), "the verifier's report names the Always park line");

console.log("OK: playbook bodies");
