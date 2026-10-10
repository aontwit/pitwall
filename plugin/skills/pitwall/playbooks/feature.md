<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/poteto-mode/playbooks/feature.md · MIT License, Copyright (c) 2026 Lauren Tan · license: `principles/LICENSE-pstack` · adapted for pitwall v1 (2026-10-07) -->

# playbook: feature — own the design, delegate the code, prove it, open the PR

Use for a direct request to build / add / change behaviour (outside the loop) · "Direct work" in `SKILL.md` applies (rule 4): below 95% sure → ask, never guess · inside `/pitwall:lap` the task's playbook and `lap.md` section 4 lead instead

## 1. Research

`Explore` over the affected subsystem + the repo's docs / knowledge base (profile `repo rules`) · finds it already exists → stop and answer with `file:line`

## 2. Name the data shape first

Before any logic (principle `model-the-domain`): config map over branching on a variant · union over booleans · typed model over repeated shape assumptions · write the shape down — it goes into the brief

## 3. Design

Crosses several files / modules → `Plan` agent for design exploration, alternatives in a table · contested choice or business rule → ask (confidence rule) before coding

## 4. Throughput checkpoint — four todo items

A dimension that does not apply keeps its item as `n/a: <reason>`, never dropped:
- **Blocking first steps** — gates that run before anything fans out
- **Independent workstreams** — disjoint files / services / layers can run in parallel · shared writes serialize
- **Shared mutable state** — split the target first (principle `separate-before-serializing-shared-state`) · serialize only for a real invariant
- **Smallest safe decomposition** — one worker is best → name why

## 5. Code

- > ~150 lines or > 3 files → brief the profile's code role (subagent type + model from "agents per task") + the domain checklist file for the change: file paths, the named data shape from step 2, success criteria · smaller → main may write it
- Before delegating: on the base or a branch the profile's `git` section forbids → `git switch -c <branch per the profile pattern>` first · note `git status --porcelain` (the user's own uncommitted work)
- Read every diff · a file outside the brief that the agent changed → `git checkout -- <file>` · never revert the user's own uncommitted work from that note
- A shared primitive improved → port it to every consumer and check each

## 6. Build in verifiable units

Each unit ends with a check before the next starts (principle `sequence-verifiable-units`) · commit each unit

## 7. `/pitwall:gauge` — cannot be skipped

Wrong surface or "inconclusive" is not a pass — say so · an item stays open only if it is one of the 3 wait cases (`SKILL.md` rule 2) · logic with a branch / money path / a bug just fixed → a test per the repo's test rules (profile `repo rules`)

## 8. Review

The profile's review panel (`agents per task`), one prompt with the every-task checklist + any extra-review checklist that matches the change, consensus table per `lap.md` reviewing · act-on `CRITICAL` / `WARNING` in the changed files → fix + `/pitwall:gauge` again · new durable knowledge → update the repo's docs / knowledge base in the same change, when the repo rules ask for it

## 9. Open the PR

`opening-a-pr.md`

## Reply

In the profile's user language: what was built · what was chosen and why (table for design alternatives) · the throughput checkpoint · open decisions
