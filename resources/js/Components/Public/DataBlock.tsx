import { Check } from '@phosphor-icons/react';
import { useState } from 'react';
import { part } from '@/Components/Public/BlockShell';

/**
 * Bloque de datos de la landing publica.
 *
 * No trae contenido propio: pinta las filas que resuelve el servidor desde el origen
 * elegido en el editor (planes, empresas, cifras o una consulta). `rows` llega ya
 * presentado, de modo que aqui solo se decide la forma.
 */

type Dict = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** Lista de textos; acepta tanto cadenas sueltas como objetos {label}. */
const labels = (v: unknown): string[] =>
    Array.isArray(v)
        ? v.map((x) => (typeof x === 'string' ? x : str((x as Dict)?.label))).filter(Boolean)
        : [];

/** Cifra sin decimales: "150.000". */
const money = (v: unknown): string =>
    typeof v === 'number' && Number.isFinite(v) ? new Intl.NumberFormat('es-CO').format(v) : str(v);

/** Precio de un plan: "$ 150.000". */
const price = (v: unknown): string => `$ ${money(v)}`;

/** Periodo de cobro que la persona tenia elegido al pedir el plan. */
export interface PlanCycleChoice {
    id: number;
    name: string;
}

/** Precio de un plan en un periodo, tal como lo calcula el servidor (`MembershipPricing`). */
interface PlanPrice {
    cycle_id: number;
    code: string;
    name: string;
    months: number;
    discount_percent: number;
    price: number | null;
    monthly: number | null;
}

const planPrices = (row: Dict): PlanPrice[] => (Array.isArray(row.prices) ? (row.prices as PlanPrice[]) : []);

interface Props {
    data: Dict;
    rows: Dict[];
    error?: string | null;
    onPlanClick?: (planId: number, planName: string, cycle: PlanCycleChoice | null) => void;
}

export function DataBlock({ data, rows, error, onPlanClick }: Props) {
    const presentation = str(data.presentation, 'cards');
    const cta = str(data.cta_label);

    // Un origen que falla no debe dejar un hueco raro en la pagina: la seccion no sale.
    if (error || rows.length === 0) {
        return null;
    }

    const superficie = { backgroundColor: 'var(--pub-surface)', border: '1px solid var(--pub-gray-6)' };

    return (
        <>
            <div>
                {str(data.title) ? (
                    <h2 className="pub-part text-[26px] leading-tight lg:text-[32px]" style={part(0, { color: 'var(--pub-text)' })}>
                        {str(data.title)}
                    </h2>
                ) : null}
                {str(data.subtitle) ? (
                    <p className="pub-part mt-3 max-w-[60ch] text-[15px] leading-relaxed" style={part(1, { color: 'var(--pub-gray-2)' })}>
                        {str(data.subtitle)}
                    </p>
                ) : null}

                <div className="mt-9">
                    {presentation === 'plans' ? (
                        <PlansGrid
                            rows={rows}
                            cta={cta}
                            // Sin la clave (bloques guardados antes de que existiera) se usa la
                            // etiqueta de siempre; vacia a proposito, no sale.
                            featuredLabel={data.featured_label === undefined ? 'Más elegido' : str(data.featured_label)}
                            onPlanClick={onPlanClick}
                        />
                    ) : null}

                    {presentation === 'logos' ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {rows.map((row, i) => (
                                <div
                                    key={i}
                                    className="pub-part flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-xl p-4"
                                    style={part(i + 2, superficie)}
                                >
                                    {str(row.logo_url) ? (
                                        <img
                                            src={str(row.logo_url)}
                                            alt={str(row.name)}
                                            className="h-11 w-11 rounded-md object-contain"
                                        />
                                    ) : (
                                        <span
                                            className="flex h-11 w-11 items-center justify-center rounded-md text-base"
                                            style={{ border: '1px solid var(--pub-accent)', color: 'var(--pub-accent)' }}
                                        >
                                            {str(row.name).charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    <span className="text-center text-[13px]" style={{ color: 'var(--pub-gray-1)' }}>
                                        {str(row.name)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {presentation === 'stats' ? (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {rows.map((row, i) => (
                                <div key={i} className="pub-part" style={part(i + 2)}>
                                    <p className="text-[30px] leading-none" style={{ color: 'var(--pub-text)' }}>
                                        {money(row.value ?? Object.values(row)[0])}
                                    </p>
                                    <p className="mt-1.5 text-[13px]" style={{ color: 'var(--pub-gray-3)' }}>
                                        {str(row.label, String(Object.keys(row)[0] ?? ''))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Tarjeta generica: sirve para cualquier consulta, sin saber sus columnas. */}
                    {presentation === 'cards' ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {rows.map((row, i) => {
                                const columnas = Object.entries(row);
                                const primera = columnas[0];
                                const resto = columnas.slice(1);

                                return (
                                    <div key={i} className="pub-part rounded-xl p-5" style={part(i + 2, superficie)}>
                                        <p className="text-[15px] font-medium" style={{ color: 'var(--pub-text)' }}>
                                            {String(primera?.[1] ?? '—')}
                                        </p>
                                        <dl className="mt-2.5 space-y-1">
                                            {resto.map(([clave, valor]) => (
                                                <div key={clave} className="flex gap-2 text-[13px]">
                                                    <dt style={{ color: 'var(--pub-gray-4)' }}>{clave}:</dt>
                                                    <dd style={{ color: 'var(--pub-gray-1)' }}>{String(valor ?? '—')}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                {str(data.note) ? (
                    <p className="pub-part mt-8 text-[13px]" style={part(rows.length + 2, { color: 'var(--pub-gray-4)' })}>
                        {str(data.note)}
                    </p>
                ) : null}
            </div>
        </>
    );
}

/**
 * Tarjetas de plan con selector de periodo de cobro.
 *
 * El precio de cada periodo llega calculado del servidor: aqui solo se elige cual mostrar.
 * El plan destacado se distingue con borde de acento, sombra y etiqueta; el boton sigue
 * siendo delineado, que es el unico estilo de boton de las pantallas publicas.
 */
function PlansGrid({
    rows,
    cta,
    featuredLabel,
    onPlanClick,
}: {
    rows: Dict[];
    cta: string;
    featuredLabel: string;
    onPlanClick?: Props['onPlanClick'];
}) {
    // Todos los planes con precio traen los mismos periodos; se toman del primero que los tenga.
    const cycles = planPrices(rows.find((row) => planPrices(row).length > 0) ?? {});
    const [cycleId, setCycleId] = useState<number | null>(cycles[0]?.cycle_id ?? null);
    const cycle = cycles.find((item) => item.cycle_id === cycleId) ?? cycles[0] ?? null;

    const superficie = { backgroundColor: 'var(--pub-surface)', border: '1px solid var(--pub-gray-6)' };
    const destacada = {
        backgroundColor: 'var(--pub-surface)',
        border: '1px solid var(--pub-accent)',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.55)',
    };

    return (
        <>
            {cycles.length > 1 ? (
                <div
                    role="tablist"
                    aria-label="Periodo de pago"
                    // En celular, rejilla de dos: cuatro periodos en fila no caben y uno quedaba solo abajo.
                    className="pub-part mb-8 grid grid-cols-2 gap-1 rounded-lg p-1 sm:flex sm:w-fit sm:max-w-full sm:flex-wrap"
                    style={part(2, { border: '1px solid var(--pub-gray-6)', backgroundColor: 'var(--pub-surface)' })}
                >
                    {cycles.map((item) => {
                        const active = item.cycle_id === cycle?.cycle_id;

                        return (
                            <button
                                key={item.cycle_id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setCycleId(item.cycle_id)}
                                className="rounded-md px-3.5 py-2 text-[14px] transition-colors"
                                style={
                                    active
                                        ? { backgroundColor: 'var(--pub-accent-fill)', color: 'var(--pub-accent-strong)' }
                                        : { color: 'var(--pub-gray-3)' }
                                }
                            >
                                {item.name}
                                {item.discount_percent > 0 ? (
                                    <span className="ml-1 text-[12px] opacity-80">−{item.discount_percent} %</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}

            <div className={`grid gap-5 sm:grid-cols-2 ${rows.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
                {rows.map((row, i) => {
                    const featured = row.is_featured === true;
                    const current = cycle ? planPrices(row).find((item) => item.cycle_id === cycle.cycle_id) : undefined;
                    const trialDays = typeof row.trial_days === 'number' ? row.trial_days : 0;

                    return (
                        <div
                            key={i}
                            className="pub-part relative flex flex-col rounded-xl p-6"
                            style={part(i + 3, featured ? destacada : superficie)}
                        >
                            {featured && featuredLabel ? (
                                <span
                                    className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[12px]"
                                    style={{
                                        backgroundColor: 'var(--pub-accent-fill)',
                                        border: '1px solid var(--pub-accent)',
                                        color: 'var(--pub-accent-strong)',
                                    }}
                                >
                                    {featuredLabel}
                                </span>
                            ) : null}

                            <h3 className="text-[19px]" style={{ color: 'var(--pub-text)' }}>
                                {str(row.name)}
                            </h3>
                            {str(row.description) ? (
                                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--pub-gray-3)' }}>
                                    {str(row.description)}
                                </p>
                            ) : null}

                            {current && current.price !== null && cycle ? (
                                <>
                                    <p className="mt-5 text-[30px] leading-none tabular-nums" style={{ color: 'var(--pub-text)' }}>
                                        {price(current.price)}
                                    </p>
                                    <p className="mt-1.5 text-[13px]" style={{ color: 'var(--pub-gray-3)' }}>
                                        {cycle.months === 1
                                            ? 'al mes'
                                            : `cada ${cycle.months} meses · ${price(current.monthly)} al mes`}
                                    </p>
                                </>
                            ) : row.price != null ? (
                                <>
                                    <p className="mt-5 text-[30px] leading-none tabular-nums" style={{ color: 'var(--pub-text)' }}>
                                        {price(row.price)}
                                    </p>
                                    <p className="mt-1.5 text-[13px]" style={{ color: 'var(--pub-gray-3)' }}>
                                        al mes
                                    </p>
                                </>
                            ) : (
                                <p className="mt-5 text-[22px] leading-none" style={{ color: 'var(--pub-text)' }}>
                                    Precio a convenir
                                </p>
                            )}

                            {trialDays > 0 ? (
                                <p
                                    className="mt-3 w-fit rounded-full px-2.5 py-0.5 text-[12px]"
                                    style={{ backgroundColor: 'var(--pub-accent-fill)', color: 'var(--pub-accent-strong)' }}
                                >
                                    {trialDays} {trialDays === 1 ? 'día' : 'días'} gratis
                                </p>
                            ) : null}

                            <ul className="mt-5 flex flex-1 flex-col gap-2">
                                {labels(row.lines).map((line, j) => (
                                    <li key={j} className="flex items-start gap-2 text-[14px]" style={{ color: 'var(--pub-gray-2)' }}>
                                        <Check size={16} weight="bold" className="mt-0.5 shrink-0" style={{ color: 'var(--pub-accent)' }} />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* En la vista previa del editor no hay manejador: el boton se pinta
                                igual para que se vea como quedara. */}
                            {cta ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onPlanClick?.(
                                            Number(row.id),
                                            str(row.name),
                                            cycle && current ? { id: cycle.cycle_id, name: cycle.name } : null,
                                        )
                                    }
                                    className="pub-btn mt-6 h-11 w-full text-[14px]"
                                    style={featured ? { borderColor: 'var(--pub-accent-strong)' } : undefined}
                                >
                                    {cta}
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </>
    );
}
