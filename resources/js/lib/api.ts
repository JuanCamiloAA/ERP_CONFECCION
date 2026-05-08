import { router } from '@inertiajs/react';
import type { VisitOptions } from '@inertiajs/core';
import { toast } from 'sonner';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ApiOptions extends Omit<VisitOptions, 'method' | 'data'> {
    silent?: boolean;
    successMessage?: string;
    errorMessage?: string;
}

function send(method: Method, url: string, data?: Record<string, unknown> | FormData, options: ApiOptions = {}): void {
    const { silent, successMessage, errorMessage, onSuccess, onError, ...rest } = options;

    router.visit(url, {
        method,
        data: data as never,
        preserveScroll: true,
        ...rest,
        onSuccess: (page) => {
            if (!silent && successMessage) {
                toast.success(successMessage);
            }
            onSuccess?.(page);
        },
        onError: (errors) => {
            if (!silent) {
                const first = Object.values(errors)[0];
                toast.error(errorMessage ?? (typeof first === 'string' ? first : 'Ocurrio un error.'));
            }
            onError?.(errors);
        },
    });
}

export const api = {
    get: (url: string, options?: ApiOptions) => send('get', url, undefined, options),
    post: (url: string, data?: Record<string, unknown> | FormData, options?: ApiOptions) => send('post', url, data, options),
    put: (url: string, data?: Record<string, unknown> | FormData, options?: ApiOptions) => send('put', url, data, options),
    patch: (url: string, data?: Record<string, unknown> | FormData, options?: ApiOptions) => send('patch', url, data, options),
    delete: (url: string, options?: ApiOptions) => send('delete', url, undefined, options),
};
