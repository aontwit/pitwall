#!/usr/bin/env bash
# Prints one line when a newer pitwall release is on GitHub; silent when up to date, offline or without gh.
# Run: bash update-check.sh · PITWALL_LATEST=<tag> skips the gh call (tests)
plugin="$(cd "$(dirname "$0")/../../.." && pwd)"
cur="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$plugin/.claude-plugin/plugin.json")"
latest="${PITWALL_LATEST:-$(gh release view --repo aontwit/pitwall --json tagName -q .tagName 2>/dev/null)}"
latest="${latest#v}"
[ -n "$cur" ] && [ -n "$latest" ] || exit 0
key() { IFS=. read -r a b c <<<"$1"; printf '%05d%05d%05d' "${a:-0}" "${b:-0}" "${c:-0}"; }
if [[ "$(key "$latest")" > "$(key "$cur")" ]]; then
  echo "pitwall $latest is out (installed: $cur) · update: claude plugin marketplace update pitwall && claude plugin update pitwall@pitwall, then restart Claude Code · notes: https://github.com/aontwit/pitwall/releases/tag/v$latest"
fi
exit 0
