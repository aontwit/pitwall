# playbook: ratchet — bring a number down and lock it from going back up

Use for tasks whose progress is measured as a number from a script — usually `repeat`, one batch per round, until the target

Main risk: the loop **optimizes the number instead of the work** (Huntley: "deterministically bad") — every item below exists to prevent this

## 1. Close the loopholes first (first batch only)

- Hunt for patterns that do the same thing but the script does not count (e.g. `!==`, loose `==`, other variable names meaning the same thing) → widen the pattern to count them, then reset the baseline to the real number (it may go up — that is correct)
- Have CI **compare the count on the PR with the count on the base branch** (fail when it goes up) instead of a fixed number in a file — no need to remember to lower it, no conflicts between PRs

## 2. Each batch

- ≤ ~8 files · pick files from `--list` (most first, or a group that can move into the same config / adapter)
- Every removed spot must **move into a real config flag or adapter** — the PR has a table `original file:line | original code | moved to where`
- A spot that is genuinely variant-specific UI (must stay) → does not count as work, write in the PR why it stays
- Behavior must stay the same → apply steps 1–2 of the `move-only` playbook to the files in the batch

## 3. Never

- Rename variables / helpers to escape the pattern, change operators, move logic to files or folders the script does not scan, add comments that disable counting
- Lower the number by removing a feature / removing a branch for a variant still in use

## 4. Review

The reviewer must answer this question directly in the review: **"Does the drop in the number come from really moving into config / adapter, or just from dodging the count?"** — answered "dodging" = `CRITICAL`

## 5. Finish

- Before / after numbers go in the PR every round · tick the plan row only in the round that reaches the target
- Target reached → lower the CI threshold to the new value in the same PR (if it still uses a fixed number)
