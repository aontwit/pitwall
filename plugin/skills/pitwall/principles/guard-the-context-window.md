<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-guard-the-context-window/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Guard the Context Window

The context window is finite and non-renewable within a session. Every token should be worth its cost.

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Isolate large payloads.** Route verbose outputs, screenshots, and large documents to subagents. The main context gets summaries, not raw data.
- **Keep frequently used content inline.** Templates and references used on every invocation belong in the skill file, not in separate files that cost a read each time.
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
