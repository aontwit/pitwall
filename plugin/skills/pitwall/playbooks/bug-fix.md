# playbook: bug-fix — reproduce first, fix, then prove it on the same screen

Use for tasks that fix wrong behavior (task `[bug]`, a plan row that says it fixes a bug) — follow this instead of the overlapping steps in `/pitwall:lap` section 4

Main risk: fixing from reading the code, then calling it done because typecheck / tests pass — a test says a branch works, it does not say the bug is gone from the page the user sees (it has happened: a PR was opened without anyone seeing the bug happen or go away)

## 1. Reproduce before touching code (step=research)

- Open **the same screen where the bug happens** (browser per the profile, the loop's dev server) on base and make the bug happen, collect evidence: console message / request / on-screen text / screenshot
- Cannot reproduce directly → build the conditions yourself: recipes in the profile's "states to build", a temporary mock config, add logs and read them while running — keep trying until the bug happens · it counts as reproduced when the symptom **matches the report** (same message / screen), not just a similar error
- You may ask a human for help **only with the profile's human-only steps** via the pair run of `/pitwall:gauge` — write a specific one-line reason why you cannot do it yourself, and only after doing everything you can yourself
- Tried every way and it still does not happen → two cases, never fix by guessing:
  - the code and the screen show the reported behaviour is **already correct** (evidence: `file:line` + what the screen shows on base) → this is "already done" (`lap.md` research): no code change, the PR only fixes the stale note / plan row and carries that evidence as its repro rows · say "not a bug" in the title
  - no evidence either way → **park as a question** with what was tried
- Repro needs a human-only step but the user is away → park "waiting for pair run" — **steps 1 and 4 must never be ⏳** (`/pitwall:lap`)

## 2. Find the root cause

Form a hypothesis → find runtime evidence → rule it out, until one mechanism is left, give `file:line` · program state unclear → add logs and read them, do not guess · logs added to find the cause are removed before commit

## 3. Fix

The smallest fix the evidence supports · "just in case" additions with no evidence they are needed → leave out · a test is possible (pure logic) → a test that fails on the base commit before the fix (the repo's test rules, profile `repo rules`)

## 4. Prove it on the same screen

Repeat every step of step 1's repro on the branch → the bug must be gone · "unsure" or a different screen = **fail** · check neighbouring paths the new code touches (e.g. the normal state where the same button must still work)

## PR additions

- Verify rows: `repro before fix (base)` + `repro after fix (branch)` — evidence for both (console message / on-screen text / request), not the word "passed"
- Root cause: mechanism + `file:line`
