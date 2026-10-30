---
playbook: brake
---

## What it does

`/pitwall:brake` stops the loop now. It first cancels the next round, then saves the unfinished task as a WIP commit on its branch (or a stash if a hook refuses the commit) and switches back to the base. Nothing is discarded and no PR is opened. Nothing is pushed either, unless the profile hands work between machines. In that case it pushes the WIP branch so the other machine can resume it.

In [lead mode](../parallel-laps/), it stops every worker and saves each worktree at its last known step as a WIP commit (or stash) on its own branch, without switching branches. The next `/pitwall:drive` resumes each one in a new worker.

Under [`merge: auto`](../auto-merge/), it also stops merges. From then on no PR merges into the dev branch, including from a single round you start with `/pitwall:lap`, until `/pitwall:drive` starts the loop again. A PR that already merged stays merged.

## Use it when

- you need the checkout back immediately
- a round is going somewhere you do not want

To let the current task finish first, use `/pitwall:stop`.

## Try it

```text
/pitwall:brake
```

## What you'll see

The example comes from a made-up repo, `acme/shop`.

```text
Stopped P2-05 Pay with a saved card
  step    coding
  branch  agent/p2-05-saved-card
  saved   commit "wip: P2-05 stopped at coding"
Done      P2-04 #58 PARTIAL
Parked    none
Continue  /pitwall:drive resumes P2-05 from this step
```

With a tracker, the task gets a comment saying where it stopped and how the work was saved. Its status stays in progress.

## Resume

Run `/pitwall:drive`. Its first round picks up the stopped task on the same branch, at the step where it stopped.
