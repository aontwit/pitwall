---
playbook: readme
---

## What pitwall is

pitwall is a Claude Code plugin that runs your backlog as a loop. You plan once and answer every open question once, up front. Then the agent builds one task per round, proves it works, gets a verdict from a verifier that did not write the code, and opens the PR. You merge, unless you let the loop merge into your dev branch (see below).

An agent left alone on a queue tends to fail in the same few ways: it asks you something at 2am and waits, calls a passing typecheck "done", grades its own work, or guesses a business rule. pitwall handles each of these:

- `/pitwall:queue` asks everything only you can decide, once, as tick boxes. During the run the agent tries it, takes a recorded default, or parks the task. It never stops to ask.
- `/pitwall:gauge` runs your checks, drives the page in a browser, and gives you numbered steps only for what a machine cannot do.
- Every PR gets a fresh, read-only verifier, pinned to the exact code it checked. A new commit makes the verdict stale.
- The agent never force-pushes or pushes to a protected branch, and merges only if you opt in with `merge: auto`. Then it merges its own PRs into your git-flow dev branch when every gate passes, and `main` and release branches stay with you ([auto merge](playbooks/auto-merge/)).

## The loop

<ol class="steps">
<li><strong><a href="playbooks/init/">init</a>.</strong> Reads the repo and writes its profile, once.</li>
<li><strong><a href="playbooks/plan/">plan</a>.</strong> Short interview rounds. Every answer goes into the spec, and the plan gets rows.</li>
<li><strong><a href="playbooks/queue/">queue</a>.</strong> Picks the tasks the agent can finish alone and asks every open question once.</li>
<li><strong><a href="playbooks/drive/">drive</a> and <a href="playbooks/lap/">lap</a>.</strong> One task per round (branch, code, prove, review, verdict, PR), then the next one.</li>
<li><strong><a href="playbooks/merge-order/">merge-order</a>.</strong> Tells you which PR to merge first. You press the button (under <code>merge: auto</code>, the lap merges into the dev branch itself).</li>
</ol>

Stop between tasks with `/pitwall:stop`, or right away with `/pitwall:brake`.

Two modes are off until you turn them on in the profile. [Parallel laps](playbooks/parallel-laps/) (`parallel: 2` or more) run a batch of tasks at once, each in its own worktree and branch. [Auto merge](playbooks/auto-merge/) (`merge: auto`) lets the loop merge its own verified PRs into your git-flow dev branch, while `main` and release branches stay with you.

## Install

<ol class="steps">
<li><strong>Add the marketplace and the plugin</strong> in Claude Code.</li>
</ol>

```text
/plugin marketplace add aontwit/pitwall
/plugin install pitwall@pitwall
```

<ol class="steps" start="2" style="counter-reset: step 1">
<li><strong>Set up each repo.</strong> Run <code class="cmd">/pitwall:init</code> in it, then commit <code>.claude/agent-loop.md</code> (and the plan file, if init wrote one) to the base branch.</li>
<li><strong>Plan, queue, drive.</strong> Run <code class="cmd">/pitwall:plan</code> if the plan has no rows yet, then <code class="cmd">/pitwall:queue</code> and <code class="cmd">/pitwall:drive</code>.</li>
</ol>

You need a GitHub repo, an authenticated [`gh`](https://cli.github.com), and `git`, `bash` and Node 18+ on the machine that runs the loop. Browser checks also need a dev server and a browser Claude can drive. To install for a whole team (project scope), see the full README below.

## Where to go next

- New to it: [init](playbooks/init/), then [plan](playbooks/plan/).
- What a PR looks like: [lap](playbooks/lap/#what-youll-see).
- How the agent works on a kind of task: the playbooks for [bug fixes](playbooks/bug-fix/), [refactors](playbooks/move-only/) and [features](playbooks/feature/).
- Why it works this way: the principles, starting with [prove it works](principles/prove-it-works/).
