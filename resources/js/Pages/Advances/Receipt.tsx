import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import { amountToWords } from '@/lib/numberToWords';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Advance, Company, Employee } from '@/types';

interface Props {
    advance: Advance & {
        employee?: Employee;
        creator?: { id: number; name: string; last_name: string | null } | null;
    };
    company: Company | null;
    previous_balance: number;
    period: { start: string | null; end: string | null; payroll_date: string | null; payroll_name: string | null };
    issued_by: string | null;
    /** 2 = original + copia; 1 = solo el original (reimpresión). */
    copies: number;
}

/**
 * Las dos copias de la hoja. Se recorren con un `map` para que la marcación no se
 * duplique a mano: si el comprobante cambia, cambia en las dos a la vez.
 */
const COPY_LABELS = ['Original — empresa', 'Copia — empleado'];

const PAYROLL_MODE_LABEL: Record<string, string> = {
    operations: 'Pago por operación',
    fixed_daily: 'Salario diario por jornada',
    hourly_legal: 'Jornada legal por horas',
};

export default function AdvanceReceipt({
    advance,
    company,
    previous_balance: previousBalance,
    period,
    issued_by: issuedBy,
    copies,
}: Props) {
    useEffect(() => {
        const timer = setTimeout(() => window.print(), 500);

        return () => clearTimeout(timer);
    }, []);

    const amount = Number(advance.amount);
    const previous = Number(previousBalance) || 0;
    const total = previous + amount;

    const companyName = company?.name ?? 'La empresa';
    const logoSrc = company?.logo ? mediaUrl(company.logo) : undefined;
    const companyMeta = [
        company?.nit ? `NIT ${company.nit}` : null,
        company?.address ?? null,
        company?.phone ?? null,
    ]
        .filter(Boolean)
        .join(' · ');

    const employeeName =
        `${advance.employee?.first_name ?? ''} ${advance.employee?.last_name ?? ''}`.trim() || 'Empleado';
    const documentLabel = advance.employee?.document_type || 'C.C.';
    const documentNumber = advance.employee?.document_number ?? '—';
    const payrollMode = PAYROLL_MODE_LABEL[advance.employee?.payroll_mode ?? 'operations'] ?? 'Pago por operación';

    const receiptNumber = String(advance.id).padStart(4, '0');
    const deliveryDate = formatDate(advance.date, "d 'de' MMMM 'de' yyyy");

    const hasPeriod = Boolean(period.start && period.end);
    const periodText = hasPeriod ? `${formatDate(period.start)} — ${formatDate(period.end)}` : '';
    const payrollLine = period.payroll_date
        ? `Nómina del ${formatDate(period.payroll_date)}`
        : 'Próxima nómina';

    const sheets = copies === 1 ? COPY_LABELS.slice(0, 1) : COPY_LABELS;

    /**
     * Una copia. Nunca lleva altura fija: se dimensiona por su contenido. Con altura fija
     * y flex, la franja de saldos (que recorta por el radio) se aplasta y desaparece.
     */
    const renderCopy = (label: string) => (
        <section className="rc-copy" key={label}>
            <header className="rc-head">
                <div className="rc-brand">
                    <div className="rc-logo">
                        {logoSrc ? <img src={logoSrc} alt={companyName} /> : <span>{companyName.charAt(0)}</span>}
                    </div>
                    <div>
                        <p className="rc-co">{companyName}</p>
                        {companyMeta ? <p className="rc-co-meta">{companyMeta}</p> : null}
                    </div>
                </div>
                <div className="rc-doc">
                    <p className="rc-kicker">Comprobante de anticipo</p>
                    <p className="rc-num">N.º {receiptNumber}</p>
                    <p className="rc-copy-label">{label}</p>
                </div>
            </header>

            <div className="rc-accent" />

            <div className="rc-value">
                <div>
                    <p className="rc-label">Valor entregado</p>
                    <p className="rc-amount">{formatCurrency(amount)}</p>
                    <p className="rc-words">{amountToWords(amount)}</p>
                </div>
                <div className="rc-value-right">
                    <p className="rc-label">Fecha de entrega</p>
                    <p className="rc-date">{deliveryDate}</p>
                    <p className="rc-way">Efectivo · caja del taller</p>
                </div>
            </div>

            <div className="rc-data">
                <div>
                    <p className="rc-label">Empleado</p>
                    <p className="rc-name">{employeeName}</p>
                    <p className="rc-sub">
                        {documentLabel} {documentNumber}
                    </p>
                </div>
                <div>
                    <p className="rc-label">Vinculación</p>
                    <p className="rc-name">{payrollMode}</p>
                    <p className="rc-sub">
                        {advance.employee?.hire_date ? `Ingreso ${formatDate(advance.employee.hire_date)}` : 'Ingreso —'}
                    </p>
                </div>
                <div>
                    <p className="rc-label">Motivo</p>
                    <p className="rc-name">{advance.reason || '—'}</p>
                    <p className="rc-sub">Solicitado por el empleado</p>
                </div>
            </div>

            {/* El empleado firma sabiendo el total que se le va a descontar, no solo lo que recibe. */}
            <div className="rc-strip">
                <div className="rc-cell">
                    <p className="rc-label">Saldo anterior</p>
                    <p className="rc-cell-v">{formatCurrency(previous)}</p>
                    <p className="rc-cell-m">Anticipos sin descontar</p>
                </div>
                <div className="rc-cell">
                    <p className="rc-label">Este anticipo</p>
                    <p className="rc-cell-v">{formatCurrency(amount)}</p>
                    <p className="rc-cell-m">Entregado hoy</p>
                </div>
                <div className="rc-cell rc-cell-total">
                    <p className="rc-label">Total a descontar</p>
                    <p className="rc-cell-v">{formatCurrency(total)}</p>
                    <p className="rc-cell-m">{payrollLine}</p>
                </div>
            </div>

            {/* La referencia al art. 149 del CST es lo que le da valor a la firma. */}
            <p className="rc-clause">
                Declaro haber recibido de <strong>{companyName}</strong> la suma aquí indicada como anticipo de mi
                salario, y autorizo por escrito que se descuente de mi liquidación{' '}
                {hasPeriod ? (
                    <>
                        del periodo <strong>{periodText}</strong>
                    </>
                ) : (
                    // Sin nomina abierta la frase tiene que seguir siendo gramatical y verificable.
                    <>
                        de <strong>la próxima nómina que se liquide</strong>
                    </>
                )}
                ; si el neto no alcanza a cubrirla, el saldo se descuenta en los periodos siguientes. Art. 149 del
                Código Sustantivo del Trabajo.
            </p>

            <div className="rc-signs">
                <div className="rc-sign-space" />
                <div className="rc-sign-space" />
                <div className="rc-fp-box">
                    <span>Huella</span>
                </div>

                <div>
                    <p className="rc-sign-t">Recibí conforme — {employeeName}</p>
                    <p className="rc-sub">
                        {documentLabel} {documentNumber}
                    </p>
                </div>
                <div>
                    <p className="rc-sign-t">Entregado por — {issuedBy ?? '—'}</p>
                    <p className="rc-sub">Firma y sello de la empresa</p>
                </div>
            </div>

            <p className="rc-foot">
                Anticipo #{advance.id} · registrado el {formatDate(advance.created_at)} por {issuedBy ?? '—'} · saldo
                tras la entrega {formatCurrency(total)} · {label}. Documento interno de control de nómina; no constituye
                factura ni soporte tributario.
            </p>
        </section>
    );

    return (
        <>
            <Head title={`Comprobante de anticipo N.º ${receiptNumber}`} />

            <style>{`
                /* Sin margen de pagina: el navegador deja de imprimir su encabezado de URL y fecha. */
                @page { size: letter; margin: 0; }

                .rc-desk { background: #ececef; padding: 8mm 0; min-height: 100vh; }

                .rc-sheet {
                    box-sizing: border-box;
                    width: 216mm;
                    min-height: 279mm;
                    margin: 0 auto;
                    /* 10mm vertical: con 12mm la segunda copia se recorta. */
                    padding: 10mm 13mm;
                    background: #fff;
                    color: #1b1b1f;
                    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
                    font-variant-numeric: tabular-nums;
                    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.12);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .rc-copy { break-inside: avoid; page-break-inside: avoid; }

                /* ------------------------------------------------------ cabecera */
                .rc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
                .rc-brand { display: flex; align-items: center; gap: 3mm; min-width: 0; }
                .rc-logo {
                    width: 12mm; height: 12mm; flex: 0 0 12mm;
                    display: flex; align-items: center; justify-content: center;
                    border: 1px solid #d9d9e0; border-radius: 1.6mm; overflow: hidden;
                    background: #fafafc; color: #6f61c4; font-size: 13pt; font-weight: 600;
                }
                .rc-logo img { width: 100%; height: 100%; object-fit: contain; }
                .rc-co {
                    font-size: 11pt; font-weight: 600; line-height: 1.2; margin: 0;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-co-meta {
                    font-size: 7.5pt; color: #5c5c66; line-height: 1.35; margin: 0.7mm 0 0;
                    /* Una linea: una direccion larga no puede empujar la segunda copia fuera de la hoja. */
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 105mm;
                }
                .rc-doc { text-align: right; flex: 0 0 auto; }
                .rc-kicker {
                    font-size: 7pt; text-transform: uppercase; letter-spacing: 0.09em;
                    color: #6b6b75; margin: 0;
                }
                .rc-num { font-size: 13pt; font-weight: 600; line-height: 1.15; margin: 0.6mm 0 0; }
                .rc-copy-label { font-size: 7.5pt; color: #6f61c4; margin: 0.6mm 0 0; }

                .rc-accent { height: 1.2pt; background: #6f61c4; margin: 2.5mm 0 0; }

                /* --------------------------------------------------------- valor */
                .rc-label {
                    font-size: 7pt; text-transform: uppercase; letter-spacing: 0.09em;
                    color: #6b6b75; margin: 0;
                }
                .rc-value {
                    display: flex; align-items: flex-end; justify-content: space-between;
                    gap: 8mm; padding: 2.5mm 0 2mm;
                }
                .rc-amount { font-size: 19pt; font-weight: 600; line-height: 1.1; margin: 1mm 0 0; }
                .rc-words {
                    font-size: 8pt; color: #3f3f48; line-height: 1.35; margin: 1mm 0 0; max-width: 130mm;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-value-right { text-align: right; flex: 0 0 auto; }
                .rc-date { font-size: 11pt; font-weight: 500; line-height: 1.2; margin: 1mm 0 0; }
                .rc-way { font-size: 7.5pt; color: #6b6b75; margin: 0.8mm 0 0; }

                /* --------------------------------------------------------- datos */
                .rc-data {
                    display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 6mm;
                    border-top: 1px solid #e3e3e9; padding-top: 2.5mm;
                }
                .rc-name {
                    font-size: 10pt; line-height: 1.25; margin: 1.2mm 0 0;
                    /* Dos lineas como techo: el motivo es texto libre y la hoja no puede crecer. */
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-sub { font-size: 7.5pt; color: #6b6b75; line-height: 1.3; margin: 0.7mm 0 0; }

                /* -------------------------------------------------- franja saldos */
                .rc-strip {
                    display: grid; grid-template-columns: 1fr 1fr 1fr;
                    border: 1px solid #dcdce3; border-radius: 2mm; overflow: hidden;
                    margin-top: 3mm;
                }
                .rc-cell { padding: 2.2mm 3mm; border-left: 1px solid #dcdce3; }
                .rc-cell:first-child { border-left: 0; }
                .rc-cell-v { font-size: 11.5pt; font-weight: 600; line-height: 1.15; margin: 1mm 0 0; }
                .rc-cell-m {
                    font-size: 7pt; color: #6b6b75; margin: 0.8mm 0 0;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                /* Tinte y color de marca; en blanco y negro el rotulo sigue diciendo que es el total. */
                .rc-cell-total { background: #f4f2fb; color: #3f3583; }
                .rc-cell-total .rc-label, .rc-cell-total .rc-cell-m { color: #5b5195; }

                /* ------------------------------------------------------ clausula */
                .rc-clause {
                    font-size: 7.8pt; line-height: 1.5; text-align: justify;
                    color: #35353d; margin: 2.5mm 0 0;
                }
                .rc-clause strong { font-weight: 600; }

                /* -------------------------------------------------------- firmas */
                .rc-signs {
                    display: grid; grid-template-columns: 1fr 1fr 17mm;
                    /* Fila 1: el hueco donde se firma, con la linea como borde inferior.
                       Al compartir fila, las dos lineas quedan siempre a la misma altura. */
                    grid-template-rows: 8mm auto;
                    column-gap: 7mm; margin-top: 3mm;
                }
                .rc-sign-space { border-bottom: 1px solid #33333c; }
                .rc-sign-t {
                    font-size: 8pt; line-height: 1.3; margin: 1.4mm 0 0;
                    /* Un renglon: si el rotulo creciera, las dos copias dejarian de caber
                       en la hoja. El nombre completo esta arriba, en el bloque Empleado. */
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .rc-fp-box {
                    /* Sin span: se desborda 6mm sobre una celda vacia y no alarga la hoja. */
                    align-self: start;
                    width: 17mm; height: 14mm; border: 1px solid #b8b8c0; border-radius: 1mm;
                    display: flex; align-items: flex-start; justify-content: center; padding-top: 1mm;
                }
                .rc-fp-box span {
                    font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: #9a9aa4;
                }

                /* ---------------------------------------------------------- pie */
                .rc-foot {
                    font-size: 6.8pt; color: #7a7a84; line-height: 1.4;
                    border-top: 1px solid #e3e3e9; padding-top: 1.5mm; margin: 2.5mm 0 0;
                }

                /* ------------------------------------------------------- corte */
                .rc-cut { padding: 1.5mm 0; }
                .rc-cut-rule { height: 0; border-top: 1px dashed #b8b8c0; }
                .rc-cut-t {
                    font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.12em;
                    color: #9a9aa4; text-align: center; margin: 1mm 0;
                }

                /* ------------------------------------------------- solo pantalla */
                .rc-bar {
                    position: fixed; right: 6mm; top: 6mm; z-index: 10;
                    display: flex; gap: 6px;
                }
                .rc-btn {
                    border: 1px solid #6f61c4; background: #fff; color: #4a3fa0;
                    border-radius: 6px; padding: 7px 14px; font-size: 12px; cursor: pointer;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                @media print {
                    .rc-desk { background: #fff; padding: 0; min-height: 0; }
                    .rc-sheet { box-shadow: none; min-height: 0; margin: 0; }
                    .rc-noprint { display: none !important; }
                }
            `}</style>

            <div className="rc-desk">
                <div className="rc-bar rc-noprint">
                    <button type="button" className="rc-btn" onClick={() => window.print()}>
                        Imprimir
                    </button>
                </div>

                <div className="rc-sheet">
                    {sheets.map((label, index) => (
                        <div key={label}>
                            {renderCopy(label)}
                            {index < sheets.length - 1 ? (
                                <div className="rc-cut" aria-hidden="true">
                                    <div className="rc-cut-rule" />
                                    <p className="rc-cut-t">Corte aquí</p>
                                    <div className="rc-cut-rule" />
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
