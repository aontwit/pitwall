---
name: stop
description: Park when you get there ("จอดเมื่อถึง") — stop the agent loop after the current task finishes (gauge, review, PR done first), then don't pick the next one. Use when the user runs /stop, "หยุด agent หลังจบงานนี้" (to stop immediately use /brake)
---

# /stop — stop after the current task

1. Read state (path in `.claude/agent-loop.md`; no file + the profile has a "multi-machine" section → receive first) — none / `running:false` → say "the agent is not running" (in the profile's user language), end
2. Set `stopRequested: true` and write it back (multi-machine → **send** state every time you write)
3. `currentTask` is null (between rounds / queue empty / waiting for merge) → `running:false`, `ScheduleWakeup stop:true`, summary report of `done` (PR link + gauge status) and `parked` (branch + reason + question)
4. Has `currentTask` → **don't touch the task**, tell the user: "will stop after `<id>` finishes (currently at step `<step>`)" — the current `/lap` round works until the PR is opened, then stops itself
5. Want to stop right now → tell them to use `/brake`
6. At the end of the item 3 report → `/secretary` short mode (speak only if there is something new that keeps being repeated)
