import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devPort = Number(env.VITE_DEV_SERVER_PORT || 5173);

    return {
        server: {
            host: env.VITE_DEV_SERVER_HOST || 'localhost',
            port: devPort,
            // Si 5173 está ocupado, prueba 5174, 5175… (evita “Port already in use”).
            strictPort: false,
            cors: true,
            hmr: {
                host: env.VITE_DEV_SERVER_HOST || 'localhost',
            },
        },
        plugins: [
            // reactRefreshHost vacío → `/@react-refresh` relativo al propio Vite (válido si el puerto cambia).
            react(mode === 'development' ? { reactRefreshHost: '' } : {}),
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                ssr: 'resources/js/ssr.tsx',
                refresh: true,
            }),
            tailwindcss(),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'resources/js'),
                ziggy: path.resolve(__dirname, 'vendor/tightenco/ziggy'),
            },
        },
    };
});
