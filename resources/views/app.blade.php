<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="{{ session('darkMode', 'light') === 'dark' ? 'dark' : '' }}">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title inertia>{{ config('app.name', 'MiTallerPro') }}</title>

    @php($brandFavicon = \App\Support\BrandIcon::url())
    @if($brandFavicon !== '')
        <link rel="icon" type="image/png" href="{{ $brandFavicon }}">
        <link rel="apple-touch-icon" href="{{ $brandFavicon }}">
    @else
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234f46e5'%3E%3Cpath d='M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7 3.5v8.64l-7 3.5-7-3.5V7.68l7-3.5z'/%3E%3C/svg%3E">
    @endif

    {{-- Shim sincrono: los chunks de Vite pueden ejecutarse antes que el script module de @viteReactRefresh (race → "can't detect preamble"). --}}
    <script>
        (function () {
            if (typeof window.$RefreshReg$ === 'undefined') {
                window.$RefreshReg$ = function () {};
            }
            if (typeof window.$RefreshSig$ === 'undefined') {
                window.$RefreshSig$ = function () {
                    return function (type) {
                        return type;
                    };
                };
            }
        })();
    </script>

    <script>
        (function () {
            const stored = localStorage.getItem('theme');
            if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        })();
    </script>

    {{-- Preamble de React Refresh antes de @routes/@vite (evita error "can't detect preamble") --}}
    @viteReactRefresh
    @routes
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="font-sans antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
    @inertia
</body>
</html>
