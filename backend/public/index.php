<?php

use Illuminate\Http\Request;

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
