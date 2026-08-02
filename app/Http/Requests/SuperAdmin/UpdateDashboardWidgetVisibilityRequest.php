<?php

namespace App\Http\Requests\SuperAdmin;

use App\Models\DashboardWidget;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateDashboardWidgetVisibilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'visibility' => ['present', 'array'],
            'visibility.*.company_id' => ['required', 'integer', 'exists:companies,id'],
            'visibility.*.role_id' => ['nullable', 'integer', 'exists:roles,id'],
            'visibility.*.position' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Regla de la seccion 2.4: si se asigna a una empresa/rol especifico, la tabla o el SQL
     * del widget deben filtrar por empresa. Se valida aqui (backend), no solo en el frontend.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var DashboardWidget|null $widget */
            $widget = $this->route('dashboard_widget');
            $rows = (array) $this->input('visibility', []);

            if (! $widget || $rows === []) {
                return;
            }

            if ($widget->query_mode === DashboardWidget::QUERY_MODE_BUILDER) {
                $table = (string) ($widget->query_definition['table'] ?? '');
                if (! WidgetQueryBuilder::tableHasCompanyScope($table)) {
                    $validator->errors()->add(
                        'visibility',
                        'Esta tabla no filtra por empresa; el widget solo puede usarse en la vista consolidada del super admin.'
                    );
                }

                return;
            }

            if ($widget->query_mode === DashboardWidget::QUERY_MODE_SQL) {
                if (! WidgetQueryBuilder::sqlReferencesCompanyPlaceholder((string) $widget->raw_sql)) {
                    $validator->errors()->add(
                        'visibility',
                        'Esta consulta no filtra por empresa (falta :company_id); solo puede usarse en la vista consolidada del super admin.'
                    );
                }
            }
        });
    }
}
