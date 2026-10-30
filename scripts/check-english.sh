#!/usr/bin/env bash
# English only: fails on Thai text in tracked files, or in a commit message (--msg <file>).
# Allowed: skill frontmatter `description:` lines (Thai trigger phrases route Thai requests)
# tests/ + plugin/evals/ (Thai user input is test data), and the docs site's Thai translation
# (site/src/i18n/th/, site/src/content/th/). Run: scripts/check-english.sh [--msg <file>]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
thai=$'\xe0[\xb8\xb9]'   # UTF-8 lead bytes of the Thai block U+0E00–U+0E7F

if [ "${1:-}" = "--msg" ]; then
  if grep -v '^#' "$2" | LC_ALL=C grep -qE "$thai"; then
    echo "check-english: commit message must be English" >&2; exit 1
  fi
  exit 0
fi

# -I: binaries (models, wasm) hold Thai lead bytes by chance; under LC_ALL=C only files with NUL bytes count as binary
hits="$(git ls-files -z --cached --others --exclude-standard -- ':!tests/' ':!plugin/evals/' ':!site/src/i18n/th/' ':!site/src/content/th/' \
  | xargs -0 env LC_ALL=C grep -nIE "$thai" -- 2>/dev/null \
  | LC_ALL=C grep -vE '^[^:]+:[0-9]+:description: ' || true)"
if [ -n "$hits" ]; then
  printf '%s\n' "$hits" | cut -c1-160
  echo "check-english: Thai outside skill descriptions / tests / the site's Thai translation" >&2
  exit 1
fi
echo "check-english: clean"
