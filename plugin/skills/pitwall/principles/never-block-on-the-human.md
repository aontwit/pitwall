<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-never-block-on-the-human/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Never Block on the Human

The human supervises asynchronously. Agents must stay unblocked. Make reasonable decisions, proceed, and let the human course-correct after the fact.

**Why:** Every permission pause stalls the pipeline and makes the human the bottleneck. Since code changes are reversible and reviewable, a wrong decision usually costs less than blocking.

**Pattern:**
- **Proceed, then present.** Do the work, show the result. Don't ask "should I do X?" Do X, explain why.
- **Make the system self-healing.** When you notice a problem, log it and fix it in the next round.

**Boundaries:**
- **Irreversible actions** (force-push, delete production data, send external messages) still require confirmation.
- **Reversible actions** (write code, edit notes, split tasks) should proceed without blocking.
- **Product direction** comes from the human. *Execution* should not block.

## pitwall adaptation

Changed from upstream on purpose:
- **Questions are not dropped, they move to the start.** Everything only the human can decide is asked once, as tick boxes in the user's language (profile `language`), in the `/pitwall:queue` briefing (`playbooks/queue.md` §4). The run then proceeds without asking.
- **During the run, use the decision ladder** in `pitwall/SKILL.md` (test → reversible default listed under "Decisions to confirm" → park). "Proceed, then present" = step 2.
- **Wider boundary than upstream.** Besides irreversible actions, the always-park list (money / price / fee, permissions / security / user data, deletes, backend or third-party values not provided) and the "Never guess about" list in `SKILL.md` "Direct work" are never defaulted.
- **Direct work** the user gives while present keeps the 95% rule in `SKILL.md` "Direct work".
