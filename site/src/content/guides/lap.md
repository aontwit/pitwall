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

## Stop or change it

- `/pitwall:stop` finishes the task in progress, then stops.
- `/pitwall:brake` stops now and saves the work as a WIP commit.
- `/pitwall:drive` runs lap after lap until the queue is empty.
- The profile, `.claude/agent-loop.md`, sets the branch pattern, check commands, review panel, agents per task and dev server.

A lap never merges, never force-pushes, never touches a branch the profile protects, and never asks you a question in the middle of a round.
