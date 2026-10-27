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

Profile `tracker` ≠ `none` → every task must have a tracker task (the `pitwall:ticket` skill), except work the profile marks "not tracked" (its tracker steps are skipped and the PR says "not tracked in the sprint") · `none` → the PR is the record; every tracker step below is skipped

## 0. State

path in the profile — write it with Write every time it changes
`step`: `research | brief | coding | checking | reviewing | gauging | docs | committing | verifying`

**Lead mode** — the profile's `parallel` is above 1 → items 0–2 below as written, then section 9 runs the round (it says when items 3–4 and sections 1–8 run as written) · `parallel` missing or 1 → this line does not apply

Start of round:
0. Read the profile `language` section: every line the user sees this round is in its user language (SKILL.md rule 8) · a wakeup prompt is English, so it is no hint
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

   **Auto merge** — the profile's `git` section says `merge: auto` → section 10 runs here, before item 1 · `merge: human` or no `merge` row → this paragraph does not apply
1. Every item in `done` whose `merged` is not yet true → `gh pr view <pr> --json state,mergedAt` — `MERGED` → `merged: true` (+ tracker sync item 2) · `CLOSED` → put it in the report (+ tracker comment, keep `in progress`)
2. Plan ticks (profile has a `plan` section) — task PRs never tick their row or write the Progress log; this sync does it once they merge, in one docs PR: `node <pitwall dir>/scripts/plan-sync.mjs --dry --skip <ids still in queue> --prefix <agent branch prefix> <plan files>` on the base → prints nothing → done · an `agent/plan-sync-*` PR is already open → leave it (the next round after it merges picks up the rest) · otherwise `git switch -c agent/plan-sync-<YYYYMMDD> origin/<base>` → the same command without `--dry` (add `--log` when profile `tracker` = `none`) → commit with the profile pattern (a docs type), push, open a PR against the base whose `## Verify` line starts `Plan PR: plan ticks for merged PRs <#n …>, docs only` (passes `scripts/check-pr-body.mjs`) → `git switch <base>`

**Tracker sync** — profile `tracker` = `none` or the tracker is unavailable → skip all of it:
1. assignee: parents in `parents` and every subtask must have me — missing → add me (the `ticket` assignee rule)
2. Items that became `merged: true` above → `pitwall:ticket` skill section 5 "PR merged"
3. **Every parent task in `parents`** (subtasks may be moved by people or other teams): read the parent with its subtasks (`pitwall:ticket` skill) — ≥ 1 subtask and all of them at `review` or later, and the parent not yet `review` → parent → `review` + comment to QA · a parent already at `review` with no new subtasks → remove it from `parents`

## 2. Pick a task (from `queue` only)

Go through `queue` in order (if `firstTask` is set, take that one first, then delete the field), skipping any that:
- have `blocked` (waiting for an answer from the briefing in `queue.md`)
- are in `done` / `parked` (except a `repeat` that has not reached its target)
- `plan`: the row is already `[x]` on origin/base, or (not a `repeat`) its agent PR has merged (`plan-sync.mjs --dry` above lists it) → remove from the queue · `tracker`: status already past `in progress`, or it belongs to someone else → remove from the queue
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
- `repeat` tasks: 1 batch (≤ ~8 files) per round, measure the number before/after and put it in the PR; the row stays in `queue` until the round that reaches the target, so the plan sync skips it until then
- a fork with no answer in `answers` → **"The 3-step ladder (loop / autopilot)" in `pitwall/SKILL.md`** · its step 3 here = **park as a question** (below; you may edit the plan yourself only where the playbook allows)
- past 90 minutes since taskStartedAt → **change method, not park**: a `decisions.tsv` row (method dropped → method next, why), then try another approach · build the condition ("states to build" in the profile) · a smaller slice = split the row per `port.md` (sub-rows + Plan correction; the plan sync ticks each sub-row when its PR merges) · **hard stop**: at most 2 switches, or 180 minutes since taskStartedAt, or no new method left → park, and the park reason lists the methods tried

**park**:
1. has code → `git add -A && git commit -m "wip: <id> parked — <reason>"` (hook fails → `git stash push -u -m "agent-loop <id>"`, record it in parked)
2. park as a question → add the question to the plan's open-questions location (profile) on the same branch
3. **don't push** — `parked` += `{ id, branch, step, reason, question? }`, `git switch <base>`, clear currentTask / branch / step → back to section 2
4. Tracker (skip when `none`): `pending` + comment with the reason / question (`ticket` section 5)

## 5. Docs (step=docs)

`tracker` → skip · `plan` → **never tick the row or write the Progress log here**: the start-of-round plan sync (section 1, PR sync item 2) does both after the PR merges, because a tick or log row that every PR writes at the same place makes each open sibling PR conflict whenever one merges (GitHub then also runs no CI for them, and the resolution makes the verdict stale) · the evidence and what still needs level C testing go in the PR body · a queue item with `newRow` → add that row, unticked, in the phase file on this branch (it is not on base yet) · first task of the phase → change the status board to in progress · plan disagrees with the actual code → fix the plan at that spot + "Plan correction" in the PR

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

## 9. Lead mode (`parallel` above 1)

The profile's `parallel` (section `agents per task`, a whole number, read as `scripts/doctor.sh` reads it) is above 1 → this session is the **lead**: it picks a **batch** with `scripts/pick-batch.mjs` and hands each task to a background **worker** in its own git worktree and branch, which runs sections 3–6 to an open PR (SPEC "Parallel laps") · workers use the profile's matching `code role` row (subagent type + model)

**Who writes what** (principle `separate-before-serializing-shared-state`): the lead alone writes the state file, the state folder (`decisions/<id>.tsv`, `reviews/<id>.tsv`) and the tracker · a worker writes only its worktree, its branch, its own PR and its report; every state change, decisions row and review table of sections 3–6 goes into its report, and the lead writes it · a parked worker parks only its own task, the others carry on

`workers[]` = one entry per task a worker holds (not `running`: that key is the loop's on / off flag): `{ id, branch, worktree, harnessBranch, step, taskStartedAt, lead, agentId?, lastReportAt?, playbook, trackerId?, parentId?, port?, waitFor?, waitSince?, waited, stash? }` · `pick-batch.mjs` skips these ids and counts them against `parallel` · `lead` = this session's id (the host's session id; none shown → a random id made once and kept in `<scratchpad>/lead-id`) · state `leadSeen: { session, at }` = the lead's id and the time of its last state write, set on every write · `stash` = a stash's sha, never its message

- **active** worker = its entry's `lead` is this session, and its `agentId` is a running background task of this session (the host's task list) or it waits for this lead's answer to a `WAIT` (`waitFor` set) · anything else is gone, whatever the entry says
- **another lead**: `leadSeen.session` is another session and `leadSeen.at` is under 60 minutes old (two heartbeats) → that session leads: touch no entry, start nothing, tell the user, end the round without scheduling
- **time limit** (section 4's hard stop, kept by the lead): an active worker past 180 minutes of `now − taskStartedAt − waited` → `TaskStop` its `agentId`, then park it as 9.4 item 3 with reason `hard stop: 180 minutes`
- **free the token** (9.6) every time an entry is removed or gets a new worker
- **remove a worktree** only this way: save what it holds uncommitted (`brake.md` lead-mode save), write the state, then `git -C <worktree> status --porcelain` is empty → `git worktree remove <worktree>` + `git branch -d <harnessBranch>` · still not empty → keep the worktree, park the task (reason `save failed: <files>`) and say so in the report · never lose work

### 9.1 Start of round (instead of section 0 items 3–4)

1. Another lead → end · `currentTask` not null (a serial task: 9.2 items 3–4, or one `/pitwall:brake` saved) → section 0 item 4, then sections 4–8 as written; skip the rest of section 9
2. Time limit, then reconcile each `workers[]` entry, safe to run twice (principle `make-operations-idempotent`): active → leave it · an open PR on its branch → as a `PR` report (9.4 item 2), status from the PR body's verifier row (no `verified` entries: the PR sync re-verifies it) · gone with `stopRequested:true` → clear `agentId` and `waitFor`, leave the entry for `/pitwall:drive` · gone, and its branch does not exist yet → remove the entry (the task is still in `queue`) and its worktree if any · gone otherwise → remove its worktree (above; a failed save parks), then start a resume worker (9.3 items 3–5, the brief adds `resume`, the `stash` sha and the last known `step`)
3. `stopRequested:true` → start no worker: no worker active → section 0 item 3 as written, its report also lists the `workers[]` entries left for `/pitwall:drive` · else end the turn (9.5)
4. Section 1 as written, except that PR sync item 0 skips a PR whose branch is in `workers[]` or held by a worktree (`git worktree list --porcelain`)

### 9.2 Pick the batch (instead of section 2)

1. `git fetch origin -q` · the plan as on base, as section 2 reads it: each plan file of the profile → `mkdir -p` its folder under `<scratchpad>/plan/`, then `git show origin/<base>:<plan file> > <scratchpad>/plan/<plan file>`
2. `node <pitwall dir>/scripts/pick-batch.mjs --state <state path> --profile .claude/agent-loop.md --prefix <agent branch prefix> <scratchpad>/plan/<plan file> …` (it lists the open PRs with `gh` itself) · stdout = the batch, one id per line · stderr `# <id> <reason>` = the report's "waiting for merge / skipped" lines; `plan row ticked` → remove that item from `queue` (section 2) · then delete `firstTask`, unless its line says `no plan row` (a `tracker` item: section 2 takes it first, item 4)
3. Exit 1 or 2 → its error line goes in the report · `workers[]` empty → section 2 as written this round (serial, in this checkout) · else no new task this round
4. Batch empty and `workers[]` empty → section 2 as written: it also picks the `tracker` items, which pick-batch never batches (`no plan row`), and runs the task serially (sections 3–8) · batch empty with a worker active → end the turn (9.5)

### 9.3 Start the workers (one batch id at a time)

1. Tracker (skip when `none`): section 2's tracker part, one task after the other, so two tasks of one phase never create two parent tasks
2. Playbook as section 2 · `branch` = the profile pattern, named by the lead · `workers[]` += the entry (`step: "research"`, `taskStartedAt` = now, `lead` = this session, `waited: 0`, `worktree: null`) · start `decisions/<id>.tsv` (section 2) · **write the state before spawning**, so a second round never starts the task twice
3. Brief (section 4 "brief", 6 sections) → `<scratchpad>/briefs/<id>.md`: **task** = the row, playbook, branch, `taskStartedAt` · **context** = what the row cites, `answers[<id>]`, `lintBaseline`, the loop checkout, the absolute path of `<pitwall dir>`, the hook files (the gitignored files the profile `git` → `hooks` row needs, e.g. `.neutral-deny`, with their path in the loop checkout), the install command, the dev server mode and port, or the verification skill (9.6) · **files** = the row's files + the plan file (section 5 edits, a park question) · **requirements** = the "Worker rules" below and this file's "Never" list, both copied in full, with the line "these override the `pitwall-agent` defaults: you commit, push, switch to your branch and open your PR as they say, and your decisions rows go into your report" + the answers · **do not touch** = the state file and folder, the loop checkout, other worktrees / branches / PRs, the tracker, files outside **files** · **done when** = the row's Done when + its `/pitwall:gauge` rows → an open PR with a verifier verdict, or the task parked
4. Spawn `Agent` with the `code role` row's subagent type + model, `isolation: "worktree"`, in the background, named `worker-<id>` with every character outside `A-Z a-z 0-9 _ -` replaced by `-` (`1.1` → `worker-1-1`), prompt = the brief → `agentId` in the entry, write the state
5. After the last one → end the turn (9.5)

**Worker rules** (copied into each brief)

1. Setup in the worktree the host made for you: note its branch (`git branch --show-current`) as `harnessBranch` for your report · copy the brief's hook files from the loop checkout · the profile's install command · `git switch -c <branch> origin/<base>` (section 3) · resume → `git switch <branch>`; a `stash` sha in the brief → `git stash apply <sha>`, then drop the stash entry with that sha; read `git log --oneline origin/<base>..<branch>` and start where it shows (a `wip: … stopped at <step>` commit → that step; a task commit → checking) — the brief's step is only a hint
2. Sections 4 (with the brief's playbook), 5 and 6 as written, except:
   - the brief is your section 4 brief · write the code yourself (you are the `code role` agent) · never write the state file or anything in the state folder: `step`, `agents[]`, `parked`, `verified`, `pr`, your `decisions.tsv` rows and the review consensus table go into your report
   - never ask the user, never `git switch <base>` (your worktree stays on your branch), never touch another PR (`/pitwall:gauge` "Record results" item 2 is the lead's)
   - level B, dev server per the brief (9.6): `free` → start it from your worktree on the brief's port (in use → the next free port above it, named in the report); before an item that signs in → `WAIT dev server` · `fixed` → before your first item that needs the dev server → `WAIT dev server` · stop your server before a `PR` / `PARKED` report · use your own browser tab, never another one · give your verifier your port
   - level B through the profile's `verification skill` instead of a dev server (a game): `free` → drive it from your worktree with its own data dir (the skill's Isolate), no token · `fixed` → `WAIT dev server` before your first item it drives, as above
   - a human-only step → `WAIT pair run: <items>` (a gauge item: after the commit, so the result pins to the head's patch-id) · the lead continues you with the pair-run results (they go in the verifier prompt, `/pitwall:gauge` "Independent verifier" item 2) or with `away` (⏳ case 1; a `bug-fix` repro parks)
   - park → section 4 park items 1–2 (WIP commit, or a stash whose sha goes in the report; the question on your branch), no push, report `PARKED`
   - no `Agent` tool among your tools → research yourself (no `Explore`) and skip reviewing and the verifier: section 4 up to gauging, section 5, the commit of section 6, then report `REVIEW`
3. Report = what your run hands back to the lead (the host's hand-back tool when it has one — closing text alone may never arrive), `pitwall-agent` "Report to the lead" plus: first line `RESULT <id> <step>` and one of `PR <url> <VERIFIED|PARTIAL>` · `PARKED <reason>` · `WAIT dev server` · `WAIT pair run: <items>` · `REVIEW` · then `branch`, `harnessBranch`, `worktree` (`git rev-parse --show-toplevel`), head SHA + patch-id, the `verified` entries as JSON (`/pitwall:gauge` "Record results" item 1, `pr` filled), your `decisions.tsv` rows, the review table, the park `question` / stash sha, the agents used · a `WAIT` report ends your run; the lead continues it with `SendMessage`

### 9.4 A worker's report (each one as it arrives)

1. Update the entry (`worktree`, `harnessBranch`, `step`, `lastReportAt` = now; a `waitFor` it had → `waited` += now − `waitSince`, clear both) · append its decisions rows to `decisions/<id>.tsv`, write its review table to `reviews/<id>.tsv` · read its diff against its brief, as section 4 coding does (`git -C <worktree> diff --name-only origin/<base>...HEAD` + `git -C <worktree> status --porcelain`): a file outside the brief's files → restore it from base in the worktree (`git rm` one base does not have), re-run `/pitwall:gauge` set A there, commit, push when its PR is open · after a verdict its `done` status stays `PARTIAL` until a new verdict exists (the PR sync re-verifies it) · say so in the report
2. `PR` → `verified` += its entries · section 7 for this task without `git switch` (`done` holds the task once: an entry with the same id is replaced; `queue`; tracker comment) · remove the entry, free the token, write the state, then remove its worktree (above)
3. `PARKED` → section 4 park items 3–4 without `git switch` (`parked` += `{ id, branch, step, reason, question?, stash? }`, tracker `pending`) · remove the entry, free the token, write the state, then remove its worktree (above)
4. `WAIT …` → `waitFor` + `waitSince` = now in the entry → 9.6
5. `REVIEW` → the lead finishes the task in that worktree (`git -C <worktree>`, absolute paths): section 4 reviewing (act-on fixes: continue the worker with them via `SendMessage`, or fix them yourself when small, then checking and gauging again), `/pitwall:gauge` "Independent verifier", section 6 → then item 2 or 3 · dev server work waits for the token (9.6)
6. The run ended with no `RESULT` line (error, killed, a hand-back that never came) → clear `agentId`, then 9.1 item 2 for that entry
7. Write the state (multi-machine → send it) · a batch started by a round the user did not start → one push notification per `PR` / `PARKED`, as section 8 · not single-round mode and no `stopRequested` → 9.2 and 9.3 again in this turn, to fill the free slots · then 9.5

### 9.5 End of the turn

- A worker active → the heartbeat `ScheduleWakeup delaySeconds:1800 prompt:"/loop /pitwall:lap" noop:false` and one line to the user: the workers started this turn + the pick-batch skipped lines · each `ScheduleWakeup` replaces the pending one, so the loop holds one wakeup at a time · a report wakes the lead by itself; the heartbeat runs the time limit and catches a worker that never reports (9.1 item 2)
- No worker active → section 8 as written, once for the batch: the report has one row per task (PR link + verdict, or the park reason) and the pick-batch skipped lines
- Single-round mode = one batch: no heartbeat, no refill (9.4 item 7), the report once no worker is active

### 9.6 Dev server, pair runs

- The token in state: `devServer: { holder: <id> | "lead" | null, queue: [<id>…] }` · profile level B `port` (missing = `fixed`): `fixed` → one dev server on the profile port, and every item that needs it takes the token · `free` → each worker runs its own server on its own port (the brief's and the entry's `port`: the profile port + 1, + 2 …, the first one no other entry holds), and only the items that sign in take the token (one browser shares its cookies across ports) · a `verification skill` with no dev server (a game) reads the same way: `free` → each worker runs its own app instance from its worktree and takes no token · `fixed` → one instance at a time, every item it drives takes the token
- A `WAIT dev server` joins `queue` · holder null → the first in `queue` becomes holder and the lead continues that worker (`SendMessage` to its `agentId`: "the dev server token is yours" + its port) · freed whenever the holder's entry is removed or gets a new worker → the next · the lead takes the token only when it is free: while a worker holds it, the lead leaves its own dev server work (PR sync re-verify, a `REVIEW` verifier, a pair run) to a later round and never waits for it mid-round
- Continuing a worker after a `WAIT` (`SendMessage`, then a second hand-back) is not yet proven on a live run · the host refuses it or no hand-back comes → 9.4 item 6
- Pair runs and human-only steps: one at a time, run by the lead (only the lead talks to the user) · a `WAIT pair run` with the user present (typed or ran a command in this session since the batch started) → `/pitwall:gauge` "Level C together" on that worktree's dev server, the results recorded in `verified` at the head the worker named, then continue the worker with them · user away → continue it with `away` · the next waiting pair run starts when this one ends

## 10. Auto merge (`merge: auto`)

The profile's `git` section says `merge: auto` (read as `scripts/doctor.sh` reads it; missing = `human`) → the PR sync (section 1, after item 0) merges the loop's own PRs into the dev branch (the base) itself, from the bottom of each stack, when every gate of SPEC "Auto merge" passes · `merge: human` or no `merge` row → this section does not apply · lead mode: the lead runs it with the rest of the PR sync; a worker never merges · multi-machine: only the machine whose round holds the state merges (section 0 item 1), and section 8 sends the state

- **One command**: `node <pitwall dir>/scripts/merge-pr.mjs --state <state path> <n>` is the only way a PR merges — it refuses unless the profile says `merge: auto` with the dev branch = the base, stop / brake is not set, the PR is open, not a draft, targets the dev branch and is not on a `workers[]` branch, `merge-gate.mjs` prints `MERGE` and the head did not move while it judged; then it runs `gh pr merge <n> --merge --match-head-commit <head oid>` (a merge commit of the judged head, never `--admin` / `--auto`) and reads the PR back as merged into the dev branch · never run `gh pr merge` yourself, never merge into another branch or outside this section
- **Candidates**: `done` items whose `merged` is not true and whose PR is open — the task PRs this loop opened; a plan-sync PR and any PR the agent did not open stay with a human · lead mode: not a PR whose branch is in `workers[]` (merge-pr refuses it too) or held by a worktree (9.1 item 4)
- **Order**: `gh pr list --state open --json number,headRefName,baseRefName,isDraft,body` · base = the dev branch, not a draft → judged this round, oldest PR first · base = the dev branch but still a draft, on an agent branch, whose body's `Stacked on #<parent>` PR is merged (GitHub moved it there itself, when the repo deletes merged head branches) → `gh pr ready` + the empty commit that starts CI on the new base, as `/pitwall:merge-order` step 2 does, a report line, and it is judged next round · base = another PR's branch (a stack child): that branch's PR merged → retarget it as item 5 and judge it next round · its parent still open → it waits, no hold line
- **One action per round**: the section ends after the round's first merge (items 4–5) or first merge-in (item 3) — a merge moves the dev branch, so every other candidate would need a merge-in and a new CI run before it may merge: at most one PR merges per round, so at most one per stack root · a hold, a wait or a re-verify goes on to the next candidate
- **Marker**: write `autoMergeAt` = now in the state when the section starts and `null` when it ends, so `/pitwall:stop` and `/pitwall:brake` know a round may still merge

Per candidate, one at a time:

1. **Gate 6**: the profile has a "multi-machine" section → **receive** the state per that section first · read the state file again — `stopRequested` set (`/pitwall:stop` or `/pitwall:brake` during the round) → no more merges this round
2. **Gates 1–3 and always-human**: `git fetch origin -q` · `node <pitwall dir>/scripts/merge-gate.mjs --state <state path> --profile .claude/agent-loop.md <n>` · `MERGE` → item 3 · `HOLD 1: re-verify …` or `HOLD always-human: no Always park check by the verifier at patch …` → **re-verify** below, then this item once more · any other `HOLD` → held (item 6) · exit 2 / 3 → its stderr line in the report, next candidate
   - **re-verify** (owner rule: a PARTIAL verdict whose boxes are all ticked since, or a verdict from before the Always park question): one fresh verifier at the PR's head, as item 0 runs it (`git switch <head>` + `git pull --ff-only`, `/pitwall:gauge` "Independent verifier", `git switch <base>`), its prompt also holding the `verified` entries at this patch-id behind the PR's ticked boxes (gauge item 2) · record its verdict and its Always park line (`/pitwall:gauge` "Record results" item 1) and set `reverified` = this patch-id on the `done` item · then `merge-gate.mjs` again: `MERGE` or `HOLD` from the new verdict — gate 1 never accepts PARTIAL · no re-verify, held as printed, when the latest verdict at this patch-id is FAIL (item 0 skips it too), when `reverified` already equals this patch-id, or when this section already ran one this round · lead mode: the dev server token as for item 0's re-verify (9.6)
3. **Gate 4 — fresh dev branch**: `git fetch origin -q` · `git rev-list --count $(git merge-base origin/<dev branch> origin/<head>)..origin/<dev branch>` is 0 → item 4: the PR branch already holds the whole dev branch, so the CI that gate 3 accepted ran on what the merge commit will hold · above 0 → the dev branch moved since the PR's merge-base (whatever files it touched: what the patch depends on cannot be read from file names, SPEC gate 4) → `devMerges` on the `done` item is already 2 → held, `HOLD 4: the dev branch moved a third time` · else merge `origin/<dev branch>` into the PR branch in a scratch worktree as `/pitwall:merge-order` 2b items 3–6 do (a clean merge needs no resolve step; a conflict only in `resolve conflicts yourself` files → its script; any other conflict → `git merge --abort`, held `HOLD 4: conflict in <file>`), push, `devMerges` += 1, write the state, a report line → the section ends (one action): the PR's new CI runs and a later round judges it again (a push that changed the patch-id → item 0 re-verifies it first)
4. **Merge, gate 5**: `node <pitwall dir>/scripts/merge-pr.mjs --state <state path> <n>` · `MERGED #<n>` (it read the PR back as merged into the dev branch) → leave `merged` to item 1, which runs next, sets `merged: true` and syncs the tracker (tracker sync item 2) · clear `held`, write the state, report line `merged #<n> into <dev branch>`, then item 5 · `REFUSED: <reason>` → held (item 6) · `FAILED: <reason>` → held, and no more merges this round (the PR's state is not known) · a `FAILED` that says it merged into another branch → also one push notification right away, whoever started the round
5. **Stack child**: the merged PR's head is another open PR's base → retarget that child per `/pitwall:merge-order` step 2 (`gh pr edit <child> --base <dev branch>`, `gh pr ready <child>`, the empty commit that starts CI on the new base) + a report line · the child is judged in a later round, never in this one: its CI has not run on the dev branch yet (gate 3) · then the section ends (one action)
6. **Held**: one line per held PR in the round report (section 8): `#<n> HOLD <gate>: <reason>`, merge-pr's `REFUSED` / `FAILED` reason as is · a hold that ends by itself (a check `pending`, the new CI after item 3) is that report line only · any other hold whose line differs from `held` on the `done` item → store it in `held` and, in a round the user did not start, send one push notification as section 8 does: `<repo>: PR <link> held — <gate>: <reason>` · a held PR waits for a human or for its next commit: never fix it outside a task

State: `autoMergeAt` (the marker above) · on each `done` item, all optional: `devMerges` (gate 4 merges into the PR branch, missing = 0), `reverified` (the patch-id of this section's last re-verify), `held` (the last hold line notified)

## Never

- never merge a PR, never push / checkout to edit branches the profile forbids, never `--force`, never `--no-verify`
- the one exception to the line above: under `merge: auto`, section 10 merges the loop's own PRs into the dev branch through `merge-pr.mjs` — never `gh pr merge` directly, never by a worker, never into another branch
- conflict on pull / rebase → park, never resolve it yourself
- never edit `.env*`, secrets, CI workflows (unless the task says so directly), never answer the plan's open questions yourself
- never touch other people's PRs / branches / tasks, never move a task to `review` before its PR merges, and never move it past `review`
- never ask the user mid-round — human questions are asked all at once in the briefing of `queue.md` · during the run use "the ladder" · the pair run for human-only steps does not count as asking
- never open a PR for a bug task that was never reproduced (playbook `bug-fix` item 1) — except the "already correct" case there, which changes no code
