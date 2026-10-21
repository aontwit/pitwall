#!/usr/bin/env bash
# Checks a repo's pitwall profile against the "Profile contract" table in ../SKILL.md.
#   doctor.sh [profile]   (default: .claude/agent-loop.md in the current repo)
# Exit 0 = every required section present · 1 = sections missing / bad tracker, parallel, port or merge value / dev branch · 3 = no profile
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

# optional `key: value` settings (missing key = fine), read only inside the section the contract puts them in, so prose
# elsewhere ("run in parallel: lint", "DB port: 5432") is never a value · `key:` on a word boundary, so `Report:` never
# matches `port:` and `on port \`4321\`` (no colon) is not a value · a {{…}} placeholder is left to the UNFILLED check
section() { # <section name> → its lines, heading matched like has()
  tr -d '\r' < "$profile" | awk -v s="$1" '/^## /{h=tolower(substr($0,4)); on=(h==s || index(h,s" ")==1); next} on'
}
raw_values() { # <section> <key> → each `key: value` found in that section, as written
  section "$1" | grep -oE "(^|[^A-Za-z0-9_])$2: *\`? *[^[:space:]\`|,;)]*" | sed -E "s/^[^A-Za-z0-9_]?//"
}
clean_value() { # `key: value` → value, without the backticks around it
  local tok="$1"
  tok="${tok#*:}"; tok="${tok# }"; tok="${tok#\`}"; tok="${tok# }"; tok="${tok#\`}"
  printf '%s' "$tok"
}
check_value() { # <section> <key> <ok-regex for the value> <message>
  local tok
  while IFS= read -r tok; do
    [ -n "$tok" ] || continue
    tok="$(clean_value "$tok")"
    [[ "$tok" == '{{'* ]] && continue
    printf '%s' "$tok" | grep -qE "$3" || { echo "BAD      $2: $4 (got \`$2: $tok\`)"; problems=$((problems+1)); }
  done < <(raw_values "$1" "$2")
}
check_value 'agents per task' parallel '^[1-9][0-9]*$' 'a whole number of 1 or more, e.g. `parallel: 2`'
check_value 'level b' port '^(fixed|free)$' 'must be `port: fixed` or `port: free` (the port number goes after `on port`)'
check_value git merge '^(human|auto)$' 'must be `merge: human` or `merge: auto` (missing = human)'

# `merge: auto` needs a real dev branch: a name in backticks in the `dev branch` row, not the base, not a branch the loop
# never touches, and present on origin · `human` (or no row) has nothing to check
row_cell() { # <row label> → the value cell of that row of the git table
  local row cell
  row="$(section git | grep -E "^\| *$1 *\|" | head -n 1)"
  cell="${row#*|}"; cell="${cell#*|}"; printf '%s' "${cell%%|*}"
}
ticks() { printf '%s\n' "$1" | grep -oE '`[^`]*`' | tr -d '`' | sed -E 's/^ +//; s/ +$//'; }  # every backticked token
first_tick() { ticks "$1" | head -n 1; }
if [ "$(clean_value "$(raw_values git merge | head -n 1)")" = auto ]; then
  dev_cell="$(row_cell 'dev branch')"
  dev="$(first_tick "$dev_cell")"
  if [[ "$dev_cell" == *'{{'* ]]; then
    :  # a placeholder is left to the UNFILLED check
  elif [ -z "$dev" ] || [ "$(printf '%s' "$dev" | lower)" = none ]; then
    echo "BAD      merge: auto needs a dev branch (name it in backticks in the \`dev branch\` row)"; problems=$((problems+1))
  elif [ "$dev" = "$(first_tick "$(row_cell base)")" ]; then
    echo "BAD      dev branch: \`$dev\` is the base, the loop never merges into it by itself"; problems=$((problems+1))
  elif ticks "$(row_cell 'never push / check out to edit')" | grep -qxF -- "$dev"; then
    echo "BAD      dev branch: \`$dev\` is a branch the loop never touches"; problems=$((problems+1))
  else
    repo="$(git -C "$(dirname "$profile")" rev-parse --show-toplevel 2>/dev/null)"
    if [ -z "$repo" ]; then
      echo "BAD      dev branch: cannot check origin, the profile is not inside a git repo"; problems=$((problems+1))
    else
      GIT_TERMINAL_PROMPT=0 git -C "$repo" ls-remote --exit-code --heads origin "refs/heads/$dev" >/dev/null 2>&1
      case $? in
        0) ;;
        2) echo "BAD      dev branch: \`$dev\` is not on origin"; problems=$((problems+1)) ;;
        *) echo "BAD      dev branch: cannot check origin for \`$dev\` (git ls-remote failed)"; problems=$((problems+1)) ;;
      esac
    fi
  fi
fi

left="$(grep -c '{{' "$profile" || true)"
if [ "$left" -gt 0 ]; then
  echo "UNFILLED $left line(s) still hold a {{…}} placeholder:"; grep -n '{{' "$profile" | cut -c1-120
  problems=$((problems+1))
fi

if [ "$problems" -eq 0 ]; then echo "doctor: profile OK ($profile)"; else echo "doctor: $problems problem(s) in $profile"; fi
[ "$problems" -eq 0 ]
