import { Check } from '@phosphor-icons/react';
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

/** Importe de plan: "150.000", sin moneda ni decimales, como en el diseño. */
const money = (v: unknown): string =>
    typeof v === 'number' && Number.isFinite(v) ? new Intl.NumberFormat('es-CO').format(v) : str(v);

interface Props {
    data: Dict;
    rows: Dict[];
    error?: string | null;
    onPlanClick?: (planId: number, planName: string) => void;
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
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {rows.map((row, i) => (
                                <div key={i} className="pub-part flex flex-col rounded-xl p-6" style={part(i + 2, superficie)}>
                                    <p className="text-[15px] font-medium" style={{ color: 'var(--pub-text)' }}>
                                        {str(row.name)}
                                    </p>
                                    {row.price != null ? (
                                        <p className="mt-1.5 text-[26px] leading-none" style={{ color: 'var(--pub-accent)' }}>
                                            {money(row.price)} <span className="text-[15px]">/ mes</span>
                                        </p>
                                    ) : null}
                                    <ul className="mt-5 flex-1 space-y-2">
                                        {labels(row.lines).map((line, j) => (
                                            <li key={j} className="flex gap-2 text-[13px]" style={{ color: 'var(--pub-gray-2)' }}>
                                                <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--pub-accent)' }} />
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                    {/* En la vista previa del editor no hay manejador: el boton
                                        se pinta igual para que se vea como quedara. */}
                                    {cta ? (
                                        <button
                                            type="button"
                                            onClick={() => onPlanClick?.(Number(row.id), str(row.name))}
                                            className="pub-btn mt-6 h-11 w-full text-[14px]"
                                        >
                                            {cta}
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
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
