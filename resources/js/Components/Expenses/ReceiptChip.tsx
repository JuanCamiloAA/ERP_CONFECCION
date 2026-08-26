import { FilePdf, Image as ImageIcon, WarningCircle } from '@phosphor-icons/react';
import { receiptKind, RECEIPT_LABEL, type ExpenseRowLike } from '@/lib/expenses';

/**
 * Estado del comprobante de un gasto.
 *
 * «Falta» se pinta en `emp-pill-warn` porque no es un dato vacio: el comprobante es
 * obligatorio al registrar, asi que un gasto sin el es un pendiente real, no una celda
 * en blanco.
 */
export function ReceiptChip({ expense }: { expense: Pick<ExpenseRowLike, 'receipt_url' | 'receipt_mime'> }) {
    const kind = receiptKind(expense);

    if (kind === 'missing') {
        return (
            <span className="emp-pill emp-pill-warn">
                <WarningCircle size={12} />
                {RECEIPT_LABEL.missing}
            </span>
        );
    }

    return (
        <a
            href={expense.receipt_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="emp-pill"
            style={{ textDecoration: 'none' }}
            title="Abrir el comprobante en una pestaña nueva"
        >
            {kind === 'pdf' ? <FilePdf size={12} /> : <ImageIcon size={12} />}
            {RECEIPT_LABEL[kind]}
        </a>
    );
}

export default ReceiptChip;
