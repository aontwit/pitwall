---
playbook: plan
---

## What it does

`/pitwall:plan` is the front of the loop. It interviews you in short rounds of tick-box questions, writes every answer into the spec or the plan before the next round, and ends with plan rows that `/pitwall:queue` can pick. It never writes code, and it ends with a docs-only PR that you merge.

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

The mode follows from what it finds: **new** (no spec: the whole product), **phase** (one phase still `TBD`), or **amend** (a decision you describe in words).

## How it runs

<ol class="steps">
<li><strong>Read first.</strong> The spec, the plan, the repo rules and the questions already answered. Anything a file answers is never asked.</li>
<li><strong>Ask in rounds.</strong> Two or three questions per round, recommended answer first, each option saying what it does to the plan. Only questions whose prerequisites are settled; a question that reshapes everything is asked alone.</li>
<li><strong>Record as it goes.</strong> Product decisions go into the spec, marked <code>(owner &lt;date&gt;)</code>; order and process decisions into the plan's answered table. Nothing stays only in chat.</li>
<li><strong>Write rows.</strong> Each row cites a spec section, names its files (about eight at most) and has a checkable "Done when". A row that needs a human verdict becomes a gate row.</li>
<li><strong>Open the PR.</strong> A docs-only PR with a table of decision, where it landed and the date. You merge it, then run <code class="cmd">/pitwall:queue</code>.</li>
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

Merge the plan PR, then `/pitwall:queue`. Anything still undecided stays labelled open, and a phase that is not ready keeps `TBD`, so the queue skips it.
