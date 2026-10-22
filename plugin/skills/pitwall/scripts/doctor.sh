#!/usr/bin/env bash
# Checks a repo's pitwall profile against the "Profile contract" table in ../SKILL.md.
#   doctor.sh [profile]   (default: .claude/agent-loop.md in the current repo)
# Exit 0 = every required section present · 1 = sections missing / bad tracker, parallel, port or merge value, or a dev branch that does not fit `merge: auto` · 3 = no profile
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

# `merge: human | auto` (missing = human) · read only in the git section, and only where a value starts: at the start of a
# line, of a backtick or of a table cell — so `pre-merge: x` in a hooks row is no value · exactly one value is allowed
merge_values() {
  section git | grep -oE '(^|[`|]) *merge: *`? *[^[:space:]`|,;)]*' | sed -E 's/^[`| ]*//'
}
merge_all="$(merge_values)"
merge_n="$(printf '%s\n' "$merge_all" | grep -c . || true)"
merge_val=""
while IFS= read -r tok; do
  [ -n "$tok" ] || continue
  merge_val="$(clean_value "$tok")"
  [[ "$merge_val" == '{{'* ]] && continue
  printf '%s' "$merge_val" | grep -qE '^(human|auto)$' || { echo "BAD      merge: must be \`merge: human\` or \`merge: auto\` (missing = human) (got \`merge: $merge_val\`)"; problems=$((problems+1)); }
done <<< "$merge_all"
if [ "$merge_n" -gt 1 ]; then
  echo "BAD      merge: $merge_n values in the git section, keep exactly one (got: $(printf '%s' "$merge_all" | paste -sd' ' -))"; problems=$((problems+1))
fi

# `merge: auto` fits only a repo whose base is the dev branch (git-flow): PRs already target it, the loop merges into it, and
# dev → main / release stays with a person · so the `dev branch` row must name, in backticks, the base itself: not `none`, not
# main / master / release* / prod*, a valid branch name with no glob characters, and exactly that ref on origin
# `human` (or no row) has nothing to check · a row that cannot be read is BAD, never skipped
row_cell() { # <row label> → the value cell of that row of the git table
  local row cell
  row="$(section git | grep -E "^\| *$1 *\|" | head -n 1)"
  cell="${row#*|}"; cell="${cell#*|}"; printf '%s' "${cell%%|*}"
}
ticks() { printf '%s\n' "$1" | grep -oE '`[^`]*`' | tr -d '`' | sed -E 's/^ +//; s/ +$//'; }  # every backticked token
first_tick() { ticks "$1" | head -n 1; }
bad_ref_name() { # <name> → 0 when it is no usable branch name, with the reason on stdout
  case "$1" in
    *'*'*|*'?'*|*'['*|*'\'*) echo "has glob characters"; return 0 ;;
    -*|*'@{'*) echo "is not a plain branch name"; return 0 ;;
  esac
  git check-ref-format --branch "$1" >/dev/null 2>&1 || { echo "is not a valid branch name"; return 0; }
  return 1
}
if [ "$merge_n" -eq 1 ] && [ "$merge_val" = auto ]; then
  base_cell="$(row_cell base)"; dev_cell="$(row_cell 'dev branch')"
  base="$(first_tick "$base_cell")"; dev="$(first_tick "$dev_cell")"
  if [[ "$base_cell" == *'{{'* || "$dev_cell" == *'{{'* ]]; then
    :  # a placeholder is left to the UNFILLED check
  elif [ -z "$base" ]; then
    echo "BAD      merge: auto needs the base: name it in backticks in the \`base\` row of the git table (the row is missing or unreadable)"; problems=$((problems+1))
  elif [ -z "$dev" ] || [ "$(printf '%s' "$dev" | lower)" = none ]; then
    echo "BAD      merge: auto needs a dev branch (name it in backticks in the \`dev branch\` row)"; problems=$((problems+1))
  elif why="$(bad_ref_name "$dev")"; then
    echo "BAD      dev branch: \`$dev\` $why"; problems=$((problems+1))
  elif [ "$dev" != "$base" ]; then
    echo "BAD      dev branch: \`$dev\` is not the base \`$base\`: \`merge: auto\` fits only a repo whose base is the dev branch"; problems=$((problems+1))
  else
    case "$(printf '%s' "$dev" | lower)" in
      main|master|release*|prod*)
        echo "BAD      dev branch: \`$dev\` looks like the main or a release line: the loop never merges into it by itself"; problems=$((problems+1)) ;;
      *)
        repo="$(git -C "$(dirname "$profile")" rev-parse --show-toplevel 2>/dev/null)"
        if [ -z "$repo" ]; then
          echo "BAD      dev branch: cannot check origin, the profile is not inside a git repo"; problems=$((problems+1))
        else
          # never prompt (no password, no ssh passphrase) · compare the returned ref name whole, not as a pattern
          if heads="$(GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -o BatchMode=yes" git -C "$repo" ls-remote --heads origin "refs/heads/$dev" 2>/dev/null)"; then
            printf '%s\n' "$heads" | cut -f2 | grep -qxF -- "refs/heads/$dev" || { echo "BAD      dev branch: \`$dev\` is not on origin"; problems=$((problems+1)); }
          else
            echo "BAD      dev branch: cannot check origin for \`$dev\` (git ls-remote failed)"; problems=$((problems+1))
          fi
        fi ;;
    esac
  fi
fi

left="$(grep -c '{{' "$profile" || true)"
if [ "$left" -gt 0 ]; then
  echo "UNFILLED $left line(s) still hold a {{…}} placeholder:"; grep -n '{{' "$profile" | cut -c1-120
  problems=$((problems+1))
fi

if [ "$problems" -eq 0 ]; then echo "doctor: profile OK ($profile)"; else echo "doctor: $problems problem(s) in $profile"; fi
[ "$problems" -eq 0 ]
