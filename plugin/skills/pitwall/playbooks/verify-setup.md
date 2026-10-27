<!-- Source: github.com/cursor/plugins/blob/d457567332aa/pstack/skills/create-verification-skill/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · license: `principles/LICENSE-pstack` · adapted for pitwall (2026-10-19): `.claude/skills/`, a Godot recipe, the profile's level B row -->

# playbook: verify-setup — write a skill that drives this repo's app

Use for `/pitwall:verify-setup`, and when `init` offers it (`verification skill: none`) · writes `.claude/skills/verify-<app>/` (a skill + a feature map) so level B evidence comes from the agent, not from a human · runs without a profile too · never commits or pushes — the user reviews the skill and commits it

You write the skill for the next agent, not for a human: it is read cold, mid-task, by an agent that has never seen the app

## 0. Already there?

A `.claude/skills/*/SKILL.md` that launches or drives the app exists → run its Doctor (or its launch) once · works → fill the profile row (step 5) and stop · broken → fix that skill through steps 3–4 instead of writing a second one

## 1. Read the repo, not the user

Answer from the code; ask only what you cannot observe (one AskUserQuestion round, SKILL.md rule 3):

- **Surface**: what a user touches — web UI, game window, CLI / TUI, desktop app, API · several → pick the primary one, name the rest in the skill
- **Run**: the repo's own start command (package scripts, `Makefile`, README quickstart, CI `run:` steps, the profile's dev server) · ports, env vars (`GODOT` = path to the engine binary), seed data, auth
- **Drive**: existing harnesses first — Playwright / Cypress specs, GUT / gdUnit4 under `addons/`, a test scene, expect scripts, curl-able endpoints · only then a recipe below
- **Observe**: screenshots, frames, ARIA snapshots, stdout / stderr, exit codes, response bodies, files written, DB rows
- **Isolate**: can two runs coexist (ports, data dirs, `user://`, profiles)? no → the skill says so: refusing to drive a shared instance beats corrupting the user's session

The checkout does not build or start as is → fix it or report it precisely first; a skill written against a broken base teaches wrong steps · an unrelated missing asset blocks startup → the skill may create it, marked as verification scaffolding, and remove it in Cleanup

### Recipe: web (Next.js and other dev-server apps)

- Launch: the profile's dev server command on its port, one server per checkout (`/pitwall:gauge` level B) · ready = the page renders the app's content, not just "port open"
- Drive: the profile's browser (built-in browser / Claude in Chrome / Playwright) · real routes · ARIA roles and accessible names, `data-testid` when the repo has them — never coordinates or tab order
- Evidence: screenshot + page text or ARIA snapshot of the end state + console errors (must be 0) + the network response that carries the side effect

### Recipe: Godot

- Launch: `"$GODOT" --version` must match `config/features` in `project.godot` · a fresh checkout has no import cache → `"$GODOT" --headless --path . --import` once (Godot 4.3+; older: `"$GODOT" --headless --path . --editor --quit`) · ready = the import exits 0 and `.godot/imported/` exists
- Drive: a drive script per feature under `res://verify/` · a runner scene (`"$GODOT" --headless --path . res://verify/<feature>.tscn -- <evidence dir>`) loads the project's autoloads like the game does · `--script res://verify/<feature>.gd` (a script that `extends SceneTree`) is lighter, and autoloads still load, but their global names do not compile there (`Identifier not found`, Godot 4.7): reach them with `root.get_node("/root/<Name>")` · the script instances the real scene, sends input the way a player does — `Input.parse_input_event()` with the `[input]` actions of `project.godot`, `get_viewport().push_input()` with a mouse event at a control's centre for UI — waits frames with `await process_frame`, prints one `VERIFY <feature> PASS|FAIL <detail>` line per check and ends with `quit(0)` or `quit(1)` · calling the handler or emitting `pressed` directly skips the input path: weaker proof, say so where it is the only way
- Evidence: stdout + exit code always (headless) · a frame needs a renderer, and `--headless` has none: `get_image()` returns null, and `await RenderingServer.frame_post_draw` never returns, so the run hangs — guard it with `DisplayServer.get_name() != "headless"` → run that drive without `--headless` (a window opens; Linux CI: `xvfb-run`) and either add `--write-movie <evidence dir>/frame.png --fixed-fps 30 --quit-after <frames>` (numbered PNGs `frame00000000.png` …, plus a `frame.wav`) or, in the script, `await RenderingServer.frame_post_draw` then `get_viewport().get_texture().get_image().save_png(<evidence dir>/<step>.png)` · the evidence dir comes in after `--` (`OS.get_cmdline_user_args()`)
- Isolate: `user://` is one folder per project name, so the human's play sessions and every other worktree of the repo share it → each drive sets its own data dir: Windows `APPDATA=<evidence dir>/appdata` (`user://` becomes `<that>/Godot/app_userdata/<name>`, checked on Godot 4.7) · Linux `XDG_DATA_HOME`, macOS `HOME` (not checked yet) · `--path` = the checkout the drive runs in, never another one · each worktree imports once into its own `.godot/` · with both, two worktrees drive at the same time (checked on Godot 4.7), so parallel workers each run their own game · a drive that must read the human's own saves → the skill says not to run while the game is open, and two drives never run at once

Other surfaces (CLI / TUI, API, desktop): build once, then each drive in its own PTY / tmux session or plain HTTP call; same five sections

## 2. Write the skill

`.claude/skills/verify-<app>/SKILL.md` with frontmatter `name: verify-<app>` and a `description` that names the app, the surface and when to reach for it (no frontmatter → the skill never registers) · every section grounded in what step 1 found, no placeholders left:

- **Launch**: the exact command and how to tell it is ready — ready means usable, not just a process answering (a DB health check can pass while its init scripts still run) · reaches a usable state from an empty data dir (migrations, seed data, import cache) · a short-lived CLI or a Godot drive has no server to keep alive: launch = build / import once, then each drive starts its own process
- **Doctor**: one read-only check — is this instance worth driving? process up, right version / build, port owned by this run, auth valid · run it first whenever anything looks off
- **Drive**: the harness recipe with real selectors / actions / commands from this repo, not examples · stable handles (ARIA labels, data attributes, input action names, node paths, prompt strings, routes) over coordinates and tab order
- **Evidence**: what to capture and where · the standards: the real user path, not internal setters or test-only endpoints · the action and the resulting state, not just the final screen · side effects (files written, rows inserted, saves changed) next to what is visible · mocks only where a production boundary already isolates the external system · a dry-run / test mode is verified by observing what it really skips (files, network, git refs), not by its name · location: the profile's state path + `evidence/<feature>/<YYYYMMDD-HHMMSS>/`, no profile → a folder under the OS temp dir the skill names · never an untracked folder in the working tree (`/pitwall:lap` stops on untracked files)
- **Cleanup**: tear down what this run started — by the PID it recorded, never by process name · removes instances and scratch state, never the evidence
- **Helpers**: a script the skill ships is executable and its invocation is shown in the skill body

## 3. Seed the feature map

`.claude/skills/verify-<app>/features/README.md` (baseline preconditions, driving conventions, proof rules, an index) + one file per user-facing feature — the top 3–5, from routes, scenes, menus, commands or docs · each file: an H1, one paragraph on the user-visible behaviour, then exactly four H2s in order: `Sub-features` (short IDs, one line each) · `How to get to it (user POV)` (every entry point) · `Driving it with <harness>` (starts with `Preconditions:`, then bullets that pair each user action with the exact command / input and the observable result) · `Gotchas` · the seed data lacks a precondition a journey needs → the journey reports a failure and the reason goes in `Gotchas`; never weaken the journey to make it pass · a proof that drives one convenient entry point is incomplete when the map lists others

## 4. Prove it before handing it over

Run the generated skill's own instructions once, end to end: Launch → Doctor → Drive ONE mapped feature → capture Evidence → Cleanup → confirm the evidence still exists at the named location (a cleanup that eats the proof fails this step) · something fails → fix the skill, run its Cleanup after every failed attempt too, so broken attempts strand no processes or ports · a skill never executed is a draft, not a deliverable · proved in a stand-in (another machine, a container, a renderer the target lacks) → list every setup step the stand-in did that the target will not; those stay unverified

## 5. Profile + report

Profile exists → set level B `verification skill` to `verify-<app>` (`.claude/skills/verify-<app>/SKILL.md`) · an app with no dev server: also `port: free` when each drive gets its own data dir (Isolate) and step 4's drive passed again from a second worktree while the first ran, else `port: fixed` — the only rows this playbook writes · report in the profile's user language (no profile → the language the user writes in): surface chosen (and the others), the step 4 run with its evidence path, features mapped, stand-in gaps, scaffolding created · next: commit `.claude/skills/verify-<app>/` (and the profile) yourself · keep the map honest as the app changes: a new feature or a changed entry point → add or edit its file, or `/pitwall:verify-setup` again
