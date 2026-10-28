#!/bin/bash
set -e

echo "Starting CRM Backend Service..."

# Ensure storage and cache directories exist and are writable
mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache
chmod -R 777 storage bootstrap/cache

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

if [ ! -d "vendor" ] || [ ! -f "vendor/autoload.php" ]; then
    echo "Running composer install..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

if ! grep -q "^APP_KEY=base64:" .env; then
    echo "Generating Application Key..."
    php artisan key:generate --force
fi

echo "Waiting for PostgreSQL ($DB_HOST:$DB_PORT) to be ready..."
until nc -z -v -w30 "$DB_HOST" "$DB_PORT"; do
    echo "Waiting for database connection..."
    sleep 2
done
echo "PostgreSQL is ready!"

echo "Running migrations..."
php artisan migrate --force

echo "Running initial seeders (Permissions & Admin user)..."
php artisan db:seed --force

echo "CRM Backend initialized successfully."

exec "$@"
