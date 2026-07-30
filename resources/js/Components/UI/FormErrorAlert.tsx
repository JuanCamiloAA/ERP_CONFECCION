import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

type ErrorBag = Partial<Record<string, string | string[] | undefined>>;

function firstMessage(value: string | string[] | undefined): string | undefined {
    if (value == null) {
        return undefined;
    }

    return Array.isArray(value) ? value[0] : value;
}

/**
 * Devuelve los mensajes de validacion que ningun campo del formulario puede mostrar
 * (por ejemplo `company_id` cuando el super admin no tiene empresa activa).
 */
export function collectUnmappedErrors(errors: ErrorBag, fieldKeys: Iterable<string>, ignore: string[] = []): string[] {
    const known = new Set([...fieldKeys, ...ignore]);

    return Object.entries(errors)
        .filter(([key]) => !known.has(key))
        .map(([, value]) => firstMessage(value))
        .filter((message): message is string => Boolean(message));
}

interface Props {
    messages: string[];
    title?: string;
}

export function FormErrorAlert({ messages, title = 'No se pudo guardar' }: Props) {
    if (messages.length === 0) {
        return null;
    }

    return (
        <div
            role="alert"
            className="flex gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-700/80 dark:bg-rose-950/40 dark:text-rose-100"
        >
            <ExclamationCircleIcon className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            <div className="min-w-0 space-y-1">
                <p className="font-semibold">{title}</p>
                {messages.map((message) => (
                    <p key={message}>{message}</p>
                ))}
            </div>
        </div>
    );
}

export default FormErrorAlert;
