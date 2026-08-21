import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { cn, formatCurrency } from '@/lib/utils';

export interface OperationOption {
    id: number;
    name: string;
    base_price: string | number;
    estimated_minutes?: string | number;
}

export interface RefOperation {
    operation_id: number;
    name: string;
    price: number;
    estimated_minutes: number;
    /**
     * Solo lo usa la vista: una linea inactiva no se ofrece al registrar produccion, pero
     * sigue sumando al costo unitario, asi que se marca en vez de esconderse.
     */
    is_active?: boolean;
}

interface Props {
    /** Lineas ya agregadas a la referencia. */
    lineas: RefOperation[];
    /** Catalogo de operaciones de la empresa. */
    disponibles: OperationOption[];
    thresholds: number[];
    currency: string;
    onAgregar: (linea: RefOperation) => void;
    onQuitar: (operationId: number) => void;
    /** Solo en editar: corrige en linea el precio de una linea existente. */
    onPrecio?: (operationId: number, precio: number) => void;
    /** Solo en editar: corrige los minutos; la dificultad se recalcula sola. */
    onMinutos?: (operationId: number, minutos: number) => void;
    /** Vista: sin fila de captura, sin papelera y con el precio como texto. */
    readOnly?: boolean;
    className?: string;
}

/** Una linea es inactiva solo si el dato lo dice; sin dato, se asume activa. */
const inactiva = (l: RefOperation): boolean => l.is_active === false;

const numero = (valor: string): number => {
    const n = Number(String(valor).replace(',', '.'));

    return Number.isFinite(n) ? n : 0;
};

/**
 * Detalle de operaciones de la referencia.
 *
 * La captura vive en la ultima fila de la tabla, no en un bloque aparte: se busca la
 * operacion escribiendo, el precio y los minutos llegan prellenados del catalogo y Enter
 * agrega la linea devolviendo el foco al buscador, de modo que se puede cargar la lista
 * entera sin tocar el raton.
 *
 * La columna «% del costo» responde «que me esta costando caro» sin salir de la pantalla.
 *
 * Con `onPrecio` y `onMinutos` la linea se corrige donde esta, sin abrir nada: el input
 * no lleva borde hasta que se pasa por encima. La dificultad no se edita a mano —sale de
 * los minutos y de los rangos de la empresa— pero se actualiza al teclear.
 *
 * Escritorio y movil dibujan sus propios campos —la tabla no cabe en 390px—, por eso cada
 * uno lleva su referencia: si compartieran una, al montarse el segundo la del primero
 * quedaria apuntando a un nodo que no se ve.
 */
export function ReferenceOperationsTable({
    lineas,
    disponibles,
    thresholds,
    currency,
    onAgregar,
    onQuitar,
    onPrecio,
    onMinutos,
    readOnly = false,
    className,
}: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [elegida, setElegida] = useState<OperationOption | null>(null);
    const [precio, setPrecio] = useState('');
    const [minutos, setMinutos] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [resaltada, setResaltada] = useState(0);
    const [hojaMovil, setHojaMovil] = useState(false);

    const buscadorEscritorio = useRef<HTMLInputElement>(null);
    const buscadorMovil = useRef<HTMLInputElement>(null);
    const precioEscritorio = useRef<HTMLInputElement>(null);
    const precioMovil = useRef<HTMLInputElement>(null);

    /** La hoja movil solo existe mientras esta abierta: si esta, es la que tiene el foco. */
    const enfocarBuscador = () => (buscadorMovil.current ?? buscadorEscritorio.current)?.focus();
    const enfocarPrecio = () => (precioMovil.current ?? precioEscritorio.current)?.focus();

    const total = useMemo(() => lineas.reduce((s, l) => s + Number(l.price), 0), [lineas]);

    const sinUsar = useMemo(
        () => disponibles.filter((o) => !lineas.some((l) => l.operation_id === o.id)),
        [disponibles, lineas],
    );

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();

        return q === '' ? sinUsar : sinUsar.filter((o) => o.name.toLowerCase().includes(q));
    }, [sinUsar, busqueda]);

    useEffect(() => {
        setResaltada(0);
    }, [busqueda]);

    const tomar = (op: OperationOption) => {
        setElegida(op);
        setBusqueda(op.name);
        setAbierto(false);
        // Del catalogo; quien captura solo corrige lo que haga falta.
        setPrecio(String(op.base_price ?? ''));
        setMinutos(String(op.estimated_minutes ?? ''));
        window.setTimeout(enfocarPrecio, 0);
    };

    const limpiar = () => {
        setElegida(null);
        setBusqueda('');
        setPrecio('');
        setMinutos('');
        setAbierto(false);
    };

    const agregar = () => {
        if (!elegida) {
            enfocarBuscador();

            return;
        }

        onAgregar({
            operation_id: elegida.id,
            name: elegida.name,
            price: precio === '' ? Number(elegida.base_price ?? 0) : numero(precio),
            estimated_minutes: minutos === '' ? Number(elegida.estimated_minutes ?? 0) : numero(minutos),
        });

        limpiar();
        setHojaMovil(false);
        window.setTimeout(enfocarBuscador, 0);
    };

    /**
     * Enter dentro de la captura agrega la linea. El formulario ya corta el envio
     * implicito; aqui se detiene ademas la propagacion para dejar claro que la tecla
     * tuvo dueno en esta fila.
     */
    const alTeclearEnCaptura = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'Enter') return;

        e.preventDefault();
        e.stopPropagation();
        agregar();
    };

    const alTeclearEnBuscador = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAbierto(true);
            setResaltada((i) => Math.min(i + 1, Math.max(filtradas.length - 1, 0)));

            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setResaltada((i) => Math.max(i - 1, 0));

            return;
        }
        if (e.key === 'Escape') {
            setAbierto(false);

            return;
        }
        if (e.key === 'Tab') {
            // Salir con Tab toma lo resaltado, para poder encadenar sin raton.
            if (abierto && !elegida && filtradas[resaltada]) {
                e.preventDefault();
                tomar(filtradas[resaltada]);
            }

            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (abierto && !elegida && filtradas[resaltada]) {
                tomar(filtradas[resaltada]);

                return;
            }
            agregar();
        }
    };

    const dificultad = minutos === '' ? null : levelFromMinutes(numero(minutos), thresholds);

    const buscadorCombo = (referencia: RefObject<HTMLInputElement | null>, id: string) => (
        <div className="relative">
            <input
                ref={referencia}
                type="text"
                role="combobox"
                aria-expanded={abierto}
                aria-controls={id}
                aria-label="Buscar operación"
                autoComplete="off"
                value={busqueda}
                placeholder="Escribe para buscar la operación…"
                onChange={(e) => {
                    setBusqueda(e.target.value);
                    setElegida(null);
                    setAbierto(true);
                }}
                onFocus={() => setAbierto(true)}
                onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
                onKeyDown={alTeclearEnBuscador}
                className="ref-field"
            />
            {abierto ? (
                filtradas.length > 0 ? (
                    <ul
                        id={id}
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg py-1 shadow-lg"
                        style={{ backgroundColor: 'var(--ref-surface)', border: '1px solid var(--ref-border)' }}
                    >
                        {filtradas.map((op, i) => (
                            <li key={op.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={i === resaltada}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => tomar(op)}
                                    onMouseEnter={() => setResaltada(i)}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px]"
                                    style={{
                                        backgroundColor: i === resaltada ? 'var(--ref-accent-soft)' : 'transparent',
                                        color: 'var(--ref-text)',
                                    }}
                                >
                                    <span className="min-w-0 truncate">{op.name}</span>
                                    <span className="shrink-0 text-[11px]" style={{ color: 'var(--ref-muted)' }}>
                                        {formatCurrency(Number(op.base_price ?? 0), currency)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div
                        className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg px-3 py-2 text-[12px]"
                        style={{ backgroundColor: 'var(--ref-surface)', border: '1px solid var(--ref-border)', color: 'var(--ref-muted)' }}
                    >
                        {sinUsar.length === 0 ? 'Ya agregaste todas las operaciones.' : 'Ninguna operación coincide.'}
                    </div>
                )
            ) : null}
        </div>
    );

    const campoPrecio = (referencia: RefObject<HTMLInputElement | null>) => (
        <input
            ref={referencia}
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={precio}
            placeholder="Precio"
            aria-label="Precio de la operación"
            onChange={(e) => setPrecio(e.target.value)}
            onKeyDown={alTeclearEnCaptura}
            className="ref-field"
        />
    );

    const campoMinutos = (
        <input
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            value={minutos}
            placeholder="Minutos"
            aria-label="Minutos de la operación"
            onChange={(e) => setMinutos(e.target.value)}
            onKeyDown={alTeclearEnCaptura}
            className="ref-field"
        />
    );

    return (
        <div className={className}>
            {/* ---------------------------------------------------- escritorio */}
            <div className="hidden overflow-hidden rounded-[10px] sm:block" style={{ border: '1px solid var(--ref-border)' }}>
                <table className="w-full text-[13px]">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--ref-surface-head)' }}>
                            {[
                                ['Operación', ''],
                                ['Precio', 'w-[116px]'],
                                ['Minutos', 'w-[116px]'],
                                ['Dificultad', 'w-[104px]'],
                                ['% del costo', 'w-[132px]'],
                                ...(readOnly ? [] : [['', 'w-[44px]']]),
                            ].map(([h, w], i) => (
                                <th
                                    key={h || `c${i}`}
                                    className={cn('px-3 py-2 text-left text-[11px] uppercase tracking-[.06em]', w)}
                                    style={{ color: 'var(--ref-subtle)', borderBottom: '1px solid var(--ref-border-table)' }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l) => {
                            const peso = total > 0 ? (Number(l.price) / total) * 100 : 0;

                            return (
                                <tr key={l.operation_id} style={{ borderTop: '1px solid var(--ref-border-table)' }}>
                                    <td className="px-3 py-2" style={{ color: inactiva(l) ? 'var(--ref-muted)' : 'var(--ref-text)' }}>
                                        {l.name}
                                        {inactiva(l) ? (
                                            <span
                                                className="ml-2 rounded-full px-2 py-0.5 text-[11px]"
                                                style={{ border: '1px solid var(--ref-border)', color: 'var(--ref-subtle)' }}
                                            >
                                                Inactiva
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-3 py-2">
                                        {onPrecio && !readOnly ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                value={l.price}
                                                aria-label={`Precio de ${l.name}`}
                                                onChange={(e) => onPrecio(l.operation_id, numero(e.target.value))}
                                                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                                className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] hover:border-[color:var(--ref-border)]"
                                                style={{ color: 'var(--ref-text)' }}
                                            />
                                        ) : (
                                            <span style={{ color: 'var(--ref-text)' }}>{formatCurrency(l.price, currency)}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {onMinutos && !readOnly ? (
                                            <span className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min={0}
                                                    value={l.estimated_minutes}
                                                    aria-label={`Minutos de ${l.name}`}
                                                    onChange={(e) => onMinutos(l.operation_id, numero(e.target.value))}
                                                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                                    className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] hover:border-[color:var(--ref-border)]"
                                                    style={{ color: 'var(--ref-text)' }}
                                                />
                                                <span className="shrink-0 text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                                                    min
                                                </span>
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--ref-muted)' }}>{l.estimated_minutes} min</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2" style={{ color: 'var(--ref-muted)' }}>
                                        {/* Derivada de los minutos: la fija el servidor con los rangos de Mi empresa. */}
                                        {difficultyLabel(levelFromMinutes(Number(l.estimated_minutes), thresholds))}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="h-1.5 w-[46px] shrink-0 rounded-full"
                                                style={{
                                                    background: `linear-gradient(90deg, var(--ref-accent) ${peso}%, var(--ref-accent-track) ${peso}%)`,
                                                }}
                                            />
                                            <span className="text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                                {peso.toFixed(0)}%
                                            </span>
                                        </span>
                                    </td>
                                    {readOnly ? null : (
                                        <td className="px-2 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onQuitar(l.operation_id)}
                                                aria-label={`Quitar ${l.name}`}
                                                className="rounded-md p-1.5"
                                                style={{ color: 'var(--ref-subtle)' }}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {/* Captura: siempre la ultima fila, tambien cuando aun no hay lineas. */}
                        {readOnly ? null : (
                            <tr style={{ borderTop: '1px solid var(--ref-border-table)', backgroundColor: 'var(--ref-accent-soft)' }}>
                            <td className="px-3 py-2 align-top">{buscadorCombo(buscadorEscritorio, 'ref-ops-lista')}</td>
                            <td className="px-2 py-2 align-top">{campoPrecio(precioEscritorio)}</td>
                            <td className="px-2 py-2 align-top">{campoMinutos}</td>
                            <td className="px-3 py-2 align-middle text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                {dificultad ? difficultyLabel(dificultad) : '—'}
                            </td>
                            <td className="px-3 py-2 align-middle" colSpan={2}>
                                <button type="button" onClick={agregar} disabled={!elegida} className="ref-btn ref-btn-primary ref-btn-sm">
                                    <PlusIcon className="h-3.5 w-3.5" />
                                    Agregar
                                </button>
                            </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <p
                    className="px-3 py-2 text-[11px]"
                    style={{
                        backgroundColor: 'var(--ref-surface-head)',
                        color: 'var(--ref-subtle)',
                        borderTop: '1px solid var(--ref-border-table)',
                    }}
                >
                    {readOnly
                        ? 'Las líneas inactivas siguen sumando al costo unitario, pero no se ofrecen al registrar producción. Para cambiar precios o minutos, entra a editar.'
                        : 'Escribe para buscar la operación; Enter agrega la línea y deja el cursor listo para la siguiente.'}
                </p>
            </div>

            {/* --------------------------------------------------------- movil */}
            <div className="space-y-2.5 sm:hidden">
                {lineas.map((l) => {
                    const peso = total > 0 ? (Number(l.price) / total) * 100 : 0;

                    return (
                        <div
                            key={l.operation_id}
                            className="flex items-start justify-between gap-3 rounded-[10px] p-3"
                            style={{ backgroundColor: 'var(--ref-surface)', border: '1px solid var(--ref-border)' }}
                        >
                            <div className="min-w-0">
                                <p className="truncate text-[14px]" style={{ color: inactiva(l) ? 'var(--ref-muted)' : 'var(--ref-text)' }}>
                                    {l.name}
                                    {inactiva(l) ? (
                                        <span className="ml-2 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                            · Inactiva
                                        </span>
                                    ) : null}
                                </p>
                                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                    {onMinutos && !readOnly ? (
                                        <span className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                inputMode="decimal"
                                                value={l.estimated_minutes}
                                                aria-label={`Minutos de ${l.name}`}
                                                onChange={(e) => onMinutos(l.operation_id, numero(e.target.value))}
                                                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                                className="ref-field h-11 w-20 px-2 text-[13px]"
                                            />
                                            <span style={{ color: 'var(--ref-subtle)' }}>min</span>
                                        </span>
                                    ) : (
                                        <span>{l.estimated_minutes} min</span>
                                    )}
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[11px]"
                                        style={{ backgroundColor: 'var(--ref-accent-soft)', color: 'var(--ref-accent-on)' }}
                                    >
                                        {difficultyLabel(levelFromMinutes(Number(l.estimated_minutes), thresholds))}
                                    </span>
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                {onPrecio && !readOnly ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        inputMode="decimal"
                                        value={l.price}
                                        aria-label={`Precio de ${l.name}`}
                                        onChange={(e) => onPrecio(l.operation_id, numero(e.target.value))}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                        className="ref-field h-11 w-28 px-2 text-right text-[13px]"
                                    />
                                ) : (
                                    <p className="text-[14px]" style={{ color: 'var(--ref-text)' }}>
                                        {formatCurrency(l.price, currency)}
                                    </p>
                                )}
                                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                    {peso.toFixed(0)}% del costo
                                </p>
                                {readOnly ? null : (
                                    <button
                                        type="button"
                                        onClick={() => onQuitar(l.operation_id)}
                                        className="mt-1 h-11 text-[12px]"
                                        style={{ color: 'var(--ref-danger)' }}
                                    >
                                        Quitar
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {readOnly ? (
                    <p className="text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                        Las líneas inactivas siguen sumando al costo unitario. Para cambiar precios o minutos, entra a editar.
                    </p>
                ) : (
                <button
                    type="button"
                    onClick={() => {
                        setHojaMovil(true);
                        window.setTimeout(enfocarBuscador, 60);
                    }}
                    className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] text-[13px]"
                    style={{ border: '1px dashed var(--ref-accent)', color: 'var(--ref-accent-on)' }}
                >
                    <PlusIcon className="h-4 w-4" />
                    Agregar operación
                </button>
                )}
            </div>

            {/* Hoja inferior de captura en movil. */}
            {hojaMovil && !readOnly ? (
                <div
                    className="fixed inset-0 z-50 flex flex-col justify-end sm:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Agregar operación"
                >
                    <button type="button" aria-label="Cerrar" onClick={() => setHojaMovil(false)} className="absolute inset-0 bg-slate-900/60" />
                    <div
                        className="relative rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
                        style={{ backgroundColor: 'var(--ref-surface-head)', borderTop: '1px solid var(--ref-border)' }}
                    >
                        <p className="mb-3 text-[14px]" style={{ color: 'var(--ref-text)' }}>
                            Agregar operación
                        </p>
                        <div className="space-y-2.5">
                            {buscadorCombo(buscadorMovil, 'ref-ops-lista-movil')}
                            <div className="grid grid-cols-2 gap-2.5">
                                {campoPrecio(precioMovil)}
                                {campoMinutos}
                            </div>
                            <p className="text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                Dificultad: {dificultad ? difficultyLabel(dificultad) : '—'}
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setHojaMovil(false)} className="ref-btn flex-1">
                                    Cancelar
                                </button>
                                <button type="button" onClick={agregar} disabled={!elegida} className="ref-btn ref-btn-primary flex-[2]">
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
