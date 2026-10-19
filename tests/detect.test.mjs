// Run: npm test — init's file-based read step (scripts/detect.mjs) on fixture repos
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = "plugin/skills/pitwall/scripts/detect.mjs";
const detect = (...args) => JSON.parse(execFileSync("node", [script, ...args], { encoding: "utf8" }));
const none = { typecheck: null, lint: null, test: null, build: null };

assert.deepEqual(
  detect("tests/fixtures/empty"),
  { packageManager: null, install: null, checks: none, godot: null, ciRuns: [], devServer: null, plan: [], verificationSkills: [], hooks: [], rules: [] },
  "empty repo: every value unsettled, nothing invented",
);

assert.deepEqual(detect("tests/fixtures/nextjs"), {
  packageManager: "pnpm",
  install: "pnpm install --frozen-lockfile",
  checks: { typecheck: "pnpm run typecheck", lint: "pnpm run lint", test: "pnpm run test", build: "pnpm run build" },
  godot: null,
  ciRuns: [
    { file: ".github/workflows/ci.yml", run: "pnpm install --frozen-lockfile" },
    { file: ".github/workflows/ci.yml", run: "pnpm run build" },
  ],
  devServer: { command: "pnpm run dev", port: 3001 },
  plan: ["PLAN.md"],
  verificationSkills: [],
  hooks: [".husky"],
  rules: ["CLAUDE.md"],
});

assert.deepEqual(detect("tests/fixtures/godot"), {
  packageManager: null,
  install: null,
  checks: none,
  godot: "4.3",
  ciRuns: [{ file: ".github/workflows/ci.yml", run: "bash scripts/test.sh" }],
  devServer: null,
  plan: ["TODO.md"],
  verificationSkills: [".claude/skills/verify-game/SKILL.md"],
  hooks: [],
  rules: [],
});

{
  // --ref reads the base as the loop will see it, not the working tree (init step 1)
  const dir = mkdtempSync(join(tmpdir(), "pitwall-detect-"));
  cpSync("tests/fixtures/nextjs", dir, { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { lint: "eslint ." } }));
  writeFileSync(join(dir, "yarn.lock"), "");
  assert.equal(detect(dir).checks.typecheck, null, "the tree changed");
  assert.equal(detect(dir, "--ref", "HEAD").checks.typecheck, "pnpm run typecheck", "--ref ignores the tree");
}

{
  // npm's placeholder test script is not a check; yarn berry gets --immutable
  const dir = mkdtempSync(join(tmpdir(), "pitwall-detect-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }));
  writeFileSync(join(dir, "yarn.lock"), "");
  writeFileSync(join(dir, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  const got = detect(dir);
  assert.equal(got.checks.test, null);
  assert.match(got.install, /^yarn .* --immutable$/);
}

console.log("OK: detect");
