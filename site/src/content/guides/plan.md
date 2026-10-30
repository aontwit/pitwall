---
playbook: plan
---

## What it does

`/pitwall:plan` sits at the front of the loop. It interviews you in short rounds of tick-box questions and writes each answer into the spec or the plan before the next round. It ends with plan rows that `/pitwall:queue` can pick, in a docs-only PR that you merge. It never writes code.

## Use it when

- the repo is new and has no spec yet
- the next phase of the plan still says `TBD`
- a decision changed and the spec and rows must follow it

## Try it

```text
/pitwall:plan                      choose the mode itself
/pitwall:plan phase-3              open that phase
/pitwall:plan prices now include tax
```

It picks the mode from what it finds: new when there is no spec (it plans the whole product), phase when one phase is still `TBD`, and amend when you describe a decision in words.

## How it runs

<ol class="steps">
<li><strong>Read first.</strong> It reads the spec, the plan, the repo rules and the questions already answered, and never asks what a file already answers.</li>
<li><strong>Ask in rounds.</strong> Two or three questions per round, recommended answer first, and each option says what it does to the plan. It only asks questions whose prerequisites are settled, and a question that reshapes everything gets a round of its own.</li>
<li><strong>Record as it goes.</strong> Product decisions go into the spec, marked <code>(owner &lt;date&gt;)</code>. Order and process decisions go into the plan's answered table. Nothing stays only in chat.</li>
<li><strong>Write rows.</strong> Each row cites a spec section, names its files (about eight at most) and has a checkable "Done when". A row that needs a human verdict becomes a gate row.</li>
<li><strong>Open the PR.</strong> The PR changes docs only and has a table of each decision, where it landed and the date. You merge it, then run <code class="cmd">/pitwall:queue</code>.</li>
</ol>

## What you'll see

From round two on, each round starts with a summary you can correct. The example comes from a made-up repo, `acme/shop`.

```text
Last round
  · v1 sells to logged-in customers only (owner, 2026-10-11)
  · prices are shown with tax included
  · phase 2 ends when search and checkout pass on a phone

Q1  Is this right?
    ● Yes, continue (recommended)   ○ Change something
Q2  How should search sort by default?
    ● Relevance (recommended): the row adds a relevance score
    ○ Newest first: no score, simpler row
```

A row it writes into the plan:

```text
| P2-04 | Sort search results by price | src/search/sort.ts, src/search/sort.test.ts |
  Done when: low → high and high → low both order correctly; equal prices keep newest first · spec §4.2
```

## Next steps

Merge the plan PR, then run `/pitwall:queue`. Anything still undecided stays labelled open, and a phase that is not ready keeps `TBD`, so the queue skips it.
