---
name: drive
description: Drive off ("ออกรถ") — start the agent loop automatically — pick tasks from the queue (/pitwall:queue) one at a time → code → /pitwall:gauge → review → PR → update the tracker task, then keep picking the next one until /pitwall:stop (stop after the task) or /pitwall:brake (stop immediately). Use when the user runs /pitwall:drive, "เริ่ม agent", "ให้ claude ทำงานเอง" (for a single round use /pitwall:lap) · repo values live in .claude/agent-loop.md
---

# /pitwall:drive — start the loop

Arguments (optional): `/pitwall:drive 2.6` = start with this task first (must be in the queue) · any other argument (e.g. a question) → answer it, don't start the loop

0. The profile has a "multi-machine" section → **receive** state per that section first (the other machine is still `running` → don't start)
1. Preconditions (any one fails → tell the user and don't start):
   - `.claude/agent-loop.md` exists — missing → this repo has not set up the loop yet
   - `git status --porcelain` is empty — not empty → have them commit / stash first (the loop switches branches in this checkout)
   - `gh auth status` passes · dependencies installed (command in the profile)
   - state has at least one **pickable** task in `queue` (no `blocked`, `waitFor` merged or empty — `lap.md` section 2) — none → have them run `/pitwall:queue` first, or answer the blocked questions; a queue of blocked tasks only would wake every 30 minutes for nothing
   - the browser from the profile won't connect (usually Claude in Chrome on the default browser) → can start, but B/C items become ⏳ case 3 of `/pitwall:lap` (PR is PARTIAL; `bug-fix` tasks will park)
   - profile `tracker` is set but its tools are not connected → can start, but tasks won't be logged (`/pitwall:ticket` later) · queue items with source `tracker` are skipped
2. Write state at the path in the profile (create the folder if missing; **keep the existing `queue`, `done`, `parked`, `parents`**):
   ```json
   { "running": true, "stopRequested": false, "startedAt": "<ISO now>", "firstTask": "<arg if any>",
     "currentTask": null, "branch": null, "step": null, "taskStartedAt": null, "lintBaseline": null }
   ```
   existing state has `currentTask` (left over from /pitwall:brake) → keep currentTask / branch / step / stash → the first round will resume
3. Tell the user in 3 lines (in the profile's user language): the rules (pick from the queue → work → /pitwall:gauge → review → PR, no merge → next one, no questions along the way, stuck → park and move on) · **while the loop runs, don't work in this checkout** · stop with `/pitwall:stop` or `/pitwall:brake`
4. Call the Skill `loop` with args `/pitwall:lap` (self-paced; every later wakeup prompt is `/loop /pitwall:lap`, `lap.md` section 8) — `/pitwall:lap` does the first round right away, then schedules itself

Never do the work in this skill itself — everything is in `/pitwall:lap` · permissions to set on the machine that runs the loop: the "permissions" section in the profile
