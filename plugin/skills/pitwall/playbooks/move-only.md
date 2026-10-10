# playbook: move-only — a refactor whose behavior must stay the same

Use for moving / restructuring code where the output must not change (e.g. wiring keyed by variant, moving a service, splitting a module) — follow this instead of the overlapping steps in `/pitwall:lap` section 4

## 1. Lock behavior before changing anything (first commit)

- Write a **characterization test that imports the real thing** (the table / function that will move) and lock the output **for every input actually used** with fixed values — e.g. every variant in the config → the query / rootField / adapter it gets
- Never use a made-up table (stub) instead of the real one — a stub proves only the lookup mechanism, it does not prove "the same as before"
- Logic buried in a hook / component that cannot be tested directly → extract the pure-function part first (no behavior change), then test it
- First commit = the test (+ the extraction, if any) **must pass on base before changing anything** → record the sha in state (`lockSha`)

## 2. Refactor

- **Never edit the test files from the first commit** — checking adds an item: `git diff <lockSha> -- <test file>` must be empty and the original tests still pass
- Having to edit the test to make it pass = behavior changed → not move-only → park as a question

## 3. Level B

- Per the time in the profile — stuck → change approach / build the conditions per "states to build" · ⏳ only for items that need a human-only step (`/pitwall:lap` gauging)
- The test from step 1 is the main level A evidence of "the same as before" — level B is only extra confirmation

## 4. Correcting the plan along the way

| You may do it yourself (write in Decisions + Plan correction) | Must park and ask |
|---|---|
| Narrow the scope, naming, file location, split a helper | Change a type / contract used across > 3 modules, change data shape, change behavior, conflict with the plan's §architecture in design terms |

## 5. Who writes the code

> ~150 lines or > 3 files → agents per task (profile) · smaller than that, main may do it — record in Agents used every time

## 6. Code that touches money / transactions / human-only steps

The PR is **always PARTIAL** · level C must state variant / what to do / expected result for every flow touched (connect, sign-in, buy, list, cancel as relevant)

## PR additions

- Verify rows: `characterization test (lock <lockSha>)` · `test file unchanged since lock`
- Decisions: every point that differs from the plan
