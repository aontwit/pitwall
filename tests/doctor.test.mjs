// Run: npm test — doctor.sh against profiles built from the real contract table
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const doctor = "plugin/skills/pitwall/scripts/doctor.sh";
const bash = process.env.DOCTOR_BASH ?? "bash"; // CI sets /bin/bash on macOS (bash 3.2)
const skill = readFileSync("plugin/skills/pitwall/SKILL.md", "utf8");
const contract = skill.split("## Profile contract")[1].split("\n## ")[0];
const required = [...contract.matchAll(/^\| ([a-z][^|(]*?) \|/gm)]
  .filter((m) => !contract.split("\n").find((l) => l.startsWith(`| ${m[1]} (optional`)))
  .map((m) => m[1]);
assert.ok(required.includes("repo") && required.includes("language"), "contract table parsed");

const dir = mkdtempSync(join(tmpdir(), "pitwall-doctor-"));
const run = (body) => {
  const file = join(dir, "agent-loop.md");
  writeFileSync(file, body);
  return spawnSync(bash, [doctor, file], { encoding: "utf8" });
};
const full = required.map((s) => `## ${s}\n\nx\n`).join("\n");

assert.equal(run(full).status, 0, "every required section → OK");
assert.equal(run(full + "\n## level B (browser)\n").status, 0, "a heading with a suffix still counts");
const noLanguage = run(full.replace("## language", "## languages-typo"));
assert.equal(noLanguage.status, 1, "a missing required section fails");
assert.match(noLanguage.stdout, /MISSING  language/, "names the missing section");
assert.equal(run(full + "\n## tracker\n\nnothing\n").status, 1, "tracker section without clickup|none fails");
assert.equal(run(full + "\n## tracker\n\n`tracker: none`\n").status, 0, "tracker: none passes");
assert.equal(run(full + "\n## tracker\n\n`tracker: github`\n").status, 0, "tracker: github passes");
// the value checks read only their own section: parallel in `agents per task`, port in `level B`
const withAgents = (line) =>
  full.replace("## agents per task\n", `## agents per task\n\n${line}\n`).replace("## level B\n", `## level B\n\n${line}\n`);
assert.equal(run(withAgents("parallel: 2\nport: fixed")).status, 0, "parallel: 2 + port: fixed passes");
assert.equal(run(withAgents("port: free")).status, 0, "port: free passes");
assert.equal(run(withAgents("`parallel: 3`")).status, 0, "a backticked `parallel: 3` passes");
assert.equal(run(withAgents("parallel: `2`\nport: `free`")).status, 0, "backticks around the value pass");
assert.equal(
  run(full.replace("## repo\n", "## repo\n\nSteps run in parallel: lint, test · DB port: 5432\n")).status,
  0,
  "`parallel:` / `port:` in prose outside their section is not a value",
);
const portNumber = run(full.replace("## level B\n", "## level B\n\ndev server port: 3000\n"));
assert.match(portNumber.stdout, /BAD      port:.*on port/, "a port number after `port:` points to `on port`");
const template = readFileSync("plugin/skills/pitwall/templates/agent-loop.md", "utf8");
const filled = run(template.replace(/\{\{[^}]*\}\}/g, "x"));
assert.equal(filled.status, 0, `the template with every {{…}} filled passes, so its defaults are valid\n${filled.stdout}`);
const zero = run(withAgents("parallel: 0"));
assert.equal(zero.status, 1, "parallel: 0 fails");
assert.match(zero.stdout, /BAD      parallel:/, "names parallel");
for (const bad of ["-1", "1.5", "two", ""]) {
  assert.equal(run(withAgents(`parallel: ${bad}`)).status, 1, `parallel: '${bad}' fails`);
}
const sometimes = run(withAgents("port: sometimes"));
assert.equal(sometimes.status, 1, "port: sometimes fails");
assert.match(sometimes.stdout, /BAD      port:/, "names port");
assert.equal(
  run(withAgents("Dev server on port `4321` · Report: x · transport: y · parallelism: z")).status,
  0,
  "`on port` without a colon, `Report:` and `transport:` are not values",
);
assert.equal(run(withAgents("parallel: {{n}}\nport: {{fixed | free}}")).status, 1, "a placeholder is UNFILLED, not BAD");
assert.doesNotMatch(
  run(withAgents("parallel: {{n}}\nport: {{fixed | free}}")).stdout,
  /BAD      (parallel|port)/,
  "a placeholder value is skipped by the value checks",
);
assert.equal(spawnSync(bash, [doctor, join(dir, "missing.md")]).status, 3, "no profile → exit 3");
assert.equal(run(full + "\n| base | `{{base}}` |\n").status, 1, "a {{…}} placeholder left in the profile fails");
assert.equal(
  spawnSync(bash, [doctor, "plugin/skills/pitwall/templates/agent-loop.md"]).status,
  1,
  "the shipped template is not a valid profile until filled",
);

console.log("OK: doctor");
