---
playbook: brake
---

## What it does

`/pitwall:brake` stops the loop **now**. It cancels the next round first, then saves the unfinished task as a WIP commit on its branch (a stash if a hook refuses the commit), and switches back to the base. Nothing is discarded and no PR is opened. Nothing is pushed either, unless the profile hands work between machines; then the WIP branch is pushed so the other machine can resume it.

In [lead mode](../lap/#lead-mode-parallel-laps), it stops every worker and saves each one's worktree the same way, at its last known step; the next `/pitwall:drive` resumes each one in a new worker.

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

With a tracker, the task gets a comment saying where it stopped and how the work was saved; its status stays in progress.

## Resume

Run `/pitwall:drive`. The first round picks the stopped task up at the step it left, on the same branch.
