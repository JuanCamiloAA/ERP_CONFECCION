import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { PermissionsProvider } from './contexts/PermissionsContext';

const appName = (import.meta.env.VITE_APP_NAME as string) || 'MiTallerCol';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ) as never,
    setup({ el, App, props }) {
        /** PermissionsProvider usa usePage(); debe ir DENTRO de <App> donde Inertia provee PageContext. */
        const tree = (
            <App {...props}>
                {({ Component, key, props: pageProps }) => (
                    <PermissionsProvider>
                        <Component key={key} {...pageProps} />
                        <Toaster
                            position="top-right"
                            richColors
                            closeButton
                            toastOptions={{
                                classNames: {
                                    toast: 'rounded-lg shadow-lg',
                                },
                            }}
                        />
                    </PermissionsProvider>
                )}
            </App>
        );

        if (import.meta.env.SSR) {
            hydrateRoot(el, tree);
            return;
        }

        createRoot(el).render(tree);
    },
    progress: {
        color: '#4f46e5',
        showSpinner: true,
    },
});
