<?php

namespace App\Services\Payroll;

use App\Models\Payroll;
use App\Models\PayrollEmployee;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;

/**
 * Comprobante de nomina como PDF, generado en el servidor.
 *
 * La pantalla produce su PDF con `window.print()`, que solo existe si hay una persona con
 * un navegador abierto. Para adjuntarlo a un correo hace falta el archivo sin navegador de
 * por medio, y eso es lo unico que agrega esta clase: los datos y el maquetado son los del
 * mismo comprobante.
 */
class PayrollReceiptPdf
{
    public function __construct(private PayrollReceiptBuilder $builder) {}

    /** Contenido binario del PDF, listo para adjuntar o descargar. */
    public function render(Payroll $payroll, PayrollEmployee $row): string
    {
        $data = $this->builder->build($payroll, $row);

        return Pdf::loadView('pdf.payroll-receipt', $data)
            ->setPaper('letter')
            ->output();
    }

    /**
     * Nombre del archivo adjunto. Lleva empleado y periodo porque el empleado va a
     * acumular uno por quincena en la misma carpeta de descargas.
     */
    public function filename(Payroll $payroll, PayrollEmployee $row): string
    {
        $name = trim(($row->employee->first_name ?? '').' '.($row->employee->last_name ?? '')) ?: 'empleado';

        return Str::slug('comprobante-'.$name.'-'.$payroll->name).'.pdf';
    }
}
