---
name: lap
description: One lap of the agent loop — at the start of the round, sync PRs and the tracker (merged PR → task review), then pick 1 task from the queue → tracker task → branch from base → code per playbook → /pitwall:gauge → review → update the plan → PR → comment on the task. Use when the user runs /pitwall:lap or says "ทำ 1 งาน" — /pitwall:drive calls this skill repeatedly via /loop · repo values live in .claude/agent-loop.md
---

# /pitwall:lap — 1 round of the agent loop

This round **does not wait for a human on anything it can decide itself**: work → /pitwall:gauge → review → commit → PR → end the round (when coming from `/pitwall:drive` → it schedules the next round itself, see section 8) · humans merge

**Proving is not deciding** — a check the agent can run itself must never be handed to a human (pstack: "never hand the human a check you could run")

**⏳ is allowed only in these 3 cases — "the 3 wait cases (⏳)"** (the single list — `/pitwall:gauge`, `/pitwall:drive` and the playbooks refer here); each needs a specific reason in the PR:
1. `human-only step while the user is away` — a step on the profile's `human-only steps` list (level B: wallet popup, 2FA, payment confirm …) must be done **and the user is away** — "present" = the user typed a message or ran a command themselves in this session during this round (including running `/pitwall:lap` themselves) → announce `/pitwall:gauge`'s pair run, wait for "go" for at most 10 minutes; no reply = away · the waiting time does not count toward the 90 minutes (section 4)
2. `needs the dev env after merge` — has to be checked on the dev env after merge
3. `environment unusable` — the profile's dev server port is in use by someone else, the browser from the profile won't connect, the source URL of the `port` playbook does not exist / is stuck on a login page

`bug-fix` tasks: the repro before / after the fix **must never be ⏳** — hits case 1 or 3 → park (reason: waiting for pair run / environment)

**Read `.claude/agent-loop.md` before anything else** — base branch, branches never to touch, check commands, plan, tracker, agents per task, state path all come from the profile

Tasks come from 2 sources (field `source` in the queue):
- `plan` = a row in the repo's plan — read in the order given in the profile
- `tracker` = a task in the profile's tracker — the brief is the description (`Why / What / Done when`); no plan to tick

Profile `tracker` ≠ `none` → every task must have a tracker task (the `pitwall:ticket` skill) · `none` → the PR is the record; every tracker step below is skipped

## 0. State

path in the profile — write it with Write every time it changes
`step`: `research | brief | coding | checking | reviewing | gauging | docs | committing | verifying`

Start of round:
1. No state file → the profile has a "multi-machine" section → **receive** state per that section first · still none → tell the user to run `/pitwall:queue` first, end
2. `running:false` = single-round mode: do 1 task, then don't schedule more
3. `stopRequested:true` and `currentTask:null` → `running:false`, `ScheduleWakeup stop:true`, summary report of `done` / `parked`, end
4. `currentTask` not null → **resume** from `step` (skip section 2): `git switch <branch>`, has `stash` → `git stash pop` then delete the field

## 1. Guard + sync

```bash
git status --porcelain     # not empty (and not a resume) → running:false + stop + report asking the human to commit/stash first
git fetch origin -q && git switch <base> && git pull --ff-only
```

lint baseline: `lintBaseline.sha` ≠ `git rev-parse origin/<base>` → run lint on base, count warnings → `lintBaseline = { sha, warnings }`

upkeep: the profile names a periodic upkeep step (level B `upkeep`) and it is due → put it at the front of the queue as a task (the profile names the playbook / task) and record the date in state when queued

**PR sync (every round, including rounds with an empty queue)**:
0. Agent PRs that conflict only in docs / wiki → resolve per `/pitwall:merge-order` item 2b · PRs still open: items in "Not done yet" with a `verified` entry of the PR's current patch-id but not ticked → tick them (`/pitwall:gauge` "Record results + tick the PR yourself" items 2–4) · ticked boxes whose patch-id is stale → untick (same item 2) · re-verify **one agent PR per round, oldest first**, among those with no verdict or only verdicts at an older patch-id (a new commit or conflict resolution after the verdict — patch-id rule in `/pitwall:gauge` "Independent verifier") — a PR whose latest verdict at its current patch-id is FAIL is skipped, not picked again: `git switch <head>` + `git pull --ff-only`, `/pitwall:gauge` "Independent verifier" (pass → replace the body's verifier row with `gh pr edit` · FAIL → recorded per that section + a PR comment with its rows + the report, no fix outside a task), `git switch <base>` · `verified` entries of branches whose PRs are all merged → delete
1. Every item in `done` whose `merged` is not yet true → `gh pr view <pr> --json state,mergedAt` — `MERGED` → `merged: true` (+ tracker sync item 2) · `CLOSED` → put it in the report (+ tracker comment, keep `in progress`)

**Tracker sync** — profile `tracker` = `none` or the tracker is unavailable → skip all of it:
1. assignee: parents in `parents` and every subtask must have me — missing → add me (the `ticket` assignee rule)
2. Items that became `merged: true` above → `pitwall:ticket` skill section 5 "PR merged"
3. **Every parent task in `parents`** (subtasks may be moved by people or other teams): read the parent with its subtasks (`pitwall:ticket` skill) — ≥ 1 subtask and all of them at `review` or later, and the parent not yet `review` → parent → `review` + comment to QA · a parent already at `review` with no new subtasks → remove it from `parents`

## 2. Pick a task (from `queue` only)

Go through `queue` in order (if `firstTask` is set, take that one first, then delete the field), skipping any that:
- have `blocked` (waiting for an answer from the briefing in `queue.md`)
- are in `done` / `parked` (except a `repeat` that has not reached its target)
- `plan`: the row is already `[x]` on origin/base → remove from the queue · `tracker`: status already past `in progress`, or it belongs to someone else → remove from the queue
- have an open PR for this task (`gh pr list --state open --json headRefName` by the branch pattern in the profile)
- `waitFor` / dependency not merged yet → skip this round (don't park), put the reason in the report

Nothing left → report "queue empty / waiting for merge: <list>"; loop → `ScheduleWakeup 1800s prompt "/loop /pitwall:lap" noop:true`, end; single round → end

Got a task → playbook: not set by the queue and it's a bug fix (task `[bug]`) → `bug-fix` · tracker ≠ `none` → `pitwall:ticket` skill sections 2–4: `plan` → find/create the phase's parent task + a subtask for the row (`in progress`) · `tracker` → set `in progress`
→ state: currentTask, trackerId, parentId, playbook, taskStartedAt=now, step="research", agents=[] · new `parentId` → add to `parents` · this task's tick-box answers (`answers[<id>]` from the briefing in `queue.md`) are requirements of the brief
→ start the task's `decisions.tsv`: `<state folder>/decisions/<id>.tsv` with header `time\tstep\tdecision\twhy\tevidence` · write a row every time you decide (choose an approach, cut scope, a ladder step, ⏳), not written back at the end
Tracker set but unavailable → work can continue, but write in the PR "not logged in the tracker yet"

## 3. Branch

`git switch -c <name per the pattern in the profile> origin/<base>` (English slug, 2–4 words) → state.branch

## 4. Work (per CLAUDE.md + every repo rule in the profile)

**Has a `playbook` → read `<playbook>.md` (same folder as this file) and follow it instead of the overlapping steps below**

- **research**: `Explore` reads the brief + the context the plan cites + the current code + the reference code (read-only branch in the profile) — finds it's already done → skip to docs with file:line evidence
- **brief** with 6 sections (task / context / files / requirements / do not touch / done when = DoD + the `/pitwall:gauge` rows), written to the scratchpad
- an install that fails on a file another program holds (an editor locking `node_modules`) → change method: do the task in a separate git worktree with its own dependencies, never fight the lock in the main checkout
- **coding**: task > ~150 lines or > 3 files → send the brief to the profile's matching `code role` row (subagent type + model from "agents per task", a fresh agent per task) and name the task's domain checklist file in the brief · smaller than that, main may do it itself
  record every time in `agents[]`: `{ agent, model, step, task, files, result }` (main is recorded as `main` too) · then read `git diff` of every file: a file outside the brief → `git checkout -- <file>`
- **checking**: `/pitwall:gauge` set A — FAIL → re-brief the same agent with the error, 1 time — FAIL again → **park**
- **reviewing** (adapted from pstack `interrogate`, MIT): variety comes from the models, not personas
  - **one prompt**: the diff + the brief + the every-task review checklist file from the profile + the extra-review checklist when a profile row matches the change (added to the same prompt) + the task's `decisions.tsv` + Decisions to confirm, and the direct question "does any default touch the "Always park" / "Never default either" lists in `pitwall/SKILL.md`" (found = `CRITICAL`) · a playbook may add its own questions
  - the prompt says **read-only** · `git status --porcelain` before sending and after the panel returns — a file a reviewer changed → `git checkout -- <file>`
  - **send the same prompt** to each model of the profile's `review panel`, in parallel, one fresh agent per model · record each in `agents[]` · a reviewer fails / times out → re-run it once with a fresh agent; fails again → build the table from the models that answered and say so in the PR
  - severities are only `CRITICAL` / `WARNING` / `INFO` (`pitwall-agent` "As a reviewer") — a reviewer that answers with another word (`SUGGESTION`, `NIT` …) → count it as `INFO`, and say so under Review in the PR
  - **consensus table** `finding | <one column per review-panel model> | call`, written to `<state folder>/reviews/<id>.tsv` (survives a resume) — merge findings that describe the same issue, keep the higher severity, `IMPACT` stays in the finding text · call = `act on` / `consider` / `noted` / `dismissed` · raised by every model = highest signal · raised by one only, or the models contradict each other → the lead reads the code itself and makes the call · every one-model call and every call other than `act on` for a `CRITICAL` / `WARNING` → a row in `decisions.tsv`
  - `CRITICAL` is always `act on`, or **park** — never consider / noted / dismissed · a `CRITICAL` from the "Always park" / "Never default either" question → park
  - act on, in the brief's files → fix + checking again (the panel is not re-run; `/pitwall:gauge` is) · act on outside the brief's files, consider, noted → follow-up in the PR · dismissed → only in `decisions.tsv` with the reason
- **gauging = the gate before opening a PR**: `/pitwall:gauge` every row — A FAIL → park · this is the writer's check, not the verdict: the independent verifier runs later on the committed head (step `verifying`, section 6)
  - B items that are not among "the 3 wait cases (⏳)" (top of the file) **must pass in this round** · stuck → change method / build the condition ("states to build" in the profile) · tried 2 methods and still not passing → park, never open the PR
  - items that need a human-only step + the user is present → `/pitwall:gauge`'s pair run (announcing + waiting for "go" does not count as "asking mid-round") · user away → ⏳ case 1 + put "waiting for pair run: <item>" in the end-of-round report
- `repeat` tasks: 1 batch (≤ ~8 files) per round, measure the number before/after and put it in the PR; tick `[x]` only in the round that reaches the target
- a fork with no answer in `answers` → **"The 3-step ladder (loop / autopilot)" in `pitwall/SKILL.md`** · its step 3 here = **park as a question** (below; you may edit the plan yourself only where the playbook allows)
- past 90 minutes since taskStartedAt → **change method, not park**: a `decisions.tsv` row (method dropped → method next, why), then try another approach · build the condition ("states to build" in the profile) · a smaller slice = split the row per `port.md` (sub-rows + Plan correction; tick only the finished sub-row) · **hard stop**: at most 2 switches, or 180 minutes since taskStartedAt, or no new method left → park, and the park reason lists the methods tried

**park**:
1. has code → `git add -A && git commit -m "wip: <id> parked — <reason>"` (hook fails → `git stash push -u -m "agent-loop <id>"`, record it in parked)
2. park as a question → add the question to the plan's open-questions location (profile) on the same branch
3. **don't push** — `parked` += `{ id, branch, step, reason, question? }`, `git switch <base>`, clear currentTask / branch / step → back to section 2
4. Tracker (skip when `none`): `pending` + comment with the reason / question (`ticket` section 5)

## 5. Docs (step=docs)

`tracker` → skip · `plan` → in the phase file on this branch: a queue item with `newRow` → add that row first (it is not on base yet), then tick `[x]` (don't tick if a repeat has not reached its target) · profile `tracker` = `none` only → add a Progress log row `| <today> | <id> <summary> | agent PR | <short evidence + what still needs level C testing> |` — with a tracker, the issue (its PR comment and status) is the progress record, and a row that every PR appends at the same place makes each open sibling PR conflict whenever one merges (GitHub then also runs no CI for them until it is resolved) · first task of the phase → change the status board to in progress · plan disagrees with the actual code → fix the plan at that spot + "Plan correction" in the PR

## 6. Commit + PR (step=committing)

Follow `opening-a-pr.md` (commit, push, PR body, Not done yet) · loop-only parts:
- set step=committing in state · after the commit step=verifying (`opening-a-pr.md` section 2 item 1) · record the verifier in `agents[]`
- hook fails → fix 1 time → fails again → **park** (section 4 park)
- PR body in the profile's PR / commit language

## 7. Close the task

Tracker (`ticket` section 5 "PR opened", skip when `none`): **keep `in progress`** + 1-line comment → store `prCommentId` — never move it to `review` now (the start-of-round sync moves it when merged)
state: `done` += `{ id, pr, trackerId, parentId, prCommentId, merged: false, status: <the verifier's VERIFIED|PARTIAL> }`, remove from `queue` (except a repeat that has not reached its target), clear currentTask / branch / step / taskStartedAt → `git switch <base>`
agents that used a separate worktree (isolation) → remove the worktree + its local branch as soon as its work is integrated (cherry-picked / merged / pushed as its own PR) · never remove one with uncommitted changes, one you push an open PR from, or a checkout that is not an agent worktree

## 8. End of round

- single-round mode → report, then end
- `stopRequested:true` → running:false, `ScheduleWakeup stop:true`, summary report
- otherwise `ScheduleWakeup delaySeconds:60 prompt:"/loop /pitwall:lap" noop:false` — the prompt is the whole `/loop` input, so the next firing re-enters `/loop` (a bare `/pitwall:lap` runs once and the loop ends)
- the profile has a "multi-machine" section → **send** state every round (before scheduling / stopping)
- a round the user did not start (a wakeup) that opened a PR, parked a task, or stopped the loop → also send one push notification, when the harness has one (Claude Code: `PushNotification`): `<repo>: PR <link> <status>` / `parked <id>: <reason>` / `loop stopped: <why>` · nothing happened (sync only, queue empty) → no notification
- short report every round (in the profile's user language): task, PR link, task link, gauge status, Edited files table, what was parked with reasons · ≥ 2 PRs waiting for merge → include the output of `/pitwall:merge-order` (table + "next" line) instead of describing the order yourself

## Never

- never merge a PR, never push / checkout to edit branches the profile forbids, never `--force`, never `--no-verify`
- conflict on pull / rebase → park, never resolve it yourself
- never edit `.env*`, secrets, CI workflows (unless the task says so directly), never answer the plan's open questions yourself
- never touch other people's PRs / branches / tasks, never move a task to `review` before its PR merges, and never move it past `review`
- never ask the user mid-round — human questions are asked all at once in the briefing of `queue.md` · during the run use "the ladder" · the pair run for human-only steps does not count as asking
- never open a PR for a bug task that was never reproduced (playbook `bug-fix` item 1) — except the "already correct" case there, which changes no code
