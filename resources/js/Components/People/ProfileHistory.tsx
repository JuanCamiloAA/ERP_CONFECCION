import { DownloadSimple } from '@phosphor-icons/react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EmployeeProfile } from '@/types';
import { EmptyRow, Restricted, ScrollTable, StatusTag } from './primitives';

/**
 * Producción, pagos y anticipos del empleado.
 *
 * Son tablas de consulta: la ficha las muestra, no las edita. Cada una desplaza en
 * horizontal dentro de su contenedor, que es lo que evita que la página entera se mueva
 * de lado en un teléfono.
 */
export function ProfileHistory({ profile }: { profile: EmployeeProfile }) {
    const { history, permissions, employeeId } = profile;
    const canSeeMoney = permissions.canViewSalary;

    return (
        <div className="space-y-6">
            {/* ------------------------------------------------------- producción */}
            <div>
                <p className="emp-kicker">Producción reciente</p>
                <ScrollTable>
                    <table className="mt-2 w-full min-w-[520px] text-[12.5px]">
                        <thead>
                            <tr className="emp-row-sep text-left">
                                <Th>Fecha</Th>
                                <Th>Referencia</Th>
                                <Th>Operación</Th>
                                <Th right>Cantidad</Th>
                                <Th right>Valor</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.productions.length === 0 ? (
                                <EmptyRow colSpan={5}>Sin registros de producción</EmptyRow>
                            ) : (
                                history.productions.map((row) => (
                                    <tr key={row.id} className="emp-row-sep emp-hover-row">
                                        <Td>{formatDate(row.date)}</Td>
                                        <Td>{row.reference ?? '—'}</Td>
                                        <Td>{row.operation ?? '—'}</Td>
                                        <Td right>{row.quantity.toLocaleString('es-CO')}</Td>
                                        <Td right strong>
                                            {canSeeMoney ? formatCurrency(row.total_value ?? 0) : <Restricted />}
                                        </Td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </ScrollTable>
            </div>

            {/* ------------------------------------------------------------ pagos */}
            <div>
                <p className="emp-kicker">Pagos por nómina</p>
                <ScrollTable>
                    <table className="mt-2 w-full min-w-[620px] text-[12.5px]">
                        <thead>
                            <tr className="emp-row-sep text-left">
                                <Th>Periodo</Th>
                                <Th right>Producido</Th>
                                <Th right>Anticipos</Th>
                                <Th right>Neto</Th>
                                <Th>Estado</Th>
                                <Th>Desprendible</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.payrolls.length === 0 ? (
                                <EmptyRow colSpan={6}>Sin pagos registrados</EmptyRow>
                            ) : (
                                history.payrolls.map((row) => (
                                    <tr key={row.id} className="emp-row-sep emp-hover-row">
                                        <Td>
                                            <span style={{ color: 'var(--emp-text)' }}>{row.name}</span>
                                            <span className="block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {formatDate(row.period_start)} – {formatDate(row.period_end)}
                                            </span>
                                        </Td>
                                        <Td right>{canSeeMoney ? formatCurrency(row.production_total ?? 0) : <Restricted />}</Td>
                                        <Td right>{canSeeMoney ? formatCurrency(row.advances_discount ?? 0) : <Restricted />}</Td>
                                        <Td right strong>
                                            {canSeeMoney ? formatCurrency(row.net_payment ?? 0) : <Restricted />}
                                        </Td>
                                        <Td>
                                            <StatusTag
                                                label={row.is_paid ? 'Pagado' : 'Pendiente'}
                                                tone={row.is_paid ? 'ok' : 'accent'}
                                            />
                                        </Td>
                                        <Td>
                                            {row.receipt_available ? (
                                                <a
                                                    className="emp-btn emp-btn-sm"
                                                    href={route('employees.receipt', [employeeId, row.id])}
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    <DownloadSimple size={13} aria-hidden="true" /> Descargar
                                                </a>
                                            ) : (
                                                <span style={{ color: 'var(--emp-faint)' }}>Al pagar la nómina</span>
                                            )}
                                        </Td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </ScrollTable>
            </div>

            {/* -------------------------------------------------------- anticipos */}
            <div>
                <p className="emp-kicker">Anticipos</p>
                {!canSeeMoney ? (
                    <p className="mt-2 text-[12.5px]">
                        <Restricted />
                    </p>
                ) : (
                    <ScrollTable>
                        <table className="mt-2 w-full min-w-[520px] text-[12.5px]">
                            <thead>
                                <tr className="emp-row-sep text-left">
                                    <Th>Fecha</Th>
                                    <Th>Motivo</Th>
                                    <Th right>Monto</Th>
                                    <Th right>Por descontar</Th>
                                    <Th>Estado</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.advances.length === 0 ? (
                                    <EmptyRow colSpan={5}>Sin anticipos</EmptyRow>
                                ) : (
                                    history.advances.map((row) => (
                                        <tr key={row.id} className="emp-row-sep emp-hover-row">
                                            <Td>{formatDate(row.date)}</Td>
                                            <Td>{row.reason ?? '—'}</Td>
                                            <Td right strong>
                                                {formatCurrency(row.amount)}
                                            </Td>
                                            <Td right>{formatCurrency(row.remaining_amount)}</Td>
                                            <Td>
                                                <StatusTag
                                                    label={row.status === 'descontado' ? 'Descontado' : 'Pendiente'}
                                                    tone={row.status === 'descontado' ? 'ok' : 'accent'}
                                                />
                                            </Td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </ScrollTable>
                )}
            </div>
        </div>
    );
}

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th
            scope="col"
            className={`pb-2 text-[11px] font-normal uppercase tracking-[0.09em] ${right ? 'text-right' : ''}`}
            style={{ color: 'var(--emp-subtle)' }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    right = false,
    strong = false,
}: {
    children: React.ReactNode;
    right?: boolean;
    strong?: boolean;
}) {
    return (
        <td
            className={`py-2 pr-3 align-top ${right ? 'text-right tabular-nums' : ''}`}
            style={{ color: strong ? 'var(--emp-text)' : 'var(--emp-muted)', fontWeight: strong ? 500 : undefined }}
        >
            {children}
        </td>
    );
}

export default ProfileHistory;
