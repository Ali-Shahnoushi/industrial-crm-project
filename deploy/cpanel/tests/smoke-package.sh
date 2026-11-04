#!/usr/bin/env bash
# Real PHP/Laravel smoke test of extracted ZIPs. Requires pdo_sqlite by default.
# MySQL mode is for a disposable CI database ONLY: CPANEL_SMOKE_MYSQL=1 DB_DATABASE=crm_test ...
set -Eeuo pipefail
DIR="${1:?Usage: bash smoke-package.sh RELEASE_DIRECTORY}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$HERE/../verify-package.sh" "$DIR"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/crm-smoke.XXXXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PRIVATE="$WORK/private app"
PUBLIC="$WORK/domain public"
mkdir -p "$PRIVATE" "$PUBLIC"
unzip -q "$DIR/cpanel-private.zip" -d "$PRIVATE"
unzip -q "$DIR/cpanel-public.zip" -d "$PUBLIC"
export APP_ENV=testing APP_DEBUG=false APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
export APP_URL=https://example.test APP_PUBLIC_PATH="$PUBLIC"
export APP_CONFIG_CACHE="$PRIVATE/bootstrap/cache/config.php"
export APP_ROUTES_CACHE="$PRIVATE/bootstrap/cache/routes-v7.php"
export CACHE_STORE=file SESSION_DRIVER=file QUEUE_CONNECTION=sync LOG_CHANNEL=stderr
export CPANEL_INSTALL_PENDING=true
if [[ "${CPANEL_SMOKE_MYSQL:-0}" == 1 ]]; then
  [[ "${DB_DATABASE:-}" == *_test ]] || { echo 'Refusing MySQL smoke test: DB_DATABASE must end in _test and be disposable.' >&2; exit 1; }
  export DB_CONNECTION=mysql
else
  export DB_CONNECTION=sqlite DB_DATABASE="$WORK/test.sqlite"
  touch "$DB_DATABASE"
fi
php "$HERE/smoke-package.php" "$PRIVATE" "$PUBLIC"
