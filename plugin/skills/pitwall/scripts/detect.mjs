// Reads the file-based rows of init step 1 from a repo, so they are the same every run and testable
// on fixture repos (#30): package manager + frozen install, check commands, Godot engine version,
// CI `run:` steps, dev server + port, plan files, verification-skill candidates, hooks, rules files.
// Rows that need GitHub (base, protected branches, labels) or judgment stay with the lead.
// Run: node detect.mjs [repo dir] [--ref origin/<base>]   (--ref reads that commit, not the tree)
//   prints JSON · a value it cannot settle is null or [], never a guess
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const fsRepo = (dir) => {
  const walk = (d) =>
    readdirSync(d).flatMap((name) => {
      if (name === ".git" || name === "node_modules") return [];
      const p = join(d, name);
      return statSync(p).isDirectory() ? walk(p) : [relative(dir, p).replaceAll("\\", "/")];
    });
  return { files: walk(dir), read: (f) => readFileSync(join(dir, f), "utf8") };
};

const gitRepo = (dir, ref) => {
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", maxBuffer: 1 << 26 });
  return { files: git("ls-tree", "-r", "--name-only", ref).split("\n").filter(Boolean), read: (f) => git("show", `${ref}:${f}`) };
};

const LOCKS = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];
const CHECKS = { typecheck: ["typecheck", "type-check", "check-types", "tsc"], lint: ["lint"], test: ["test"], build: ["build"] };
const NPM_DEFAULT_TEST = /no test specified/;
const PLAN = /^(PLAN|TODO|IMPLEMENTATION_PLAN|tasks)\.md$|^docs\/(.+\/)?plan[^/]*$|^\.taskmaster\//i;
const RULES = /^(CLAUDE|AGENTS|CONTRIBUTING)\.md$|^\.claude\/rules\/|^\.cursor\/rules\//;

/** the init step 1 values a repo's files settle */
export const detect = ({ files, read }) => {
  const has = (f) => files.includes(f);
  const lock = LOCKS.find(([f]) => has(f));
  const pm = lock?.[1] ?? (has("package.json") ? "npm" : null);
  // frozen form: npm ci · yarn berry (.yarnrc.yml) --immutable · the rest --frozen-lockfile
  const install = !lock ? null : pm === "npm" ? "npm ci" : `${pm} install ${pm === "yarn" && has(".yarnrc.yml") ? "--immutable" : "--frozen-lockfile"}`;

  const pkg = has("package.json") ? JSON.parse(read("package.json")) : {};
  const scripts = pkg.scripts ?? {};
  const run = (s) => (pm === "npm" ? `npm run ${s}` : `${pm} run ${s}`);
  const checks = {};
  for (const [check, names] of Object.entries(CHECKS)) {
    const name = names.find((n) => scripts[n] && !(n === "test" && NPM_DEFAULT_TEST.test(scripts[n])));
    checks[check] = name ? run(name) : null;
  }

  let godot = null;
  if (has("project.godot")) godot = /^config\/features=PackedStringArray\("([\d.]+)"/m.exec(read("project.godot"))?.[1] ?? "unknown";

  const ciRuns = files
    .filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))
    .flatMap((f) => [...read(f).matchAll(/^\s*(?:-\s+)?run:\s*([^|>\s].*?)\s*$/gm)].map((m) => ({ file: f, run: m[1] })));

  const devName = ["dev", "start"].find((n) => scripts[n]);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const port =
    Number(/(?:-p|--port)[ =](\d+)|PORT=(\d+)/.exec(scripts[devName] ?? "")?.slice(1).find(Boolean)) ||
    (deps.next ? 3000 : deps.vite ? 5173 : null);
  const devServer = devName ? { command: run(devName), port } : null;

  return {
    packageManager: pm,
    install,
    checks,
    godot,
    ciRuns,
    devServer,
    plan: files.filter((f) => PLAN.test(f)),
    verificationSkills: files.filter((f) => /^\.claude\/skills\/[^/]*(verify|control|drive|e2e)[^/]*\/SKILL\.md$/i.test(f)),
    hooks: [...new Set(files.filter((f) => f.startsWith(".husky/")).map(() => ".husky"))].concat(
      files.filter((f) => /^lefthook\.ya?ml$/.test(f)),
    ),
    rules: files.filter((f) => RULES.test(f)),
  };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--ref");
  const ref = at < 0 ? null : args.splice(at, 2)[1];
  const dir = args[0] ?? ".";
  if (!existsSync(dir) || (at >= 0 && !ref)) {
    console.error("usage: detect.mjs [repo dir] [--ref origin/<base>]");
    process.exit(2);
  }
  console.log(JSON.stringify(detect(ref ? gitRepo(dir, ref) : fsRepo(dir)), null, 2));
}
