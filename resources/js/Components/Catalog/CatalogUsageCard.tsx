import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

export interface CatalogUsage {
    count: number;
    year_total: number;
    last_used_at: string | null;
}

interface Props {
    usage: CatalogUsage;
    /** «Gastos registrados» / «Nóminas con este concepto». */
    countLabel: string;
    totalLabel: string;
    lastLabel: string;
}

/**
 * Uso real del registro del catalogo.
 *
 * Es lo que decide si se puede eliminar, asi que la ficha lo muestra en vez de dejar al
 * usuario descubrirlo cuando el servidor rechaza el borrado.
 */
export function CatalogUsageCard({ usage, countLabel, totalLabel, lastLabel }: Props) {
    return (
        <EmployeeAsideCard title="Uso">
            <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>{countLabel}</dt>
                    <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatNumber(usage.count)}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>{totalLabel}</dt>
                    <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(usage.year_total)}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>{lastLabel}</dt>
                    <dd style={{ color: 'var(--emp-text)' }}>
                        {usage.last_used_at ? formatDate(usage.last_used_at) : 'Nunca'}
                    </dd>
                </div>
            </dl>
        </EmployeeAsideCard>
    );
}

export default CatalogUsageCard;
