---
playbook: merge-order
---

## What it does

`/pitwall:merge-order` tells you which open PRs to merge first and why the others have to wait. It sorts stacked PRs parent before child and gives each PR a level. Then it fixes what it safely can: it retargets a child whose parent merged, keeps children in draft, and resolves conflicts in the plan's log and rows. It never merges. You press the button.

Under [`merge: auto`](../auto-merge/), the sync at the start of a lap merges the loop's own PRs into the dev branch when every gate passes, in the same order (bottom of each stack first, as a merge commit). That is part of the lap, separate from this command.

## Use it when

- several agent PRs are open, some stacked on others
- you just merged one and want to know what is next
- the other PRs started to conflict in the plan after a merge

## Try it

```text
/pitwall:merge-order          all your open PRs
/pitwall:merge-order 101      only the stack that holds #101
```

## The levels

| Level | Means |
|---|---|
| 🟢 | can merge now: on the base, checks green, nothing pending, a passing verdict at its current code |
| 🟡 | can merge, but something is pending: an unticked item, or no verdict yet at its current code. You decide whether it can wait until after merge |
| ⏸ | waiting for the PR it is stacked on |
| 🔴 | blocked: draft, conflict, failing check, changes requested, or the verdict failed |
| ⏳ | a check is still running |

## What you'll see

The example comes from a made-up repo, `acme/shop`.

```text
retarget: #59 → main (#58 merged)

Stack A — 3 PR (main ← #59 ← #60 ← #61)
| # | PR                        | Level | Pending              |
|---|---------------------------|-------|----------------------|
| 1 | #59 price filter          | 🟢    |                      |
| 2 | #60 filter chips          | ⏸     | waiting for #59      |
| 3 | #61 saved filters         | ⏸     | waiting for #60      |

Standalone
| # | PR                        | Level | Pending              |
|---|---------------------------|-------|----------------------|
| 1 | #62 lint batch 3          | 🟡    | needs re-verify      |

Next: merge #59 → then press "Delete branch" in that PR (GitHub moves #60 to main itself)
```

## When you merge

- Use **Create a merge commit**. Never squash or rebase a PR in a stack: the child would see its parent's commits twice and conflict.
- Merge one at a time, in order, and only PRs whose base is the profile's base.
- Press **Delete branch** right after, so GitHub moves the child onto the base. If you forget, run `/pitwall:merge-order` again and it retargets.
- After a merge, the other agent PRs usually conflict in the plan's log. Run the command again, or let the next lap fix them.
