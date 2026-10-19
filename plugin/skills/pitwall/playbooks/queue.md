---
name: queue
description: Pick tasks into the agent loop queue — look at both the unticked rows in the repo's plan and the open tasks in the tracker (profile `tracker`), decide which ones the agent can do on its own (6 criteria), then queue them with a playbook and a pass / fail reason table. Use when the user runs /pitwall:queue, "งานไหนให้ agent ทำได้บ้าง", "ใส่คิว agent" · repo values live in .claude/agent-loop.md
---

# /pitwall:queue — pick tasks for the agent loop

Read `.claude/agent-loop.md` first (sections repo, plan, tracker)

Arguments:
- `/pitwall:queue` = analyse both sources, then queue the ones that pass
- `/pitwall:queue dry` = analyse + show the table, **do not touch the queue**
- `/pitwall:queue 2.6 2.7` = plan rows by number · `/pitwall:queue <tracker task id or URL>` = a tracker task — still check the criteria; fails → say why and do not queue it
- `/pitwall:queue remove <id>` = remove from the queue
- `/pitwall:queue <a task in words>` (anything that is not a row number, tracker id or keyword) = **add a plan row** (the `add-task` of other loops): write it in the profile's plan row format — next free id, task, files, DoD ("Done when") — then check the criteria like any row · the row is a **pending row**: stored in the queue item as `"newRow": "<the row, as it will appear in the plan>"` and written into the plan file by `/pitwall:lap` on the task's own branch (`lap.md` section 5), because the loop never commits to base · no DoD in the words → the row still queues, and "Done when" becomes a briefing question (step 4) · profile has no plan section → stop: "run `/pitwall:init` first"

The queue lives in the loop's state (path in the profile), field `queue` — **do not edit files in the repo and do not touch the tracker** (creating tasks belongs to `/pitwall:ticket`)

## 1. Pull data from the 2 sources

The profile has a "multi-machine" section → **receive** state per that section first (the other machine's queue / done / parked must not be lost) · at the end of a `/pitwall:queue` that changed the queue → **send** state


**Plan** (if the profile has a "plan" section): `git fetch origin -q` then `git show origin/<base>:<plan files in the reading order from the profile>` — task = an unticked row whose agent PR has not merged (`node <pitwall dir>/scripts/plan-sync.mjs --dry <plan files>` lists the merged ones: ticks land later, in the lap's plan sync), plus the pending rows (`newRow`) already in the queue; skip phases / rows the profile marks "not queued"
**Tracker** (skip when `none`): the open tasks per the `pitwall:ticket` skill section "Find open tasks" (tag from the profile, status `to do`, assignee me or empty) — plan subtasks that `/pitwall:ticket` has already created count as plan rows, not counted twice
Both: `gh pr list --state open --json number,title,headRefName`

## 2. Criteria (must pass all)

| # | Criterion | Fails when |
|---|---|---|
| 1 | A 6-section brief can be written | Plan row: gives only a name, no files, no DoD · tracker task: no checkable "Done when" section |
| 2 | Main evidence is level A/B of `/pitwall:gauge` | Main evidence has to be C (a real transaction, an irreversible action) → the human does it with Claude · only needs a human-only step with no lasting effect (connect / sign in) = still B → passes (the loop uses pair run or park per `/pitwall:lap`) |
| 3 | No decision needed — or it can be asked in the briefing (step 4) | A question the briefing asked and the user did not answer / answered "wait", or needs someone outside the team to answer (criterion 4) · a question the user can answer by ticking → **passes**, then ask it in step 4 · observable and not on a list → **passes** (line below) |
| 4 | Does not wait on anyone outside the team | `external`, values from backend / chain / devops / design not available yet (unless the plan clearly allows a placeholder) |
| 5 | Finishes in 1 round (~90 minutes, ≤ ~8 files) | Sweeps the whole repo — **except** when it splits into small rounds and is measurable as a number → passes as `repeat` |
| 6 | Does not overlap pending work | There is an open PR for this task, or it touches the same files so a conflict is certain |

Unsure on criterion 3 → classify it ("The 3-step ladder (loop / autopilot)" in `pitwall/SKILL.md`): observable and not on "Always park" / "Never default either" → **passes**, reason `prototype first` · on a list or not observable → ask it in the briefing (step 4), cannot be asked → **fails** · unsure on criterion 4 → check it read-only now · unsure on criterion 5 → **fails** (or split into `repeat`) · dependency not merged yet → may pass but state "waiting for X" (the loop skips it until X merges)

**playbook**: choose by task type in the profile (`move-only` / `ratchet` / `port` / `bug-fix` / none) — a task that fixes wrong behavior (task `[bug]` or its "Why" describes a wrong symptom) → `bug-fix`, set from the moment it is queued · rows the profile already assigns `port` stay `port` — a task the profile says needs a playbook but the playbook does not exist yet → fails

## 3. Report + queue

1. Table before touching anything: `id | source | result (pass / pass·repeat / fail / already queued) | playbook | short reason | failed criteria | waiting for`
2. Not `dry` → add to `queue` (no state file → create it with `running:false`), plan first (by phase / number), then tracker:
   ```json
   { "id": "2.7", "source": "plan", "file": "phase-2-trade-refactor.md", "playbook": "ratchet", "repeat": true, "waitFor": ["2.6"] }
   { "id": "t-<task id>", "source": "tracker", "trackerId": "<task id>", "playbook": "bug-fix" }   // or null if not a bug
   ```
3. Closing summary: how many were queued, the ones waiting on a merge, the ones a human should do (level C)

## 4. Briefing — ask every unclear point once, as tick boxes

Do this at the end of every `/pitwall:queue` (except `dry`) — goal: once the user finishes ticking, `/pitwall:drive` can run all night without asking again

1. Gather the questions of **every task in the queue** (both new ones and existing ones still unanswered): open questions in the plan that the row refers to, forks the brief cannot be written without knowing, items in the "Always park" list of `pitwall/SKILL.md` that the task will touch, parked tasks with a question
2. Drop questions you can answer yourself: can be tried (step 1) or has a reversible default in a rule / playbook (step 2) → do not ask, but **the table must have a `default to use` column** per task so the user sees it before ticking · items on the "Always park" / "Never default either" lists of `pitwall/SKILL.md` → always ask, never drop them yourself
3. Ask the rest with **AskUserQuestion** — in the profile's user language · ≤ 4 questions per call, ≤ 4 options · recommended option first, marked with the profile's recommended marker · the description states the outcome of each option · more than 4 → call several times in a row in the same round · questions where several choices apply use `multiSelect`
4. Store answers in state: `answers[<task id>] = [{ q, a, at }]` → **send** state (multi-machine) · answers to the plan's open questions → `/pitwall:lap` records them in the plan on that task's branch, stating the user answered in the briefing on which date (this is not "answering the plan's open questions yourself", which `lap.md` forbids)
5. User answers "wait" / does not answer → set `blocked: "waiting for answer: <question>"` on that task in the queue (`/pitwall:lap` skips tasks with `blocked`) · all answered in the next `/pitwall:queue` → remove `blocked`
6. Closing summary: tasks ready to run all night · defaults the loop will take itself (they will be in each PR's Decisions to confirm) · items still parked
