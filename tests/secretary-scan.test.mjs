// Run: npm test
import assert from "node:assert/strict";

import { extractTurns, redact } from "../plugin/skills/pitwall/scripts/secretary-scan.mjs";

const line = (record) => JSON.stringify({ timestamp: "2026-10-06T10:00:00Z", sessionId: "abcdef12-x", ...record });
const user = (content, extra = {}) => line({ type: "user", uuid: extra.uuid ?? Math.random().toString(), message: { content }, ...extra });

const lines = [
  user("ลำดับ merge ย้ำหลายรอบแล้ว"),
  user([{ type: "text", text: "<ide_selection>code</ide_selection>" }, { type: "text", text: "แก้ตรงนี้" }]),
  user([{ type: "tool_result", content: "ok" }]),
  user("<command-name>/queue</command-name><command-args>agent</command-args>"),
  user("<task-notification>done</task-notification>"),
  user("caveat", { isMeta: true }),
  user("summary", { isCompactSummary: true }),
  user("subagent prompt", { isSidechain: true }),
  user("dup", { uuid: "same" }),
  user("dup", { uuid: "same" }),
  user([{ type: "image" }]),
  user("old", { timestamp: "2026-09-01T00:00:00Z" }),
  "not json",
  line({ type: "assistant", uuid: "a1", message: { content: [{ type: "text", text: "merge #101 first" }] } }),
];

const texts = extractTurns(lines, { since: "2026-10-01" }).map((turn) => turn.text);
assert.deepEqual(
  texts,
  ["ลำดับ merge ย้ำหลายรอบแล้ว", "แก้ตรงนี้", "/queue agent", "dup", "[1 image]"],
  "keeps only what the human typed: no tool results, envelopes, meta, summaries, subagents, replays or old turns"
);

const withAgent = extractTurns(lines, { since: "2026-10-01", assistant: true });
assert.equal(withAgent.at(-1).who, "A", "--assistant adds what the agent told the user");
assert.equal(withAgent.at(-1).text, "merge #101 first", "assistant text is kept as said");

assert.equal(
  redact('token "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI0OCJ9.sig_part-1" ok'),
  'token "[secret]" ok',
  "a pasted JWT never reaches the report"
);
assert.equal(redact("wallet 0xf488b58ce5Ae48D63Ef2a8d6d63cb1c5ACc5e3a2"), "wallet 0xf488b58ce5Ae48D63Ef2a8d6d63cb1c5ACc5e3a2", "addresses are not secrets");

console.log("OK: secretary scan keeps human turns only");
