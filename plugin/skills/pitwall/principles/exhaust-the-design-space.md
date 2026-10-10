<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/principle-exhaust-the-design-space/SKILL.md · MIT License, Copyright (c) 2026 Lauren Tan · copied for pitwall v1 (2026-10-07) -->


# Exhaust the Design Space

When a novel interaction or architectural decision has no established precedent, explore several concrete alternatives before implementation. Building the wrong thing costs more than exploring three options.

**The rule.** When the right answer is not obvious, build 2-3 competing prototypes or sketches. Compare them side by side. Only then commit. Design it twice is this rule by another name. A second flavor of the first shape does not count.

**When it applies:**
- Novel UI interactions (no prior art in the codebase)
- Architectural choices with multiple viable approaches
- Product design decisions where user experience depends on feel, not logic

**When it doesn't:**
- Mechanical implementation where the pattern is established
- Bug fixes or refactors with a clear target state
- Changes where constraints dictate a single viable approach

## pitwall adaptation

- Without a design file or a source UI to match, the 2–3 alternatives are a step-1 throwaway prototype (screenshots in the PR / briefing); the chosen design is still the human's call (parked or asked in briefing). No new design tokens outside the repo's token source.
