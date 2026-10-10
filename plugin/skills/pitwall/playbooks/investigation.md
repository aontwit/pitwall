<!-- Source: github.com/cursor/plugins/blob/df581122cde1/pstack/skills/poteto-mode/playbooks/investigation.md · MIT License, Copyright (c) 2026 Lauren Tan · license: `principles/LICENSE-pstack` · adapted for pitwall v1 (2026-10-07) -->

# playbook: investigation — a cited answer or a recommendation, never code

Use for read-only questions: how does it work / why is it like this / are you sure / which option is better · produces an explanation or a recommendation, not a change

## 1. Gather from the sources

- Code with `file:line` (`Explore` when it spans many files)
- `git log` / `git blame` for the why behind a line
- The tracker task, if the question comes from one
- The repo's docs / knowledge base named in the profile `repo rules`

Every claim cites one of these or is labelled (checked / inferred / guessed)

## 2. Throughput checkpoint

One line: `n/a, read-only investigation`

## 3. Shape the answer

- Explanation → Overview / Key concepts / How it works / Where things live / Gotchas
- Decision between alternatives → a recommendation + a tradeoffs table

## 4. "Are you sure?"

Give your real judgment with reasons, not agreement · the premise is wrong → push back (principle `attack-the-premise`)

## Never

- never edit code, never open a PR
- it turns into a change → hand back to the user and re-route per the `SKILL.md` "Choose a playbook" table

## Reply

The answer from step 3, in the profile's user language
