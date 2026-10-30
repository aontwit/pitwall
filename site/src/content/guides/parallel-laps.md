---
playbook: parallel-laps
---

## What it does

When the profile's `parallel` is above 1, this session becomes the lead. Instead of doing one task in this checkout, it hands each task to a background worker, and each worker runs a full [lap](../lap/), from Branch to PR, in its own git worktree and branch. With `parallel` missing or set to 1, a lap does one task at a time in this checkout.

> Lead mode is not proven yet. One live batch on the pitwall repo (0.7.0) opened two PRs side by side, but it has not run with a pinned backend port, and it has not been stopped or braked while workers run. Try it on a repo where a stuck round costs you little.

## What the lead does

<ol class="steps">
<li><strong>Pick a batch.</strong> Up to <code>parallel</code> tasks from the queue whose plan rows share no file. Files the loop already resolves conflicts in, such as the plan file or <code>CHANGELOG.md</code>, don't count. A task that shares a file waits until the first task's worker is done (PR open or parked). Tasks that come from the tracker, with no plan row, are not batched: they run one at a time in this checkout while no worker is running.</li>
<li><strong>Start one worker per task.</strong> Each worker gets a brief and its own worktree and branch, and runs the task to an open PR (code, checks, browser, review panel and verifier) under the same rules as a serial round. A worker that cannot start its own reviewers hands the task back, and the lead runs the review panel, verifier and PR for it. Workers use the agent and model of the profile's code role.</li>
<li><strong>Keep the books.</strong> Only the lead writes the loop state and the tracker. A worker hands everything back in its report and the lead records it, so two workers never write the same file. A worker that parks only parks its own task, and the others carry on.</li>
<li><strong>Share the dev server.</strong> With <code>port: fixed</code>, one dev server runs on the profile's port and the workers take turns holding it. With <code>port: free</code>, each worktree runs its own server on the next spare port, but steps that sign in still take turns, because one browser shares its cookies across ports. The lead runs pair runs and human-only steps one at a time, because only the lead talks to you.</li>
<li><strong>Refill and report.</strong> Under <code>/pitwall:drive</code>, the lead refills a finished worker's slot from the queue in the same turn. A <code>/pitwall:lap</code> you type runs one batch and reports once its last worker is done. A worker still running after 180 minutes is stopped and parked. When no worker is left, one report covers the batch.</li>
</ol>

Only one session leads at a time. A second session that finds a lead active in the last hour starts nothing and tells you so.

## What you'll see

One PR per task, each with its own Verify table and verdict, the same as a serial round. While workers run, the lead says which ones it started, which tasks it left out, and why:

```text
Started  P2-04 · P2-07, each in its own worktree
Waiting  P2-06 shares src/search/sort.ts with P2-04
```

When the last worker of a typed `/pitwall:lap` finishes, the round report has one row per task (the wording may differ):

```text
Lap · batch of 2
P2-04   https://github.com/acme/shop/pull/58   [PARTIAL]
P2-07   https://github.com/acme/shop/pull/59   VERIFIED
Parked  none
Waiting P2-06 shares src/search/sort.ts with P2-04
```

## Stop and brake with workers running

- `/pitwall:stop` starts no new worker. The running ones finish their PRs or park, and the loop stops once none is left.
- `/pitwall:brake` stops every worker now and saves each worktree as a WIP commit on its branch (a stash if a hook refuses). The next `/pitwall:drive` resumes each one in a new worker at the step it left. If `parallel` is back to 1, drive refuses and names the waiting tasks.

## Turn it on

In the profile, `.claude/agent-loop.md`, set the cap under `agents per task`, and say under `level B` whether each worktree may run its own dev server:

```markdown
## agents per task

`parallel: 2`

## level B (browser)

| | |
|---|---|
| dev server | `npm run dev` on port `3000` · `port: free` |
```

Leave out `port`, or write `port: fixed`, when your backend accepts only one origin. Then run `/pitwall:doctor`. It fails a `parallel` that is not a whole number of 1 or more, and a `port` other than `fixed` or `free`. Commit the profile to the base before the next `/pitwall:drive`.
