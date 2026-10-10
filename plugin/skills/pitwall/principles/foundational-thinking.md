<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-foundational-thinking/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Foundational Thinking

**Structural decisions** protect option value. **Code-level decisions** protect simplicity.

**Data structures first.** Get the data shape right before writing logic. Define core types early, trace every access pattern, and choose structures that match the dominant paths.

At code level, DRY the structure, not every line. Types and data models should converge. Three similar statements still beat a premature abstraction. Prefer explicit over clever. Test behavior and edge cases, not line counts.

**Concurrency corollary.** Before sharing state between actors, ask "what happens if another actor modifies this concurrently?" If not "nothing", isolate.

**Scaffold first.** If something helps every later phase, do it first. Ask "does every subsequent phase benefit from this existing?" CI, linting, test infrastructure, and shared types are scaffold. Sequence for option value: setup before features, tests before fixes. Keep commits small and single-purpose.

Each increment should land a coherent abstraction or deepen one that exists. Do not spread a new capability across callers as special-case coordination.

Subtraction comes before scaffolding. Remove dead code first, then lay foundations.

## pitwall adaptation

- Under `port`, `move-only` or `ratchet`: behaviour stays identical, scope is the task's files only (~8), and variants still in use keep their branches. A removal or redesign this principle suggests becomes a `/ticket`, not part of the PR.
- "Three similar statements beat a premature abstraction" yields to the repo rules when they set a duplication threshold (e.g. extract at the second copy unless the copies will diverge — ask).
