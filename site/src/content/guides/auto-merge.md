---
playbook: auto-merge
---

## What it does

With `merge: auto` in the profile's `git` section, the sync at the start of each round merges the loop's own finished PRs into your dev branch. The base must be that dev branch (git-flow: PRs target `dev`, and a person merges `dev` into `main` or a release branch). The loop never merges into `main`, `master`, a release branch or a production branch, and a lead-mode worker never merges.

> Auto merge is not proven yet: it has not merged a PR on a live run. It is off by default. With `merge: human`, or no `merge` row, you merge every PR.

## What the sync does

<ol class="steps">
<li><strong>Pick the candidates.</strong> Only task PRs this loop opened that are still open, oldest first, each stack from the bottom. A plan-sync PR, your own PRs and anyone else's stay with you. A PR a worker still holds is skipped until the worker hands it back.</li>
<li><strong>Check stop and brake.</strong> Once <code class="cmd">/pitwall:stop</code> or <code class="cmd">/pitwall:brake</code> is set, nothing more merges.</li>
<li><strong>Judge the gates.</strong> The PR needs a VERIFIED verdict (never PARTIAL) from a fresh verifier at its current code, a "Not done yet" section with nothing unticked, and green CI that ran on the current head and the current base. A PARTIAL PR whose boxes have all been ticked since, or a verdict from before the verifier's money / permissions / user data / deletes question, gets one new verifier run first.</li>
<li><strong>Bring the dev branch in.</strong> When the dev branch has commits the PR does not have yet, the loop merges them into the PR branch, pushes, and judges the PR again in a later round, after the new CI. On the third time, or on a conflict it may not resolve itself, it holds the PR.</li>
<li><strong>Merge.</strong> Through one script, <code>merge-pr.mjs</code>: a merge commit of the exact head it judged, never <code>--admin</code> or <code>--auto</code>. It then reads the PR back to check it is merged into the dev branch.</li>
<li><strong>Move the stack along.</strong> A child PR stacked on the merged one is moved onto the dev branch and judged in a later round, once its CI has run there.</li>
</ol>

Each round takes one action: one merge, or one merge of the dev branch into a PR branch. Every merge moves the dev branch, so the next PR needs a fresh look anyway.

## Always for you

A PR stays with a person, even when every gate passes, if the verifier found money, prices or fees, permissions or security, user data, or deletes in its diff, or if it changes CI or the checks: workflows and hooks, any `package.json`, ESLint, RuboCop or TypeScript config, a baseline, the profile, or a file the profile's check commands run.

## What you'll see

A merge or a held PR gets one line in the round report (the wording may differ):

```text
merged #58 into dev
#61 HOLD 3: e2e pending
#62 HOLD always-human: .github/workflows/ci.yml is CI, hook or repo-owner config
```

A hold that needs you also sends one push notification when it happens in a round you did not start. A hold that clears by itself, such as a check still running, only gets the report line. Any other held PR waits for you or for its next commit, and the loop never fixes it outside a task.

## Turn it on

`/pitwall:init` asks who merges when the base is named like a dev branch: `dev`, `development`, or a short form in between such as `devel`. To do it by hand, set both rows in the profile's `git` table, then run `/pitwall:doctor`. It fails a dev branch that is not the base, looks like `main` or a release line, or is not on origin:

```markdown
| base | `dev` |
| merge | `merge: auto` |
| dev branch | `dev` |
```

Then add the one permission rule init names to this machine's `.claude/settings.local.json`, with the real path of the plugin's `scripts/` folder: `Bash(node <absolute pitwall dir>/scripts/merge-pr.mjs:*)`. Update it when a plugin update moves the path, and remove any deny rule that matches it. `gh pr merge` itself stays denied, and init never writes a settings file.
