# Spec

<!-- pitwall:spec-schema 1 -->

What the product is. `/pitwall:plan` writes each decision into its section with `(owner <date>)`, and marks a line still undecided `open`. A line read from the code but not yet confirmed ends with `(inferred from <file>)` and counts as open. Plan rows cite the section they build. Leave a section empty rather than fill it with a guess.

## Stack

<!-- New repos only: what the product is built with and where it deploys, as the owner answered, or `delegated: <the choice and why>` -->

## Users

<!-- Who uses it, in what situation, and what job they are doing -->

## Purpose

<!-- What it makes possible, what v1 includes, and what it will not do -->

## Capabilities and constraints

<!-- Confirmed behaviour, rules, limits and numbers. A business value (price, limit, credential) only when the owner gave it -->

### Parallel laps (#42)

- One session leads: the lap that picks the tasks hands each task's work to a background subagent in its own git worktree and branch, as pstack `swarm` fans out workers, and gathers their results (owner 2026-10-21)
- The lead is the only writer of the loop state; a worker writes only its worktree, its branch and its own report (owner 2026-10-21)
- A worker runs its whole task up to an open PR, review panel and verifier included, since a subagent can spawn subagents (run 2026-10-21: a nested `Agent` call returned). A host whose workers have no `Agent` tool → the lead runs the review panel, the verifier and the PR for that task (owner 2026-10-21)
- The profile sets the cap as `parallel: <n>`; a profile without it runs one task at a time, as today (owner 2026-10-21)
- Two tasks run together only when their rows share no file, except files on the profile's `resolve conflicts yourself` list (`PLAN.md`, `CHANGELOG.md` …); a shared file → the second task waits for the first one's PR (owner 2026-10-21)
- Level B: a profile that pins the dev server port (a backend that allows one origin) → the lead lets one task at a time hold the dev server; otherwise each worktree runs its own server on a spare port. Pair runs and human-only steps always go one at a time (owner 2026-10-21)

## Terms

<!-- The domain words the code and the plan use, one line each, so agents don't guess -->

- **lead**: the session running `/pitwall:lap` that picks a batch, spawns workers and is the only writer of the loop state
- **worker**: a background subagent that runs one task in its own git worktree and branch, and reports back to the lead
- **batch**: the tasks a lead starts together — pickable, no shared file outside `resolve conflicts yourself`, at most `parallel` of them

## Open decisions

<!-- What is still undecided, and which rows wait on it -->
