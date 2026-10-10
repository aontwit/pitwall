// Checks a PR body against the pitwall template: a Verify heading with the independent verifier
// row, and every open box under "Not done yet" is a ⏳ wait case (case 1-3). Run: node check-pr-body.mjs --pr <n> | --file <path> | < stdin
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The independent verifier's passing verdict, pinned to the head SHA and patch-id it ran at (gauge skill).
const VERIFIER_ROW =
  /^\|\s*Verifier\s*\|.*@[0-9a-f]{7,40}\b.*\bpatch [0-9a-f]{8,40}\b.*✅ (VERIFIED|PARTIAL)\b/i;

/** { ok, problems } for a PR body. */
export const checkPrBody = (body) => {
  const problems = [];
  const lines = body.split("\n");
  const isVerifyStart = (line) => /^#{1,3} Verify/.test(line);
  const hasVerify = lines.some(isVerifyStart);
  if (!hasVerify) problems.push("no heading matching `^#{1,3} Verify`");
  let verifyLevel = 0; // heading level of the open Verify section, 0 = outside it
  let hasVerifierRow = false;
  let inNotDone = false;
  const isNotDoneStart = (line) => /^(#{1,3} |\*\*)Not done yet/.test(line);
  const hasNotDone = lines.some(isNotDoneStart);
  for (const line of lines) {
    const heading = /^(#{1,3}) /.exec(line);
    if (heading || /^\*\*Not done yet/.test(line)) {
      inNotDone = isNotDoneStart(line);
      // Verify ends only at a heading of the same or a higher level (a `### Pair run` stays inside).
      if (isVerifyStart(line)) verifyLevel = heading[1].length;
      else if (!heading || heading[1].length <= verifyLevel) verifyLevel = 0;
    } else if (verifyLevel && VERIFIER_ROW.test(line)) {
      hasVerifierRow = true;
    } else if (/^\s*[-*+] \[ \]/.test(line)) {
      if (!inNotDone) {
        if (!hasNotDone) problems.push(`open box outside a Not done yet section: ${line.trim()}`);
      } else if (!line.includes("⏳") || !/\bcase [123]\b[:\s]+\S/i.test(line)) {
        problems.push(
          `open box under "Not done yet" needs ⏳ and "case 1/2/3" with a reason: ${line.trim()}`,
        );
      }
    }
  }
  if (hasVerify && !hasVerifierRow) {
    problems.push(
      "no verifier row in the Verify section: `| Verifier | … @<head sha> patch <patch-id> | ✅ VERIFIED or PARTIAL |`",
    );
  }
  return { ok: problems.length === 0, problems };
};

const usage = () => {
  console.error("Usage: check-pr-body.mjs --pr <number> | --file <path> | < body-on-stdin");
  process.exit(2);
};

const readBody = () => {
  const args = process.argv;
  const arg = (name) => {
    const at = args.indexOf(name);
    if (at === -1) return undefined;
    return args[at + 1] ?? usage();
  };
  const pr = arg("--pr");
  if (pr)
    return execFileSync("gh", ["pr", "view", pr, "--json", "body", "-q", ".body"], {
      encoding: "utf8",
    });
  const file = arg("--file");
  if (!file && process.stdin.isTTY) usage();
  return readFileSync(file ?? 0, "utf8");
};

if (Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, problems } = checkPrBody(readBody());
  if (ok) console.log("PR body OK");
  else {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
