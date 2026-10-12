// Run: npm test — update-check.sh says a newer release is out, and stays silent otherwise
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const bash = process.env.DOCTOR_BASH ?? "bash";
const cur = JSON.parse(readFileSync("plugin/.claude-plugin/plugin.json", "utf8")).version;
const [a, b, c] = cur.split(".").map(Number);
const run = (tag) =>
  spawnSync(bash, ["plugin/skills/pitwall/scripts/update-check.sh"], {
    env: { ...process.env, PITWALL_LATEST: tag },
    encoding: "utf8",
  });

for (const newer of [`v${a}.${b}.${c + 1}`, `${a}.${b + 1}.0`, `v${a + 1}.0.0`, `v${a}.${b}.${c + 10}`]) {
  const r = run(newer);
  assert.equal(r.status, 0);
  assert.match(r.stdout, new RegExp(`pitwall ${newer.replace(/^v/, "")} is out \\(installed: ${cur}\\)`), newer);
}
for (const same of [`v${cur}`, cur, `v${a}.${b}.${Math.max(c - 1, 0)}`, `v0.0.1`]) {
  const r = run(same);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "", same);
}
console.log("OK: update check");
