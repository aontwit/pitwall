---
name: secretary
description: Secretary — read this repo's past conversations (local transcripts), find what the user has to say again / correct again and what the agent explains again every round, then report what should become a skill / rule / memory (or an existing skill that still needs reminding). Use when the user runs /secretary, "เลขา", "ผมย้ำอะไรบ่อย", "อะไรควรเป็น skill" — /stop calls it at the end of a session · does not create a skill itself until the user chooses
---

# /secretary — things repeated often → skill

Principle: anything that has to be said more than 2 times belongs in a file, not in someone's memory · the secretary **reports and proposes**, the user chooses

Arguments: none = since the previous report (`--since auto`) · `all` = everything · `<YYYY-MM-DD>` = since that date · called from `/stop` = short mode (step 6)

## 1. Pull the messages

Run from the repo's main checkout (the transcript path is computed from cwd — a worktree gets a different folder):

```bash
node <pitwall dir>/scripts/secretary-scan.mjs --since auto --assistant > <scratchpad>/secretary.txt
```

- 1 line = `time session U|A message` · `U` = what the user typed themselves (including `/command args`, `[N image]`) · `A` = what the agent told the user (cut at 240 characters — things deep inside a long message are lost)
- tokens / keys are already replaced with `[secret]` — still never quote anything that looks secret in the report
- transcripts exist **only on this machine** (Windows / macOS separate) → the report header states the machine name (`hostname`)
- no new messages → "nothing new since <date>", done

## 2. Group by intent (not by matching words)

Read the whole file, group it into topics — mixed Thai / English and misspellings ("fash", "bestpractics") count as the same topic if they ask for the same thing

| Type | Looks like | Example |
|---|---|---|
| Repeated procedure | The same kind of work starts with similar words | "here's the QA report" → fix → "how do I test it" → `/commit-push` |
| Repeated correction / ban | The user calls out the same kind of mistake | "not pro", "take the emoji out", "sloppy", "why didn't you follow the loop" |
| Repeated question | The user has to ask because the agent did not say it on its own | "what next", "do I have to wait", "did it pass", "show me the evidence" |
| Agent explains again (`A`) | The agent tells the same story several rounds | merge order, how to switch accounts |

Count: **times** (messages) and **sessions** (different 2nd column) · a "[Request interrupted]" message followed immediately by the same text typed again = 1 time

| Threshold | Result |
|---|---|
| ≥ 3 times in ≥ 2 sessions · or the agent explains again ≥ 3 times | **propose** |
| 2 times | **watch** (one line at the end of the report) |
| Once · generic commands ("let's go", "go", "start") · a skill already used normally (e.g. `/commit-push` called often = working well, not a problem) | do not report |

## 3. Does it already have a home

Per topic that passes the threshold, grep keywords (Thai + English) in `.claude/skills/*/SKILL.md`, the rules files of the profile `repo rules`, `CLAUDE.md`, `.claude/agent-loop.md`, `~/.claude/skills/` (machine-level skills), this plugin's skills and the project's `MEMORY.md`

- Not there → **new**
- There, but the message repeats **after** the date that file added the topic (`git log -1 --format=%cs -S'<word>' -- <file>`) → **exists but still needs reminding** — the skill is not invoked (the description lacks the words the user says) or the agent does not follow it (the rule is buried / vague) · say which one it likely is
- There, and not repeated after that → do not report (the fix worked)

## 4. What it should become

| Trait | Home |
|---|---|
| Several steps, ordered, invokable by a command | a new **skill** or a new section in an existing skill |
| A one-line ban / requirement, every task | the repo's rules files (profile `repo rules`) |
| Repo-specific values (branch, check, port) | `.claude/agent-loop.md` |
| The user's personal preference / used across repos | memory (`feedback`) |
| Agent explains again | move the explanation into a skill and have reports refer to the skill name (like `/merge-order`) |
| Domain knowledge (WHAT / WHY) | the repo's docs / knowledge base |

## 5. Report (short, in the profile's user language)

```
Secretary · <machine> · <N> messages · <M> sessions · since <date>

| Topic | Times / sessions | Example (≤ 12 words) | Now | Proposal |
|---|---|---|---|---|
| Get QA report → fix → how to test | 5 / 4 | "here's the QA report" | new | skill `/qa-fix` |
| Asks what to do next / whether to wait | 9 / 3 | "so I have to wait, right?" | new | every report ends with "You: …" (lap / rules) |
| Merge order | agent 11 | "merge in order, #101 first" | exists `/merge-order` | — |

Watch: <topic (2)> · …
```

- Sorted by times, most first · at most 6 rows (the rest go to watch)
- The example quotes the user's own words, short, 1 message — never quote tokens, passwords, unnecessary addresses, personal data

Then ask with `AskUserQuestion` (multiSelect) which ones to do — chosen items: `/ticket` creates an `[improve]` task, then follow the normal round (branch → fix → `/gauge` → PR) · items not chosen: note them as declined

Finally `node <pitwall dir>/scripts/secretary-scan.mjs --since auto --mark > /dev/null` (records that reporting has reached this point · state lives in `secretary.json` next to that machine's transcripts)

## 6. Short mode (called from `/stop`)

Do steps 1–4 but report only **propose** topics not reported before, one line per topic + "run `/secretary` to choose" · none → say nothing · no `--mark` (leave marking to the full `/secretary`)

## Never

- Never create / edit a skill, rule, memory before the user chooses
- Never send transcript content off the machine (tracker / PR / artifact) — in tasks / PRs put only the topic name + the count
- Never draw conclusions about the user's habits or abilities — report only what repeats
