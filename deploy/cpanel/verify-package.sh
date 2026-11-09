#!/usr/bin/env bash
# Check the contents of the actual ZIPs without extracting or requiring PHP.
set -Eeuo pipefail
DIR="${1:?Usage: bash verify-package.sh RELEASE_DIRECTORY}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
for kind in public private; do
  unzip -tq "$DIR/cpanel-$kind.zip" >/dev/null
  unzip -Z -1 "$DIR/cpanel-$kind.zip" > "$WORK/$kind.list"
  # Do not allow zip-slip paths, absolute paths or Windows path separators.
  if grep -Eq '(^/|(^|/)\.\.(/|$)|\\)' "$WORK/$kind.list"; then
    echo "Unsafe archive path in $kind package" >&2; exit 1
  fi
  # Match active/backup env files, never the deliberately included example file.
  if grep -E '(^|/)(\.env($|\.)|auth\.json$|hot$|installed\.lock$|install\.mutex$)|\.(sqlite|sqlite3|sql|pem|key|log)$|(^|/)(node_modules|\.git)/' "$WORK/$kind.list" | grep -v '^\.env\.cpanel\.example$'; then
    echo "Sensitive/runtime file in $kind package" >&2; exit 1
  fi
done
for file in index.php index.html .htaccess resolve-private.php private-path.php install.php update.php setup-check.php; do
  grep -Fxq "$file" "$WORK/public.list" || { echo "Missing public file: $file" >&2; exit 1; }
done
for file in vendor/autoload.php bootstrap/app.php artisan .htaccess .env.cpanel.example; do
  grep -Fxq "$file" "$WORK/private.list" || { echo "Missing private file: $file" >&2; exit 1; }
done
if grep -Eq '^(app|bootstrap|config|database|vendor)/' "$WORK/public.list"; then
  echo 'Private application files in public ZIP' >&2; exit 1
fi
if grep -q '^public/' "$WORK/private.list"; then
  echo 'Unexpected public tree in private ZIP' >&2; exit 1
fi
for prefix in assets/; do
  grep -q "^$prefix" "$WORK/public.list" || { echo "Missing assets: $prefix" >&2; exit 1; }
done
if grep -Eq '^(css/filament|js/filament|vendor/livewire)/' "$WORK/public.list"; then
  echo 'Disabled Filament/Livewire assets must not be shipped in public ZIP' >&2; exit 1
fi
# Runtime directories must exist, but must contain no user data.
for prefix in storage/framework/cache/data/ storage/framework/sessions/ storage/framework/views/ storage/logs/; do
  grep -Fxq "$prefix" "$WORK/private.list" || { echo "Missing runtime directory: $prefix" >&2; exit 1; }
done
if grep '^storage/.*[^/]$' "$WORK/private.list"; then
  echo 'Private runtime files must not be shipped' >&2; exit 1
fi
if grep '^storage/.*[^/]$' "$WORK/public.list"; then
  echo 'Public uploads must not be shipped' >&2; exit 1
fi
echo 'Package layout and sensitive-file checks passed.'
