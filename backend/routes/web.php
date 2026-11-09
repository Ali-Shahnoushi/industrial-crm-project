<?php

use Illuminate\Support\Facades\Route;

// React SPA serves the web UI; root PHP requests without SPA index.html return 404.
Route::get('/', function () {
    abort(404);
});
