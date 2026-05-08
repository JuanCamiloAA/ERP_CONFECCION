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
                $validator->errors()->add('file', 'Tipo de contenido no permitido: '.$mime);
            }
        });
    }
}
