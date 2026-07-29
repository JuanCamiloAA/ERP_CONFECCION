<?php

namespace App\Http\Requests\SuperAdmin;

use App\Models\DataImportBatch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreDataImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(DataImportBatch::types())],
            'file' => ['required', 'file', 'max:'.(int) config('data_import.max_upload_kb', 5120)],
            'company_import_mode' => ['nullable', 'string', Rule::in(['skip', 'update'])],
            'employee_update_existing' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $file = $this->file('file');
            if (! $file || $validator->errors()->has('file')) {
                return;
            }

            $ext = strtolower((string) $file->getClientOriginalExtension());
            if ($ext !== 'csv') {
                $validator->errors()->add('file', 'El archivo debe tener extension .csv');

                return;
            }

            $mime = (string) $file->getMimeType();
            $allowed = config('data_import.allowed_mimes', []);
            if ($allowed !== [] && ! in_array($mime, $allowed, true)) {
                $message = match ($mime) {
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'El archivo es un Excel (.xlsx), no un CSV. Aunque tenga extension .csv, el contenido sigue siendo Excel. En Excel: Archivo → Guardar como → «CSV UTF-8 (delimitado por comas) (.csv)». En Google Hojas: Descargar → Valores separados por comas (.csv).',
                    'application/vnd.ms-excel' => 'El archivo parece ser Excel (.xls), no CSV de texto. Exportelo como CSV UTF-8 desde Excel o Google Hojas.',
                    default => 'Tipo de contenido no permitido ('.$mime.'). Solo se aceptan archivos CSV de texto (UTF-8), no hojas de calculo.',
                };
                $validator->errors()->add('file', $message);
            }
        });
    }
}
