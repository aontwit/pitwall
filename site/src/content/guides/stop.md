---
playbook: stop
---

## What it does

`/pitwall:stop` ends the loop gently. A task in progress is left alone: its round finishes, opens the PR, and then the loop stops by itself. Between rounds, it stops at once. In [lead mode](../lap/#lead-mode-parallel-laps), no new worker starts, the running ones finish their PRs (or park), and the loop stops once none is left.

Under [`merge: auto`](../lap/#auto-merge), it also stops merges while the loop runs: from then on no PR merges into the dev branch, and that includes a single round you started with `/pitwall:lap`, until `/pitwall:drive` starts the loop again. A PR that already merged stays merged.

## Use it when

- you want the loop to end but the current task to land as a PR
- you are back and want the checkout for yourself after this task

To stop in the middle of a task, use `/pitwall:brake`.

## Try it

```text
/pitwall:stop
```

## What you'll see

The examples come from a made-up repo, `acme/shop`. A task is in progress:

```text
Will stop after P2-05 finishes (currently at step reviewing).
```

Between rounds, a summary of the run:

```text
Loop stopped
Done
  P2-04  #58   PARTIAL
  P2-07  #59   VERIFIED
Parked
  P2-05  agent/p2-05-saved-card  the plan does not say what happens when the saved card has expired
```

When it stops, it also reads the session for anything you keep repeating, and speaks only if there is something new.
