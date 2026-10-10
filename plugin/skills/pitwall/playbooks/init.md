# playbook: init — write this repo's profile

Use for `/pitwall init` · writes `.claude/agent-loop.md` (and `PLAN.md` when the repo has no tracker and no plan) · reads first, then asks once, then writes · never commits, pushes or edits settings files — the user reviews the result and commits it

## 0. Already set up?

`.claude/agent-loop.md` exists → `playbooks/doctor.md` · OK → say so and stop (`/pitwall init redo` starts over) · missing / unfilled sections → fill only those, through steps 1–4

## 1. Read the repo (no questions yet)

Each value keeps its source for the report (file:line or command)

| Value | Read from |
|---|---|
| install + check commands | lockfile → package manager (`package-lock.json` npm · `pnpm-lock.yaml` pnpm · `yarn.lock` yarn · `bun.lock*` bun), frozen install form · scripts that exist in `package.json` (typecheck / lint / test / build) · other stacks: `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod` · a check with no command → `none`, never invent one |
| base | `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`), else `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` |
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

Copy `<pitwall dir>/templates/agent-loop.md` and fill every `{{…}}` that step 1 settled · roles in `agents per task`: a stronger model for design and the review panel, a faster one for pattern work and the verifier (a default — listed in the report)

## 3. Ask once

Only what step 1 could not settle, plus the rows a human must confirm — AskUserQuestion, ≤ 4 questions per call, ≤ 4 options, recommended first, in the language step 1 found:
- tracker: `clickup` / `none`
- user language · PR / commit language
- protected branches (when the API did not answer)
- level B: dev server + port, which browser, human-only steps (wallet popup, 2FA, payment confirm, none)
- no tracker and no plan → where the plan goes: `PLAN.md` at the root (recommended) / another path

Never ask what a file answered; never fill a business value (prices, limits, credentials) from a guess

## 4. Write

- `.claude/agent-loop.md` from the draft + answers · a row nobody could answer → `none` + the reason, never left as `{{…}}`
- no tracker and no plan → copy `<pitwall dir>/templates/plan.md` to the chosen path; the profile `plan` section points at it
- no verification skill → `verification skill: none`; level B items with no browser fall to C, say so in the report
- `permissions`: write the list into the profile; adding it to the settings file is the user's step

## 5. Check + report

`playbooks/doctor.md` → must end in "profile OK" · report in the profile's user language: values read (with source) · values answered · defaults taken · files written · next: review and commit the files, then `/pitwall queue`
