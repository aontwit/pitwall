# playbook: init — write this repo's profile

Use for `/pitwall:init` · writes `.claude/agent-loop.md` (and `PLAN.md` when the repo has no tracker and no plan) · reads first, then asks once, then writes · never commits, pushes or edits settings files — the user reviews the result and commits it

## 0. Already set up?

`.claude/agent-loop.md` exists → `playbooks/doctor.md` · OK → say so and stop (`/pitwall:init redo` starts over) · missing / unfilled sections → fill only those, through steps 1–4

## 1. Read the repo (no questions yet)

Each value keeps its source for the report (file:line or command)

Read the **base as the loop will see it**, not the working tree: `git fetch origin -q`, settle `base` first (row below), then read every file in the table with `git show origin/<base>:<path>` · the local base is behind (`git rev-list --count <base>..origin/<base>` > 0) → say so in the report (the first `/pitwall:lap` pulls it, and a value read from the stale tree would be wrong: lockfile, scripts, ports)

| Value | Read from |
|---|---|
| install + check commands | lockfile → package manager (`package-lock.json` npm · `pnpm-lock.yaml` pnpm · `yarn.lock` yarn · `bun.lock*` bun), frozen install form · scripts that exist in `package.json` (typecheck / lint / test / build) · other stacks: `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod` · a check with no command → `none`, never invent one |
| base | the branch most of the last 30 merged **work** PRs target — count only PRs whose head is not itself a target (a `<base> → release` PR is a release, not work): `gh pr list --state merged --limit 30 --json headRefName,baseRefName` → drop rows whose `headRefName` is any row's `baseRefName` → most common `baseRefName` · compare with `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`) · they differ, or no work PRs yet → it becomes a step 3 question with both as options |
| protected branches | `gh api repos/{owner}/{repo}/branches?protected=true -q '.[].name'` (403 / empty → ask) |
| hooks | `.husky/`, `lefthook.yml`, `git config core.hooksPath` |
| CI checks | `.github/workflows/*.yml` job names |
| repo rules | `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.cursor/rules/`, `CONTRIBUTING.md`, a docs / knowledge-base index |
| dev server | a `dev` / `start` script + its port (script flags, framework config) |
| verification skill | a `.claude/skills/*/SKILL.md` that launches or drives the app |
| plan | `PLAN.md`, `TODO.md`, `IMPLEMENTATION_PLAN.md`, `tasks.md`, `docs/**/plan*`, `.taskmaster/` |
| tracker | tracker tools connected in this session (ClickUp MCP) |
| language | language of `CLAUDE.md` and of the last 20 commit subjects |
| `gh` | `gh auth status` — fails → stop: pitwall needs an authenticated `gh` |

## 2. Draft

Copy `<pitwall dir>/templates/agent-loop.md` and fill every `{{…}}` that step 1 settled · roles in `agents per task`: a stronger model for design, a faster one for pattern work and the verifier, and **two different models** in the review panel — its variety comes from the models (a default — listed in the report)

## 3. Ask once

Only what step 1 could not settle, plus the rows a human must confirm — AskUserQuestion, ≤ 4 questions per call, ≤ 4 options, recommended first, in the language step 1 found:
- tracker: `clickup` / `none`
- user language · PR / commit language
- base, when step 1 found two candidates (the merged-PR target first, as recommended)
- protected branches (when the API did not answer)
- level B: dev server + port, which browser, human-only steps (wallet popup, 2FA, payment confirm, none)
- no tracker and no plan → where the plan goes: `PLAN.md` at the root (recommended) / another path

Never ask what a file answered; never fill a business value (prices, limits, credentials) from a guess

## 4. Write

- `.claude/agent-loop.md` from the draft + answers · a row nobody could answer → `none` + the reason, never left as `{{…}}`
- no tracker and no plan → copy `<pitwall dir>/templates/plan.md` to the chosen path; the profile `plan` section points at it
- the plan file goes into `git` → `resolve conflicts yourself`: every PR appends a row and a log line to it, so two open PRs always conflict there (append-only, safe to union)
- no verification skill → `verification skill: none`; level B items with no browser fall to C, say so in the report
- `permissions`: write the list into the profile; adding it to the settings file is the user's step
- `git check-ignore -v .claude/agent-loop.md <plan file>` matches → the file cannot be committed as is: say which `.gitignore` line hides it and the line that un-ignores it (e.g. `!.claude/agent-loop.md`) — adding it is the user's call

## 5. Check + report

`playbooks/doctor.md` → must end in "profile OK" · report in the profile's user language: values read (with source) · values answered · defaults taken · files written · next: commit `.claude/agent-loop.md` (and the plan file) to the base yourself — the loop never pushes to the base, and `/pitwall:lap` stops on an untracked file in the tree — then `/pitwall:queue`
