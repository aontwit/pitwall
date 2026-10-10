// Run: npm test — doctor.sh against profiles built from the real contract table
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const doctor = "plugin/skills/pitwall/scripts/doctor.sh";
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
  return spawnSync("bash", [doctor, file], { encoding: "utf8" });
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
assert.equal(spawnSync("bash", [doctor, join(dir, "missing.md")]).status, 3, "no profile → exit 3");
assert.equal(run(full + "\n| base | `{{base}}` |\n").status, 1, "a {{…}} placeholder left in the profile fails");
assert.equal(
  spawnSync("bash", [doctor, "plugin/skills/pitwall/templates/agent-loop.md"]).status,
  1,
  "the shipped template is not a valid profile until filled",
);

console.log("OK: doctor");
