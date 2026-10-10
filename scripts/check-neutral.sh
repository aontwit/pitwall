#!/usr/bin/env bash
# Fails when a tracked (or staged) file contains a word from the deny list.
# Deny list: .neutral-deny (one or more case-insensitive regex lines, gitignored)
# or $NEUTRAL_DENY (CI secret, same format). Run: scripts/check-neutral.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
deny="${NEUTRAL_DENY:-}"
[ -z "$deny" ] && [ -f .neutral-deny ] && deny="$(cat .neutral-deny)"
[ -z "$deny" ] && { echo "check-neutral: no deny list (.neutral-deny or NEUTRAL_DENY)" >&2; exit 2; }
pattern="$(printf '%s\n' "$deny" | grep -v '^\s*$' | paste -sd'|' -)"
# --cached --others: tracked + new files not ignored, so a file is caught before its first commit
# lockfile integrity hashes are random base64 and hit short patterns by chance; every other lockfile line is still checked
hits="$(git ls-files -z --cached --others --exclude-standard | xargs -0 grep -nIiE "$pattern" -- 2>/dev/null   | grep -vE '^[^:]+:[0-9]+:[[:space:]]*"integrity": "sha(256|384|512)-[A-Za-z0-9+/=]+",?$' || true)"
if [ -n "$hits" ]; then
  printf '%s\n' "$hits"
  echo "check-neutral: $(printf '%s\n' "$hits" | wc -l | tr -d ' ') hit(s)" >&2
  exit 1
fi
echo "check-neutral: clean"
