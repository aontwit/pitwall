#!/usr/bin/env bash
# Checks a repo's pitwall profile against the "Profile contract" table in ../SKILL.md.
#   doctor.sh [profile]   (default: .claude/agent-loop.md in the current repo)
# Exit 0 = every required section present · 1 = sections missing / bad tracker value · 3 = no profile
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
skill="$here/../SKILL.md"
profile="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/agent-loop.md}"

if [ ! -f "$profile" ]; then
  echo "no profile at $profile — this repo has not set up pitwall yet (run /pitwall:init)"
  exit 3
fi

# bash 3.2-safe (macOS /bin/bash): no mapfile, no ${x,,}, no arrays under set -u
lower() { tr '[:upper:]' '[:lower:]'; }
# Contract rows: "| <section> | <holds> |" between the "## Profile contract" heading and the next "## "
rows="$(awk '/^## Profile contract/{on=1;next} on&&/^## /{exit} on&&/^\| [a-z]/{sub(/^\| /,""); sub(/ \|.*/,""); print}' "$skill")"
headings="$(grep -E '^## ' "$profile" | tr -d '\r' | sed 's/^## *//' | lower)"

# a heading counts when it is the section name, alone or followed by " (…)" / " — …"
has() {
  local h
  while IFS= read -r h; do
    [[ "$h" == "$1" || "$h" == "$1 "* ]] && return 0
  done <<< "$headings"
  return 1
}

problems=0
while IFS= read -r row; do
  [ -n "$row" ] || continue
  name="$(printf '%s' "${row%% (*}" | lower)"
  if has "$name"; then
    echo "ok       $name"
  elif [[ "$row" == *"(optional"* ]]; then
    echo "optional $name (not set)"
  else
    echo "MISSING  $name"; problems=$((problems+1))
  fi
done <<< "$rows"

if has tracker && ! grep -qE 'tracker: *`?(clickup|github|none)([^a-z0-9_]|$)' "$profile"; then
  echo "BAD      tracker: the section must say \`tracker: clickup\`, \`tracker: github\` or \`tracker: none\`"; problems=$((problems+1))
fi

left="$(grep -c '{{' "$profile" || true)"
if [ "$left" -gt 0 ]; then
  echo "UNFILLED $left line(s) still hold a {{…}} placeholder:"; grep -n '{{' "$profile" | cut -c1-120
  problems=$((problems+1))
fi

if [ "$problems" -eq 0 ]; then echo "doctor: profile OK ($profile)"; else echo "doctor: $problems problem(s) in $profile"; fi
[ "$problems" -eq 0 ]
