# playbook: doctor — is this repo's profile complete?

Use for `/pitwall:doctor`, "check the profile", and as the last step of `init` · read-only

1. `bash <pitwall dir>/scripts/doctor.sh` from the repo root (another profile path → pass it as the argument)
2. Exit 3 → "this repo has not set up pitwall yet — run `/pitwall:init`", end
3. Exit 1 → report each `MISSING` / `BAD` line with what that section holds (the "Profile contract" table in `SKILL.md`), end
4. Exit 0 → also check what the script cannot: the install command's package manager matches the lockfile on `origin/<base>` (`git ls-tree --name-only origin/<base>` — a base that moved from one package manager to another leaves a stale profile; fix it with `/pitwall:init redo`), every command in `checks` exists (`package.json` script / binary on PATH), `git` → `base` exists on origin (`git ls-remote --heads origin <base>`), `gh auth status` passes, tracker `clickup` → its tools are connected · report one line per finding, or "profile OK"

Never edit the profile here — fixes go through `init` or the user
