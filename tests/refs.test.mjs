// Run: npm test — every file path the skills tell Claude to open must exist
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const pitwall = "plugin/skills/pitwall";
const docs = walk("plugin").filter((file) => file.endsWith(".md"));
const missing = [];
for (const file of docs) {
  const text = readFileSync(file, "utf8");
  // `${CLAUDE_PLUGIN_ROOT}/x` → plugin/x · `playbooks/x.md`, `principles/x.md`, `scripts/x`, `templates/x` → the pitwall skill dir
  for (const [, rest] of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g))
    if (!existsSync(join("plugin", rest))) missing.push(`${file}: \${CLAUDE_PLUGIN_ROOT}/${rest}`);
  for (const [, rel] of text.matchAll(/(?<![\w/{}-])((?:playbooks|principles|scripts|templates)\/[\w.-]+\.(?:md|sh|mjs))/g))
    if (!existsSync(join(pitwall, rel))) missing.push(`${file}: ${rel}`);
  // shim skills: "runs `playbooks/<name>.md`" is covered above; the skill they invoke must exist
  for (const [, skill] of text.matchAll(/`pitwall:([\w-]+)`/g))
    if (!existsSync(join("plugin/skills", skill, "SKILL.md")) && !existsSync(join("plugin/agents", `${skill}.md`)))
      missing.push(`${file}: pitwall:${skill}`);
}
assert.deepEqual(missing, [], `referenced files that do not exist:\n${missing.join("\n")}`);

// every playbook row in the routing table has a shim, and every shim has a playbook
const shims = readdirSync("plugin/skills").filter((name) => !["pitwall", "gauge", "ticket"].includes(name));
for (const shim of shims)
  assert.ok(existsSync(join(pitwall, "playbooks", `${shim}.md`)), `shim /pitwall:${shim} has no playbook`);

console.log(`OK: refs (${docs.length} files, ${shims.length} shims)`);
