# Changelog

## Unreleased

- `init` always asks the user language and the PR / commit language, and asks in the language the user writes in. Before, it took both from `CLAUDE.md` and the commit subjects and asked its questions in that language, so a Thai owner of a repo written in English got the init questions, the briefing and every PR in English. `opening-a-pr` says which words stay in English in a PR body of any language (the ones the PR-body check matches), so a translated `Verify` heading no longer fails the check. The README says how to change a profile value later. Questions use plain labels (`Thai`, not "the language you write in"; no pitwall words), and no option may say "tell me in Other": `plan`'s "is this right?" offers the shakiest summary line turned around as its second option, so the likely fix is one click
- Docs site drive mode: the car keeps pulling to its top speed (about 300 km/h at 10 s, 336 at 20 s). The engine's push fell to zero at top speed while drag did not, so a held throttle stalled at 295 km/h after 15 s and the needle never reached the red zone
- Docs site drive mode feels like driving: lifting off slows the car (drag of about 1 g at top speed, as an F1 car, plus engine braking: 100 km/h to rest in about 9 s), and the tyres stand still when the car does. The floor no longer strobes: its grid of dots moved about one gap per frame at 100 and 200 km/h and read as standing still, so floor and air are now random specks moving at the car's real speed, each drawing a one-frame streak. The air no longer drifts at an angle to the floor (its group kept the slow turn of the parked hero). Wind lines run faster and longer with speed, and the lens widens to 70°
- Docs site home page: the first line now says what pitwall is ("The agent loop for Claude Code …") as the page's one `h1`. Before, the only heading was the stage title, so a first visit never learned it was a Claude Code plugin. Quick start lists all three install steps, each with its own Copy button, and a blocked clipboard selects the command and says "Press Ctrl+C" instead of failing silently. A Star on GitHub link sits next to Read the docs. On phones the stepper and Drive share one row, so Drive no longer covers Merge and Pit in no longer covers Go. Engine labels on the Lap stage stay on screen
- Docs site for search: `sitemap.xml`, `robots.txt`, a `SoftwareApplication` JSON-LD block, and a title that names Claude Code. `/pitwall:gauge` gets a docs page (it ships as its own skill, so the site linked to its file on GitHub)
- The independent verifier may FAIL only on a set A item, a DoD item, a spec rule the task implements (wrong, or with no test that fails when it breaks) or a repo rule the diff breaks; the rest is INFO. It lists every FAIL item in one pass, and the fresh verifier after a re-brief checks the failed rows and the new commits, not the whole PR again. Found on Guild Register: each new verifier found a different untested edge, so one row took 5 verifiers and two parks
- `lap` writes a plan Progress log row only when the profile has no tracker. With a tracker the issue is the progress record, and the log row every PR appended at the same place made each open sibling PR conflict on every merge, so GitHub ran no CI for them until someone resolved it. Found on Guild Register: 6 conflicts in one day, the last one holding back CI on a PR

## 0.4.0 — 2026-10-11

`/pitwall:plan` for the front of the loop, a docs site, and fixes: sibling agent PRs no longer need hand work when the plan docs conflict, checks from an old base count as not run, `doctor` runs on macOS's bash 3.2.

- Docs site (`site/`, Astro, TypeScript only): a hero with an F1 car drawn in light, a lap explained as an exploded engine, and a drive mode with a speed gauge; the docs pages render the README, playbooks and principles straight from the repo. CI builds it, so a playbook change that breaks the site fails the PR
- `merge-order`: a PR moved to a new base after its parent merged counts as ⏳ `CI not run on the new base` until a run exists, because GitHub starts no `pull_request` run on a base change and the old run (against the parent branch) still shows green. For an `agent/*` head, `merge-order` pushes an empty commit, which starts the run and keeps the patch-id. `init` flags a workflow without the `edited` trigger and gives the lines to add. Found on Guild Register: #13 showed 🟢 from a run against its old base
- `/pitwall:plan`: the front of the loop. It interviews the owner in rounds of 2–3 tick-box questions, recording each answer in the spec or plan before the next round, and writes plan rows `queue` can pick. Modes: `new` (whole product), `phase` (open a `TBD` phase), `amend` (a decision changed). It ends with a docs-only PR. Optional profile `plan` keys: `spec` and `question banks`, so domain questions (art, economy …) live in the repo and not in the skill
- `init` points to `/pitwall:plan` when the plan has no rows yet
- Docs conflicts between sibling agent PRs: `scripts/resolve-docs-conflict.mjs` does `merge-order` 2b's union (base's lines first, a task row once and ticked if either side ticked) and refuses what union cannot decide. The patch-id leaves out the profile's "resolve conflicts yourself" files, so fixing a plan-log conflict no longer makes the verdict stale and forces a re-verify. A commit-msg hook that refuses git's merge message gets the profile's commit pattern instead. Found on Guild Register: every merge left the other open PRs conflicting in the plan's rows and log
- `doctor.sh` runs on macOS's bash 3.2 (no `mapfile`, `${x,,}` or empty arrays under `set -u`); it used to exit 1 with no `MISSING` line, so `init` could not reach "profile OK" on a stock Mac. A macOS CI job runs it with `/bin/bash`

## 0.3.0 — 2026-10-10

Fixes and a GitHub Issues tracker from the first run on a repo outside JavaScript / TypeScript (Godot).

- `tracker: github`: GitHub Issues as a tracker, through `gh` alone. Status moves through labels the profile names. A plan row becomes a sub-issue of one parent issue per phase. The open milestone with the nearest due date stands in for the sprint. The agent never closes an issue, and PRs say `Refs #n`, so QA still decides when work is done
- `init` takes the commit / PR title pattern from the repo's own rule (commit-msg hook, commitlint, CI check, rules files, then recent commits), not a fixed `<type>: <summary>` that the repo's hook could reject
- `init` reads check commands from the `run:` steps of CI workflows when the repo has no package scripts, and knows `project.godot`
- `init` flags a project-scope install whose `.claude/settings.json` lacks the `extraKnownMarketplaces` entry a teammate's clone needs; the README shows the entry
- README Status: `init` and `doctor` have run on a Godot (GDScript) repo

## 0.2.1 — 2026-10-10

- README: a Status section that lists what has been proven on real repos and what has not
- A wakeup round that opens a PR, parks a task or stops the loop sends one push notification, so an away user hears about it
- `drive` keeps looping: every wakeup prompt is `/loop /pitwall:lap` (a bare `/pitwall:lap` ran once and stopped)
- `drive` starts only with a pickable task, not a queue of blocked ones
- `gauge`: one dev server per checkout, short polls for long waits
- `lap`: an install blocked by a locked file moves to a separate worktree
- `bug-fix`: a bug that cannot be reproduced because the behaviour is already correct ends in a no-code PR with the evidence, not a park; `lap` allows that one case
- `init` lists the plan file under "resolve conflicts yourself", since every PR appends to it

## 0.2.0 — 2026-10-10

Fixes from the first runs on two other repos.

- `init` picks the base from the branch merged work PRs target, skipping release PRs (`<base> → release`), and asks when it differs from `origin/HEAD`
- `init` fetches and reads every file from `origin/<base>`, not a working tree that may be behind (a repo that had moved from one package manager to another got the old commands)
- `init` flags a profile or plan file that `.gitignore` hides, and its report says to commit both before the first lap
- `init` puts two different models in the review panel
- `doctor` flags a profile whose install command no longer matches the base's lockfile
- `lap` counts a reviewer severity outside `CRITICAL` / `WARNING` / `INFO` as `INFO`
- README: install scopes (user, project, local) and how to update

## 0.1.0 — 2026-10-10

- First plugin release of pitwall
- Commands: `/pitwall:init`, `doctor`, `queue`, `drive`, `lap`, `stop`, `brake`, `merge-order`, `secretary`, plus `/pitwall:gauge` and `/pitwall:ticket`
- Trackers: `clickup` or `none` (the PR is the record)
- `/pitwall:queue <task in words>` adds a plan row; `init` creates `PLAN.md` when a repo has no tracker and no plan
- Routing eval: 6 cases, Thai and English (`plugin/evals/`, run locally with `claude plugin eval plugin --scaffold`)
