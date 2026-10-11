---
playbook: readme
---

## What pitwall is

pitwall is a plugin for Claude Code that runs your backlog as a loop. You plan once and answer every open question once, up front. Then the agent builds one task per round, proves it, gets a verdict from a verifier that did not write the code, and opens the PR. **You merge.**

An agent left alone on a queue tends to fail the same few ways: it asks you something at 2am and waits, it calls a passing typecheck "done", it grades its own work, and it guesses a business rule. pitwall is built against each of these:

- **Questions up front.** `/pitwall:queue` asks everything only you can decide, once, as tick boxes. During the run the agent tries it, takes a recorded default, or parks the task. It never stops to ask.
- **Evidence, not claims.** `/pitwall:gauge` runs your checks, drives the page in a browser, and hands you numbered steps only for what a machine cannot do.
- **A verdict from someone else.** Every PR gets a fresh, read-only verifier, pinned to the exact code it checked. A new commit makes the verdict stale.
- **Humans merge.** The agent never merges, force-pushes or touches a protected branch.

## The loop

<ol class="steps">
<li><strong><a href="playbooks/init/">init</a>.</strong> Read the repo and write its profile, once.</li>
<li><strong><a href="playbooks/plan/">plan</a>.</strong> Short interview rounds; every answer lands in the spec, and the plan gets rows.</li>
<li><strong><a href="playbooks/queue/">queue</a>.</strong> Pick the tasks the agent can finish alone, and ask every open question once.</li>
<li><strong><a href="playbooks/drive/">drive</a> and <a href="playbooks/lap/">lap</a>.</strong> One task per round: branch, code, prove, review, verdict, PR. Then the next.</li>
<li><strong><a href="playbooks/merge-order/">merge-order</a>.</strong> Which PR to merge first. You press the button.</li>
</ol>

Stop between tasks with `/pitwall:stop`, or now with `/pitwall:brake`.

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
<li><strong>Plan, queue, drive.</strong> <code class="cmd">/pitwall:plan</code> when the plan has no rows yet, then <code class="cmd">/pitwall:queue</code> and <code class="cmd">/pitwall:drive</code>.</li>
</ol>

You need a GitHub repo, an authenticated [`gh`](https://cli.github.com), and `git`, `bash` and Node 18+ on the machine that runs the loop. Browser checks need a dev server and a browser Claude can drive. For installing for a whole team (project scope), see the full README below.

## Where to go next

- New to it: [init](playbooks/init/), then [plan](playbooks/plan/).
- Curious what a PR looks like: [lap](playbooks/lap/#what-youll-see).
- Choosing how the agent works on a kind of task: the playbooks for [bug fixes](playbooks/bug-fix/), [refactors](playbooks/move-only/) and [features](playbooks/feature/).
- Why it works the way it does: the principles, starting with [prove it works](principles/prove-it-works/).
