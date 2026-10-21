// Picks the batch for a parallel lap (SPEC: Parallel laps): from the loop state's queue it takes the
// pickable items in queue order (`firstTask` first) and adds one only when its plan row shares no file with
// an item already in the batch, up to `parallel` items · files that match the profile's `resolve conflicts
// yourself` globs never count as shared · pickable = the rules of `playbooks/lap.md` §2: not `blocked`, not in
// `done` / `parked` (a `repeat` may be), plan row present and `[ ]`, no open PR on `<prefix><id>-…` (the
// longest id wins, so `agent/2.7a-x` is row 2.7a, not 2.7), every `waitFor` id merged or its row ticked.
// Run: node pick-batch.mjs --state <state.json> [--profile .claude/agent-loop.md] [--parallel <n>] [--prs <json>] [--prefix agent/] <plan file>…
//   --profile = reads `parallel: <n>` in its `## agents per task` section (missing = 1, bad value → exit 2) and the
//   globs of the `resolve conflicts yourself` row in its `## git` section · --parallel overrides the profile
//   --prs = a file with `gh pr list --state open --json headRefName` output (default: that command)
//   prints one batch id per line on stdout, one `# <id> <reason>` line per skipped item on stderr
//   exit 0 (also for an empty batch) · 1 = could not read the state, a plan, the profile or the PR list · 2 = bad arguments
//   · ids in state `running[]` are skipped, hold their files and count toward `parallel`
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TASK_ROW = /^\|\s*([^|]+?)\s*\|\s*\[([ x])\]/; // id + checkbox, as plan-sync.mjs
const CELLS = /(?<!\\)\|/; // a table cell border; `\|` inside a cell is text

/** Map id → { ticked, files } from plan-file text · files = the backticked tokens of the files cell */
export const parseRows = (text, rows = new Map()) => {
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = TASK_ROW.exec(line);
    if (!m || rows.has(m[1])) continue;
    const cell = (line.split(CELLS)[3] ?? "").trim();
    const ticks = [...cell.matchAll(/`([^`]+)`/g)].map((t) => t[1].trim());
    // a cell without backticks: comma-separated paths, unless it says `none …` (no files)
    const files = ticks.length || /^none\b/i.test(cell) ? ticks : cell.split(",").map((f) => f.trim()).filter(Boolean);
    rows.set(m[1], { ticked: m[2] === "x", files });
  }
  return rows;
};

const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
const isGlob = (p) => /[*?]/.test(p);
const prefixOf = (p) => p.slice(0, p.search(/[*?]/)); // the literal part before the first wildcard

/** `*` = within one path segment · `**` = any depth · `?` = one character */
const globRe = (glob) => {
  let re = "";
  for (let i = 0; i < glob.length; ) {
    if (glob.startsWith("**/", i)) {
      re += "(?:.*/)?";
      i += 3;
    } else if (glob.startsWith("**", i)) {
      re += ".*";
      i += 2;
    } else if (glob[i] === "*") {
      re += "[^/]*";
      i++;
    } else if (glob[i] === "?") {
      re += "[^/]";
      i++;
    } else {
      re += glob[i].replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${re}$`);
};
const matches = (glob, path) => globRe(glob).test(path);

/** do two file entries (a path or a glob each) touch the same files? */
export const overlaps = (a, b) => {
  a = norm(a);
  b = norm(b);
  if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true; // a folder holds its files
  if (isGlob(a) && !isGlob(b)) return matches(a, b);
  if (isGlob(b) && !isGlob(a)) return matches(b, a);
  if (isGlob(a) && isGlob(b)) {
    // ponytail: two globs count as overlapping when one literal prefix (up to the first wildcard) starts with the
    // other — conservative: `src/*.ts` vs `src/*.md` share no file yet overlap here · the ceiling is a task run
    // one after the other that could have run together, never a clash · replace with a real glob-intersection
    // test when a plan has rows that hit it
    const [pa, pb] = [prefixOf(a), prefixOf(b)];
    return pa.startsWith(pb) || pb.startsWith(pa);
  }
  return false;
};

const toList = (v) => (Array.isArray(v) ? v : String(v ?? "").split(/[\s,]+/)).filter(Boolean);

/** { batch: [id…], skipped: [{ id, reason }] } */
export const pickBatch = (state, rows, { parallel = 1, shared = [], openBranches = [], prefix = "agent/" } = {}) => {
  const plan = rows instanceof Map ? rows : new Map(Object.entries(rows));
  const queue = state.queue ?? [];
  const first = queue.find((q) => q.id === state.firstTask);
  const ordered = first ? [first, ...queue.filter((q) => q !== first)] : queue;
  const done = new Map((state.done ?? []).map((d) => [d.id, d]));
  const parked = new Set((state.parked ?? []).map((p) => p.id));
  const ids = [...new Set([...plan.keys(), ...queue.map((q) => q.id)])];
  const prOwner = (branch) => ids.filter((i) => branch.startsWith(`${prefix}${i}-`)).sort((a, b) => b.length - a.length)[0];
  const openIds = new Map(openBranches.map((b) => [prOwner(b), b]));
  const merged = (id) => done.get(id)?.merged === true || plan.get(id)?.ticked === true;
  const isShared = (file) => shared.some((g) => norm(g) === norm(file) || matches(norm(g), norm(file)));

  // tasks a worker still runs (state `running[]`) hold their files and a slot of the cap
  const running = (state.running ?? []).map((r) => r.id);
  const skipped = [];
  const pickable = [];
  for (const item of ordered) {
    const row = plan.get(item.id);
    const waiting = toList(item.waitFor).filter((w) => !merged(w));
    const reason = running.includes(item.id)
      ? "running"
      : item.blocked
      ? "blocked"
      : !item.repeat && done.has(item.id)
        ? "done"
        : !item.repeat && parked.has(item.id)
          ? "parked"
          : !row
            ? "no plan row"
            : row.ticked
              ? "plan row ticked"
              : openIds.has(item.id)
                ? `open PR ${openIds.get(item.id)}`
                : waiting.length
                  ? `waitFor ${waiting.join(", ")} not merged`
                  : "";
    if (reason) skipped.push({ id: item.id, reason });
    else pickable.push({ id: item.id, files: row.files.filter((f) => !isShared(f)) });
  }

  const batch = [];
  const taken = running.flatMap((id) => (plan.get(id)?.files ?? []).filter((f) => !isShared(f)).map((file) => ({ id, file })));
  for (const item of pickable) {
    if (running.length + batch.length >= parallel) {
      skipped.push({ id: item.id, reason: `batch full (parallel ${parallel})` });
      continue;
    }
    let clash;
    for (const file of item.files) {
      const hit = taken.find((t) => overlaps(file, t.file));
      if (hit) {
        clash = `shares ${file} with ${hit.id}`;
        break;
      }
    }
    if (clash) {
      skipped.push({ id: item.id, reason: clash });
      continue;
    }
    batch.push(item.id);
    taken.push(...item.files.map((file) => ({ id: item.id, file })));
  }
  return { batch, skipped };
};

/** lines of a `## <name>` section, heading matched like doctor.sh (`## agents per task`, or `… (more words)`) */
const section = (text, name) => {
  let on = false;
  const out = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("## ")) {
      const h = line.slice(3).toLowerCase();
      on = h === name || h.startsWith(`${name} `);
    } else if (on) out.push(line);
  }
  return out;
};

/** the `parallel: <n>` values in the profile's agents-per-task section (doctor.sh reads it the same way) */
export const profileParallel = (profile) => {
  const found = [];
  for (const line of section(profile, "agents per task")) {
    for (const m of line.matchAll(/(?:^|[^A-Za-z0-9_])parallel: *`? *([^\s`|,;)]*)/g)) {
      if (!m[1].startsWith("{{")) found.push(m[1]);
    }
  }
  return found;
};

/** the globs of the `resolve conflicts yourself` row in the profile's git section */
export const profileShared = (profile) => {
  const row = section(profile, "git").find((l) => l.startsWith("|") && l.split(CELLS)[1]?.includes("resolve conflicts yourself"));
  if (!row) return [];
  return [...row.split(CELLS).slice(2).join("|").matchAll(/`([^`]+)`/g)]
    .map((t) => t[1].trim())
    .filter((t) => t && !/\s/.test(t) && !t.startsWith("#"));
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const usage = () => {
    console.error(
      "usage: pick-batch.mjs --state <state.json> [--profile .claude/agent-loop.md] [--parallel <n>] [--prs <json>] [--prefix agent/] <plan file>…",
    );
    process.exit(2);
  };
  const args = process.argv.slice(2);
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const value = args.splice(at, 2)[1];
    return value ?? usage();
  };
  const stateFile = take("--state");
  const profileFile = take("--profile");
  const parallelArg = take("--parallel");
  const prsFile = take("--prs");
  const prefix = take("--prefix") ?? "agent/";
  if (!stateFile || !args.length || args.some((a) => a.startsWith("--"))) usage();

  const profile = profileFile ? readFileSync(profileFile, "utf8") : "";
  const values = parallelArg !== undefined ? [parallelArg] : profileParallel(profile);
  const bad = values.find((v) => !/^[1-9][0-9]*$/.test(v));
  if (bad !== undefined) {
    console.error(`parallel must be a whole number of 1 or more (got \`${bad}\`)`);
    process.exit(2);
  }
  const parallel = values.length ? Number(values[0]) : 1;

  let rows = new Map();
  for (const file of args) rows = parseRows(readFileSync(file, "utf8"), rows);
  const prs = JSON.parse(
    prsFile
      ? readFileSync(prsFile, "utf8")
      : execFileSync("gh", ["pr", "list", "--state", "open", "--limit", "1000", "--json", "headRefName"], { encoding: "utf8" }),
  );
  const { batch, skipped } = pickBatch(JSON.parse(readFileSync(stateFile, "utf8")), rows, {
    parallel,
    shared: profileShared(profile),
    openBranches: prs.map((p) => p.headRefName),
    prefix,
  });
  for (const { id, reason } of skipped) console.error(`# ${id} ${reason}`);
  for (const id of batch) console.log(id);
}
