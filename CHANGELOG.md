# Changelog

## 0.2.0 — 2026-10-10

Fixes from the first runs on two other repos.

- `init` picks the base from the branch merged work PRs target, skipping release PRs (`<base> → release`), and asks when it differs from `origin/HEAD`
- `init` fetches and reads every file from `origin/<base>`, not a working tree that may be behind (a repo that had moved from one package manager to another got the old commands)
- `init` flags a profile or plan file that `.gitignore` hides, and its report says to commit both before the first lap
- `init` puts two different models in the review panel
- `lap` counts a reviewer severity outside `CRITICAL` / `WARNING` / `INFO` as `INFO`
- README: install scopes (user, project, local) and how to update

## 0.1.0 — 2026-10-10

- First plugin release of pitwall
- Commands: `/pitwall:init`, `doctor`, `queue`, `drive`, `lap`, `stop`, `brake`, `merge-order`, `secretary`, plus `/pitwall:gauge` and `/pitwall:ticket`
- Trackers: `clickup` or `none` (the PR is the record)
- `/pitwall:queue <task in words>` adds a plan row; `init` creates `PLAN.md` when a repo has no tracker and no plan
- Routing eval: 6 cases, Thai and English (`plugin/evals/`, run locally with `claude plugin eval plugin --scaffold`)
