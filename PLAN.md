# Plan

Tasks for the agent loop. One row = one task = one PR. Add rows by hand or with `/pitwall:queue <task in words>` (the row lands with the task's PR). Task PRs never tick their row: the loop ticks rows and writes the Progress log in one docs PR after the task PRs merge. Ticked rows stay as history.

## Tasks

| ID | Task | Files | Done when |
|---|---|---|---|
| P1 | [ ] Profile values for parallel laps: `parallel: <n>` (missing = 1) and the dev server `port: fixed \| free` in the profile contract and the template, checked by doctor (SPEC: Parallel laps) | `plugin/skills/pitwall/SKILL.md`, `plugin/skills/pitwall/templates/agent-loop.md`, `plugin/skills/pitwall/scripts/doctor.sh`, `tests/doctor.test.mjs` | doctor passes a profile with `parallel: 2` / `port: fixed`, fails `parallel: 0` and a bad `port` value, passes a profile with neither (test cases) · `plugin validate --strict` passes |
| P2 | [x] Script that picks the batch: pickable queue items (not blocked, `waitFor` merged, no open PR), no shared file across the batch except the profile's `resolve conflicts yourself` globs, at most `parallel` (SPEC: Parallel laps) | `plugin/skills/pitwall/scripts/pick-batch.mjs`, `tests/pick-batch.test.mjs` | tests: two rows with no shared file → both picked · a shared code file → only the first · a shared `CHANGELOG.md` → both · cap 1 → one · a `waitFor` not merged → skipped |
| P3 | [ ] Lead mode in lap: with `parallel` > 1, pick the batch with `pick-batch.mjs`, start one background worker per task in its own worktree (`isolation: worktree`), each running the lap's steps 3–7 to an open PR; the lead alone writes state (`running[]`, one entry per task), holds the dev server for one task at a time when `port: fixed`, runs pair runs one at a time, and takes over the review panel, verifier and PR when a worker has no `Agent` tool; stop / brake wait for or save every worker. Needs P1 and P2 merged (SPEC: Parallel laps) | `plugin/skills/pitwall/playbooks/lap.md`, `plugin/skills/pitwall/playbooks/drive.md`, `plugin/skills/pitwall/playbooks/stop.md`, `plugin/skills/pitwall/playbooks/brake.md`, `tests/playbook-bodies.test.mjs` | `parallel` unset → the lap reads as today (diff shows no change to that path) · a dry walk of lap with `parallel: 2` on the fixture queue names the batch and each worker's brief · `tests/playbook-bodies.test.mjs` and both `plugin validate --strict` pass |
| P4 | [ ] Docs for parallel laps: README Status and profile section, the docs site guide, a CHANGELOG `Unreleased` entry. Needs P3 merged (SPEC: Parallel laps) | `README.md`, `site/src/content/guides/*`, `CHANGELOG.md` | `npm run build --prefix site` passes · the guide page at 393 and 1366 px, console errors = 0 |
| P5 | [ ] 🚪 Live run with `parallel: 2` on a sample repo with two independent rows: both PRs open with VERIFIED verdicts, state holds both entries, no port clash. Needs P4 merged (SPEC: Parallel laps) | none (sample repo) | the owner reads both PRs and the state file and says it works |
| M1 | [ ] Profile values for auto merge: `merge: human \| auto` (missing = `human`) and `dev branch` in the `git` section; `init` asks them only when the repo has a dev branch and names the permission rule the user must add for `gh pr merge`; doctor fails `auto` with no dev branch, a dev branch that does not exist on origin, or one that is `main` / a branch never to touch; SKILL.md rule 5 reads "Humans merge, except into the dev branch under `merge: auto`". Needs P1 merged (SPEC: Auto merge) | `plugin/skills/pitwall/SKILL.md`, `plugin/skills/pitwall/templates/agent-loop.md`, `plugin/skills/pitwall/playbooks/init.md`, `plugin/skills/pitwall/scripts/doctor.sh`, `tests/doctor.test.mjs` | doctor test cases: `merge: auto` + existing `dev branch` passes · `auto` with no dev branch, a missing branch, or `main` fails · no `merge` row passes as `human` · both `plugin validate --strict` pass |
| M2 | [ ] Script that judges one PR for auto merge: reads `gh pr view` JSON, the state `verified` entries and the profile, prints `MERGE` or `HOLD <gate>: <reason>` for gates 1–3 of the spec (VERIFIED verdict at the current patch-id, no `- [ ]` in "Not done yet", green CI run on the current base) and the always-human kinds (Always park, CI / check / baseline changes) (SPEC: Auto merge) | `plugin/skills/pitwall/scripts/merge-gate.mjs`, `tests/merge-gate.test.mjs` | tests: VERIFIED + no boxes + green → `MERGE` · PARTIAL → `HOLD 1` · a stale patch-id → `HOLD 1` · one `- [ ]` → `HOLD 2` · a failing or pre-retarget check → `HOLD 3` · a change under `.github/workflows/` → `HOLD always-human` |
| M3 | [ ] Auto merge in the lap's PR sync: with `merge: auto`, walk each stack into the dev branch bottom-up, one PR per step: `merge-gate.mjs`, then gate 4 (fresh dev branch, merge it in and wait for CI when it touched the patch's files, hold on the third round), `gh pr merge --merge`, read back `MERGED` (gate 5), retarget the child per `/pitwall:merge-order` step 2; no merges while stop / brake is set (gate 6); a held PR goes in the round report and a push notification. `/pitwall:merge-order` "Never" names the auto-merge exception. Needs M1, M2 and P3 merged (SPEC: Auto merge) | `plugin/skills/pitwall/playbooks/lap.md`, `plugin/skills/pitwall/playbooks/merge-order.md`, `plugin/skills/pitwall/playbooks/stop.md`, `plugin/skills/pitwall/playbooks/brake.md`, `tests/playbook-bodies.test.mjs` | `merge: human` → the PR sync reads as today (diff shows no change to that path) · `tests/playbook-bodies.test.mjs` and both `plugin validate --strict` pass |
| M4 | [ ] Docs for auto merge: README (who it is for, the gates, the permission rule), the docs site guide, a CHANGELOG `Unreleased` entry; README Status lists it as not proven until M5. Needs M3 merged (SPEC: Auto merge) | `README.md`, `site/src/content/guides/*`, `CHANGELOG.md` | `npm run build --prefix site` passes · the guide page at 393 and 1366 px, console errors = 0 |
| M5 | [ ] 🚪 Live run on a sample repo with a `dev` branch and `merge: auto`: a passing PR merges into `dev` by itself, a PARTIAL PR and a PR that edits a CI workflow stay open with their hold reason, `main` is untouched. Needs M4 merged (SPEC: Auto merge) | none (sample repo) | the owner reads the three PRs and the round report and says it works |

## Answered questions

| Question | Answer | Date |
|---|---|---|
| How is #42 split into PRs? | P1–P5 as above; P1 and P2 can run together, P3 needs both | 2026-10-21 |
| How does the loop run these rows? | `/pitwall:queue` P1–P4, then `/pitwall:drive`; P5 is a gate for the owner | 2026-10-21 |
| How is auto merge split into PRs? | M1–M5 as above; M2 can start now, M1 needs P1, M3 needs M1, M2 and P3 | 2026-10-21 |
| How does the loop run the auto-merge rows? | M1–M4 join the end of the running queue; M5 is a gate for the owner | 2026-10-21 |

## Open questions

| # | Question | Blocks |
|---|---|---|

## Progress log

| Date | Task | PR | Evidence |
|---|---|---|---|
| 2026-10-21 | P2 feat(pick-batch): script that picks the batch for a parallel lap | #48 | see PR |
