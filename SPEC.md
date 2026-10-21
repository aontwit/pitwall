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

### Auto merge (pstack `shipping`)

- `init` asks `merge: human | auto`; `human` stays the default. `auto` lets the agent merge only into the dev branch the profile names (e.g. `dev`); the base's other destinations (`main`, release) are always merged by a human, and a repo with no dev branch is never offered `auto` (owner 2026-10-21)
- Merges happen in one place: the PR sync at the start of a `/pitwall:lap` round, one PR at a time from the bottom of each stack, never by the worker that wrote the PR (owner 2026-10-21)
- A PR merges only when every gate passes, as in pstack `shipping`: (1) a VERIFIED verdict (not PARTIAL) from a fresh verifier at the current patch-id; (2) no `- [ ]` left in "Not done yet", so no ⏳ and no pending level C; (3) green CI on the current head, run on the current base; (4) right before the merge, fetch the dev branch: when it changed a file the patch touches or depends on, merge it into the PR branch and wait for CI again, and a third such round holds the PR and reports it; (5) read the PR back as `MERGED` after the merge, never `--auto`; (6) no merge while `/pitwall:stop` or `/pitwall:brake` is set. A failed gate leaves the PR for a human (owner 2026-10-21)
- Always for a human, even with every gate passed: a PR that touches the "Always park" list (money, permissions / security, user data, deletes), and a PR that loosens a gate (CI workflows, check commands, ignored checks, a lint baseline that grows) (owner 2026-10-21)
- Merge method: a merge commit, as `/pitwall:merge-order` already tells humans, so a stack's history stays intact (owner 2026-10-21)

## Terms

<!-- The domain words the code and the plan use, one line each, so agents don't guess -->

- **lead**: the session running `/pitwall:lap` that picks a batch, spawns workers and is the only writer of the loop state
- **worker**: a background subagent that runs one task in its own git worktree and branch, and reports back to the lead
- **batch**: the tasks a lead starts together — pickable, no shared file outside `resolve conflicts yourself`, at most `parallel` of them

## Open decisions

<!-- What is still undecided, and which rows wait on it -->
