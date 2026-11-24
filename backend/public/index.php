<?php

use Illuminate\Http\Request;

// Prevent PHP 8.5+ deprecation notices during early config bootstrap from corrupting JSON API responses
@ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

define('LARAVEL_START', microtime(true));

$baseDir = require __DIR__.'/resolve-private.php';

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $baseDir.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require $baseDir.'/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
(require_once $baseDir.'/bootstrap/app.php')
    ->handleRequest(Request::capture());
