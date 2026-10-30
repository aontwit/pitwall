---
playbook: drive
---

## What it does

`/pitwall:drive` starts the loop: one `/pitwall:lap` after another, each scheduling the next, until the queue is empty or you stop it. Drive does no task work itself. It runs the checks below, writes the loop's state and hands over to the first lap.

## Use it when

- the queue is ready and its questions are answered
- you are about to leave the machine for a while, or for the night

## Try it

```text
/pitwall:drive              start with the first pickable task
/pitwall:drive P2-05        start with this task (it must be in the queue)
```

Don't work in this checkout while the loop runs, because it switches branches there.

## Before it starts

Drive refuses to start, and says why, when:

- the repo has no profile (run `/pitwall:init` first)
- the working tree has uncommitted changes (commit or stash them)
- `gh` is not signed in, or the dependencies are not installed
- the queue has no task it could pick because all are blocked or waiting for a merge (run `/pitwall:queue` first, or answer the blocked questions)
- in [lead mode](../parallel-laps/), another session still leads, or workers a brake left behind are waiting while `parallel` is back to 1 (set it above 1 again to resume them)

It starts with a warning when the browser in the profile does not connect (browser checks wait and bug-fix tasks park) or the tracker's tools are not connected (tasks are not logged).

## What you'll see

The example comes from a made-up repo, `acme/shop`.

```text
Loop started · 4 tasks in the queue
  Each round: pick from the queue → work → /pitwall:gauge → review → PR. No merges, no questions; stuck → park and move on.
  While it runs, don't work in this checkout.
  Stop with /pitwall:stop (after this task) or /pitwall:brake (now).
```

Under [`merge: auto`](../auto-merge/) the start message still says "No merges", but the sync at the start of a round may merge one finished PR into the dev branch.

With `parallel` above 1 in the profile, the message has one more line: up to that many tasks run at once, each in its own worktree and branch, and this session leads them ([lead mode](../parallel-laps/)).

After that you get one report per round, as on the [lap page](../lap/). A round you did not start yourself that opens a PR, parks a task or stops the loop also sends one push notification, if your setup has them. When the queue is empty, the loop checks every 30 minutes for PRs that merged.

## Stop it

- `/pitwall:stop` finishes the current task, then stops.
- `/pitwall:brake` stops now and saves the work as a WIP commit. The next `/pitwall:drive` resumes it.
