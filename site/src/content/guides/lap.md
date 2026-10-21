---
playbook: lap
---

## What it does

`/pitwall:lap` runs **one round** of the loop. It takes the next task from the queue, does it on a fresh branch, proves it, gets a review and an independent verdict, and opens a pull request. Then it ends, or, when `/pitwall:drive` started it, schedules the next round. It never merges.

## Use it when

- you want to watch one round before you let the loop run on its own
- you changed the profile or a playbook and want to see one task end to end
- one task is urgent, and `/pitwall:drive` would keep going after it

## Try it

```text
/pitwall:queue
/pitwall:lap
```

Run `/pitwall:queue` first. A lap only takes tasks from the queue, and the queue is where every question for you was asked, up front.

## How a round runs

<ol class="steps">
<li><strong>Sync.</strong> Pull the base, tick or untick PR checkboxes whose code changed since they passed, re-verify one older PR, and note which PRs were merged.</li>
<li><strong>Pick.</strong> Take the first task that is not blocked, parked, already open as a PR, or waiting for another merge. Nothing left: report and end.</li>
<li><strong>Branch.</strong> A new branch from the base, named by the profile's pattern.</li>
<li><strong>Work.</strong> Research, a six-part brief, then code. A large task goes to a subagent for its role; the lead reads every diff and reverts any file outside the brief.</li>
<li><strong>Prove and review.</strong> <code class="cmd">/pitwall:gauge</code> runs your checks and drives the page in a browser. The same review prompt goes to every model on the panel, and their findings become one table.</li>
<li><strong>Verdict and PR.</strong> A fresh, read-only verifier checks the committed head and pins its verdict to the patch-id. Then the PR opens with all of the evidence.</li>
</ol>

A task that cannot be finished safely is **parked** instead of shipped: the work is kept as a local commit that is not pushed, the reason goes on record, and the round moves to the next task. A task that runs past 90 minutes changes its method first; after two changes, or 180 minutes, it parks.

## What you'll see

The examples below come from a made-up repo, `acme/shop`.

### The report at the end of the round

```text
Lap · P2-04 Sort search results by price
PR      https://github.com/acme/shop/pull/58   [PARTIAL]
Task    plan row P2-04 (tracker: none)
Gauge   PARTIAL: every A and B item passed, 1 C item left for a human
Edited  src/search/sort.ts · src/search/sort.test.ts · docs/plan/phase-2.md
Parked  none
```

### The pull request

<div class="example" data-label="PR #58 · [PARTIAL] Sort search results by price">

**What.** Sort search results by price, low to high and back. Plan row P2-04, playbook `feature`.

**Changes**
- the search page has a price sort, low to high and high to low
- results with the same price keep newest first

**Verify**

| Item | Level | Command / method | Result |
|---|---|---|---|
| typecheck | A | `pnpm typecheck` | ✅ 0 errors |
| unit tests | A | `pnpm test src/search` | ✅ 14 passed |
| search page | B | dev server `/search?q=lamp` @1366 | ✅ order correct both ways, console 0 errors |
| phone check | C | 1. search "lamp" on a phone 2. sort high → low → order is right | ⏳ |
| Verifier | — | general-purpose sonnet @3f9c2e1 patch 8d41b0c27a9e | ✅ PARTIAL |

**Decisions to confirm**
- Equal prices sort newest first · other option: by name · change it in `sortResults()`

**Agents used**
- Explore haiku · research → 6 files read
- general-purpose sonnet · coding → done
- review panel, 2 models · reviewing → 2 findings

**Review**
- act on (both models): an empty result list crashed the sort → fixed
- consider (one model): cache the sorted list → follow-up

**Not done yet (before merge)**
- [ ] C · on a phone: search "lamp", sort high → low, the order is right

</div>

### When a task is parked

```text
Parked P2-05 Pay with a saved card
Reason  the plan does not say what happens when the saved card has expired
Saved   commit "wip: P2-05 parked — …" on agent/p2-05-saved-card (not pushed)
Asked   the question is written into the plan's open questions on that branch
```

## Lead mode (parallel laps)

**Not proven yet.** Lead mode has not opened two PRs side by side on a live run. Try it on a repo where a stuck round costs you little.

When the profile's `parallel` is above 1, a round no longer does one task in this checkout. This session becomes the **lead**: it hands each task to a background **worker**, and each worker runs the round above, from Branch to PR, in its own git worktree and branch. With `parallel` missing or 1, a lap works as described above.

### What the lead does

<ol class="steps">
<li><strong>Pick a batch.</strong> Up to <code>parallel</code> tasks from the queue, whose plan rows share no file. Files the loop already resolves conflicts in, such as the plan file or <code>CHANGELOG.md</code>, don't count. A task that shares a file waits until the first one’s worker is done (PR open or parked). Tasks that come from the tracker rather than a plan row are not batched: they run one at a time in this checkout when no worker is running.</li>
<li><strong>Start one worker per task.</strong> Each gets a brief and its own worktree and branch, and runs the task to an open PR: code, checks, browser, review panel and verifier, under the same rules as a serial round. A worker that cannot start its own reviewers hands the task back, and the lead runs the review panel, verifier and PR for it. Workers use the profile's code role agent and model.</li>
<li><strong>Keep the books.</strong> Only the lead writes the loop state and the tracker. A worker hands everything back in its report and the lead records it, so two workers never write the same file. A worker that parks parks only its own task; the others carry on.</li>
<li><strong>Share the dev server.</strong> With <code>port: fixed</code>, one dev server runs on the profile's port and the workers take turns holding it. With <code>port: free</code>, each worktree runs its own server on the next spare port; steps that sign in still take turns, since one browser shares its cookies across ports. Pair runs and human-only steps go one at a time, run by the lead, since only the lead talks to you.</li>
<li><strong>Refill and report.</strong> Under <code>/pitwall:drive</code>, when a worker finishes, the lead fills its slot from the queue in the same turn. A <code>/pitwall:lap</code> you type runs one batch and reports once its last worker is done. A worker still running after 180 minutes is stopped and parked. When no worker is left, one report covers the batch.</li>
</ol>

Only one session leads at a time: a second session that finds a lead active in the last hour starts nothing and tells you so.

### What you'll see

One PR per task, each with its own Verify table and verdict, the same as a serial round. While workers run, the lead says which ones it started and which tasks it left out, and why:

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

### Stop and brake with workers running

- `/pitwall:stop` starts no new worker. The running ones finish their PRs, or park, and the loop stops once none is left.
- `/pitwall:brake` stops every worker now and saves each worktree as a WIP commit on its branch (a stash if a hook refuses). The next `/pitwall:drive` resumes each one in a new worker, at the step it left. Drive refuses while `parallel` is back to 1, and names the tasks that are waiting.

### Turn it on

In the profile, `.claude/agent-loop.md`, set the cap under `agents per task`, and say under `level B` whether each worktree may run its own dev server:

```markdown
## agents per task

`parallel: 2`

## level B (browser)

| | |
|---|---|
| dev server | `npm run dev` on port `3000` · `port: free` |
```

Leave out `port`, or write `port: fixed`, when your backend accepts only one origin. Then run `/pitwall:doctor`: it fails a `parallel` that is not a whole number of 1 or more, and a `port` other than `fixed` or `free`. Commit the profile to the base before the next `/pitwall:drive`.

## Stop or change it

- `/pitwall:stop` finishes the task in progress, then stops.
- `/pitwall:brake` stops now and saves the work as a WIP commit.
- `/pitwall:drive` runs lap after lap until the queue is empty.
- The profile, `.claude/agent-loop.md`, sets the branch pattern, check commands, review panel, agents per task, how many tasks run at once and dev server.

A lap never merges, never force-pushes, never touches a branch the profile protects, and never asks you a question in the middle of a round.
