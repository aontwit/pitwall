# Changelog

## Unreleased

- `/pitwall:plan`: the front of the loop. It interviews the owner in rounds of 2–3 tick-box questions, recording each answer in the spec or plan before the next round, and writes plan rows `queue` can pick. Modes: `new` (whole product), `phase` (open a `TBD` phase), `amend` (a decision changed). It ends with a docs-only PR. Optional profile `plan` keys: `spec` and `question banks`, so domain questions (art, economy …) live in the repo and not in the skill
- `init` points to `/pitwall:plan` when the plan has no rows yet
- Docs conflicts between sibling agent PRs: `scripts/resolve-docs-conflict.mjs` does `merge-order` 2b's union (base's lines first, a task row once and ticked if either side ticked) and refuses what union cannot decide. The patch-id leaves out the profile's "resolve conflicts yourself" files, so fixing a plan-log conflict no longer makes the verdict stale and forces a re-verify. A commit-msg hook that refuses git's merge message gets the profile's commit pattern instead. Found on Guild Register: every merge left the other open PRs conflicting in the plan's rows and log

## 0.3.0 — 2026-10-10

Fixes and a GitHub Issues tracker from the first run on a repo outside JavaScript / TypeScript (Godot).

- `tracker: github`: GitHub Issues as a tracker, through `gh` alone. Status moves through labels the profile names. A plan row becomes a sub-issue of one parent issue per phase. The open milestone with the nearest due date stands in for the sprint. The agent never closes an issue, and PRs say `Refs #n`, so QA still decides when work is done
- `init` takes the commit / PR title pattern from the repo's own rule (commit-msg hook, commitlint, CI check, rules files, then recent commits), not a fixed `<type>: <summary>` that the repo's hook could reject
- `init` reads check commands from the `run:` steps of CI workflows when the repo has no package scripts, and knows `project.godot`
- `init` flags a project-scope install whose `.claude/settings.json` lacks the `extraKnownMarketplaces` entry a teammate's clone needs; the README shows the entry
- README Status: `init` and `doctor` have run on a Godot (GDScript) repo

## 0.2.1 — 2026-10-10

- README: a Status section that lists what has been proven on real repos and what has not
- A wakeup round that opens a PR, parks a task or stops the loop sends one push notification, so an away user hears about it
- `drive` keeps looping: every wakeup prompt is `/loop /pitwall:lap` (a bare `/pitwall:lap` ran once and stopped)
- `drive` starts only with a pickable task, not a queue of blocked ones
- `gauge`: one dev server per checkout, short polls for long waits
- `lap`: an install blocked by a locked file moves to a separate worktree
- `bug-fix`: a bug that cannot be reproduced because the behaviour is already correct ends in a no-code PR with the evidence, not a park; `lap` allows that one case
- `init` lists the plan file under "resolve conflicts yourself", since every PR appends to it

## 0.2.0 — 2026-10-10

Fixes from the first runs on two other repos.

- `init` picks the base from the branch merged work PRs target, skipping release PRs (`<base> → release`), and asks when it differs from `origin/HEAD`
- `init` fetches and reads every file from `origin/<base>`, not a working tree that may be behind (a repo that had moved from one package manager to another got the old commands)
- `init` flags a profile or plan file that `.gitignore` hides, and its report says to commit both before the first lap
- `init` puts two different models in the review panel
- `doctor` flags a profile whose install command no longer matches the base's lockfile
- `lap` counts a reviewer severity outside `CRITICAL` / `WARNING` / `INFO` as `INFO`
- README: install scopes (user, project, local) and how to update

## 0.1.0 — 2026-10-10

- First plugin release of pitwall
- Commands: `/pitwall:init`, `doctor`, `queue`, `drive`, `lap`, `stop`, `brake`, `merge-order`, `secretary`, plus `/pitwall:gauge` and `/pitwall:ticket`
- Trackers: `clickup` or `none` (the PR is the record)
- `/pitwall:queue <task in words>` adds a plan row; `init` creates `PLAN.md` when a repo has no tracker and no plan
- Routing eval: 6 cases, Thai and English (`plugin/evals/`, run locally with `claude plugin eval plugin --scaffold`)
