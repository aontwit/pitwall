#!/usr/bin/env bash
# Shared scaffold: a small git repo with a filled pitwall profile and one real bug,
# so routing is not cut short by "no profile" or "nothing to work on"
set -e
here="$(cd "$(dirname "$0")" && pwd)"
git init -q -b main && git config user.email eval@example.com && git config user.name eval
mkdir -p .claude src tests
sed -e 's/{{base}}/main/g' -e 's/{{repo name}}/shop/' -e 's/{{test command}}/node --test tests\//' \
    -e 's/{{language}}/English/g' -e 's/{{[^}]*}}/none/g' \
    "$here/../skills/pitwall/templates/agent-loop.md" > .claude/agent-loop.md
cat > src/search.js <<'JS'
// Sorts search results for the search page. "price" should sort low → high.
export const sortResults = (items, by) =>
  by === "price" ? [...items].sort((a, b) => a.price > b.price) : items;
JS
printf '{ "name": "shop", "type": "module", "scripts": { "test": "node --test tests/" } }\n' > package.json
git add -A && git commit -qm init
