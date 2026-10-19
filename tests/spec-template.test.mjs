// Run: npm test — the spec template has every section plan.md writes to (#31)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dir = "plugin/skills/pitwall";
const plan = readFileSync(`${dir}/playbooks/plan.md`, "utf8");
const spec = readFileSync(`${dir}/templates/spec.md`, "utf8");
const sections = new Set([...spec.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()));

const named = [...plan.matchAll(/spec's `## ([^`]+)`/g)].map((m) => m[1]);
assert.ok(named.length > 0, "plan.md names at least one spec section");
for (const name of named) assert.ok(sections.has(name), `templates/spec.md has \`## ${name}\` (plan.md writes there)`);
assert.match(spec, /<!-- pitwall:spec-schema \d+ -->/, "the spec carries its schema version");
assert.match(plan, /templates\/spec\.md/, "plan.md creates the spec from the template");
assert.match(readFileSync(`${dir}/templates/agent-loop.md`, "utf8"), /^\| spec \|/m, "the profile has a spec row");

console.log("OK: spec template");

// survey (#32): the marker plan.md writes is the one the spec template explains to its readers
const marker = /`\(inferred from <file>\)`/;
assert.match(plan, marker, "plan.md marks unconfirmed lines");
assert.match(spec, marker, "templates/spec.md explains the marker");
assert.match(plan, /^\| survey \|/m, "plan.md has the survey mode");
console.log("OK: survey marker");
