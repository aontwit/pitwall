<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-redesign-from-first-principles/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Redesign From First Principles

When integrating a change, don't bolt it onto the existing design. Redesign as if the requirement had been there from the start.

- Read all affected files and understand the current design
- Ask: "if we were writing this from scratch with this new requirement, what would we build?"
- Propagate the change through every reference: types, docs, examples, rationale sections
- Think about the whole redesign, then deliver it incrementally

This is the method for preserving option value when integrating changes into an existing design.

## pitwall adaptation

- Under `port`, `move-only` or `ratchet`: behaviour stays identical, scope is the task's files only (~8), and variants still in use keep their branches. A removal or redesign this principle suggests becomes a `/pitwall:ticket`, not part of the PR.
