---
playbook: queue
---

## What it does

`/pitwall:queue` picks the tasks the agent can finish alone, puts them in the loop's queue, and asks you every open question once, as tick boxes. After you tick them, `/pitwall:drive` can run all night without asking again.

## Use it when

- a merged plan PR added new rows
- you want to see what is ready without changing anything (`dry`)
- a task came in that is not in the plan yet: describe it in words and it becomes a plan row

## Try it

```text
/pitwall:queue                 both sources: the plan's unticked rows and the tracker's open tasks
/pitwall:queue dry             the table only, the queue is not touched
/pitwall:queue 2.6 2.7         these plan rows
/pitwall:queue add a price sort to search
/pitwall:queue remove 2.7
```

The queue lives in the loop's state. It does not edit files in the repo or touch the tracker.

## The six checks

A task is queued only when all six pass:

<ol class="steps">
<li><strong>A brief can be written.</strong> The row names its files and has a checkable "Done when".</li>
<li><strong>The proof is automatic.</strong> Checks or a browser can show it works. A real payment or an irreversible action is left to you.</li>
<li><strong>No open decision.</strong> An open decision is fine if you can answer it with a tick box in the briefing.</li>
<li><strong>Nobody outside the team is needed.</strong> No value is still coming from backend, design or ops.</li>
<li><strong>It fits one round.</strong> About 90 minutes and eight files. Bigger work that can be measured can repeat in small rounds.</li>
<li><strong>No overlap.</strong> It does not overlap an open PR or files another task will touch.</li>
</ol>

## What you'll see

The examples come from a made-up repo, `acme/shop`. First the table, before anything changes:

| id | source | result | playbook | reason | failed | waiting for |
|---|---|---|---|---|---|---|
| P2-04 | plan | pass | feature | brief complete, proof at level B | | |
| P2-05 | plan | pass | feature | one question for the briefing | | |
| P2-06 | plan | fail | | tax rates come from the finance team | 4 | finance |
| P2-07 | plan | pass · repeat | ratchet | 212 lint warnings, one batch per round | | |
| P2-08 | plan | pass | bug-fix | the sort is wrong on a phone | | P2-04 merged |

Then the briefing, showing the default each task takes if you don't answer:

```text
P2-05 Pay with a saved card
  What happens when the saved card has expired?
  ● Ask for a new card before paying (recommended)
  ○ Fall back to entering the card by hand
  ○ Wait: leave the task blocked
```

If you answer "wait" or skip a question, that task stays blocked and the next `/pitwall:queue` asks again. Defaults the loop takes on its own show up in each PR under "Decisions to confirm".

## Next steps

Run `/pitwall:lap` for one task, or `/pitwall:drive` for the whole queue.
