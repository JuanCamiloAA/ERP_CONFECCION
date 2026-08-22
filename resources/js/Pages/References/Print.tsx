import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import { formatCurrency, formatNumber } from '@/lib/utils';

/** Linea del detalle de operaciones, tal como la arma App\Services\References\ReferenceExportData. */
interface PrintOperation {
    operation_id: number;
    name: string;
    description: string | null;
    price: number;
    minutes: number;
    minutes_inherited: boolean;
    difficulty_level: number | null;
    difficulty_label: string;
    is_active: boolean;
    status_label: string;
    cost_share: number | null;
    lot_total: number;
    produced: number;
    pending: number | null;
}

interface PrintReference {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    status_label: string;
    image_url: string | null;
    created_at: string | null;
    updated_at: string | null;
    lot_total_quantity: number;
    payment_per_unit: number;
    payment_defined: boolean;
    operational_cost_per_unit: number;
    margin_per_unit: number;
    margin_ratio: number | null;
    lot_payment_total: number;
    lot_operational_total: number;
    lot_margin_total: number;
    operations_count: number;
    operations_active_count: number;
    operations_completed_count: number;
    total_minutes: number;
    produced_max_per_operation: number;
    produced_total: number;
    pending_units: number | null;
    progress_ratio: number | null;
    operations: PrintOperation[];
}

interface Props {
    company: { name: string; nit: string | null; address: string | null; phone: string | null; logo: string | null };
    currency: string;
    generated_at: string;
    totals: {
        references: number;
        active: number;
        inactive: number;
        operations: number;
        lot_units: number;
        lot_payment_total: number;
        lot_operational_total: number;
        lot_margin_total: number;
    };
    references: PrintReference[];
}

function percent(ratio: number | null): string {
    return ratio == null ? '—' : `${(ratio * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

/**
 * Ficha imprimible de referencias: la salida «PDF» de la exportacion.
 *
 * Igual que el comprobante de nomina, el PDF lo produce el navegador desde esta pantalla
 * (Imprimir > Guardar como PDF). Evita un motor de PDF en el servidor y, sobre todo,
 * imprime la foto real de la prenda con la calidad que tenga el archivo original.
 *
 * Los datos llegan ya calculados desde el backend —costo operacional, margenes, avance—,
 * para que el papel diga exactamente lo mismo que el Excel y que la ficha en pantalla.
 */
export default function ReferencesPrint({ company, currency, generated_at, totals, references }: Props) {
    // Imprimir antes de que carguen las fotos sacaria huecos en blanco: se espera a que
    // todas resuelvan (o fallen) y solo entonces se abre el cuadro de impresion.
    useEffect(() => {
        let printed = false;
        const print = () => {
            if (printed) return;
            printed = true;
            window.print();
        };

        const pending = Array.from(document.images).filter((img) => !img.complete);
        const fallback = window.setTimeout(print, 6000);

        if (pending.length === 0) {
            const soon = window.setTimeout(print, 400);
            return () => {
                window.clearTimeout(soon);
                window.clearTimeout(fallback);
            };
        }

        let left = pending.length;
        const tick = () => {
            left -= 1;
            if (left <= 0) window.setTimeout(print, 250);
        };

        pending.forEach((img) => {
            img.addEventListener('load', tick);
            img.addEventListener('error', tick);
        });

        return () => {
            window.clearTimeout(fallback);
            pending.forEach((img) => {
                img.removeEventListener('load', tick);
                img.removeEventListener('error', tick);
            });
        };
    }, []);

    const logoSrc = company.logo ? mediaUrl(company.logo) : undefined;
    const varias = references.length > 1;

    const encabezado = (titulo: string, subtitulo: string) => (
        <header className="rp-header">
            <div className="rp-brand">
                <div className="rp-logo">{logoSrc ? <img src={logoSrc} alt={company.name} /> : <span>{company.name.charAt(0)}</span>}</div>
                <div>
                    <p className="rp-company">{company.name}</p>
                    {company.nit ? <p className="rp-meta">NIT {company.nit}</p> : null}
                    {company.address ? <p className="rp-meta">{company.address}</p> : null}
                    {company.phone ? <p className="rp-meta">Tel: {company.phone}</p> : null}
                </div>
            </div>
            <div className="rp-doc">
                <p className="rp-kicker">Catálogo de referencias</p>
                <p className="rp-title">{titulo}</p>
                <p className="rp-accent">{subtitulo}</p>
                <p className="rp-meta">Generado el {generated_at}</p>
            </div>
        </header>
    );

    const pie = (
        <footer className="rp-foot">
            <span>
                {company.name}
                {company.nit ? ` · NIT ${company.nit}` : ''} · Ficha técnica de referencia
            </span>
            <span>Valores en {currency} · {generated_at}</span>
        </footer>
    );

    const dato = (etiqueta: string, valor: string, ayuda?: string) => (
        <div className="rp-box">
            <p className="rp-box-k">{etiqueta}</p>
            <p className="rp-box-v">{valor}</p>
            {ayuda ? <p className="rp-box-h">{ayuda}</p> : null}
        </div>
    );

    return (
        <>
            <Head title={varias ? `Imprimir ${references.length} referencias` : `Imprimir ${references[0]?.code ?? 'referencia'}`} />
            <style>{`
                @page { size: letter; margin: 12mm; }

                .rp {
                    --ink: #111827;
                    --muted: #6b7280;
                    --faint: #9ca3af;
                    --line: #e5e7eb;
                    --accent: #4338ca;
                    --panel: #f9fafb;
                    color: var(--ink);
                    background: #fff;
                    font-variant-numeric: tabular-nums;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .rp-page { max-width: 62rem; margin: 0 auto; padding: 2rem; }
                .rp-sheet + .rp-sheet { margin-top: 3rem; padding-top: 2rem; border-top: 2px dashed var(--line); }

                .rp-header { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start;
                    padding-bottom: 0.9rem; border-bottom: 2px solid var(--ink); }
                .rp-brand { display: flex; gap: 0.75rem; align-items: flex-start; }
                .rp-logo { width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
                    display: flex; align-items: center; justify-content: center; background: var(--panel);
                    font-size: 18px; font-weight: 700; color: var(--muted); flex: none; }
                .rp-logo img { width: 100%; height: 100%; object-fit: contain; }
                .rp-company { font-size: 14px; font-weight: 700; }
                .rp-meta { font-size: 10px; color: var(--muted); }
                .rp-doc { text-align: right; }
                .rp-kicker { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
                .rp-title { font-size: 17px; font-weight: 700; }
                .rp-accent { font-size: 12px; font-weight: 600; color: var(--accent); }

                .rp-sec { display: flex; align-items: center; gap: 0.6rem; margin: 1.3rem 0 0.6rem; }
                .rp-sec-t { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
                .rp-sec-line { flex: 1; height: 1px; background: var(--line); }
                .rp-sec-m { font-size: 10px; color: var(--faint); }

                .rp-id { display: flex; gap: 1.25rem; align-items: flex-start; }
                .rp-photo { width: 190px; height: 190px; flex: none; border: 1px solid var(--line); border-radius: 10px;
                    overflow: hidden; background: var(--panel); display: flex; align-items: center; justify-content: center; }
                .rp-photo img { width: 100%; height: 100%; object-fit: cover; }
                .rp-photo span { font-size: 10px; color: var(--faint); text-align: center; padding: 0 0.5rem; }
                .rp-id-data { flex: 1; min-width: 0; }
                .rp-ref-code { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
                .rp-ref-name { font-size: 13px; color: var(--muted); }
                .rp-chip { display: inline-block; margin-left: 0.5rem; padding: 0.1rem 0.5rem; border-radius: 999px;
                    border: 1px solid var(--line); font-size: 10px; font-weight: 600; vertical-align: middle; }
                .rp-chip-on { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
                .rp-chip-off { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
                .rp-desc { margin-top: 0.6rem; font-size: 11px; white-space: pre-line; }
                .rp-dates { margin-top: 0.6rem; font-size: 10px; color: var(--muted); }

                .rp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
                .rp-grid-3 { grid-template-columns: repeat(3, 1fr); }
                .rp-box { border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem 0.6rem; background: #fff; }
                .rp-box-k { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
                .rp-box-v { font-size: 14px; font-weight: 700; margin-top: 0.1rem; }
                .rp-box-h { font-size: 9px; color: var(--muted); margin-top: 0.1rem; }
                .rp-box-strong { background: #eef2ff; border-color: #c7d2fe; }

                .rp-note { margin-top: 0.5rem; font-size: 10px; color: var(--muted); line-height: 1.5; }

                table.rp-t { width: 100%; border-collapse: collapse; font-size: 10.5px; }
                table.rp-t th { background: #312e81; color: #fff; font-weight: 600; text-align: left;
                    padding: 0.35rem 0.45rem; border: 1px solid #312e81; }
                table.rp-t td { padding: 0.32rem 0.45rem; border: 1px solid var(--line); }
                table.rp-t tbody tr:nth-child(even) td { background: #fafafa; }
                table.rp-t .n { text-align: right; }
                table.rp-t .c { text-align: center; }
                table.rp-t tfoot td { background: #eef2ff; font-weight: 700; border-color: #c7d2fe; }
                .rp-off { color: var(--muted); }

                .rp-foot { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem;
                    padding-top: 0.5rem; border-top: 1px solid var(--line); font-size: 9px; color: var(--faint); }

                .rp-actions { margin-top: 2rem; text-align: center; }
                .rp-btn { background: var(--accent); color: #fff; border: 0; border-radius: 8px;
                    padding: 0.6rem 1.4rem; font-size: 13px; font-weight: 600; cursor: pointer; }
                .rp-hint { margin-top: 0.5rem; font-size: 11px; color: var(--muted); }

                @media print {
                    .rp-page { padding: 0; max-width: none; }
                    .no-print { display: none !important; }
                    .rp-sheet { break-after: page; page-break-after: always; }
                    .rp-sheet:last-of-type { break-after: auto; page-break-after: auto; }
                    .rp-sheet + .rp-sheet { margin-top: 0; padding-top: 0; border-top: 0; }
                    table.rp-t { break-inside: auto; }
                    table.rp-t tr { break-inside: avoid; page-break-inside: avoid; }
                    .rp-id { break-inside: avoid; page-break-inside: avoid; }
                }
            `}</style>

            <div className="rp">
                <div className="rp-page">
                    {/* Con varias referencias, primero la hoja consolidada de la seleccion. */}
                    {varias ? (
                        <section className="rp-sheet">
                            {encabezado('Resumen de la selección', `${totals.references} referencias`)}

                            <div className="rp-sec">
                                <span className="rp-sec-t">Consolidado</span>
                                <span className="rp-sec-line" />
                                <span className="rp-sec-m">
                                    {totals.active} activas · {totals.inactive} inactivas · {totals.operations} operaciones
                                </span>
                            </div>

                            <div className="rp-grid">
                                {dato('Unidades de lote', formatNumber(totals.lot_units), 'Suma de los lotes')}
                                {dato('Total pago de los lotes', formatCurrency(totals.lot_payment_total, currency))}
                                {dato('Total costo operacional', formatCurrency(totals.lot_operational_total, currency))}
                                {dato('Margen de los lotes', formatCurrency(totals.lot_margin_total, currency))}
                            </div>

                            <div className="rp-sec">
                                <span className="rp-sec-t">Referencias</span>
                                <span className="rp-sec-line" />
                            </div>

                            <table className="rp-t">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Nombre</th>
                                        <th className="c">Estado</th>
                                        <th className="n">Lote</th>
                                        <th className="n">Pago u.</th>
                                        <th className="n">Costo op. u.</th>
                                        <th className="n">Margen u.</th>
                                        <th className="n">Total costo op. lote</th>
                                        <th className="n">Margen del lote</th>
                                        <th className="c">Ops.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {references.map((ref) => (
                                        <tr key={ref.id}>
                                            <td>{ref.code}</td>
                                            <td>{ref.name}</td>
                                            <td className={`c ${ref.is_active ? '' : 'rp-off'}`}>{ref.status_label}</td>
                                            <td className="n">{formatNumber(ref.lot_total_quantity)}</td>
                                            <td className="n">
                                                {ref.payment_defined ? formatCurrency(ref.payment_per_unit, currency) : '—'}
                                            </td>
                                            <td className="n">{formatCurrency(ref.operational_cost_per_unit, currency)}</td>
                                            <td className="n">{formatCurrency(ref.margin_per_unit, currency)}</td>
                                            <td className="n">{formatCurrency(ref.lot_operational_total, currency)}</td>
                                            <td className="n">{formatCurrency(ref.lot_margin_total, currency)}</td>
                                            <td className="c">
                                                {ref.operations_completed_count}/{ref.operations_count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3}>TOTAL · {totals.references} referencias</td>
                                        <td className="n">{formatNumber(totals.lot_units)}</td>
                                        <td className="n" />
                                        <td className="n" />
                                        <td className="n" />
                                        <td className="n">{formatCurrency(totals.lot_operational_total, currency)}</td>
                                        <td className="n">{formatCurrency(totals.lot_margin_total, currency)}</td>
                                        <td className="c">{totals.operations}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {pie}
                        </section>
                    ) : null}

                    {references.map((ref) => (
                        <section key={ref.id} className="rp-sheet">
                            {encabezado('Ficha técnica de referencia', `${ref.code} · ${ref.name}`)}

                            {/* --------------------------------------------- Identidad */}
                            <div className="rp-sec">
                                <span className="rp-sec-t">Identidad</span>
                                <span className="rp-sec-line" />
                                <span className="rp-sec-m">
                                    {ref.created_at ? `Creada el ${ref.created_at}` : ''}
                                    {ref.updated_at ? ` · Actualizada el ${ref.updated_at}` : ''}
                                </span>
                            </div>

                            <div className="rp-id">
                                <div className="rp-photo">
                                    {ref.image_url ? (
                                        <img src={ref.image_url} alt={`${ref.code} — ${ref.name}`} />
                                    ) : (
                                        <span>Sin imagen cargada</span>
                                    )}
                                </div>
                                <div className="rp-id-data">
                                    <p className="rp-ref-code">
                                        {ref.code}
                                        <span className={`rp-chip ${ref.is_active ? 'rp-chip-on' : 'rp-chip-off'}`}>{ref.status_label}</span>
                                    </p>
                                    <p className="rp-ref-name">{ref.name}</p>
                                    <p className="rp-desc">{ref.description || 'Sin descripción.'}</p>
                                    <p className="rp-dates">
                                        {ref.operations_count} {ref.operations_count === 1 ? 'operación' : 'operaciones'} ·{' '}
                                        {formatNumber(ref.total_minutes)} min por unidad · lote de {formatNumber(ref.lot_total_quantity)} u.
                                    </p>
                                </div>
                            </div>

                            {/* ---------------------------------------- Dinero y costo */}
                            <div className="rp-sec">
                                <span className="rp-sec-t">Dinero y costo operacional</span>
                                <span className="rp-sec-line" />
                                <span className="rp-sec-m">Valores en {currency}</span>
                            </div>

                            <div className="rp-grid">
                                {dato(
                                    'Valor unitario de pago',
                                    ref.payment_defined ? formatCurrency(ref.payment_per_unit, currency) : 'Sin definir',
                                    'Lo que reciben por unidad',
                                )}
                                {dato('Costo operacional por unidad', formatCurrency(ref.operational_cost_per_unit, currency), 'Suma del detalle')}
                                {dato('Margen por unidad', formatCurrency(ref.margin_per_unit, currency), `Margen ${percent(ref.margin_ratio)}`)}
                                {dato('Cantidad total del lote', formatNumber(ref.lot_total_quantity), 'Tope por operación')}
                            </div>

                            <div className="rp-grid rp-grid-3" style={{ marginTop: '0.5rem' }}>
                                <div className="rp-box rp-box-strong">
                                    <p className="rp-box-k">Total pago del lote</p>
                                    <p className="rp-box-v">{formatCurrency(ref.lot_payment_total, currency)}</p>
                                    <p className="rp-box-h">
                                        {formatCurrency(ref.payment_per_unit, currency)} × {formatNumber(ref.lot_total_quantity)} u.
                                    </p>
                                </div>
                                <div className="rp-box rp-box-strong">
                                    <p className="rp-box-k">Total costo operacional del lote</p>
                                    <p className="rp-box-v">{formatCurrency(ref.lot_operational_total, currency)}</p>
                                    <p className="rp-box-h">
                                        {formatCurrency(ref.operational_cost_per_unit, currency)} × {formatNumber(ref.lot_total_quantity)} u.
                                    </p>
                                </div>
                                <div className="rp-box rp-box-strong">
                                    <p className="rp-box-k">Margen del lote</p>
                                    <p className="rp-box-v">{formatCurrency(ref.lot_margin_total, currency)}</p>
                                    <p className="rp-box-h">
                                        {formatCurrency(ref.margin_per_unit, currency)} × {formatNumber(ref.lot_total_quantity)} u.
                                    </p>
                                </div>
                            </div>

                            <p className="rp-note">
                                El costo operacional por unidad es la suma de los precios de las {ref.operations_count}{' '}
                                {ref.operations_count === 1 ? 'operación' : 'operaciones'} de la referencia, incluidas las cerradas por lote
                                completo; el total del lote lo multiplica por las {formatNumber(ref.lot_total_quantity)} unidades vigentes.
                            </p>

                            {/* ------------------------------------------- Produccion */}
                            <div className="rp-sec">
                                <span className="rp-sec-t">Producción registrada</span>
                                <span className="rp-sec-line" />
                                <span className="rp-sec-m">Avance medido con la operación más adelantada</span>
                            </div>

                            <div className="rp-grid">
                                {dato('Operación más avanzada', formatNumber(ref.produced_max_per_operation), 'Unidades')}
                                {dato('Pendientes del lote', ref.pending_units == null ? '—' : formatNumber(ref.pending_units), 'Unidades')}
                                {dato('Avance del lote', percent(ref.progress_ratio), ref.progress_ratio == null ? 'Sin lote definido' : undefined)}
                                {dato(
                                    'Operaciones completadas',
                                    `${ref.operations_completed_count} de ${ref.operations_count}`,
                                    `Acumulado total: ${formatNumber(ref.produced_total)} u.`,
                                )}
                            </div>

                            {/* ------------------------------------------ Operaciones */}
                            <div className="rp-sec">
                                <span className="rp-sec-t">Operaciones · detalle del costo operacional</span>
                                <span className="rp-sec-line" />
                                <span className="rp-sec-m">
                                    {ref.operations_active_count} activas de {ref.operations_count}
                                </span>
                            </div>

                            {ref.operations.length === 0 ? (
                                <p className="rp-note">La referencia no tiene operaciones vinculadas.</p>
                            ) : (
                                <table className="rp-t">
                                    <thead>
                                        <tr>
                                            <th>Operación</th>
                                            <th className="n">Precio u.</th>
                                            <th className="n">% del costo</th>
                                            <th className="n">Minutos</th>
                                            <th className="c">Dificultad</th>
                                            <th className="c">Estado</th>
                                            <th className="n">Producidas</th>
                                            <th className="n">Pendientes</th>
                                            <th className="n">Total en el lote</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ref.operations.map((op) => (
                                            <tr key={op.operation_id}>
                                                <td>{op.name}</td>
                                                <td className="n">{formatCurrency(op.price, currency)}</td>
                                                <td className="n">{percent(op.cost_share)}</td>
                                                <td className="n">
                                                    {formatNumber(op.minutes)}
                                                    {op.minutes_inherited ? <span className="rp-off"> *</span> : null}
                                                </td>
                                                <td className="c">{op.difficulty_label}</td>
                                                <td className={`c ${op.is_active ? '' : 'rp-off'}`}>{op.status_label}</td>
                                                <td className="n">{formatNumber(op.produced)}</td>
                                                <td className="n">{op.pending == null ? '—' : formatNumber(op.pending)}</td>
                                                <td className="n">{formatCurrency(op.lot_total, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td>Costo operacional por unidad</td>
                                            <td className="n">{formatCurrency(ref.operational_cost_per_unit, currency)}</td>
                                            <td className="n">100%</td>
                                            <td className="n">{formatNumber(ref.total_minutes)}</td>
                                            <td className="c" colSpan={4} />
                                            <td className="n">{formatCurrency(ref.lot_operational_total, currency)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {ref.operations.some((op) => op.minutes_inherited) ? (
                                <p className="rp-note">* Minutos heredados del dato maestro de la operación (la línea no tiene los suyos).</p>
                            ) : null}

                            {pie}
                        </section>
                    ))}

                    <div className="no-print rp-actions">
                        <button onClick={() => window.print()} className="rp-btn">
                            Imprimir o guardar PDF
                        </button>
                        <p className="rp-hint">
                            Para guardar como PDF: en el cuadro de impresión elige el destino «Guardar como PDF»
                            {varias ? ' · cada referencia sale en su propia hoja.' : '.'}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
