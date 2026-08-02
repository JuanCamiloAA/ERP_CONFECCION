<?php

namespace App\Http\Requests\SuperAdmin;

use App\Models\DashboardWidget;
use App\Services\DashboardBuilder\WidgetQueryBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreDashboardWidgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'type' => ['required', Rule::in([
                DashboardWidget::TYPE_KPI,
                DashboardWidget::TYPE_BAR,
                DashboardWidget::TYPE_LINE,
                DashboardWidget::TYPE_PIE,
                DashboardWidget::TYPE_TABLE,
            ])],
            'query_mode' => ['required', Rule::in([DashboardWidget::QUERY_MODE_BUILDER, DashboardWidget::QUERY_MODE_SQL])],
            'query_definition' => ['nullable', 'array', 'required_if:query_mode,'.DashboardWidget::QUERY_MODE_BUILDER],
            'raw_sql' => ['nullable', 'string', 'required_if:query_mode,'.DashboardWidget::QUERY_MODE_SQL],
            'chart_config' => ['nullable', 'array'],
            'refresh_interval_seconds' => ['nullable', 'integer', 'min:15', 'max:3600'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'query_definition.required_if' => 'La definicion de la consulta guiada es obligatoria en modo guiado.',
            'raw_sql.required_if' => 'El SQL es obligatorio en modo avanzado.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $mode = $this->input('query_mode');
            $type = (string) $this->input('type');

            if ($mode === DashboardWidget::QUERY_MODE_BUILDER) {
                $definition = (array) $this->input('query_definition', []);
                foreach (WidgetQueryBuilder::validateDefinitionShape($definition, $type) as $error) {
                    $validator->errors()->add('query_definition', $error);
                }
            }

            if ($mode === DashboardWidget::QUERY_MODE_SQL) {
                $sql = trim((string) $this->input('raw_sql', ''));
                try {
                    app(WidgetQueryBuilder::class)->assertSqlSafe($sql);
                } catch (\Throwable $e) {
                    $validator->errors()->add('raw_sql', $e->getMessage());
                }
            }
        });
    }
}
