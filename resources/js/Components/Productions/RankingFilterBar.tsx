import { CaretDown } from '@phosphor-icons/react';
import { type ReactNode } from 'react';
import {
    ProductionFilterBar,
    type FilterChip,
    type ProductionFilterState,
    type QuickRangeKey,
} from '@/Components/Productions/ProductionFilterBar';
import { EmpSwitch } from '@/Components/UI/ModuleFields';

/** Lo que el ranking manda en la URL. Sus fechas se llaman `start`/`end`, no `date_*`. */
export interface RankingFilterState {
    start: string;
    end: string;
    reference_id: string;
    shift: string;
    only_confirmed: boolean;
}

export const SHIFT_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

/** El ranking corta por quincena, que es como corta la nomina. */
const RANKING_RANGES: QuickRangeKey[] = ['today', 'week', 'fortnight', 'month'];

interface ReferenceOption {
    id: number;
    code: string;
    name: string;
}

interface Props {
    filters: RankingFilterState;
    references: ReferenceOption[];
    onApply: (next: RankingFilterState) => void;
    /** Vuelve al filtro de equipo, o a la quincena en curso si no hay ninguno. */
    onReset: () => void;
    /**
     * Interruptor «aplicar a todos». Se pinta dentro del panel y solo llega con el permiso
     * de gestion: sin el, quien mira no debe ni intuir que existe.
     */
    teamToggle?: ReactNode;
}

/**
 * Barra de filtro del ranking.
 *
 * Envuelve la del listado de produccion en vez de duplicarla: mismos segmentados, mismo
 * panel «Mas filtros» con su contador y mismas pastillas. Cambia lo que el ranking
 * necesita —el rango de quincena, y referencia/turno en lugar de empleado y estado— y
 * traduce entre `start`/`end`, que es lo que viaja en su URL, y el `date_start`/`date_end`
 * que la barra compartida entiende.
 */
export function RankingFilterBar({ filters, references, onApply, onReset, teamToggle }: Props) {
    // La barra compartida razona en `date_start`/`date_end`; aqui se traduce en los dos
    // sentidos para no cambiarle el vocabulario al listado de produccion.
    const inner: ProductionFilterState = {
        employee_id: '',
        reference_id: filters.reference_id,
        operation_id: '',
        date_start: filters.start,
        date_end: filters.end,
        shift: filters.shift,
        status: '',
    };

    const applyInner = (next: ProductionFilterState) => {
        onApply({
            ...filters,
            start: next.date_start,
            end: next.date_end,
            reference_id: next.reference_id,
            shift: next.shift,
        });
    };

    const chips: FilterChip[] = [];
    if (filters.reference_id) {
        const reference = references.find((r) => String(r.id) === filters.reference_id);
        chips.push({ key: 'reference_id', label: reference ? reference.code : 'Referencia' });
    }
    if (filters.shift) {
        chips.push({ key: 'shift', label: SHIFT_LABEL[filters.shift] ?? filters.shift });
    }
    if (filters.only_confirmed) {
        chips.push({ key: 'only_confirmed', label: 'Solo confirmadas' });
    }

    const clearFilter = (key: string) => {
        if (key === 'only_confirmed') {
            onApply({ ...filters, only_confirmed: false });

            return;
        }

        onApply({ ...filters, [key]: '' });
    };

    const fields = (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <RankingSelect
                    label="Referencia"
                    value={filters.reference_id}
                    onChange={(v) => onApply({ ...filters, reference_id: v })}
                    placeholder="Todas"
                    options={references.map((r) => ({ value: String(r.id), label: `${r.code} - ${r.name}` }))}
                />
                <RankingSelect
                    label="Turno"
                    value={filters.shift}
                    onChange={(v) => onApply({ ...filters, shift: v })}
                    placeholder="Todos"
                    options={[
                        { value: 'manana', label: 'Mañana' },
                        { value: 'tarde', label: 'Tarde' },
                        { value: 'noche', label: 'Noche' },
                    ]}
                />
                <RankingDate label="Desde" value={filters.start} onChange={(v) => onApply({ ...filters, start: v })} />
                <RankingDate label="Hasta" value={filters.end} onChange={(v) => onApply({ ...filters, end: v })} />
            </div>

            <div className="border-t pt-1" style={{ borderColor: 'var(--emp-border)' }}>
                <EmpSwitch
                    checked={filters.only_confirmed}
                    onChange={(v) => onApply({ ...filters, only_confirmed: v })}
                    label="Solo confirmadas"
                    description="Excluye la producción que todavía está por confirmar"
                />
            </div>

            {teamToggle ? (
                <div className="border-t pt-1" style={{ borderColor: 'var(--emp-border)' }}>
                    {teamToggle}
                </div>
            ) : null}
        </div>
    );

    return (
        <ProductionFilterBar
            filters={inner}
            onApply={applyInner}
            onClearFilter={clearFilter}
            onReset={onReset}
            chips={chips}
            fields={fields}
            ranges={RANKING_RANGES}
            showSearch={false}
        />
    );
}

/* --------------------------------------------------------------- auxiliares */

function RankingSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <div className="min-w-0">
            <label className="emp-label">{label}</label>
            <div className="relative">
                <select value={value} onChange={(e) => onChange(e.target.value)} className="emp-field">
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>
        </div>
    );
}

function RankingDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="min-w-0">
            <label className="emp-label">{label}</label>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="emp-field" />
        </div>
    );
}

export default RankingFilterBar;
