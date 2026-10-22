---
playbook: doctor
---

## What it does

`/pitwall:doctor` checks the profile, `.claude/agent-loop.md`, against the contract every command relies on, and names any section that is missing or wrong. It is read-only: fixes go through `/pitwall:init` or through you.

## Use it when

- you edited the profile by hand
- a command stopped and said a section is missing
- the repo changed tools, for example from npm to pnpm

## Try it

```text
/pitwall:doctor
```

## What it checks

<ol class="steps">
<li><strong>The sections.</strong> Every required section is there (repo, git, checks, level B, states to build, repo-specific evidence, agents per task, repo rules, permissions, language), the tracker line is valid, <code>parallel</code> and <code>port</code> hold a valid value when they are set, and no <code>{{…}}</code> placeholder is left.</li>
<li><strong>What a script cannot see.</strong> The install command still matches the lockfile on the base, every check command exists, the base branch exists on the remote, <code>gh</code> is signed in, and the tracker's tools are connected.</li>
</ol>

## What you'll see

A healthy profile:

```text
ok       repo
ok       git
ok       checks
ok       level B
…
optional multi-machine (not set)
doctor: profile OK (.claude/agent-loop.md)
```

A profile with problems, each line explained in the report:

```text
MISSING  states to build
BAD      tracker: the section must say `tracker: clickup`, `tracker: github` or `tracker: none`
UNFILLED 1 line(s) still hold a {{…}} placeholder:
doctor: 3 problem(s) in .claude/agent-loop.md
```

No profile at all: doctor says the repo has not set up pitwall and points to `/pitwall:init`.
