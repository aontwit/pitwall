<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/poteto-mode/playbooks/opening-a-pr.md · MIT License, Copyright (c) 2026 Lauren Tan · license: `principles/LICENSE-pstack` · adapted for pitwall v1 (2026-10-07) -->

# playbook: opening-a-pr — commit, push, open the PR with its evidence

Use at the end of every playbook that changes code (`lap.md` step=committing, `feature.md`, a direct request that ends in a PR) · the single home of the PR rules — other files point here, never copy them

## 1. Commit

- Commit liberally: small, ordered commits, each one landable and telling the story · a fix that belongs in the commit you just made → amend **only before push**; after push or separable → new commit (never force-push)
- On the base or a branch the profile's `git` section forbids → `git switch -c <branch per the profile pattern>` before the first commit
- Commit / PR title per the pattern in the profile's `git` section · commit message, PR title and PR body in the profile `language` section's PR / commit language · whatever that language, these stay in English because the PR-body check matches them: the `Verify` and `Not done yet` headings, the `Verifier` row with `✅ VERIFIED` / `PARTIAL`, and `case 1/2/3`
- hook fails → fix 1 time → fails again → stop and report (inside the loop: park per `lap.md`) — **never `--no-verify`**

## 2. Before `gh pr create`

1. **Independent verdict** on the committed head — `/pitwall:gauge` "Independent verifier" (every PR, inside the loop or not) · FAIL → that section's item 4
2. Apply `/pitwall:gauge` "Record results + tick the PR yourself":
   - item 3 — `verified` entries with this head's patch-id and this branch → ✅ rows in the Verify table, and those items stay out of "Not done yet"
   - item 4 — `[PARTIAL]` in the title ⇔ "Not done yet" still has a `- [ ]` (same as `/pitwall:gauge` = PARTIAL) · gauge item 4 removes it later with `gh pr edit` when the last box is ticked
3. Run the PR-body check on the body file — the profile's `checks` one if it names one, else `node <pitwall dir>/scripts/check-pr-body.mjs --file <body file>` — it fails → fix the body first, never open the PR with it failing

## 3. Push + open

Everything is committed in section 1 — a commit after the verdict changes the patch-id → section 2 again

```bash
git push -u origin <branch>
gh pr create --base <base> --title "<[PARTIAL] per section 2><title>" --body-file <scratchpad>/pr.md
```

Then fill `pr` in this head's `verified` entries (`/pitwall:gauge` "Record results + tick the PR yourself" item 1)

## 4. PR body

- What: the brief + link to the plan row / tracker task (`tracker: github` → `Refs #<n>`, never a closing keyword — `pitwall:ticket` G1) · playbook used
- Changes: one bullet per behaviour that changed (no file | +/− table — GitHub's Files tab already shows it) · a playbook may ask for its own table (e.g. `ratchet` moves)
- **Verify table** from `/pitwall:gauge` + the verifier row `| Verifier | — | <subagent> <model> @<7-char headSha> patch <12-char patchId> | ✅ <VERIFIED / PARTIAL> |` (the PR-body check fails without it)
- **Decisions to confirm**: every fork that used ladder step 2, one line each: option taken · other options · where to change it (none → write "none")
- Decisions: other things decided on your own + reasons — summarised from the task's `decisions.tsv`
- **Agents used**: one line per agent from `agents[]` — `<agent> <model> · <step> → <result>` (missing = PR incomplete)
- **Review**: the consensus table from `lap.md` reviewing — act on / consider / noted rows, one line each with the models that raised it and what happened (fixed / follow-up) · dismissed → one line "N dismissed, see decisions" (none at all → write "none")
- A PR whose base is another PR's branch (stack) → open with `gh pr create --draft` (`/pitwall:merge-order` marks it ready when its turn comes) + one line `Stacked on #<parent> — merge order: /pitwall:merge-order` · never write the merge method / order yourself
- Not done yet (before merge): B/C items as checkboxes + post-merge work from the profile — **only things that must be done** (follow-ups / notes go in a separate section) · items already passed locally at this head's patch-id (this round / any round / any machine — see state `verified`) do not belong here, or are ticked already, per `/pitwall:gauge` "Record results + tick the PR yourself" · items that can't be done yet stay `[ ]` + `⏳ <case 1–3 + specific reason>` (the 3 wait cases at the top of `lap.md`) — items outside the 3 cases must not be in this section (they must pass before opening the PR) · never tick an item that was not actually run

Outside the loop (direct request): Decisions to confirm = the decisions the user answered or took a default on this session, or "none" · Agents used = the subagents called this session with their models, the verifier included · Review = the review panel per the profile · no `verified` state → nothing to carry over · link the tracker task if one exists (else `/pitwall:ticket`, unless the profile says `tracker: none`)

Playbook-specific PR additions (e.g. `move-only.md` "PR additions", `port.md`) are added on top

## 5. After opening

- Opening a PR does not start a babysit — post the URL and keep building
- Run `gh pr view <n>` before you refer to PR status

## Never

- never `--no-verify` · never tick an item that was not actually run · never write the merge method / order yourself

The PR body format above is the repo's (What / Changes / Verify / …), not pstack's Why / Scope / Blast Radius
