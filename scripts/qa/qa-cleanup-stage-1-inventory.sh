#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

print_section() {
  printf '\n## %s\n' "$1"
}

count_files() {
  local target="$1"
  if [ -d "$target" ]; then
    find "$target" -type f 2>/dev/null | wc -l | tr -d ' '
  else
    printf '0'
  fi
}

print_section "Cleanup stage 1 inventory"
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Generated at: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

print_section "Top-level file counts"
for target in backend frontend ai-engine agent database docs scripts qa-results deploy; do
  printf '%-12s %s\n' "$target" "$(count_files "$target")"
done

print_section "Backend route files"
if [ -d backend/src/routes ]; then
  find backend/src/routes -maxdepth 1 -type f -name '*.js' | sort
else
  printf 'backend/src/routes not found\n'
fi

print_section "Backend route mounts from app.js"
if [ -f backend/src/app.js ]; then
  node <<'NODE'
const fs = require('fs');
const appPath = 'backend/src/app.js';
const text = fs.readFileSync(appPath, 'utf8');
const requires = [...text.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g)]
  .map((match) => ({ name: match[1], file: `backend/src/routes/${match[2]}.js` }));
const mounts = [...text.matchAll(/app\.use\(['"]([^'"]+)['"],\s*([^\n;]+)\)/g)]
  .map((match) => ({ base: match[1], args: match[2] }));

for (const route of requires) {
  const identifier = new RegExp(`\\b${route.name}\\b`);
  const routeMounts = mounts
    .filter((mount) => identifier.test(mount.args))
    .map((mount) => mount.base);
  console.log(`${route.file}|${routeMounts.length ? routeMounts.join(',') : 'NOT_MOUNTED'}`);
}
NODE
fi

print_section "Backend route files not mounted by app.js require scan"
if [ -f backend/src/app.js ] && [ -d backend/src/routes ]; then
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const appText = fs.readFileSync('backend/src/app.js', 'utf8');
const mountedFiles = new Set([...appText.matchAll(/require\(['"]\.\/routes\/([^'"]+)['"]\)/g)]
  .map((match) => `backend/src/routes/${match[1]}.js`));
const routeFiles = fs.readdirSync('backend/src/routes')
  .filter((name) => name.endsWith('.js'))
  .map((name) => `backend/src/routes/${name}`)
  .sort();
for (const file of routeFiles) {
  if (!mountedFiles.has(file)) console.log(file);
}
NODE
fi

print_section "Frontend app pages"
if [ -d frontend/src/app ]; then
  find frontend/src/app -path '*/page.tsx' -type f | sort | sed 's#^frontend/src/app##; s#/page.tsx$##; s#^$#/#'
else
  printf 'frontend/src/app not found\n'
fi

print_section "Sidebar/AppLayout route references"
if command -v rg >/dev/null 2>&1; then
  rg -n "CLIENT_MVP_NAV_ITEMS|INTERNAL_CLIENT_HIDDEN_ROUTES|PLATFORM_ROUTES|DEALER_ROUTES|href:|href=|router\.push" \
    frontend/src/components/Sidebar.tsx \
    frontend/src/components/AppLayout.tsx \
    frontend/src/utils/mvpPermissions.ts 2>/dev/null || true
else
  grep -RInE "CLIENT_MVP_NAV_ITEMS|INTERNAL_CLIENT_HIDDEN_ROUTES|PLATFORM_ROUTES|DEALER_ROUTES|href:|href=|router\.push" \
    frontend/src/components/Sidebar.tsx \
    frontend/src/components/AppLayout.tsx \
    frontend/src/utils/mvpPermissions.ts 2>/dev/null || true
fi

print_section "QA results summary"
if [ -d qa-results ]; then
  printf 'qa-results directories: %s\n' "$(find qa-results -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  printf 'qa-results files: %s\n' "$(find qa-results -type f | wc -l | tr -d ' ')"
  find qa-results -mindepth 1 -maxdepth 1 -type d | sort | sed -n '1,80p'
else
  printf 'qa-results not found\n'
fi

print_section "token.txt metadata only"
token_count=0
while IFS= read -r token_file; do
  token_count=$((token_count + 1))
  if stat -f '%z|%Sm' -t '%Y-%m-%dT%H:%M:%S%z' "$token_file" >/tmp/tcdx-token-stat.$$ 2>/dev/null; then
    stat_value="$(cat /tmp/tcdx-token-stat.$$)"
  else
    stat_value="$(stat -c '%s|%y' "$token_file" 2>/dev/null || printf 'unknown|unknown')"
  fi
  if command -v shasum >/dev/null 2>&1; then
    digest="$(shasum -a 256 "$token_file" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    digest="$(sha256sum "$token_file" | awk '{print $1}')"
  else
    digest="sha256-unavailable"
  fi
  printf '%s|%s|sha256=%s\n' "$token_file" "$stat_value" "$digest"
done < <(find . -type f -name 'token.txt' \
  -not -path './backend/node_modules/*' \
  -not -path './frontend/node_modules/*' \
  -not -path './frontend/.next/*' 2>/dev/null | sort)
rm -f /tmp/tcdx-token-stat.$$ 2>/dev/null || true
printf 'token.txt files: %s\n' "$token_count"

print_section ".DS_Store candidates"
find . -type f -name '.DS_Store' \
  -not -path './backend/node_modules/*' \
  -not -path './frontend/node_modules/*' \
  -not -path './frontend/.next/*' 2>/dev/null | sort

print_section "Historical ZIP candidates"
find . -type f -name '*.zip' \
  -not -path './backend/node_modules/*' \
  -not -path './frontend/node_modules/*' \
  -not -path './frontend/.next/*' 2>/dev/null | sort

print_section "SQL with destructive keywords"
if command -v rg >/dev/null 2>&1; then
  rg -n "\b(DROP|DELETE\s+FROM|TRUNCATE)\b" database --glob '*.sql' 2>/dev/null || true
else
  grep -RInE "\b(DROP|DELETE[[:space:]]+FROM|TRUNCATE)\b" database --include='*.sql' 2>/dev/null || true
fi

print_section "Script inventory"
find scripts agent -type f 2>/dev/null | sort

print_section "Done"
printf 'Inventory completed without deleting, moving, running SQL, or reading token contents.\n'
