# playbook: plan — interview the owner, write the spec and the plan rows

Use for `/pitwall:plan` · the front of the loop: an empty repo, a phase whose rows are still `TBD`, or a decision that changed → spec + plan rows that `/pitwall:queue` can pick · it runs **outside** the loop, so it asks in rounds (SKILL.md rule 3 still governs the loop) · it never writes code and ends with a docs-only PR that the human merges · the shape follows two existing interview patterns: a whole-product interview first, then one small interview per phase or change, each confirmed before it stops

Arguments: none = choose the mode in step 0 · `/pitwall:plan <phase>` = that phase · `/pitwall:plan <a changed decision in words>` = amend

## 0. Mode (read only, no questions)

Read the profile `plan` section: plan location, `spec`, `question banks` (both optional) · no profile → stop: "run `/pitwall:init` first"

| Mode | When | Covers |
|---|---|---|
| new | no spec file (or it is empty), and the base has no code yet (a new repo, below) | the whole product: brief, then each area, then phases, then the first phase's rows |
| survey | no spec file (or it is empty), but the base already has code | what the code already says: a drafted spec the owner confirms (section 1b), then `phase` for the rows if the owner wants them |
| phase | the argument names a phase, or the next phase in reading order has rows marked `TBD` | that phase only: its open items, then its rows |
| amend | the argument describes a decision that changed | that decision, the spec section it touches, and the rows it affects |

**New repo**: the base has no code yet, i.e. `git ls-tree -r --name-only origin/<base>` lists only docs and config (`*.md`, `LICENSE*`, `.gitignore`, `.github/**`, `.claude/**`). Mode `new` then adds the stack round (step 2) and phase 0 (step 3)

## 1. Read before asking

- Read the spec, the plan files (`git show origin/<base>:<path>`), the repo rules and the plan's answered questions
- Make the list for this mode: items the spec labels open or deferred, rows marked `TBD`, people gates, plan open questions, and anything the question bank files ask
- Drop every question a file already answers. A likely reading becomes a claim the owner can correct, not a menu
- No question bank in the profile → use the generic order in step 2

## 1b. Survey: read the code, draft the spec (mode `survey` only)

The code already answers most of what `new` would ask, so read it first and ask only to confirm. Repo evidence is a claim, not an answer, until the owner confirms it
- Read in this order: `node <pitwall dir>/scripts/detect.mjs . --ref origin/<base>` (stack, checks, dev server) · the README and any docs · the entry points the user touches (web: `app/` / `pages/` routes, API handlers · Godot: `project.godot` main scene and autoloads, `*.tscn` scenes) · the data shapes (schemas, models, types, saved-game / resource classes) · the tests (they state intended behaviour) · the last ~30 commit subjects
- Copy `<pitwall dir>/templates/spec.md` to `SPEC.md` on the plan branch (step 3) and fill each section with what the code shows. Every line ends with `(inferred from <file>)`. `## Terms` lists the domain words the code uses (type, table, scene and route names) with what each seems to mean. A section the code doesn't show stays empty, never a guess
- Ask in the step 2 rounds, but the questions are about the draft: a round shows 3–6 inferred lines of one section, and asks "is this right?" with the shakiest line turned around as the second option. A confirmed line swaps its `(inferred from …)` for `(owner <date>)`. A corrected line takes the owner's words
- At most 6 questions in all, and none that a file you read answers. Lines still unconfirmed when the owner stops keep their `inferred` mark, and `queue` treats them as open
- Then offer rows: "plan the next work now" → mode `phase` for it, or "spec only" → step 4

## 2. Ask in rounds

- AskUserQuestion with **2–3 questions per round** and ≤ 4 options each. Write them in the profile's user language, put the recommended option first with its marker, and make each description say what the option does to the plan · labels and options per SKILL.md rule 3 (plain words, every option a full answer)
- Ask only the frontier: questions whose prerequisites are settled. A dependent question waits for the next round. A root question that reshapes everything after it is asked alone. Examples: what the product is, who it is for, the riskiest question
- From round 2 on, put a 3–6 line summary of the last round in the message and make the first question "is this right?": "yes, go on" (recommended) and, as the second option, the summary line you are least sure of turned around ("no: <the other answer>"), so the likely fix is one click; any other fix is typed in Other
- Record each round (step 3) before you ask the next one
- Stop when every item on the step 1 list is answered or recorded as open, and the owner confirms the last summary. If the owner says stop, record what is answered and leave the rest open
- Generic order for mode `new`:
  1. brief: what it is, who it is for, the riskiest question, the date that holds while scope moves, and what it will not do
  2. stack, new repo only, once, in plain words: the owner may not know any framework names, so options never are one · "Recommend one for me" (recommended): you propose one stack that fits the brief, with a one-line reason the owner can follow ("2D, opens from a link, no server"), and the deploy target when one constrains it, recorded as `delegated: <stack> — <reason>` · "I already have a stack in mind" → they type it in Other · goes to the spec's `## Stack` · never pick the stack without this question · phase 0's `0.1` is the cheap moment to change it: the owner sees a running screen before any product row
  3. MVP line: what is in v1 and what comes later
  4. each area of the spec, from the question bank
  5. phases: order by risk, the people gates (🚪), and what each phase ends with
  6. how the loop runs: queue the whole phase, one lap at a time, or split rows with people

## 3. Record as you go

Work on a branch from the profile's agent branch pattern (`<id>` = `plan`) · nothing stays only in chat, because context compaction loses it

- Profile `spec` is `none` → before the first record, copy `<pitwall dir>/templates/spec.md` to `SPEC.md` at the root on this branch and set the profile `plan` section's `spec` row to `SPEC.md` (same PR). Never write a second spec next to an existing `PRODUCT.md`
- Product decisions go into the spec, in the section they belong to, with `(owner <date>)`. Anything still undecided gets the spec's open label
- New repo → phase 0 comes before every product phase, and the first product phase's rows say "needs 0.2 merged":
  - `0.1` scaffold in the chosen stack · Done when: the app starts locally from a clean clone with the commands in the README
  - `0.2` checks: typecheck / lint / test / build as repo scripts (those the stack has), one passing test, and a CI workflow that runs them · Done when: CI is green on the PR, and the profile's `checks` section names these commands (same PR)
  - `0.3` a verification skill at `.claude/skills/verify-<app>/SKILL.md` (write it with `/pitwall:verify-setup`) that launches the app, drives one screen and captures evidence · Done when: it ran once end to end in the PR's Verify table, and the profile's `verification skill` row (level B section) points at it (same PR)
- Order and process decisions go into the plan's answered table (question · answer · date). Items still open go to the profile's `open questions` location
- Rows follow the profile row format. Each row cites a spec section, names its files (≤ ~8), and has a checkable "Done when". Dependencies go in the task text ("needs X merged")
- A row that needs a human verdict is a 🚪 gate row. A phase that is not ready keeps `TBD`, so `/pitwall:queue` skips it
- A decision that changes a ticked row adds a new row that cites the old id. Ticked rows are never edited

## 4. Check

- Read every new or changed row back: does it have files, "Done when" and a spec reference?
- Run the profile's level A checks that cover docs (lint, commit message)
- Every answered question can be found in a file. Quote each one with the line where it landed

## 5. PR + report

- Commit with the profile pattern (a docs type), push the branch, and open a PR against the base. The body has a table of decision · where it lands · date, the checks that ran, and **Decisions to confirm** (defaults taken, or "none")
- `opening-a-pr.md` and its verifier row do not apply. A plan PR has no code to verify, and the owner confirmed every decision live. In place of the verifier row the body has a `## Verify` section whose line starts with `Plan PR` (e.g. `Plan PR: docs only, no code to verify. The owner confirmed every decision live`); both words stay in English. Run the PR-body check on it (`node <pitwall dir>/scripts/check-pr-body.mjs --file <body file>`, or the profile's own) and open the PR only when it passes
- Report in the profile's user language: what was decided, where it landed, what is still open, and the PR link. Next steps: merge, then `/pitwall:queue`

## Never

Write code · tick a row · answer an open item yourself · ask what a file answers · ask more than 3 questions in a round
