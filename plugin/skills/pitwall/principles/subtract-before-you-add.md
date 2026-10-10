<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-subtract-before-you-add/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Subtract Before You Add

When evolving a system, remove complexity first, then build.

**Why:** Adding to a complex system compounds complexity. Removing first leaves less code, reveals the essential structure, and usually makes the next design obvious. Default to subtraction.

Make simplification a continual investment. Leave the design slightly simpler and more capable behind the same or smaller surface than you found it.

**The pattern:**
- Sequence removal before construction
- Cut before you polish (get to the minimum before investing in quality)
- Design for observed usage, not speculative edge cases
- No speculative validators, parsers, or guards beyond what the spec demands
- Simplify prompts (remove redundant instructions, excessive templates)
- When a reference has no novel content, delete it rather than leaving a stub

## pitwall adaptation

- Under `port`, `move-only` or `ratchet`: behaviour stays identical, scope is the task's files only (~8), and variants still in use keep their branches. A removal or redesign this principle suggests becomes a `/pitwall:ticket`, not part of the PR.
