import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { route } from 'ziggy-js';
import { PermissionsProvider } from './contexts/PermissionsContext';

const appName = (import.meta.env.VITE_APP_NAME as string) || 'Taller Confeccion';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} | ${appName}` : appName),
        resolve: (name) =>
            resolvePageComponent(
                `./Pages/${name}.tsx`,
                import.meta.glob('./Pages/**/*.tsx'),
            ) as never,
        setup: ({ App, props }) => {
            (globalThis as any).route = (...args: any[]) => {
                const [name, params, absolute] = args;
                return route(name, params, absolute, {
                    ...(page.props as any).ziggy,
                    location: new URL((page.props as any).ziggy.location),
                });
            };
            return (
                <App {...props}>
                    {({ Component, key, props: pageProps }) => (
                        <PermissionsProvider>
                            <Component key={key} {...pageProps} />
                        </PermissionsProvider>
                    )}
                </App>
            );
        },
    }),
);
