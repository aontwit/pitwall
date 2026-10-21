# Plan

Tasks for the agent loop. One row = one task = one PR. Add rows by hand or with `/pitwall:queue <task in words>` (the row lands with the task's PR). Task PRs never tick their row: the loop ticks rows and writes the Progress log in one docs PR after the task PRs merge. Ticked rows stay as history.

## Tasks

| ID | Task | Files | Done when |
|---|---|---|---|
| P1 | [ ] Profile values for parallel laps: `parallel: <n>` (missing = 1) and the dev server `port: fixed \| free` in the profile contract and the template, checked by doctor (SPEC: Parallel laps) | `plugin/skills/pitwall/SKILL.md`, `plugin/skills/pitwall/templates/agent-loop.md`, `plugin/skills/pitwall/scripts/doctor.sh`, `tests/doctor.test.mjs` | doctor passes a profile with `parallel: 2` / `port: fixed`, fails `parallel: 0` and a bad `port` value, passes a profile with neither (test cases) · `plugin validate --strict` passes |
| P2 | [ ] Script that picks the batch: pickable queue items (not blocked, `waitFor` merged, no open PR), no shared file across the batch except the profile's `resolve conflicts yourself` globs, at most `parallel` (SPEC: Parallel laps) | `plugin/skills/pitwall/scripts/pick-batch.mjs`, `tests/pick-batch.test.mjs` | tests: two rows with no shared file → both picked · a shared code file → only the first · a shared `CHANGELOG.md` → both · cap 1 → one · a `waitFor` not merged → skipped |
| P3 | [ ] Lead mode in lap: with `parallel` > 1, pick the batch with `pick-batch.mjs`, start one background worker per task in its own worktree (`isolation: worktree`), each running the lap's steps 3–7 to an open PR; the lead alone writes state (`running[]`, one entry per task), holds the dev server for one task at a time when `port: fixed`, runs pair runs one at a time, and takes over the review panel, verifier and PR when a worker has no `Agent` tool; stop / brake wait for or save every worker. Needs P1 and P2 merged (SPEC: Parallel laps) | `plugin/skills/pitwall/playbooks/lap.md`, `plugin/skills/pitwall/playbooks/drive.md`, `plugin/skills/pitwall/playbooks/stop.md`, `plugin/skills/pitwall/playbooks/brake.md`, `tests/playbook-bodies.test.mjs` | `parallel` unset → the lap reads as today (diff shows no change to that path) · a dry walk of lap with `parallel: 2` on the fixture queue names the batch and each worker's brief · `tests/playbook-bodies.test.mjs` and both `plugin validate --strict` pass |
| P4 | [ ] Docs for parallel laps: README Status and profile section, the docs site guide, a CHANGELOG `Unreleased` entry. Needs P3 merged (SPEC: Parallel laps) | `README.md`, `site/src/content/guides/*`, `CHANGELOG.md` | `npm run build --prefix site` passes · the guide page at 393 and 1366 px, console errors = 0 |
| P5 | [ ] 🚪 Live run with `parallel: 2` on a sample repo with two independent rows: both PRs open with VERIFIED verdicts, state holds both entries, no port clash. Needs P4 merged (SPEC: Parallel laps) | none (sample repo) | the owner reads both PRs and the state file and says it works |

## Answered questions

| Question | Answer | Date |
|---|---|---|
| How is #42 split into PRs? | P1–P5 as above; P1 and P2 can run together, P3 needs both | 2026-10-21 |
| How does the loop run these rows? | `/pitwall:queue` P1–P4, then `/pitwall:drive`; P5 is a gate for the owner | 2026-10-21 |

## Open questions

| # | Question | Blocks |
|---|---|---|

## Progress log

| Date | Task | PR | Evidence |
|---|---|---|---|
