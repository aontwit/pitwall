# pitwall

[![CI](https://github.com/aontwit/pitwall/actions/workflows/ci.yml/badge.svg)](https://github.com/aontwit/pitwall/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/aontwit/pitwall)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/aontwit/pitwall?style=social)](https://github.com/aontwit/pitwall/stargazers)

The agent loop that queues your work, proves every PR, and leaves the merge to you.

Plan in short interview rounds, then ask every remaining question once, up front. Then the agent builds one task per round, proves it, gets a verdict from a verifier that did not write the code, and opens the PR. 18 playbooks, 20 principles. Runs in Claude Code today; Codex, Cursor and Gemini CLI are planned.

> **Quick start:** `/plugin marketplace add aontwit/pitwall`, then `/plugin install pitwall@pitwall`, then run `/pitwall:init` in your repo.

**Who it's for:** developers with a GitHub repo who want a queue of small tasks built and proven while they're away, and who still read and merge every PR. It is not an app builder for people who don't review code.

## Your first 30 minutes

1. **Install:** `/plugin marketplace add aontwit/pitwall`, then `/plugin install pitwall@pitwall`.
2. **Init:** `/pitwall:init` in your repo. It reads the repo, asks only what it can't read, and writes `.claude/agent-loop.md` (and `PLAN.md` when you have no plan or tracker).
3. **Commit the profile:** init ends with the exact commands to paste: a direct commit, or a small PR when your base is protected. Merge it before the next step.
4. **Queue one task:** `/pitwall:queue fix the broken sort on the search page`, in your own words. It asks anything it must not guess, once, as tick boxes.
5. **Lap:** `/pitwall:lap` runs one round: branch, code, checks, two-model review, an independent verifier, then a PR.
6. **Review the PR:** read its Verify table and merge it yourself. Want more? `/pitwall:plan` for a whole product or a phase, then `/pitwall:drive`. On a new repo it asks the stack in plain words and writes phase 0 (scaffold, checks, a verification skill). On a repo with code but no docs it drafts the spec from the code and asks you to confirm it.

## Why pitwall?

An agent left alone on a queue fails in the same few ways: it asks you something at 2am and waits, it calls a passing typecheck "done", it grades its own work, and it guesses a business rule instead of stopping.

pitwall adds:
- **Questions up front, never mid-round.** `/pitwall:queue` asks everything only a human can decide, once, as tick boxes. The run then follows a 3-step ladder: try it, take a recorded default, or park the task.
- **Evidence, not claims.** `/pitwall:gauge` picks proof by what changed: level A runs your checks, level B drives the page in a browser, level C hands a human numbered steps. Nothing is ticked that was not run.
- **A verdict from someone who did not write the code.** Every PR gets a fresh read-only verifier pinned to its patch-id. A new commit makes the verdict stale.
- **Humans merge.** The agent builds, proves and opens the PR. It never merges, force-pushes or touches protected branches.
- **One profile per repo.** Everything repo-specific (base branch, check commands, dev server, tracker, plan) lives in `.claude/agent-loop.md`. The plugin holds no repo values.

## How it works

```mermaid
flowchart TD
    init["/pitwall:init<br/>write the profile"] --> plan["/pitwall:plan<br/>interview → spec + rows"]
    plan --> queue["/pitwall:queue<br/>pick tasks + ask once"]
    queue --> drive["/pitwall:drive"]
    drive --> lap

    subgraph lap ["/pitwall:lap · 1 task"]
        pick["pick next task"] --> branch["branch from base"]
        branch --> code["code<br/>(subagent per role)"]
        code --> gauge["/pitwall:gauge<br/>A checks · B browser"]
        gauge --> review["review panel<br/>(2 models, one prompt)"]
        review --> verify["independent verifier<br/>@ patch-id"]
        verify --> pr["open PR"]
    end

    pr -->|next round| pick
    gauge -.->|stuck after 2 methods| park["park + question<br/>for next briefing"]
    review -.->|CRITICAL on a park list| park
    park -.-> queue
    pr --> merge["/pitwall:merge-order<br/>human merges"]
```

`/pitwall:stop` ends the loop after the current task. `/pitwall:brake` stops now and saves the work as a WIP commit.

## What's included

### The skill: pitwall

Every command is `/pitwall:<command>`. Or say what you want in plain words, English or Thai, and pitwall picks the playbook:

```
/pitwall:lap
/pitwall:pitwall fix the broken sort on the search page
```

### Commands

| Command | What it does |
|---------|--------------|
| `/pitwall:init` | One-time setup: read the repo, ask what it can't read, write `.claude/agent-loop.md` |
| `/pitwall:doctor` | Check the profile against the contract and say which section is missing |
| `/pitwall:verify-setup` | Write `.claude/skills/verify-<app>/`: a skill that launches, drives and captures evidence from your app (browser for web, a headless scene run plus a frame for Godot), and run it once |
| `/pitwall:plan` | Interview you in rounds of 2–3 questions, record each answer in the spec, and write plan rows (docs-only PR). Modes: `new` (empty repo: stack, `SPEC.md`, phase 0), `survey` (code but no docs: drafts the spec from the code, you confirm), `phase`, `amend` |
| `/pitwall:queue` | Pick tasks the agent can finish alone (6 criteria), then ask every open question once |
| `/pitwall:drive` | Start the loop: one task per round until the queue is empty or you stop it |
| `/pitwall:lap` | Run exactly one round |
| `/pitwall:stop` | Stop after the current task finishes |
| `/pitwall:brake` | Stop now; save unfinished work as a WIP commit |
| `/pitwall:merge-order` | Order your open PRs by stack and readiness, retarget merged parents |
| `/pitwall:secretary` | Read past sessions and report what you keep repeating, as skill / rule candidates |
| `/pitwall:gauge` | Prove the work: Verify table with VERIFIED / PARTIAL / FAIL |
| `/pitwall:ticket` | Create or update the tracker task for a piece of work |

### Playbooks by task type

| Task | Playbook | Its guard |
|------|----------|-----------|
| Bug | `bug-fix` | Reproduce on the real screen before and after the fix |
| Refactor that must not change behaviour | `move-only` | Characterization test locked in the first commit |
| Bring a number down | `ratchet` | The reviewer must say whether the drop is real or a dodged count |
| Bring behaviour over from another branch | `port` | Parity test with golden output from the source |
| New feature | `feature` | Name the data shape before any logic |
| Read-only question | `investigation` | Cited answer, never code |
| Spec and plan rows | `plan` | Every answer lands in a file before the next round |

### Principles

20 ways of thinking adapted from [pstack](https://github.com/cursor/plugins/tree/df581122cde1/pstack), such as `fix-root-causes`, `prove-it-works`, `attack-the-premise` and `never-block-on-the-human`. A playbook cites the principle that changed a decision.

## The profile

`/pitwall:init` writes `.claude/agent-loop.md`. `/pitwall:doctor` checks it. To change a value later (say, PRs in Thai), edit the file, run `/pitwall:doctor` and commit it to your base branch. `/pitwall:init redo` asks everything again.

| Section | Holds |
|---------|-------|
| repo | name, state path, the checkout the loop uses |
| git | base, protected branches, branch / commit / PR patterns, hooks |
| checks | level A commands: install, typecheck, lint, test, build |
| level B | dev server, browser, pages, viewports, human-only steps |
| states to build | recipes for the states your tests need |
| repo-specific evidence | file pattern → extra proof + level |
| plan (optional) | where the plan lives and how its rows look |
| tracker (optional) | `clickup`, `github` (GitHub Issues) or `none` (the PR is the record) |
| agents per task | subagent + model per role, review panel, checklists |
| repo rules | your rules files, principles turned off |
| multi-machine (optional) | hand off loop state between machines |
| permissions | allow / deny for the machine that runs the loop |
| language | language for you, for PRs / commits, for tracker comments |

## Status

pitwall is pre-1.0. It has run end to end on two repos outside the one it came from (TypeScript, GitHub, `tracker: none`, Windows), on a Next.js frontend repo, on two Godot (GDScript) game repos (`tracker: github`, Windows), and on macOS.

| Proven | Not proven yet |
|--------|----------------|
| install from this repo, `/pitwall:init`, `/pitwall:doctor` | `/pitwall:brake`, and `/pitwall:stop` during a task |
| `/pitwall:queue`, including tasks typed in words and blocking on a question it must not guess | a wakeup that picks a new task and reaches a PR on its own |
| `/pitwall:lap` end to end: repro, fix, checks, browser evidence, two-model review, independent verifier, PR | the sync at the start of a round after a PR merges, including the plan-sync PR that ticks merged rows (0.5.0) |
| `/pitwall:lap` on a Next.js frontend repo, on a Godot repo with `tracker: github`, and on macOS | `tracker: clickup` in plugin form |
| `/pitwall:drive` start, a self-scheduled wakeup that re-enters the loop, `/pitwall:stop` between rounds | the `port`, `move-only` and `ratchet` playbooks, multi-machine hand-off |
| `/pitwall:merge-order`, with the script that resolves plan-doc conflicts between sibling PRs | a `/pitwall:lap` on Linux |
| routing from Thai and English requests (eval) | `/pitwall:plan` survey mode and new-repo phase 0, `/pitwall:verify-setup` on an outside repo (0.5.0) |
| `init`'s file-based reads (`detect.mjs`) on empty, Next.js and Godot fixture repos (tests) | tokens and time per lap, not measured yet |

## Feedback

pitwall is in public beta. If you try it, open an issue with the [beta feedback template](https://github.com/aontwit/pitwall/issues/new?template=beta-feedback.md): what you ran, on what kind of repo, and where it stalled, guessed or claimed something it hadn't proven. A PR it opened that you would not merge is the most useful report.

## Installation

```
/plugin marketplace add aontwit/pitwall
/plugin install pitwall@pitwall
```

| Scope | Who gets it | Use it for |
|-------|-------------|------------|
| user (default) | you, in every repo | your own work |
| project | everyone who clones the repo (written to `.claude/settings.json`, which you commit) | a team that shares one profile |
| local | you, in one repo | trying it out |

Pick one with `--scope`, for example `claude plugin install pitwall@pitwall --scope project`. Update to a new release with `claude plugin marketplace update pitwall` and then `claude plugin update pitwall@pitwall`, and restart Claude Code. The first pitwall command of a session tells you when a newer release is out.

`--scope project` writes only `enabledPlugins`. A teammate's clone does not know where `pitwall@pitwall` comes from until the marketplace is in the same file, so add it before you commit:

```json
"extraKnownMarketplaces": {
  "pitwall": { "source": { "source": "github", "repo": "aontwit/pitwall" } }
}
```

Once a teammate accepts the workspace trust dialog, Claude Code registers the marketplace and loads pitwall from it, because the marketplace lists the plugin by a relative path ([Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)). `/pitwall:init` flags a project-scope install that is missing this entry.

Then, in each repo:

```
/pitwall:init
```

Commit `.claude/agent-loop.md` (and `PLAN.md`, if init wrote one) to your base branch before the first `/pitwall:lap`: the loop never pushes to the base, and a lap stops on untracked files.

## Requirements

- A GitHub repo and an authenticated [`gh`](https://cli.github.com) CLI
- `git`, `bash` and Node 18+ on the machine that runs the loop
- For level B: a dev server and a browser Claude can drive
- For `tracker: clickup`: the ClickUp MCP connector
- For `tracker: github`: Issues turned on in the repo, and the labels the profile names already created

## Development

```bash
npm test                      # doctor, references, PR-body check, secretary scan
bash scripts/check-english.sh # files and commit messages stay English
bash scripts/check-commit-msg.sh --all  # type(scope): summary, no co-author trailer
claude plugin validate ./plugin --strict
claude plugin eval plugin --scaffold --ablation none   # routing eval, calls the model
```

`git config core.hooksPath .githooks` turns on the commit-msg and pre-push checks.

## Supported tools

| Tool | Status |
|------|--------|
| Claude Code | Supported |
| Codex, Cursor, Gemini CLI | Planned |

## Credits

The principles, the `feature`, `investigation` and `opening-a-pr` playbooks and the subagent are adapted from pstack by Lauren Tan (MIT). Every adapted file keeps its source line, and the license is in `plugin/skills/pitwall/principles/LICENSE-pstack`.

The docs site's 3D models are [Formula 1 Car](https://sketchfab.com/models/e89589184eac42c08028db5cba3f6499) by spsvision and [V6 car engine](https://sketchfab.com/models/7309cf5e6b07435c962f954513ca170e) by Blendoriano, both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). They are reduced for the web: the car has new wheels, and the engine keeps only its assembled parts.

## License

MIT
