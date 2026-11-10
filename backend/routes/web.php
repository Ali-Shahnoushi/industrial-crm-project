<?php

use Illuminate\Support\Facades\Route;

// React SPA serves the web UI; if index.html exists in public_path() (cPanel/LiteSpeed fallback), serve it cleanly.
Route::get('/', function () {
    $spaIndex = public_path('index.html');
    if (is_file($spaIndex)) {
        return response()->file($spaIndex, ['Content-Type' => 'text/html; charset=UTF-8']);
    }
    abort(404);
});

Route::fallback(function (\Illuminate\Http\Request $request) {
    if (
        !$request->is('api', 'api/*', 'admin', 'admin/*', 'livewire', 'livewire/*', 'filament', 'filament/*', 'docs', 'docs/*', 'storage', 'storage/*') &&
        is_file($spaIndex = public_path('index.html'))
    ) {
        return response()->file($spaIndex, ['Content-Type' => 'text/html; charset=UTF-8']);
    }
    abort(404);
});
