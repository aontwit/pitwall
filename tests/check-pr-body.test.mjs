// Run: npm test
import assert from "node:assert/strict";

import { checkPrBody } from "../plugin/skills/pitwall/scripts/check-pr-body.mjs";

const VERIFIER =
  "| Verifier | — | pitwall-agent sonnet @abc1234 patch 0123456789ab | ✅ VERIFIED |";

const body = (notDone) =>
  [
    "## Summary",
    "- [ ] outside",
    "",
    "## Verify",
    "| a | VERIFIED |",
    VERIFIER,
    "",
    "## Not done yet",
    notDone,
    "",
    "## Other",
    "- [ ] also outside",
  ].join("\n");

assert.deepEqual(
  checkPrBody(body("- [x] done thing")),
  { ok: true, problems: [] },
  "a body with only ticked boxes is OK",
);
assert.equal(
  checkPrBody(body("- [ ] ⏳ case 3: no wallet")).ok,
  true,
  "an open box with a wait marker and case 3 is OK",
);
assert.equal(
  checkPrBody(body("- [ ] ⏳ CASE 1: wallet")).ok,
  true,
  "case is matched case-insensitively",
);
assert.equal(
  checkPrBody(body("- [ ] B — something")).ok,
  false,
  "an open box without a wait marker must fail",
);
assert.equal(
  checkPrBody(body("- [ ] ⏳ waiting")).ok,
  false,
  "a wait marker without a case number must fail",
);
assert.equal(
  checkPrBody(body("- [ ] case 2 only")).ok,
  false,
  "a case number without the wait marker must fail",
);
assert.equal(
  checkPrBody("## Not done yet\n- [x] x").ok,
  false,
  "a body without a Verify heading must fail",
);
assert.equal(
  checkPrBody(`# Verify\n${VERIFIER}\n`).ok,
  true,
  "a Verify heading of any level 1-3 counts, no Not-done section needed",
);

const withHeading = (heading, line) => `## Verify\n${VERIFIER}\n\n${heading}\n${line}\n`;
assert.equal(
  checkPrBody(withHeading("# Not done yet", "- [ ] B")).ok,
  false,
  "an h1 Not done yet heading opens the section",
);
assert.equal(
  checkPrBody(withHeading("### Not done yet", "- [ ] B")).ok,
  false,
  "an h3 Not done yet heading opens the section",
);
assert.equal(
  checkPrBody(withHeading("**Not done yet**", "- [ ] B")).ok,
  false,
  "a bold Not done yet line opens the section",
);
assert.equal(
  checkPrBody(withHeading("**Not done yet**", "- [ ] ⏳ case 1: wallet")).ok,
  true,
  "a valid wait box under a bold section is OK",
);
assert.equal(
  checkPrBody(`## Verify\n${VERIFIER}\n## Not done yet\n### Notes\n- [ ] free text`).ok,
  true,
  "a deeper heading closes the Not done yet section",
);
for (const bullet of ["*", "+"]) {
  assert.equal(
    checkPrBody(withHeading("## Not done yet", `${bullet} [ ] B`)).ok,
    false,
    `a "${bullet}" bullet box is checked`,
  );
}
assert.equal(
  checkPrBody(withHeading("## Not done yet", "- [ ] ⏳ case 12: x")).ok,
  false,
  "case 12 is not case 1",
);
assert.equal(
  checkPrBody(withHeading("## Not done yet", "- [ ] ⏳ case 1")).ok,
  false,
  "a case without a reason must fail",
);
assert.equal(
  checkPrBody(withHeading("## Not done yet", "- [ ] ⏳ case 1: wallet")).ok,
  true,
  "case 1 with a reason is OK",
);
assert.deepEqual(
  checkPrBody(`## Verify\n${VERIFIER}\n- [ ] stray`),
  { ok: false, problems: ["open box outside a Not done yet section: - [ ] stray"] },
  "an open box in a body with no Not done yet section must fail",
);

const verifyWith = (row) =>
  checkPrBody(`## Verify\n| typecheck | A | x | ✅ |\n${row}\n## Notes\n`);
assert.equal(verifyWith(VERIFIER).ok, true, "a verifier row with head SHA and patch-id is OK");
assert.deepEqual(
  checkPrBody("## Verify\n| typecheck | A | x | ✅ |\n"),
  {
    ok: false,
    problems: [
      "no verifier row in the Verify section: `| Verifier | … @<head sha> patch <patch-id> | ✅ VERIFIED or PARTIAL |`",
    ],
  },
  "a Verify section without the verifier row must fail",
);
assert.equal(
  verifyWith("| Verifier | — | pitwall-agent sonnet | ✅ VERIFIED |").ok,
  false,
  "a verifier row not pinned to a head SHA and patch-id must fail",
);
assert.equal(
  verifyWith("| Verifier | — | pitwall-agent sonnet @abc1234 | ✅ VERIFIED |").ok,
  false,
  "a verifier row without a patch-id must fail",
);
assert.equal(
  checkPrBody(`## Verify\n| a | ✅ |\n## Notes\n${VERIFIER}\n`).ok,
  false,
  "a verifier row outside the Verify section does not count",
);
assert.equal(
  verifyWith("| Verifier | — | pitwall-agent sonnet @abc1234 patch 0123456789ab | ❌ FAIL |").ok,
  false,
  "a verifier row with a FAIL verdict must fail",
);
assert.equal(
  verifyWith("| Verifier | — | pitwall-agent sonnet @abc1234 patch 0123456789ab | ✅ PARTIAL |").ok,
  true,
  "a PARTIAL verdict is a passing verdict",
);
assert.equal(
  checkPrBody(`## Verify\n| a | ✅ |\n### Pair run\n| b | ✅ |\n${VERIFIER}\n## Notes\n`).ok,
  true,
  "a deeper heading inside Verify does not end the section",
);

console.log("OK: PR body checked");
