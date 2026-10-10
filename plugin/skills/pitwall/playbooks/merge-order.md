---
name: merge-order
description: Merge order — resolve docs / wiki conflicts in the agent's PRs yourself, then read my open PRs, sort them by stack (a PR whose base is another PR's branch) and give each one's readiness level (🟢 can merge / 🟡 can merge but B/C still pending or no current verifier verdict / ⏸ waiting for base / 🔴 blocked) + the next one to press · retarget PRs whose base has merged into the profile's base yourself. Use when the user runs /merge-order, "merge ตัวไหนก่อน", "ลำดับ merge", "PR ไหนพร้อม" — /lap and every report refer to this skill instead of writing the merge order themselves · repo values live in .claude/agent-loop.md
---

# /merge-order — which one to merge first

The merge order lives here and only here — PR bodies / round reports / messages to the user **never explain the merge order themselves**, they write only "merge order: `/merge-order`"

Arguments: none = all my open PRs · `<PR number>` = only the stack containing that PR · Claude **does not merge itself** (forbidden in the profile) — a human presses

## 1. Pull data

```bash
gh pr list --author "@me" --state open --limit 100 \
  --json number,title,url,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,body
```

Verdicts: state `verified` (path in the profile; multi-machine → **receive** first; none → no PR has a verdict) · `git fetch origin -q` → the current patch-id of every PR (`/gauge` "Independent verifier")

A "destination" base = `base` in the profile + branches the profile forbids pushing to · any other base = another PR's branch (stack)

A PR whose **head** is a destination (e.g. `<base> → release`, shipping to prod) = a release PR: put it in a separate "release" table at the end of the report, never walk on to children from that head (otherwise the base stack shows up twice)

## 2. Retarget before sorting

When the repo has "Automatically delete head branches" **off** (check repo settings) → after a parent PR merges, GitHub does **not** move the child PR's base (it only moves it when the parent branch is deleted); the child still points at the already-merged parent branch — if merged at that point, the work lands in the parent branch, not base

Every PR whose base is not a destination: `gh pr list --state merged --head <base> --json number,baseRefName --limit 1`
- Found (parent merged) → `gh pr edit <child> --base <parent's baseRefName>` → base is now a destination → `gh pr ready <child>` and note it in the report ("retarget #child → <base> because #parent merged")
- Not found and no open PR with head = that base → 🔴 "base `<branch>` has no PR" (closed and dropped?) never guess, ask the user

After retargeting, pull step 1's data again (`mergeable` is recomputed slowly → treat `UNKNOWN` as ⏳, not 🔴)

### Child PRs in a stack are always Draft

GitHub cannot merge a Draft PR — this stops a child being pressed before its parent (it has happened: a 3-PR stack was merged bottom-up, the children's work landed in the parent branch, not base, and had to be opened again)
- Every PR whose base is **not** a destination and is not Draft yet → `gh pr ready <n> --undo`, note it in the report
- A PR whose base = destination but is still Draft and belongs to the agent (`agent/*`) → `gh pr ready <n>`

## 2b. Resolve docs conflicts yourself

The conflict that recurs every time is the logs every PR appends to at the same place (the plan's progress log, a docs changelog, the open-questions table, the status board) — append-only logs collide; knowledge pages rarely do · GitHub does not read `merge=union`, so it has to be fixed in the branch

Per PR with `mergeable = CONFLICTING`, head starting with `agent/` (agent branches only — never touch anyone else's, including the user's own) and base = destination:

1. Conflicting files (read-only): `git fetch -q origin && git merge-tree --write-tree --name-only --no-messages origin/<base> origin/<head> | tail -n +2`
2. Any file outside the profile's "resolve conflicts yourself" → **do not touch** 🔴 `conflict in code: <file>` for a human
3. Separate worktree (does not disturb the main checkout / dev server): the local branch has commits not yet pushed (`git rev-list origin/<head>..<head>` not empty) → stop 🔴 · otherwise `git worktree add -B <head> <scratchpad>/wt-merge origin/<head>` (this worktree uses a real `node_modules` — run the profile's install command the first time, in case a pre-push hook builds)
4. `git merge --no-edit origin/<base>` → every conflicting hunk: **keep both sides, base's first, then the branch's** (= `git merge-file --union`) — for append-only logs this matches what humans pick on the web · a blank line before every `## ` heading, then check what union can get wrong:

| After union you find | Fix |
|---|---|
| Duplicate open-question number (two rows with the same number) | The branch's row → next free number, and fix the `#<number>` the branch refers to in files the branch changed (`git diff --name-only origin/<base>...origin/<head>`) |
| Two checklist rows with the same id (both sides edited the same row) | Merge into one row: ticked if either side ticked, base's text + what the branch added |
| Two status board lines for the same line | Merge into one line that states both things |
| Unsure the merge is right | `git merge --abort` → 🔴 `conflict needs a human: <file:line>` |

5. Check: `git grep -n -e '^<<<<<<<' -e '^>>>>>>>' -e '^=======$' -- <files>` is empty · `git diff --check` passes · referenced paths / task numbers exist (docs of `/gauge`)
6. `git commit --no-edit` (message `Merge remote-tracking branch 'origin/<base>' into <head>` — looks the same as the web button) → `git push -u origin <head>` (hooks run) → `git worktree remove <scratchpad>/wt-merge`
7. Note in the report: `resolved conflict: #n (<file>) — kept both sides` · `mergeable` is recomputed slowly → ⏳, then running `/merge-order` again will show 🟢

Child PRs in a stack need nothing — the conflict shows up when it is retargeted to base, and is fixed in that round

## 3. Sort

Parent → child: start from the PR whose base = destination, then follow `headRefName` → the PR whose `baseRefName` equals it (depth-first, multiple children sorted by PR number) · separate stacks = one table per stack · standalone PRs (no child, no parent) go together in a final table

## 4. Levels (per PR, in order)

| Level | When |
|---|---|
| 🔴 blocked | `isDraft` · `mergeable = CONFLICTING` · any check in `statusCheckRollup` is FAILURE / ERROR (skip checks in the profile's "ignored checks") · `reviewDecision = CHANGES_REQUESTED` · the latest verdict at the current patch-id is FAIL (`verdict FAIL`) |
| ⏸ waiting for base | base is still an open PR (it is Draft — cannot be merged until its turn) |
| 🟡 can merge, but pending | base = destination, not blocked, but the body's "Not done yet (before merge)" section still has `- [ ]` (count that section only · the "merge in stack order" item does not count) or the title starts with `[PARTIAL]` · or no passing verdict (`item: "verdict"`, VERIFIED / PARTIAL) of this PR (`pr` / `branch`) at its current patch-id: older patch-ids only → `needs re-verify`, none at all → `no verifier verdict` (PRs the agent did not open stay here by design — the loop never verifies them) |
| 🟢 can merge now | base = destination, not blocked, no `- [ ]` pending, a passing verdict at the PR's current patch-id |
| ⏳ | a check is still running (PENDING / IN_PROGRESS — not counting ignored checks) or `mergeable = UNKNOWN` |

Release PRs (head = destination, the separate release table) need no verdict — the verdict clauses above skip them, as `/gauge` "Record results + tick the PR yourself" item 2 does

Child PRs in a stack have no checks yet (CI usually runs only on PRs into base) — checks run after retarget, not a problem

🟡 does not mean do not merge — the user decides whether the pending items can wait until after merge (e.g. testing on dev)

## 5. Report (short, in the profile's user language)

```
retarget: #102 → <base> (#101 merged)          ← present when step 2 was done

Stack A — 12 PR (<base> ← #101 ← … ← #112)
| # | PR | Level | Pending |
|---|---|---|---|
| 1 | #101 currency label | 🟡 | C purchase flow |
| 2 | #102 carousel | ⏸ | waiting for #101 |
…

Next: merge #101 → then press "Delete branch" in that PR (GitHub moves #102 to base itself) · forgot to delete → run /merge-order again and it retargets
```

- A long run of consecutive ⏸ PRs → collapse into one row `#103–#112 ⏸ waiting for the previous one` unless one of them is 🔴 (always shown separately)
- "Pending" = `- [ ]` items trimmed to ≤ 6 words / item, more than 2 items → "+N" · plus `needs re-verify` / `no verifier verdict` when that is why it is 🟡

## 6. Merge-button rules (tell the user in one line every time there is a 🟢 / 🟡)

- The **Create a merge commit** button (keeps stack history intact) — **never Squash / Rebase** PRs in a stack: the parent's commits get rewritten → the child sees the parent's commits twice and conflicts
- Merge one at a time, in order · press only PRs whose base = the profile's base (check the PR header before pressing)
- After merging, press **Delete branch** right away → GitHub moves the child PR to base
- After merging → the next `/lap` round syncs the task to `review` itself (or `/ticket`)

## Never

- Never `gh pr merge` / close a PR / delete a branch yourself — only retarget (`gh pr edit --base`) and merge base **into** an `agent/*` branch per step 2b
- Never resolve conflicts in code / config / lockfile — report them to a human
- Never edit the body / tick checkboxes in this skill (that is the job of `/lap` + `/gauge`)
