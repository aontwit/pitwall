// Run: npm test — init's file-based read step (scripts/detect.mjs) on fixture repos
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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
  // the repo's own hooks folder: the one `git config core.hooksPath` names, and a `.githooks/` folder
  const repo = (files, hooksPath) => {
    const dir = mkdtempSync(join(tmpdir(), "pitwall-detect-"));
    for (const f of files) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), "#!/bin/sh\n");
    }
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    if (hooksPath) git("config", "core.hooksPath", hooksPath);
    return { dir, git };
  };

  const set = repo([".githooks/pre-push", ".githooks/commit-msg", "README.md"], ".githooks");
  assert.deepEqual(detect(set.dir).hooks, [".githooks"], "core.hooksPath = .githooks, folder present");

  const folderOnly = repo([".githooks/pre-push"]);
  assert.deepEqual(detect(folderOnly.dir).hooks, [".githooks"], "a .githooks folder is reported without the config");

  const custom = repo(["tools/hooks/pre-commit"], "./tools/hooks/");
  assert.deepEqual(detect(custom.dir).hooks, ["tools/hooks"], "any folder core.hooksPath names, ./ and trailing / dropped");

  const both = repo([".husky/pre-commit", "tools/hooks/pre-push", ".githooks/commit-msg", "lefthook.yml"], "tools/hooks");
  assert.deepEqual(
    detect(both.dir).hooks,
    [".husky", "tools/hooks", ".githooks", "lefthook.yml"],
    "husky, config folder, .githooks, lefthook together, in that order",
  );

  const nested = repo([".githooks/sub/pre-push"], ".githooks/sub");
  assert.deepEqual(detect(nested.dir).hooks, [".githooks"], "a config folder inside .githooks adds nothing");

  const messy = repo(["tools/hooks/pre-push"], "tools//./hooks/");
  assert.deepEqual(detect(messy.dir).hooks, ["tools/hooks"], "the config value is normalised");

  const husky9 = repo([".husky/pre-commit", ".husky/_/pre-commit"], ".husky/_");
  assert.deepEqual(detect(husky9.dir).hooks, [".husky"], "husky v9's .husky/_ adds nothing to .husky");

  const unset = repo(["README.md"]);
  assert.deepEqual(detect(unset.dir).hooks, [], "no hooks folder: nothing invented");

  const missing = repo(["README.md"], "no-such-dir");
  assert.deepEqual(detect(missing.dir).hooks, [], "core.hooksPath naming a folder with no files is not reported");

  const absolute = repo(["tools/hooks/pre-push"], "placeholder");
  absolute.git("config", "core.hooksPath", join(absolute.dir, "tools/hooks"));
  assert.deepEqual(detect(absolute.dir).hooks, [], "an absolute core.hooksPath is not followed (init reads it itself)");

  const up = repo(["tools/hooks/pre-push"], "../tools/hooks");
  assert.deepEqual(detect(up.dir).hooks, [], "a core.hooksPath going up out of the repo names no folder of it");

  // --ref: the folders come from the commit, the path from the clone's config
  const ref = repo(["tools/hooks/pre-push", "README.md"], "tools/hooks");
  ref.git("add", ".");
  ref.git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  rmSync(join(ref.dir, "tools"), { recursive: true });
  assert.deepEqual(detect(ref.dir).hooks, [], "the tree lost the folder");
  assert.deepEqual(detect(ref.dir, "--ref", "HEAD").hooks, ["tools/hooks"], "--ref: config path + folder tracked in the commit");
  ref.git("config", "core.hooksPath", "elsewhere");
  assert.deepEqual(detect(ref.dir, "--ref", "HEAD").hooks, [], "--ref: a config path with no tracked files is not reported");

  // a folder inside another repo does not read that repo's config
  mkdirSync(join(ref.dir, "sub/hooks-x"), { recursive: true });
  writeFileSync(join(ref.dir, "sub/hooks-x/pre-push"), "#!/bin/sh\n");
  ref.git("config", "core.hooksPath", "hooks-x");
  assert.deepEqual(detect(join(ref.dir, "sub")).hooks, [], "sub/ is no repo root: the parent's core.hooksPath is not read");
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
