<?php

return [

    'ssr' => [

        'enabled' => (bool) env('INERTIA_SSR_ENABLED', false),

        'url' => env('INERTIA_SSR_URL', 'http://127.0.0.1:13714'),

        'ensure_bundle_exists' => (bool) env('INERTIA_SSR_ENSURE_BUNDLE_EXISTS', true),

    ],

    'ensure_pages_exist' => false,

    'page_paths' => [
        resource_path('js/Pages'),
    ],

    'page_extensions' => [
        'js', 'jsx', 'svelte', 'ts', 'tsx', 'vue',
    ],

    /**
     * Obligatorio con @inertiajs/react v2+: el cliente lee la página inicial desde
     * <script data-page="app" type="application/json">, no desde data-page en el div.
     */
    'use_script_element_for_initial_page' => (bool) env('INERTIA_USE_SCRIPT_ELEMENT_FOR_INITIAL_PAGE', true),

    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => [resource_path('js/Pages')],
        'page_extensions' => ['js', 'jsx', 'svelte', 'ts', 'tsx', 'vue'],
    ],

    'history' => [
        'encrypt' => (bool) env('INERTIA_ENCRYPT_HISTORY', false),
    ],

];
