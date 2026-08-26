import { Link } from '@inertiajs/react';
import { OperationActionsMenu, type OperationRowData } from '@/Components/Operations/OperationRow';
import { difficultyLabel } from '@/lib/difficulty';
import { formatCurrency } from '@/lib/utils';

interface Props {
    operation: OperationRowData;
    selected: boolean;
    onToggleSelect: (id: number) => void;
    onDelete: (operation: OperationRowData) => void;
}

/**
 * Operacion en movil.
 *
 * El precio no se edita aqui: la edicion en linea vive en la tabla de escritorio, donde
 * hay sitio para el campo y los dos botones. En el telefono, tocar el nombre abre la
 * ficha y el menu tiene el resto.
 */
export function OperationCard({ operation, selected, onToggleSelect, onDelete }: Props) {
    return (
        <article className={`emp-card flex items-start gap-3 p-3 ${operation.is_active ? '' : 'emp-row-off'}`}>
            <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(operation.id)}
                aria-label={`Seleccionar ${operation.name}`}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded"
                style={{ accentColor: 'var(--emp-accent)' }}
            />

            <div className="min-w-0 flex-1">
                <Link
                    href={route('operations.show', operation.id)}
                    className="block truncate text-[14px]"
                    style={{ color: 'var(--emp-text)' }}
                >
                    {operation.name}
                </Link>
                {operation.description ? (
                    <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {operation.description}
                    </p>
                ) : null}

                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="emp-pill">{formatCurrency(operation.base_price)}</span>
                    <span className="emp-pill">{difficultyLabel(operation.difficulty_level)}</span>
                    <span className={operation.is_active ? 'emp-pill' : 'emp-pill emp-pill-warn'}>
                        {operation.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                </div>
            </div>

            <OperationActionsMenu operation={operation} onDelete={onDelete} />
        </article>
    );
}

export default OperationCard;
