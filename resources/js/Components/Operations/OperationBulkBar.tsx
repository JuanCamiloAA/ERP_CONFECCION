import { Check, Prohibit } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import { formatNumber } from '@/lib/utils';

interface Props {
    count: number;
    onActivate: () => void;
    onDeactivate: () => void;
    onClear: () => void;
}

/**
 * Acciones sobre la seleccion.
 *
 * Aparece solo cuando hay algo marcado: una barra permanente vacia ocupa sitio y no
 * responde a ninguna pregunta.
 */
export function OperationBulkBar({ count, onActivate, onDeactivate, onClear }: Props) {
    if (count === 0) {
        return null;
    }

    return (
        <div className="emp-note flex flex-wrap items-center justify-between gap-2">
            <span style={{ color: 'var(--emp-text)' }}>
                {formatNumber(count)} {count === 1 ? 'operación seleccionada' : 'operaciones seleccionadas'}
            </span>

            <div className="flex flex-wrap items-center gap-2">
                <Can permission="operations.index.edit">
                    <button type="button" onClick={onActivate} className="emp-btn emp-btn-sm">
                        <Check size={13} />
                        Activar
                    </button>
                </Can>
                <Can permission="operations.index.edit">
                    <button type="button" onClick={onDeactivate} className="emp-btn emp-btn-sm">
                        <Prohibit size={13} />
                        Inactivar
                    </button>
                </Can>
                <button type="button" onClick={onClear} className="emp-btn emp-btn-sm emp-btn-ghost">
                    Limpiar
                </button>
            </div>
        </div>
    );
}

export default OperationBulkBar;
