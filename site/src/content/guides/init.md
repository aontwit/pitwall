---
playbook: init
---

## What it does

`/pitwall:init` sets a repo up for the loop. It reads the repo first, asks you only what the files could not answer, then writes the profile, `.claude/agent-loop.md`, that every other command runs on. It never commits, pushes or edits your settings: you review the profile and commit it yourself.

## Use it when

- a repo is about to get its first `/pitwall:queue`
- the stack changed under the profile, for example a new package manager (`/pitwall:init redo` starts over)
- `/pitwall:doctor` reports sections that are missing (init fills only those)

## Try it

```text
/pitwall:init
```

You need an authenticated `gh`. Without it, init stops at once.

## How it runs

<ol class="steps">
<li><strong>Read.</strong> Everything comes from the base branch as the loop will see it: install and check commands (from the lockfile and scripts, or from CI steps), the base branch (where merged work PRs go), protected branches, hooks, the commit pattern, the dev server, the plan and the tracker. Each value keeps its source.</li>
<li><strong>Draft.</strong> Fill the profile template with what was read, including two different models for the review panel.</li>
<li><strong>Ask once.</strong> Up to four tick-box questions at a time, recommended answer first: tracker, languages, the base when there were two candidates, the dev server and browser, steps only a human may do. When the base is named like a dev branch (<code>dev</code>, <code>development</code>, or a short form in between such as <code>devel</code>), it also asks who merges: a person (the default and the recommended answer) or the loop, into that branch only (<a href="../lap/#auto-merge">auto merge</a>). Any other base gets <code>merge: human</code> with no question.</li>
<li><strong>Write.</strong> The profile, and a <code>PLAN.md</code> when the repo has neither a tracker nor a plan.</li>
<li><strong>Check.</strong> Run <code class="cmd">/pitwall:doctor</code>; init must end in "profile OK".</li>
</ol>

It never asks what a file answered, and never fills a business value (a price, a limit, a credential) from a guess.

## What you'll see

The example comes from a made-up repo, `acme/shop`.

```text
Profile written: .claude/agent-loop.md · doctor: profile OK

Read from the repo
  install     pnpm install --frozen-lockfile     pnpm-lock.yaml
  checks      pnpm typecheck · pnpm lint · pnpm test   package.json scripts
  base        main                                last 30 merged work PRs
  commits     feat(scope): summary                .husky/commit-msg
  dev server  pnpm dev, port 5173                 vite.config.ts
Answered by you
  tracker none · languages English · browser Claude in Chrome
Defaults taken
  review panel: two different models
Written
  .claude/agent-loop.md · PLAN.md

Next: commit both files to main yourself, then /pitwall:plan
```

## Next steps

- Commit `.claude/agent-loop.md` (and the plan file) to the base. The loop never pushes to the base, and a lap stops on untracked files.
- The plan has no rows yet: `/pitwall:plan`. It has rows: `/pitwall:queue`.
- Init may list things only you should do: add `permissions` to your settings file, un-ignore the profile in `.gitignore`, or add the marketplace entry a teammate's clone needs.
- You chose `merge: auto`: the report names one permission rule, `Bash(node <absolute pitwall dir>/scripts/merge-pr.mjs:*)` with the real path, for this machine's `.claude/settings.local.json`, not the shared `.claude/settings.json`. Add it yourself, remove any deny rule that matches it, and update the path after a plugin update moves it. `gh pr merge` stays denied.
