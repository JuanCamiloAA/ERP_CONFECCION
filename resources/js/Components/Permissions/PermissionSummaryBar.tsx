import { ArrowUUpLeft, CaretDown, CheckCircle, PencilSimple } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

interface Props {
    /** Lo guardado hoy. */
    baseline: string[];
    /** Lo que hay ahora en pantalla. */
    value: string[];
    onDiscard: () => void;
    /** `permiso => "Módulo · Etiqueta"`. */
    labels?: Record<string, string>;
    /** En la página del rol se pega abajo; en el modal es el pie del diálogo. */
    sticky?: boolean;
}

/**
 * Cuántos cambios llevas sin guardar, y cuáles.
 *
 * Marcar veinte pastillas y no poder repasarlas antes de guardar es la forma más fácil de
 * dejar a alguien sin un permiso sin enterarse. Aquí el recuento está siempre a la vista y
 * el detalle se abre sin salir de la pantalla.
 */
export function PermissionSummaryBar({ baseline, value, onDiscard, labels = {}, sticky = false }: Props) {
    const [open, setOpen] = useState(false);

    const { added, removed } = useMemo(() => {
        const before = new Set(baseline);
        const after = new Set(value);

        return {
            added: value.filter((name) => ! before.has(name)),
            removed: baseline.filter((name) => ! after.has(name)),
        };
    }, [baseline, value]);

    const total = added.length + removed.length;
    const label = (name: string) => labels[name] ?? name;

    return (
        <div
            className={sticky ? 'sticky bottom-0 z-10 mt-3' : 'mt-3'}
            style={
                sticky
                    ? { backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }
                    : undefined
            }
        >
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                    {total === 0 ? (
                        <>
                            <CheckCircle size={14} style={{ color: 'var(--emp-ok)' }} />
                            Sin cambios desde lo guardado
                        </>
                    ) : (
                        <>
                            <PencilSimple size={14} style={{ color: 'var(--emp-accent-on)' }} />
                            <span style={{ color: 'var(--emp-accent-on)' }}>
                                {total} {total === 1 ? 'cambio' : 'cambios'} sin guardar
                            </span>
                        </>
                    )}
                </p>

                {total > 0 ? (
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onDiscard} className="emp-btn emp-btn-sm">
                            <ArrowUUpLeft size={13} />
                            Descartar
                        </button>
                        <button type="button" onClick={() => setOpen(! open)} className="emp-btn emp-btn-sm">
                            {open ? 'Ocultar detalle' : 'Ver detalle'}
                            <CaretDown
                                size={12}
                                style={{
                                    transform: open ? 'rotate(180deg)' : undefined,
                                    transition: 'transform 120ms ease-out',
                                }}
                            />
                        </button>
                    </div>
                ) : null}
            </div>

            {open && total > 0 ? (
                <div className="grid grid-cols-1 gap-3 pb-2.5 sm:grid-cols-2">
                    <div>
                        <p className="emp-kicker">Se agregan ({added.length})</p>
                        <div className="mt-1 flex max-h-24 flex-wrap gap-1.5 overflow-auto">
                            {added.length === 0 ? (
                                <span className="text-[11.5px]" style={{ color: 'var(--emp-faint)' }}>
                                    Nada
                                </span>
                            ) : (
                                added.map((name) => (
                                    <span key={name} className="emp-pill emp-pill-accent" title={name}>
                                        {label(name)}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="emp-kicker">Se quitan ({removed.length})</p>
                        <div className="mt-1 flex max-h-24 flex-wrap gap-1.5 overflow-auto">
                            {removed.length === 0 ? (
                                <span className="text-[11.5px]" style={{ color: 'var(--emp-faint)' }}>
                                    Nada
                                </span>
                            ) : (
                                removed.map((name) => (
                                    <span key={name} className="emp-pill emp-pill-warn" title={name}>
                                        {label(name)}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default PermissionSummaryBar;
