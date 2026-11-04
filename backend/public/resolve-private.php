<?php
// Shared by the front controller and cPanel maintenance tools. Never use request input.
$privatePath = require __DIR__.'/private-path.php';
$privatePath = is_string($privatePath) ? realpath($privatePath) : false;
if (!$privatePath || !is_file($privatePath.'/bootstrap/app.php')) {
    http_response_code(503);
    exit('Private application path is invalid. Configure private-path.php in the public directory.');
}
$_SERVER['APP_PUBLIC_PATH'] = __DIR__;
// $_SERVER is sufficient; putenv may be disabled on shared hosting.
return $privatePath;
