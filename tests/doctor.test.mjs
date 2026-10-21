// Run: npm test — doctor.sh against profiles built from the real contract table
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const doctor = "plugin/skills/pitwall/scripts/doctor.sh";
const bash = process.env.DOCTOR_BASH ?? "bash"; // CI sets /bin/bash on macOS (bash 3.2)
const skill = readFileSync("plugin/skills/pitwall/SKILL.md", "utf8");
const contract = skill.split("## Profile contract")[1].split("\n## ")[0];
const required = [...contract.matchAll(/^\| ([a-z][^|(]*?) \|/gm)]
  .filter((m) => !contract.split("\n").find((l) => l.startsWith(`| ${m[1]} (optional`)))
  .map((m) => m[1]);
assert.ok(required.includes("repo") && required.includes("language"), "contract table parsed");

const dir = mkdtempSync(join(tmpdir(), "pitwall-doctor-"));
const run = (body, env = {}) => {
  const file = join(dir, "agent-loop.md");
  writeFileSync(file, body);
  return spawnSync(bash, [doctor, file], { encoding: "utf8", env: { ...process.env, ...env } });
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

// merge: auto — a temp repo with a local bare `origin` that holds `main`, `dev` and `release` (no network)
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
const origin = join(dir, "origin.git");
const repo = join(dir, "repo");
mkdirSync(origin);
git(origin, "init", "-q", "--bare");
mkdirSync(join(repo, ".claude"), { recursive: true });
git(repo, "init", "-q");
git(repo, "checkout", "-q", "-b", "main");
git(repo, "commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", "init");
git(repo, "remote", "add", "origin", origin);
for (const b of ["dev", "release"]) git(repo, "branch", b);
git(repo, "push", "-q", "origin", "main", "dev", "release");
const runInRepo = (body) => {
  const file = join(repo, ".claude", "agent-loop.md");
  writeFileSync(file, body);
  return spawnSync(bash, [doctor, file], { encoding: "utf8" });
};
const baseRows = "| base | `main` — PRs target it |\n| never push / check out to edit | `main`, `release` |";
const withGit = (rows) => full.replace("## git\n", `## git\n\n| | |\n|---|---|\n${baseRows}\n${rows}\n`);
const mergeRow = (value) => `| merge | \`merge: ${value}\` — whatever the description says |`;
const devRow = (value) => `| dev branch | ${value} — whatever the description says |`;

const auto = runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`dev`")}`));
assert.equal(auto.status, 0, `merge: auto with a dev branch that exists on origin passes\n${auto.stdout}`);
assert.equal(runInRepo(withGit(`merge: auto\n${devRow("`dev`")}`)).status, 0, "a bare `merge: auto` line passes too");
assert.equal(runInRepo(withGit(`| merge | \`merge: auto\` |\n| dev branch | \`dev\` or none |`)).status, 0, "text after the branch is fine");
assert.equal(runInRepo(withGit(`${mergeRow("human")}\n${devRow("`dev`")}`)).status, 0, "merge: human passes");
assert.equal(runInRepo(withGit(devRow("`dev`"))).status, 0, "no merge row passes as human");
assert.equal(runInRepo(withGit(`${mergeRow("human")}\n${devRow("`ghost`")}`)).status, 0, "human checks no dev branch");
assert.equal(runInRepo(withGit(`${mergeRow("human")}\n${devRow("`main`")}`)).status, 0, "human with main as the dev branch passes");

const noDev = runInRepo(withGit(mergeRow("auto")));
assert.equal(noDev.status, 1, "merge: auto with no dev branch row fails");
assert.match(noDev.stdout, /BAD      merge: auto needs a dev branch/, "names the missing dev branch");
const noneDev = runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`none`")}`));
assert.equal(noneDev.status, 1, "merge: auto with `none` as the dev branch fails");
assert.match(noneDev.stdout, /BAD      merge: auto needs a dev branch/, "names the missing dev branch");
assert.equal(runInRepo(withGit(`${mergeRow("auto")}\n${devRow("none")}`)).status, 1, "a branch name without backticks is no branch");
const ghost = runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`ghost`")}`));
assert.equal(ghost.status, 1, "merge: auto with a branch that is not on origin fails");
assert.match(ghost.stdout, /BAD      dev branch: `ghost` is not on origin/, "names the missing branch");
assert.equal(runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`de`")}`)).status, 1, "a branch name is matched whole, not as a suffix");
git(repo, "branch", "feature/dev");
git(repo, "push", "-q", "origin", "feature/dev");
git(origin, "branch", "-q", "-D", "dev");
assert.equal(runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`dev`")}`)).status, 1, "feature/dev on origin is not `dev`");
git(repo, "push", "-q", "origin", "dev");
const isBase = runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`main`")}`));
assert.equal(isBase.status, 1, "merge: auto with the base as the dev branch fails");
assert.match(isBase.stdout, /BAD      dev branch: `main` is the base/, "names the base");
const isNever = runInRepo(withGit(`${mergeRow("auto")}\n${devRow("`release`")}`));
assert.equal(isNever.status, 1, "merge: auto with a branch never to touch fails, though it exists on origin");
assert.match(isNever.stdout, /BAD      dev branch: `release` is a branch the loop never touches/, "names the rule");
const noRepo = run(withGit(`${mergeRow("auto")}\n${devRow("`dev`")}`), { GIT_CEILING_DIRECTORIES: dirname(dir) }); // no repo above the temp dir
assert.equal(noRepo.status, 1, "merge: auto with a profile outside any git repo fails");
assert.match(noRepo.stdout, /cannot check origin/, "says it cannot check origin");

const badMerge = runInRepo(withGit(mergeRow("sometimes")));
assert.equal(badMerge.status, 1, "merge: sometimes fails");
assert.match(badMerge.stdout, /BAD      merge:/, "names merge");
assert.equal(
  runInRepo(full.replace("## repo\n", "## repo\n\nmerge: sometimes · automerge: yes\n")).status,
  0,
  "`merge:` in prose outside the git section is not a value",
);
const mergePlaceholder = runInRepo(withGit("| merge | `merge: {{human | auto}}` |"));
assert.equal(mergePlaceholder.status, 1, "a merge placeholder is UNFILLED");
assert.doesNotMatch(mergePlaceholder.stdout, /BAD      merge/, "a placeholder value is skipped by the merge check");
assert.match(template, /^\| merge \| `merge: human`/m, "the template ships merge: human as a real value");
assert.match(template, /^\| dev branch \| `none`/m, "the template ships dev branch none");

console.log("OK: doctor");
