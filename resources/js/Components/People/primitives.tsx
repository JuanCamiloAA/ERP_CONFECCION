import { LockSimple } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/**
 * Piezas sueltas que repiten los bloques de la ficha.
 *
 * Viven aparte porque las usan tanto el modo `self` como el modo `admin`, y porque son
 * justo donde se juegan dos reglas del sistema: que un dato restringido se lea como
 * «Restringido» y no como un hueco, y que un dato enmascarado salga en monoespaciada.
 */

/** Fila rotulo / valor. `wide` ocupa las dos columnas de la rejilla. */
export function DataRow({
    label,
    children,
    wide = false,
    mono = false,
}: {
    label: string;
    children: ReactNode;
    wide?: boolean;
    mono?: boolean;
}) {
    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="emp-kicker">{label}</dt>
            <dd
                className={`mt-1 text-[13px] ${mono ? 'font-mono tabular-nums' : ''}`}
                style={{ color: 'var(--emp-text)' }}
            >
                {children}
            </dd>
        </div>
    );
}

/**
 * Dato que existe pero que este usuario no puede ver.
 *
 * Con texto y candado a proposito: un campo vacio se lee como «no hay dato» y manda a
 * alguien a buscar lo que si esta cargado. Decir «Restringido» es informacion, no adorno.
 */
export function Restricted({ label = 'Restringido' }: { label?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--emp-subtle)' }}>
            <LockSimple size={14} weight="bold" aria-hidden="true" />
            <span>{label}</span>
        </span>
    );
}

/** Valor ausente. Distinto de restringido: aqui no hay nada cargado. */
export function Empty() {
    return (
        <span style={{ color: 'var(--emp-faint)' }} aria-label="sin dato">
            —
        </span>
    );
}

/** Cifra de cabecera. Los montos van alineados a la derecha y en tabular. */
export function StatTile({
    label,
    value,
    hint,
    tone = 'plain',
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: 'plain' | 'accent';
}) {
    return (
        <div className="emp-card p-3.5">
            <p className="emp-kicker">{label}</p>
            <p
                className="mt-1.5 text-[20px] tabular-nums"
                style={{ color: tone === 'accent' ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
            >
                {value}
            </p>
            {hint ? (
                <p className="mt-1 text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Barra de progreso contra la meta.
 *
 * El acento es la linea de avance, nunca el fondo: rellenar toda la barra con el color de
 * marca es lo que el sistema prohibe. El valor tambien se escribe al lado, porque el
 * porcentaje no puede depender solo de la longitud de una barra.
 */
export function ProgressBar({
    value,
    goal,
    percent,
    caption,
}: {
    value: number;
    goal: number;
    percent: number | null;
    caption: string;
}) {
    const pct = percent ?? 0;

    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                    {caption}
                </span>
                <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    {value.toLocaleString('es-CO')} / {goal.toLocaleString('es-CO')}
                    {percent !== null ? <span style={{ color: 'var(--emp-subtle)' }}> · {pct}%</span> : null}
                </span>
            </div>
            <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--emp-row)' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={caption}
            >
                <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: 'var(--emp-accent-line)' }}
                />
            </div>
        </div>
    );
}

/** Etiqueta de estado. Siempre con texto: el color acompaña, no informa por si solo. */
export function StatusTag({
    label,
    tone = 'neutral',
}: {
    label: string;
    tone?: 'neutral' | 'accent' | 'warn' | 'ok';
}) {
    if (tone === 'ok') {
        return (
            <span
                className="emp-pill"
                style={{ borderColor: 'color-mix(in srgb, var(--emp-ok) 40%, transparent)', color: 'var(--emp-ok)' }}
            >
                {label}
            </span>
        );
    }

    return <span className={`emp-pill ${tone === 'accent' ? 'emp-pill-accent' : ''} ${tone === 'warn' ? 'emp-pill-warn' : ''}`}>{label}</span>;
}

/** Contenedor de tabla: en móvil desplaza en horizontal, nunca desborda la página. */
export function ScrollTable({ children }: { children: ReactNode }) {
    return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}

/** Vacío de una lista, con el mismo tono en toda la ficha. */
export function EmptyRow({ children, colSpan }: { children: ReactNode; colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="py-6 text-center text-[12.5px]" style={{ color: 'var(--emp-subtle)' }}>
                {children}
            </td>
        </tr>
    );
}
