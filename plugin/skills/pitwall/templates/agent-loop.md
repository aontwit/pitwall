# Agent loop — profile of this repo

Repo values that pitwall (`/pitwall`, `/pitwall:gauge`, `/pitwall:ticket`) reads. The skills hold none of these. Sections follow the "Profile contract" in the pitwall `SKILL.md`; `/pitwall:doctor` checks them. Replace every `{{…}}` with a value or `none` — `/pitwall:doctor` fails while one is left.

## repo

| | |
|---|---|
| name | {{repo name}} ({{one line on what it is}}) |
| loop state | one folder per repo, outside the checkout: Windows `%LOCALAPPDATA%\Agent-Loop\{{repo}}\state.json` · macOS `~/Library/Application Support/Agent-Loop/{{repo}}/state.json` · Linux `~/.local/state/agent-loop/{{repo}}/state.json` |
| loop checkout | {{the checkout the loop switches branches in — nobody works in it while the loop runs}} |

## language

| Used for | Language |
|---|---|
| user — questions, reports, tick boxes | {{language}} · recommended option marked `{{marker, e.g. (Recommended)}}` |
| PR body / PR title / commit | {{language}} |
| tracker comments and task descriptions | {{language, or none}} |

## git

| | |
|---|---|
| base | `{{base}}` — pulled at the start of every round, PRs target it |
| never push / check out to edit | `{{base}}`, {{release branches, other protected branches}} |
| agent branch | `agent/<id>-<slug>` |
| commit / PR title | `<type>: <summary>` (type = feat / fix / refactor / test / chore) |
| hooks | {{pre-commit / pre-push commands, or none}} — never `--no-verify` |
| resolve conflicts yourself | {{docs paths the agent may merge itself, e.g. `docs/**/*.md` · everything else → a human}} |
| ignored checks | {{CI checks that never pass and must not block `/pitwall:merge-order`, or none}} |

## checks (level A)

```bash
{{install command}}     # when the lockfile changes or dependencies are missing
{{typecheck command}}
{{lint command}}        # 0 errors, warnings ≤ lintBaseline
{{test command}}
{{build command}}
```

PR-body check: `node <pitwall dir>/scripts/check-pr-body.mjs --file <body file>` (default) or {{the repo's own}}

## level B (browser)

| | |
|---|---|
| dev server | `{{command}}` on port `{{port}}` · port already in use by someone else → never kill it, item B becomes ⏳ case 3 |
| browser | {{which browser the agent drives, e.g. Claude in Chrome / built-in browser / Playwright}} |
| pages | {{the pages that matter, with paths}} |
| viewports | {{widths, e.g. 393 and 1366 px}} · console errors = 0 |
| time | ~10 minutes per method per item, then change method |
| human-only steps | {{what only a human may do: wallet popup, 2FA, payment confirm …, or none}} |
| verification skill | {{a repo skill that drives the app, or none → B items without a browser become C with the reason}} |
| upkeep | {{a periodic task the loop queues itself, or none}} |

## states to build

{{recipes for producing the states tests need (seed data, flags, accounts), or a pointer to the file that holds them, or none}}

## repo-specific evidence

| Changed files | Evidence | Level |
|---|---|---|
| {{glob}} | {{extra proof}} | {{A / B / C}} |

## plan

| | |
|---|---|
| location | `{{plan file or folder}}` read from `origin/{{base}}` |
| reading order | {{files in order}} |
| task row | `\| <id> \| [ ] <task> \| <files> \| <Done when> \|` |
| open questions | {{where they go}} |
| not queued | {{rows / phases the loop must skip, or none}} |
| playbook per row type | {{e.g. refactor that must stay identical → move-only, bug → bug-fix}} |

## tracker

`tracker: none` — no tasks, the PR is the record · for ClickUp write `tracker: clickup` and fill: workspace / space / sprint folder, tag, QA, meaning of `review`, task names · for GitHub Issues write `tracker: github` and fill: agent label, `in progress` / `review` / `pending` labels, QA login, `milestone: current | none`, issue names (phase parent, `<prefix> <id> ` for a row)

## agents per task

| Role | subagent | model |
|---|---|---|
| research | `Explore` | default |
| `code role` — follows an existing pattern | `pitwall:pitwall-agent` | {{model}} |
| `code role` — design across modules, docs, playbooks | `pitwall:pitwall-agent` | {{model}} |
| `review panel` — every task | `pitwall:pitwall-agent` ×2 | {{model}} + {{model}} — the same prompt |
| `verifier` — fresh, read-only, before every PR | `pitwall:pitwall-agent` | {{model}} |

| Work | checklist in the brief |
|---|---|
| every review | {{checklist file, or none}} |

## repo rules

{{rules files the agent follows (CLAUDE.md, AGENTS.md, rules folders) · principles turned off, each with the reason, or none}}

## permissions

{{allow / deny for the machine that runs the loop — at least: the check commands, git fetch / switch / pull --ff-only / add / commit, `git push -u origin agent/*`, `gh pr list / view / create / edit` · deny: `gh pr merge`, force push, `--no-verify`, pushes to protected branches, edits to `.env*`}}
