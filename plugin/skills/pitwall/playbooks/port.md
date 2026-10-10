# playbook: port — bring behavior from an old branch into base

Use for rows the profile says are port work — follow this instead of the overlapping steps in `/lap` section 4

Principle: **port behavior, not code** — the destination is written in base's structure (base's service / hook / type / config), the source branch is only "the right answer" to compare results against

## 1. Pin the source

- `git fetch origin -q` → `portSha = git rev-parse origin/<source>`, store it in state — the source branch is frozen, but pin it in case a commit slips in
- Read the source only with `git show <portSha>:<path>`, never check out the source branch
- Trace it fully: the files in the row's "source" column + everything they import (hook, util, type, constant) until you see the whole picture · each piece's destination comes from the plan's hook map table
- A piece with no destination in the table → **never invent a destination yourself** — if it is not used in this row's flow, write in the PR "not ported: <piece> — no users"; if it is used → park as a question

## 2. Lock the source's answers first (first commit)

- Every piece of pure logic being ported (adapter, filter → query map, price / decimals conversion, sort, status map, building params for the SDK) must have a **parity test** where the repo's test rules put tests
- input = a real response from the dev / staging API, trimmed to what is used, written as a literal in the test file
- expected = **the output of the real source code, not written by hand**: `git show <portSha>:<file> > <scratchpad>/`, strip unrelated imports, then run it on the same input with `node --experimental-strip-types` → put the output in as fixed values + comment `golden: origin/<source>@<short portSha>:<path>`
- A source function so tangled with React / hooks that it cannot run on its own → expected comes from reading the code, put a `file:line` comment from the source on every value, and write in the PR that this golden was "read from code, not run"
- First commit = a test that **fails on base** (no destination yet) → keep the sha as `lockSha` · from here on never change expected values (`git diff <lockSha> -- <test file>` must be empty, adding cases only)

## 3. Write the destination

- Structure / names / file locations per base and the repo rules (profile `repo rules`) — base's data layer, type locations, naming and i18n, never the source's
- **Never bring over the source's components / layout** — the UI uses base's existing ones; if base has no UI the row needs → allowed only for rows the profile permits (step 3.1), otherwise out of port scope → park
- New behavior must sit behind a config / feature flag only — base's existing variants must give the same results: all existing tests pass + level B of an existing variant, 1 page
- Values not available yet (URL, contract, design) → the source's existing value + a `FIXME(<variant>)` comment only when the plan clearly allows a placeholder, otherwise park
- The source has an obvious workaround / bug → **port it as is** so the parity test passes, then write it in the PR under "found in source" — fixing it later is a separate task (`/ticket`)
- **Except security holes** (secret fallback, trusting client values, skipping permission checks) — never port as is: the plan row says how to fix it → do that and the parity test locks the fixed behavior · the plan does not say → park as a question · the review prompt (the profile's review panel + its review checklist) must ask for a security section, and the PR carries it
- 1 destination file, 1 comment at the top: `// ported from origin/<source>:<path> (<short portSha>)`

### 3.1 New UI (only for rows the profile specifies)

- **Assemble from base's components** (its UI primitives and existing layouts) per the repo rules — the source is only the reference for "what to show / how it works", never bring over its markup / classes / colours / spacing
- The same pattern already exists in base (e.g. another variant-specific filter) → follow that structure at every point, only the data may differ
- Having to decide on looks base has no example for (new layout, position on the page, new colour) → pick what is closest to base, then write it in the PR under "UI decided by the agent", item by item — never add new tokens / colours
- Level B: screenshots at the profile's viewports of base next to the source, put in the PR · the PR is **always PARTIAL** — a human must look before merge (level C: "look at the screenshots + open page X and compare")

## 4. Size

- A row over ~8 files / ~90 minutes (e.g. service + wiring + adapter in one row) → split the plan row into `<id>a`, `<id>b` (Plan correction), one sub-row per round, in order: type + adapter → service → wiring → hook

## 5. Level B — compare with the source

- Open the new variant's page on the profile's dev server and compare with the deployed source: the same set of listings, same prices, same counts
- The deployed source URL must be in the plan — not there yet → the comparison side of level B is ⏳ case 3 of `/lap` (**never guess the URL**) · when the profile pins one dev server port, the source cannot run locally side by side
- The source is behind a login page (e.g. an SSO / access proxy) → open it only in the default browser where the human is already logged in; hit a login page → ⏳ **never log in yourself**
- The parity test from step 2 is the main level A evidence — level B only confirms the wiring is complete

## 6. Code that touches money / transactions / human-only steps

- Split into 2 layers: **building params** (order, criteria, price, allowance amount) as pure functions → parity test at level A · **sending the transaction** (sign, send via SDK) → level C
- The PR is **always PARTIAL** · level C on a test network / sandbox states variant / what to do / expected result for every flow touched (connect, sign-in, approve, buy, sweep, list, cancel as relevant)

## 7. Correcting the plan along the way

| You may do it yourself (write in Decisions + Plan correction) | Must park and ask |
|---|---|
| Split a row (step 4), naming, file location, split a helper, not porting a piece with no users | Mapping differs from the plan's table, adding / changing fields in a type used across > 3 modules beyond what the plan wrote, adding a new flag / family, destination not in the hook map table |

## 8. Who writes the code

the profile's code role (`agents per task`: subagent type + model) + the matching domain checklist file in the brief (the profile's `agents per task` table) — always pass `portSha` + source path + parity test along · record in Agents used

## PR additions

- Table `source (path@portSha) | destination | notes` covering every ported piece · sections "not ported" and "found in source" (if any)
- Verify rows: `parity test (golden from origin/<source>@<portSha>, lock <lockSha>)` · `test file unchanged since lock` · `existing variants unchanged`
