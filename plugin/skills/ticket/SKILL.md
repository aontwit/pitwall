---
name: ticket
description: Ticket — the tracker adapter of pitwall. Create / find / update the tracker task for each piece of work (plan work = subtask under the phase's parent task; review = merged) so work the PM didn't hand out, improvements you found yourself, and every task the agent loop does show up where the team scores it. v1 trackers: `clickup`, `none` (no tasks, the PR is the record). Use when the user runs /ticket, "สร้าง task", "เปิด task ใน sprint" — /lap calls this skill itself · repo values live in .claude/agent-loop.md
user-invocable: true
---

# /ticket — the tracker task for each piece of work

Read the `tracker` section of `.claude/agent-loop.md` first — its first row is `tracker: clickup | none` (no section = `none`)

## Tracker `none`

No tracker tasks: the PR is the record of the work · `/ticket …` typed by the user → say "this repo has no tracker (profile `tracker: none`)" and stop (`/ticket agent` too) · every call from the loop → do nothing, return

Everything below is the `clickup` adapter (values from the profile: workspace / space / sprint folder, tag, QA, names)

Arguments:
- `/ticket <subject + details>` = create a task in the current sprint with status `to do`
- `/ticket agent <subject + details>` = create it and also put it in the loop's queue (it must pass the `/queue` criteria)
- called from `/lap` = find the task for that work; none → create it (sections 3–4) · update it per event (section 5)

Operations the playbooks call by name:

| Operation | clickup |
|---|---|
| Find open tasks (`/queue`) | section 2 → `clickup_filter_tasks list_ids=[sprint]` with the profile's tag, status `to do`, assignee me or empty |
| Read a parent with its subtasks (`/lap` tracker sync) | `clickup_get_task include=["subtasks"]` |
| Create / status / comment | sections 4–5 |

## 1. Common values

| | |
|---|---|
| me | `clickup_resolve_assignees ["me"]` — use the numeric id, don't hardcode it |
| statuses the agent uses | `to do` · `in progress` · `review` · `pending` (blocked) — the stages after review (`rejected`, `wait to deploy`, `on prod` …) QA / PM move themselves |
| `review` means | merged into base, testable on dev (not just a PR opened) |
| tag | per the profile — the tag must already exist; never create a new one |

## 2. Find the current sprint

`clickup_get_workspace_hierarchy space_ids=[<space>] max_depth="2"` → in the profile's sprint folder, pick the list whose date range in its name covers today (`clickup_get_folder` does not return the list names — don't use it)
No list covers today → **never guess**: manual → ask the user · from the loop → skip the tracker step and write in the PR "No sprint list for today yet"

## 3. Names + structure (names from the profile — the way the team actually names things)

| Work | Structure |
|---|---|
| a plan row | a **subtask** under 1 parent task per phase |
| other work / improvements you found yourself | a standalone task in the sprint |

Avoid duplicates: `clickup_filter_tasks list_ids=[sprint] include_closed=true` → a name that starts the same way (parent: phase name, child: `<prefix> <id> `) → use that one
The parent task is not in this sprint (the phase spans sprints) → look in the previous sprint by the same name; found → use it, not found → only then create it

## 4. Create

Every one: `clickup_create_task` list_id=current sprint, **assignees=[<id of me>], never empty**, tags per the profile → `clickup_get_task` to confirm me is on it (not there → the assignee rule in section 5)
- **phase parent task**: status `in progress` · description in the profile's tracker language · Why (the plan's goal + the phase) / What (link to the phase file, 1 subtask = 1 row = 1 PR) / Done when (all subtasks merged + QA per the phase's combined DoD)
- **subtask**: `parent=<parent id>`, status `in progress` (loop) — parent already in `review` → parent back to `in progress` + comment (in the profile's tracker language) "Added <subtask> — back to in progress until everything is merged"
- **standalone task**: status manual `to do` · loop `in progress`

Description of a subtask / standalone task (body in the profile's tracker language):

```markdown
## Why
<problem / opportunity — for work you found yourself, say where you found it (code, user, metric)>

## What
<short scope + main files · plan work: link the row in the phase file instead of copying it>

## Done when
- <checkable criteria — level A/B/C of `/gauge`>
```

No points / estimate — the team scores it at sprint review · manual: not enough information to write "Done when" → ask the user 1 question before creating

## 5. Updates along the way (called by the loop) — short team-style comment, no tables (the Verify table / size live in the PR)

Comment templates below are in English; write them in the profile's tracker language.

| Event | subtask / standalone task | parent task |
|---|---|---|
| PR opened | **keep `in progress`** + 1-line comment `PR #<n> opened (waiting for merge) — <what it does> · no testing needed yet` → store `prCommentId` in state | don't touch |
| PR merged (sync at the start of a `/lap` round) | → `review` + ✅ on the PR comment: the API has no reactions, so use `clickup_update_comment` to prepend `✅ merged <YYYY-MM-DD> — ` to the existing text | see the next row |
| the parent has **≥ 1** subtask and **every one** is in `review` or later | — | → `review` + comment to QA: `merged to <base>: PR #a, #b · <effect on users / regression scope> · please test on dev: <level C steps from the PR> [@<QA>](#user_mention#<id>)` |
| PR closed without merge | keep `in progress` + comment the reason + report to the user | don't touch |
| park | → `pending` + 1–2 line comment with the reason / question | don't touch |

- **Changing status: `clickup_update_task` sends only `task_id` + `status`** — never send `assignees` in the same call (the tool replaces the whole list)
- **Assignee rule (after every create or status change):** there must be ≥ 1 assignee and me must be one — me missing → `clickup_update_task assignees=[<everyone already there> + me]` (never remove anyone, including QA)

## 6. `/ticket agent`

Create per section 4 (status `to do`), then check the `/queue` criteria — pass → add to `queue` in state: `{ "id": "t-<task id>", "source": "tracker", "trackerId": "<task id>", "playbook": null }` · fail → say which criteria failed (the task stays in the sprint for a human to do)

## Report

Task link + sprint + status + (if any) whether it was added to the loop's queue — in the profile's user language

## Never

- Never touch other people's tasks (without me) **except** tasks the agent created itself (in state / subtasks of a parent in `parents`), to which you may add me back · never change priority / points · assignee: you may only add me
- Never create a task outside the profile's sprint folder; never create a new tag / list; never delete a task
- Never move to `rejected` / `accepted` / `wait to deploy` / `on prod` / `complete`
