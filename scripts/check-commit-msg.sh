#!/usr/bin/env bash
# Commit message rules: `type(scope): summary`, English only, no co-author trailer.
#   check-commit-msg.sh <message file>     (commit-msg hook)
#   check-commit-msg.sh --all              (every commit on HEAD, for CI)
# ponytail: --all walks the whole history; a range (origin/main..HEAD) once the repo is large
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
types='feat|fix|refactor|test|chore|docs'

check() { # $1 = file holding one message, $2 = label
  local subject; subject="$(grep -v '^#' "$1" | head -1)"
  local bad=0
  [[ "$subject" =~ ^($types)\([a-z0-9-]+\):\ [^[:space:]] ]] || { echo "$2: subject must be 'type(scope): summary' (type: ${types//|/, }) — got: $subject" >&2; bad=1; }
  if grep -v '^#' "$1" | grep -qi '^co-authored-by:'; then echo "$2: no Co-Authored-By trailer" >&2; bad=1; fi
  bash scripts/check-english.sh --msg "$1" 2>/dev/null || { echo "$2: message must be English" >&2; bad=1; }
  return $bad
}

if [ "${1:-}" = "--all" ]; then
  tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT; fail=0
  for c in $(git rev-list HEAD); do
    [ "$(git rev-list --parents -n1 "$c" | wc -w)" -gt 2 ] && continue   # merge commits keep git's own message
    git log -1 --format=%B "$c" > "$tmp"; check "$tmp" "${c:0:7}" || fail=1
  done
  [ "$fail" -eq 0 ] && echo "check-commit-msg: all commits OK"; exit "$fail"
fi
# A merge commit keeps git's own message, as --all skips it
[ -f "$(git rev-parse --git-path MERGE_HEAD)" ] && exit 0
check "$1" "commit message"
