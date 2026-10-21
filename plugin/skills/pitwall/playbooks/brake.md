---
name: brake
description: Brake ("เบรก") — stop the agent loop immediately, even mid-task — save the unfinished work as a WIP commit (or stash) on the task's branch, then cancel the loop. Use when the user runs /pitwall:brake, "หยุดเดี๋ยวนี้", "หยุด agent ทันที"
---

# /pitwall:brake — stop immediately, save unfinished work

1. `ScheduleWakeup stop:true` before anything else (prevents the next round from firing on top)
2. Read state (path in `.claude/agent-loop.md`; no file + the profile has a "multi-machine" section → receive first) — none / `running:false` → say "not running" (in the profile's user language), end
   lead mode (`lap.md` section 9): a non-empty `workers[]` counts as running, even with `running:false` (a single round started by `/pitwall:lap`)
3. Set `running:false`, `stopRequested:true` and write it back (**keep** currentTask / branch / step so `/pitwall:drive` can resume)
4. Has `currentTask`:
   - cancel subagents that are still running
   - `git status --porcelain` has changes → `git add -A && git commit -m "wip: <id> stopped at <step>"` on the current branch — hook fails → `git stash push -u -m "agent-loop <id> @<step>"` and record `stash` in state · **don't open a PR, never discard** · don't push — unless the profile has a "multi-machine" section: push the WIP branch and record `stashMachine` per that section
   - `git switch <base>`
   - has `trackerId` → comment (in the profile's tracker language) starting with `**[Claude] Stopped by /pitwall:brake**`: the step it stopped at, branch, saved as commit or stash — **status stays `in progress`**

   lead mode (`lap.md` section 9), `workers[]` not empty — the **lead-mode save**: stop every worker that still runs (`TaskStop` on its `agentId`) · per entry, in its worktree (`worktree`, or `git worktree list --porcelain` by `branch`; no branch yet → nothing to save): the same save as above with `git -C <worktree>` — WIP commit `wip: <id> stopped at <step>` (`<step>` = the entry's last known step), hook fails → `git -C <worktree> stash push -u -m "agent-loop <id> @<step>"` and record its sha (`git -C <worktree> rev-parse stash@{0}`, right after the push) as `stash` in the entry · no `git switch`, no PR, never discard, no push (multi-machine: push each WIP branch per that section) · then clear `agentId`, `waitFor` and `waitSince` in the entry (`waited` += the open wait) · the same tracker comment per `trackerId`, naming the last known step · **keep `workers[]`** (branch, worktree, step, stash) so `/pitwall:drive` resumes each one · `devServer` → null, and stop the dev servers the workers started
5. multi-machine → **send** state
6. Report (in the profile's user language): the unfinished task + branch + the step it stopped at + how it was saved, summary of `done` / `parked`, how to continue (`/pitwall:drive` resumes on its own) · lead mode: the same per `workers[]` entry, with its last known step
