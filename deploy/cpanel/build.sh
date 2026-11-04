#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  🏭 Industrial CRM — ساخت پکیج آماده استقرار cPanel
#
#  خروجی:  cpanel-release/cpanel-{public,private}.zip   (برنامه کامل + نصب‌کننده وب)
#
#  استفاده (از ریشه ریپو):
#     bash deploy/cpanel/build.sh
#
#  پیش‌نیاز: PHP 8.2+ , Composer , Node 22.12+ , npm , zip
#  (این اسکریپت داخل GitHub Actions هم اجرا می‌شود)
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
DEPLOY="$ROOT/deploy/cpanel"
OUT_DIR="${CPANEL_OUT_DIR:-$ROOT/cpanel-release}"
STAGE="$(mktemp -d)"


# composer scripts (package:discover) به .env نیاز دارند؛ اگر نبود موقتاً می‌سازیم
TMP_ENV=0
if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  TMP_ENV=1
fi
restore_env() {
  if [ "$TMP_ENV" = "1" ] && [ -f "$BACKEND/.env" ]; then rm -f "$BACKEND/.env"; fi
}
trap 'restore_env; rm -rf "$STAGE"' EXIT

echo "==> 1/7 Installing backend dependencies (composer --no-dev)"
composer install --no-dev --optimize-autoloader --no-interaction --working-dir="$BACKEND" --quiet

echo "==> 2/7 Building frontend (vite)"
(cd "$FRONTEND" && npm ci --no-audit --no-fund --loglevel=error && npm run build)

echo "==> 3/7 Staging application files"
mkdir -p "$STAGE"
(cd "$BACKEND" && cp -a . "$STAGE/")
# پاکسازی موارد غیرضروری برای استقرار
rm -rf "$STAGE/.env" \
       "$STAGE/.git" \
       "$STAGE/node_modules" \
       "$STAGE/database/database.sqlite" \
       "$STAGE/Dockerfile" \
       "$STAGE/docker-entrypoint.sh"
# Never ship machine-specific bootstrap caches or a development hot marker.
rm -f "$STAGE/bootstrap/cache/"*.php "$STAGE/public/hot"
rm -f "$STAGE/storage/installed.lock" "$STAGE/storage/install.mutex"
rm -f  "$STAGE/storage/logs/"*.log 2>/dev/null || true
find "$STAGE/storage/framework/sessions" "$STAGE/storage/framework/cache/data" "$STAGE/storage/framework/views" -type f ! -name '.gitignore' -delete 2>/dev/null || true

echo "==> 4/7 Injecting SPA build + cPanel deployment files"
# خروجی فرانت‌اند (SPA)
rm -rf "$STAGE/public/assets" "$STAGE/public/index.html" "$STAGE/public/favicon.svg" "$STAGE/public/icons.svg"
cp -r "$FRONTEND/dist/." "$STAGE/public/"
# htaccess مسیریابی SPA + API
cp "$DEPLOY/htaccess/public.htaccess" "$STAGE/public/.htaccess"
# htaccess ریشه (برای نصب داخل public_html) — با پسوند غیرفعال
cp "$DEPLOY/htaccess/root.htaccess" "$STAGE/_cpanel-root-htaccess.txt"
# نصب‌کننده وب + به‌روزرسان دیتابیس + بررسی سلامت
cp "$DEPLOY/install.php" "$DEPLOY/update.php" "$DEPLOY/setup-check.php" "$STAGE/public/"
# پوشه آپلودها (بدون نیاز به symlink)
mkdir -p "$STAGE/public/storage"
touch "$STAGE/public/storage/.gitkeep"
# راهنمای سریع
cp "$DEPLOY/README.md" "$STAGE/README-FIRST-cpanel.txt"

echo "==> 5/7 Writing .env.cpanel.example with fresh APP_KEY"
APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
sed "s|__GENERATED_AT_BUILD__|$APP_KEY|" "$DEPLOY/env.cpanel.example" > "$STAGE/.env.cpanel.example"

echo "==> 6/7 Zipping"
# Separate archives: public contents go to the domain document root, private elsewhere.
# Deliberately require an explicit path rather than guessing a private location.
printf "<?php\nreturn '/home/CPANEL_USER/private_pro/project1/myc';\n" > "$STAGE/public/private-path.php"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/cpanel-app.zip" "$OUT_DIR/cpanel-public.zip" "$OUT_DIR/cpanel-private.zip"
(cd "$STAGE/public" && zip -qr "$OUT_DIR/cpanel-public.zip" .)
rm -rf "$STAGE/public"
printf 'Require all denied\n' > "$STAGE/.htaccess"
(cd "$STAGE" && zip -qr "$OUT_DIR/cpanel-private.zip" .)

echo "==> 7/7 Done"
echo ""
echo "Built: $OUT_DIR/cpanel-public.zip + $OUT_DIR/cpanel-private.zip"
echo "   ℹ️  برای ساخت crm-database.sql (روش نصب دستی) راهنمای deploy/cpanel/README.md را ببین."
