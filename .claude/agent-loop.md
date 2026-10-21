# Agent loop — profile of this repo

Repo values that pitwall (`/pitwall`, `/pitwall:gauge`, `/pitwall:ticket`) reads. The skills hold none of these. Sections follow the "Profile contract" in the pitwall `SKILL.md`; `/pitwall:doctor` checks them.

## repo

| | |
|---|---|
| name | pitwall (a Claude Code plugin: an agent loop that builds, proves and opens PRs, plus its docs site in `site/`) |
| loop state | one folder per repo, outside the checkout: Windows `%LOCALAPPDATA%\Agent-Loop\pitwall\state.json` · macOS `~/Library/Application Support/Agent-Loop/pitwall/state.json` · Linux `~/.local/state/agent-loop/pitwall/state.json` |
| loop checkout | `C:\personal\pitwall` (the main checkout; the owner works in worktrees under `.claude\worktrees\`) — nobody edits it while the loop runs |

## language

| Used for | Language |
|---|---|
| user — questions, reports, tick boxes | Thai · recommended option marked with the Thai word for "(recommended)" (spelled in words here: `check-english.sh` bans Thai in tracked files) |
| PR body / PR title / commit | English (enforced by `scripts/check-english.sh` and `scripts/check-commit-msg.sh`) |
| tracker comments and task descriptions | none (no tracker) |

## git

| | |
|---|---|
| base | `main` — pulled at the start of every round, PRs target it |
| never push / check out to edit | `main` |
| agent branch | `agent/<id>-<slug>` |
| commit / PR title | `<type>(<scope>): <summary>` · type: feat / fix / refactor / test / chore / docs · scope: lowercase, digits, `-` · English only · no `Co-Authored-By` trailer (`scripts/check-commit-msg.sh`) |
| hooks | none installed · run `bash scripts/check-commit-msg.sh <message file>` before each commit — never `--no-verify` |
| resolve conflicts yourself | `PLAN.md`, `CHANGELOG.md` (the `## Unreleased` section only — keep both entries) · everything else → a human |
| ignored checks | none |

## checks (level A)

```bash
npm ci --prefix site                                  # when site/package-lock.json changes or site/node_modules is missing
npm test                                              # node --test tests/*.test.mjs
bash scripts/check-english.sh
bash scripts/check-commit-msg.sh --all
bash scripts/check-neutral.sh                         # needs .neutral-deny in the checkout (gitignored)
npm run build --prefix site                           # astro check + build + pagefind
npx -y @anthropic-ai/claude-code@2.1.294 plugin validate ./plugin --strict
npx -y @anthropic-ai/claude-code@2.1.294 plugin validate . --strict
```

No typecheck or lint step outside the site build (`astro check` runs inside it).

PR-body check: `node <pitwall dir>/scripts/check-pr-body.mjs --file <body file>` (default)

## level B (browser)

| | |
|---|---|
| dev server | `npm run dev --prefix site` on port `4321` (built: `npm run preview --prefix site -- --port 4322`, both in `.claude/launch.json`) · port already in use by someone else → never kill it, item B becomes ⏳ case 3 |
| browser | built-in browser (Claude desktop browser pane) |
| pages | `/` (landing), the docs page of each changed playbook / principle |
| viewports | 393 and 1366 px · console errors = 0 |
| time | ~10 minutes per method per item, then change method |
| human-only steps | a live run of a changed `/pitwall:*` skill on a sample repo (Next.js / Godot) or a real ClickUp workspace — level C, steps in the PR |
| verification skill | none |
| upkeep | none |

## states to build

none — the tests build their own fixture repos (`tests/fixtures/`)

## repo-specific evidence

| Changed files | Evidence | Level |
|---|---|---|
| `plugin/**` | both `plugin validate --strict` commands pass · `tests/playbook-bodies.test.mjs` passes | A |
| `plugin/skills/**/scripts/*` | the test in `tests/` that covers the script passes, a new behaviour gets a new test case | A |
| `plugin/skills/**/*.md` | the changed step read against the playbook that calls it (names, section numbers) · a live run on a sample repo | A + C |
| `site/**` | `npm run build --prefix site` · the changed page at both viewports, console errors = 0 | A + B |
| `CHANGELOG.md` | a `## Unreleased` entry for every user-facing change | A |

## plan

| | |
|---|---|
| location | `PLAN.md` read from `origin/main` |
| reading order | `PLAN.md` |
| task row | `\| <id> \| [ ] <task> \| <files> \| <Done when> \|` |
| open questions | the `Open questions` table in `PLAN.md` |
| not queued | none |
| playbook per row type | bug → bug-fix · refactor that must stay identical → move-only · everything else → feature |
| spec | none — `/pitwall:plan` creates `SPEC.md` |
| question banks | none |

## tracker

`tracker: none` — no tasks, the PR is the record · GitHub Issues stays for feedback and requests from users

## agents per task

| Role | subagent | model |
|---|---|---|
| research | `Explore` | default |
| `code role` — follows an existing pattern | `pitwall:pitwall-agent` | sonnet |
| `code role` — design across modules, docs, playbooks | `pitwall:pitwall-agent` | opus |
| `review panel` — every task | `pitwall:pitwall-agent` ×2 | opus + sonnet — the same prompt |
| `verifier` — fresh, read-only, before every PR | `pitwall:pitwall-agent` | sonnet |

| Work | checklist in the brief |
|---|---|
| every review | none |

## repo rules

No `CLAUDE.md` / `AGENTS.md` / rules folder · the rules are the CI scripts: English only in tracked files (`scripts/check-english.sh`), no internal names (`scripts/check-neutral.sh`), commit shape (`scripts/check-commit-msg.sh`) · principles turned off: none

## permissions

allow: `npm test`, `npm ci --prefix site`, `npm run build --prefix site`, `npm run dev --prefix site`, `bash scripts/check-*.sh`, `npx -y @anthropic-ai/claude-code@2.1.294 plugin validate *`, `node <pitwall dir>/scripts/*`, `git fetch` / `switch` / `pull --ff-only` / `add` / `commit`, `git push -u origin agent/*`, `gh pr list / view / create / edit`, `gh issue view / list` · deny: `gh pr merge`, `git push --force*`, `--no-verify`, `git push origin main`, edits to `.env*` and `.neutral-deny`
