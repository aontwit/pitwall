# Changelog

## 0.5.0 — 2026-10-19

Hardening for the public beta: sibling task PRs no longer conflict in the plan, `init` reads repo values through a tested script, `/pitwall:plan` drafts a spec from the code or sets up a new repo with a phase 0, `/pitwall:verify-setup` writes a skill that drives the app (Godot included), and the README says who pitwall is for and how to send feedback.

- Task PRs no longer tick their plan row or write the Progress log (#29). The start-of-round sync in `lap` ticks the rows of merged agent PRs and writes the log in one docs PR, through `scripts/plan-sync.mjs`, and `queue` and `lap` count a row as done once its agent PR has merged. Sibling task PRs from the same base no longer conflict in the plan file after each merge, and a resolution no longer makes their verdict stale. That conflict was behind #7, #25, the resolver in 0.4.0 and the log-row change in 0.4.1. A `repeat` row stays in the queue until its target round, so the sync skips it until then
- `init` reads the file-based values of step 1 through `scripts/detect.mjs` (#30): package manager and frozen install, check commands, Godot version, CI `run:` steps, dev server and port, plan files, verification-skill candidates, hooks and rules files. It reads `origin/<base>` with `--ref`, and a value it cannot settle stays `null`, never a guess. Tests run it against three fixture repos (empty, Next.js, Godot). A second test reads the verifier row and the `Plan PR` line that the playbooks prescribe and runs them through `check-pr-body.mjs`, so a playbook and the script can no longer drift apart unnoticed the way they did in #26
- A new repo gets a spec and a phase 0 (#31). When the base has no code yet, `/pitwall:plan` asks once what to build with and where it deploys, and writes the answer to the spec's `## Stack`, or records `delegated` with the reason. When the profile has no spec, it creates `SPEC.md` from `templates/spec.md` (Stack, Users, Purpose, Capabilities and constraints, Terms, Open decisions) and points the profile at it. Before any product phase it writes phase 0: a scaffold, check commands with CI, and a verification skill. Each of these rows updates its own profile row, so the first product PR has level A evidence that actually ran. `init` reads an existing `PRODUCT.md` (impeccable) as the spec and never writes a second one
- New `/pitwall:verify-setup` (`playbooks/verify-setup.md`, adapted from pstack `create-verification-skill`, MIT): reads the repo, writes `.claude/skills/verify-<app>/SKILL.md` with Launch / Doctor / Drive / Evidence / Cleanup and a feature map of the top 3–5 features, runs it once end to end and fills the profile's `verification skill` row. It has a web recipe (dev server + browser) and a Godot recipe (headless scene run through a drive script, stdout + exit code, a frame from `--write-movie` or `save_png` with a renderer). `init` offers it when the repo has no verification skill, and `/pitwall:gauge` drives a level B item with that skill when there is no browser, so a Godot repo gets level B evidence instead of a step for a human (#33)
- `/pitwall:plan` survey mode for a repo with code but no docs (#32): it reads the code first (`detect.mjs`, entry points, data shapes, tests, commits), drafts `SPEC.md` with every line marked `(inferred from <file>)`, and asks at most 6 questions to confirm the draft, never one a file answers. Unconfirmed lines stay open, and `queue` asks about any task that rests on one
- Docs: the README says who pitwall is for, lists the `plan` modes, updates the Status table for 0.5.0, and adds a Feedback section with a beta feedback issue template

## 0.4.4 — 2026-10-19

A shorter way to the first agent PR: `init` hands over the commands to commit the profile and offers a one-task path, and the README says what has run on real repos.

- `init` step 5: the report gives the commands to commit the profile and the plan file, ready to paste: a direct commit and push when the base is not protected, a small `docs/pitwall-profile` PR when it is. Init still runs none of them. Before, it only said "commit it to the base yourself"
- `init` step 5: an empty plan gets two paths, `/pitwall:queue <one task in words>` then `/pitwall:lap` (one round to the first PR), or `/pitwall:plan` for a whole product or phase. Before, it always sent a new user to the multi-round `/pitwall:plan` interview and a plan PR to merge first, about 7 steps before the first agent PR
- README: a "Your first 30 minutes" section after Quick start. The Status table moves to Proven what users have run: `/pitwall:merge-order` with the docs-conflict resolver, laps on a Next.js frontend repo, laps on two Godot repos with `tracker: github` (Duskreign, Guild Register), and laps on macOS (#7)

## 0.4.3 — 2026-10-19

Fixes from users: the docs-conflict resolver no longer drops a branch's edit to a task row, and a `/pitwall:plan` PR passes its own PR-body check.

- `scripts/resolve-docs-conflict.mjs`: a task row both sides hold with different text kept base's text and exited 0, so a `Plan correction` or a changed Files cell on the branch was lost without a word. It now reads the merge base from git's index and keeps the text of the side that changed the row, ticked if either side ticked. When both sides changed it, or there is no merge base to tell, it exits 1 and names the row, and `merge-order` 2b says how to fix it. Found in one repo: three merges in a row lost the branch's Plan correction, and one reached `main` (#25)
- `scripts/check-pr-body.mjs` accepts a docs-only plan PR: a `## Verify` section with a line starting `Plan PR` stands in for the verifier row. `plan` step 5 says to write that line and run the check, so the playbook and the check agree. Before, a plan PR failed the check that `plan` says it needs no verifier for (#26)

## 0.4.2 — 2026-10-12

The loop keeps talking in the user's language from start to end, and pitwall tells you when a new release is out.

- Every line the user sees follows the profile's user language, not only questions and reports: SKILL.md rule 8, and `lap` re-reads the `language` section at the start of every round. Found on Duskreign: the briefing was in Thai, but from `/pitwall:drive` on, the progress lines and round reports came out in English, because the slash command, the wakeup prompt `/loop /pitwall:lap`, the playbooks and the subagent reports are all English
- Update notice: the first pitwall command of a session checks the latest GitHub release (`scripts/update-check.sh`, through `gh`) and, when it is newer than the installed plugin, tells the user in one line how to update. Silent when up to date, offline or without `gh`

## 0.4.1 — 2026-10-12

Fixes from users: `init` asks which language to use and its questions read plainly, the verifier fails only on what the task owns, sibling PRs no longer conflict on the plan log, and the docs site says what pitwall is.

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
