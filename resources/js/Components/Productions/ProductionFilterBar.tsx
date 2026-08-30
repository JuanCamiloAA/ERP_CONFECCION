import { CaretDown, DownloadSimple, FunnelSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Employee, Operation, Reference } from '@/types';

export type ProductionFilterKey =
    | 'employee_id'
    | 'reference_id'
    | 'operation_id'
    | 'date_start'
    | 'date_end'
    | 'shift'
    | 'status';

export type ProductionFilterState = Record<ProductionFilterKey, string>;

export interface FilterChip {
    key: ProductionFilterKey;
    label: string;
}

/** Rango rapido: escribe date_start / date_end, los parametros que el backend ya entiende. */
type RangeKey = 'today' | 'week' | 'month' | 'custom';

function isoDate(date: Date): string {
    // Fecha local, no UTC: `toISOString()` en Bogota (UTC-5) devuelve el dia anterior
    // durante toda la tarde.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
}

export function rangeFor(key: Exclude<RangeKey, 'custom'>): { date_start: string; date_end: string } {
    const today = new Date();
    const end = isoDate(today);

    if (key === 'today') {
        return { date_start: end, date_end: end };
    }

    if (key === 'week') {
        const start = new Date(today);
        // Semana de lunes a domingo, como se cuenta la producción del taller.
        const weekday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - weekday);

        return { date_start: isoDate(start), date_end: end };
    }

    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    return { date_start: isoDate(start), date_end: end };
}

/** Que boton del segmentado corresponde al rango que hay puesto. */
export function activeRange(filters: ProductionFilterState): RangeKey | null {
    if (!filters.date_start && !filters.date_end) return null;

    for (const key of ['today', 'week', 'month'] as const) {
        const r = rangeFor(key);
        if (r.date_start === filters.date_start && r.date_end === filters.date_end) {
            return key;
        }
    }

    return 'custom';
}

interface Suggestion {
    key: ProductionFilterKey;
    value: string;
    group: string;
    label: string;
}

interface Props {
    filters: ProductionFilterState;
    /** Aplica y recarga; el boton «Filtrar» ya no existe. */
    onApply: (next: ProductionFilterState) => void;
    onClearFilter: (key: ProductionFilterKey) => void;
    onReset: () => void;
    chips: FilterChip[];
    /** Los seis selects de siempre; se muestran dentro del panel. */
    fields: ReactNode;
    employees: Employee[];
    references: Reference[];
    operations: Operation[];
    exportUrl: string;
    /** Conmutador de vista; se pinta pegado a la derecha de la barra. */
    viewSwitch?: ReactNode;
    /** Controles que van al extremo derecho de la barra (hoy, el conmutador de vista). */
    trailing?: ReactNode;
}

/**
 * Barra de filtro del listado de produccion.
 *
 * Sustituye a la tarjeta con seis desplegables siempre abiertos. Lo que se usa a diario
 * —el rango de fechas y buscar a una persona— queda en una linea; el resto vive detras de
 * «Mas filtros», con el numero de los que estan puestos.
 *
 * La busqueda no manda un parametro nuevo al servidor: resuelve sobre las listas que la
 * pagina ya tiene y elige el filtro que corresponde (`employee_id`, `reference_id` u
 * `operation_id`), de modo que lo que viaja en la URL sigue siendo exactamente lo mismo
 * que antes.
 */
export function ProductionFilterBar({
    filters,
    onApply,
    onClearFilter,
    onReset,
    chips,
    fields,
    employees,
    references,
    operations,
    exportUrl,
    viewSwitch,
    trailing,
}: Props) {
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    const range = activeRange(filters);
    const activeCount = chips.length;

    const suggestions = useMemo<Suggestion[]>(() => {
        const q = term.trim().toLowerCase();
        if (q.length < 2) return [];

        const out: Suggestion[] = [];

        employees.forEach((e) => {
            const label = e.full_name ?? `${e.first_name} ${e.last_name}`;
            if (label.toLowerCase().includes(q)) {
                out.push({ key: 'employee_id', value: String(e.id), group: 'Empleado', label });
            }
        });

        references.forEach((r) => {
            if (`${r.code} ${r.name}`.toLowerCase().includes(q)) {
                out.push({ key: 'reference_id', value: String(r.id), group: 'Referencia', label: `${r.code} · ${r.name}` });
            }
        });

        operations.forEach((o) => {
            if (o.name.toLowerCase().includes(q)) {
                out.push({ key: 'operation_id', value: String(o.id), group: 'Operación', label: o.name });
            }
        });

        return out.slice(0, 8);
    }, [term, employees, references, operations]);

    // Cerrar al hacer clic fuera: la lista tapa la tabla y no debe quedarse abierta.
    useEffect(() => {
        if (!open) return;

        const onDocDown = (event: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onDocDown);

        return () => document.removeEventListener('mousedown', onDocDown);
    }, [open]);

    const pick = (suggestion: Suggestion) => {
        setTerm('');
        setOpen(false);
        onApply({ ...filters, [suggestion.key]: suggestion.value });
    };

    const setRange = (key: Exclude<RangeKey, 'custom'>) => {
        const next = { ...filters, ...rangeFor(key) };
        onApply(next);
    };

    return (
        <div className="flex flex-col gap-2.5">
            {/*
              * En movil la busqueda toma la linea entera —a 44px, que es el objetivo
              * tactil— y los controles pasan a una fila que se desliza; a partir de
              * 640px todo cabe en un solo renglon de 36px.
              */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* -------------------------------------------------- busqueda */}
                <div ref={boxRef} className="relative min-w-0 sm:max-w-[340px] sm:flex-1">
                    <MagnifyingGlass
                        size={15}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <input
                        value={term}
                        onChange={(e) => {
                            setTerm(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && suggestions[0]) {
                                e.preventDefault();
                                pick(suggestions[0]);
                            }
                            if (e.key === 'Escape') setOpen(false);
                        }}
                        placeholder="Buscar empleado, referencia u operación…"
                        aria-label="Buscar para filtrar"
                        className="emp-field pl-8"
                    />

                    {open && suggestions.length > 0 ? (
                        <ul className="emp-card absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto py-1">
                            {suggestions.map((suggestion) => (
                                <li key={`${suggestion.key}-${suggestion.value}`}>
                                    <button
                                        type="button"
                                        onClick={() => pick(suggestion)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[color:var(--emp-accent-tint)]"
                                        style={{ color: 'var(--emp-text)' }}
                                    >
                                        <span className="emp-pill shrink-0">{suggestion.group}</span>
                                        <span className="min-w-0 truncate">{suggestion.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {open && term.trim().length >= 2 && suggestions.length === 0 ? (
                        <div className="emp-card absolute left-0 right-0 top-full z-30 mt-1 px-3 py-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            Nada coincide con «{term.trim()}».
                        </div>
                    ) : null}
                </div>

                <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-1 sm:overflow-visible sm:px-0">
                {/* --------------------------------------------------- rangos */}
                <div className="emp-seg shrink-0">
                    {(
                        [
                            { key: 'today', label: 'Hoy' },
                            { key: 'week', label: 'Semana' },
                            { key: 'month', label: 'Mes' },
                        ] as { key: Exclude<RangeKey, 'custom'>; label: string }[]
                    ).map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setRange(item.key)}
                            className={`emp-seg-item ${range === item.key ? 'emp-seg-on' : ''}`}
                        >
                            {item.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className={`emp-seg-item ${range === 'custom' ? 'emp-seg-on' : ''}`}
                    >
                        Rango…
                    </button>
                </div>

                {/* --------------------------------------------- mas filtros */}
                <button
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    aria-expanded={panelOpen}
                    className="emp-btn emp-btn-sm shrink-0"
                >
                    <FunnelSimple size={14} />
                    Más filtros
                    {activeCount > 0 ? (
                        <span
                            className="ml-0.5 rounded-full px-1.5 text-[11px]"
                            style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                        >
                            {activeCount}
                        </span>
                    ) : null}
                    <CaretDown size={12} className={panelOpen ? 'rotate-180' : ''} />
                </button>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {viewSwitch}
                        <a href={exportUrl} className="emp-btn emp-btn-sm">
                            <DownloadSimple size={14} />
                            <span className="max-sm:sr-only">Exportar</span>
                        </a>
                    </div>
                </div>

                {trailing}
            </div>

            {/* ------------------------------------------------ panel de filtros */}
            {panelOpen ? (
                <div className="emp-card emp-reveal p-4">
                    {fields}
                    <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={onReset} className="emp-btn emp-btn-sm">
                            Limpiar todo
                        </button>
                        <button type="button" onClick={() => setPanelOpen(false)} className="emp-btn emp-btn-sm emp-btn-primary">
                            Listo
                        </button>
                    </div>
                </div>
            ) : null}

            {/* --------------------------------------------------------- chips */}
            {chips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    {chips.map((chip) => (
                        <span key={chip.key} className="emp-pill emp-pill-accent gap-0 pr-0.5">
                            <span className="max-w-40 truncate">{chip.label}</span>
                            <button
                                type="button"
                                onClick={() => onClearFilter(chip.key)}
                                aria-label={`Quitar filtro ${chip.label}`}
                                className="ml-1 flex h-5 w-5 items-center justify-center rounded-full"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={onReset}
                        className="text-[12px] underline underline-offset-2"
                        style={{ color: 'var(--emp-muted)' }}
                    >
                        Limpiar todo
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export default ProductionFilterBar;
