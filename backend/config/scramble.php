<?php

return [
    /*
     * Your API path. By default, all routes starting with this path will be added to the docs.
     */
    'api_path' => 'api/v1',

    'api_domain' => null,

    /*
     * The title and info of the API.
     */
    'info' => [
        'version' => '2.1.0',
        'title' => 'سامانه مدیریت مشتریان و دستگاه‌های صنعتی (Industrial Devices CRM API)',
        'description' => 'مستندات کامل اندپوئینت‌های احراز هویت، مدیریت مشتریان، کاتالوگ دستگاه‌ها، کنترل موجودی انبار، تخصیص شماره سریال، سوابق سرویس و پیامک‌های الگو.',
    ],

    /*
     * Customize Scramble UI.
     */
    'ui' => [
        'title' => 'Industrial CRM v2.1.0 - OpenAPI Documentation',
        'theme' => 'light',
        'hide_try_it' => false,
    ],

    'servers' => [
        'Local API Server' => 'http://localhost:8000/api/v1',
    ],

    'middleware' => [
        'web',
    ],
];
