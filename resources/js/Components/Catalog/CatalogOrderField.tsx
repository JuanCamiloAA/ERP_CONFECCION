import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { useMemo } from 'react';

export interface CatalogSibling {
    id: number;
    name: string;
    is_active: boolean;
}

interface Props {
    siblings: CatalogSibling[];
    /** id del registro en curso; null al crear (todavia no existe). */
    currentId: number | null;
    /** Nombre que se esta escribiendo, para verlo moverse en la lista. */
    currentName: string;
    /** Posicion 0-based dentro de la lista. */
    position: number;
    onChange: (position: number) => void;
    help?: string;
}

/**
 * Orden dentro del catalogo, sobre la lista real.
 *
 * Sustituye al campo numerico `sort_order`: escribir «3» no dice entre que dos registros
 * queda, y con dos catalogos distintos el mismo numero significa cosas distintas. Aqui se
 * ve el sitio.
 */
export function CatalogOrderField({ siblings, currentId, currentName, position, onChange, help }: Props) {
    /** La lista con el registro en curso ya colocado en su posicion. */
    const rows = useMemo(() => {
        const others = siblings.filter((sibling) => sibling.id !== currentId);
        const current = { id: currentId ?? -1, name: currentName || 'Este registro', is_active: true, current: true };
        const list: (CatalogSibling & { current?: boolean })[] = others.map((sibling) => ({ ...sibling }));

        const index = Math.max(0, Math.min(position, list.length));
        list.splice(index, 0, current);

        return list;
    }, [siblings, currentId, currentName, position]);

    const max = rows.length - 1;
    const index = rows.findIndex((row) => row.current);

    return (
        <div className="min-w-0">
            <div
                className="overflow-hidden rounded-[12px]"
                style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
            >
                {rows.map((row, rowIndex) => (
                    <div
                        key={row.current ? 'current' : row.id}
                        className={`flex items-center gap-2.5 px-2.5 py-2 ${row.current ? 'emp-seg-on' : ''} ${
                            !row.current && !row.is_active ? 'emp-row-off' : ''
                        }`}
                        style={rowIndex > 0 ? { borderTop: '1px solid var(--emp-border)' } : undefined}
                    >
                        <span
                            className="w-5 shrink-0 text-[11px] tabular-nums"
                            style={{ color: row.current ? 'var(--emp-accent-on)' : 'var(--emp-subtle)' }}
                        >
                            {rowIndex + 1}
                        </span>

                        <span
                            className="min-w-0 flex-1 truncate text-[13px]"
                            style={{ color: row.current ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                        >
                            {row.name}
                            {!row.current && !row.is_active ? ' · inactiva' : ''}
                        </span>

                        {row.current ? (
                            <span className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    aria-label="Subir una posición"
                                    disabled={index <= 0}
                                    onClick={() => onChange(Math.max(0, index - 1))}
                                    className="flex items-center justify-center rounded-lg disabled:opacity-35"
                                    style={{
                                        width: '26px',
                                        height: '26px',
                                        border: '1px solid var(--emp-border)',
                                        color: 'var(--emp-muted)',
                                        backgroundColor: 'var(--emp-surface)',
                                    }}
                                >
                                    <CaretUp size={13} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Bajar una posición"
                                    disabled={index >= max}
                                    onClick={() => onChange(Math.min(max, index + 1))}
                                    className="flex items-center justify-center rounded-lg disabled:opacity-35"
                                    style={{
                                        width: '26px',
                                        height: '26px',
                                        border: '1px solid var(--emp-border)',
                                        color: 'var(--emp-muted)',
                                        backgroundColor: 'var(--emp-surface)',
                                    }}
                                >
                                    <CaretDown size={13} />
                                </button>
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>

            <p className="emp-help">
                {help ?? 'Reemplaza el campo numérico de orden: se mueve dentro de la lista real, no a ciegas.'}
            </p>
        </div>
    );
}

export default CatalogOrderField;
