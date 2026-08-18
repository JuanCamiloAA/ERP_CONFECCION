<?php

use App\Models\Advance;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\Production;

return [

    /*
    |--------------------------------------------------------------------------
    | Lista blanca de tablas y columnas para el constructor de widgets
    |--------------------------------------------------------------------------
    |
    | Cualquier tabla no listada aqui es inaccesible, tanto en modo guiado
    | como en el validador del modo SQL avanzado. Cualquier columna no
    | listada dentro de una tabla es inaccesible en modo guiado.
    |
    | has_company_scope: si es true, WidgetQueryBuilder EXIGE filtrar por
    | company_id en cada ejecucion contra empresas/roles especificos.
    |
    | soft_deletes: si es true, la consulta descarta las filas borradas. El
    | constructor trabaja con consultas crudas, sin los scopes de Eloquent, asi
    | que sin esta marca un widget sumaria registros ya eliminados.
    |
    | scopes: condiciones de negocio que no se pueden escribir como un filtro de
    | columna (necesitan subconsulta). Se declaran aqui solo con su etiqueta; el
    | SQL vive en WidgetQueryBuilder::applyScopes(), porque la configuracion se
    | cachea y no admite closures.
    |
    */
    'tables' => [

        'productions' => [
            'label' => 'Produccion',
            'model' => Production::class,
            'has_company_scope' => true,
            'soft_deletes' => true,
            'scopes' => [
                'pending_payment' => [
                    'label' => 'Solo lo pendiente de pago',
                    'help' => 'Deja fuera la produccion cuya fecha ya cae dentro de un periodo de nomina marcada como pagada. Es la misma definicion que usa el indicador «Unidades pendientes por pagar».',
                ],
            ],
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer', 'aggregatable' => true],
                'quantity' => ['label' => 'Cantidad', 'type' => 'number', 'aggregatable' => true],
                'unit_price' => ['label' => 'Precio unitario', 'type' => 'currency', 'aggregatable' => true],
                'total_value' => ['label' => 'Valor total', 'type' => 'currency', 'aggregatable' => true],
                'date' => ['label' => 'Fecha', 'type' => 'date', 'groupable' => true],
                'shift' => ['label' => 'Turno', 'type' => 'string', 'groupable' => true],
                'status' => ['label' => 'Estado', 'type' => 'string', 'groupable' => true],
                'employee_id' => ['label' => 'Empleado (ID)', 'type' => 'integer', 'groupable' => true],
                'reference_id' => ['label' => 'Referencia (ID)', 'type' => 'integer', 'groupable' => true],
                'operation_id' => ['label' => 'Operacion (ID)', 'type' => 'integer', 'groupable' => true],
                'created_at' => ['label' => 'Creado', 'type' => 'date', 'groupable' => true],
            ],
        ],

        'payrolls' => [
            'label' => 'Nomina',
            'model' => Payroll::class,
            'has_company_scope' => true,
            'soft_deletes' => true,
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer', 'aggregatable' => true],
                'name' => ['label' => 'Nombre', 'type' => 'string', 'groupable' => true],
                'type' => ['label' => 'Tipo', 'type' => 'string', 'groupable' => true],
                'status' => ['label' => 'Estado', 'type' => 'string', 'groupable' => true],
                'total_amount' => ['label' => 'Total', 'type' => 'currency', 'aggregatable' => true],
                'period_start' => ['label' => 'Inicio periodo', 'type' => 'date', 'groupable' => true],
                'period_end' => ['label' => 'Fin periodo', 'type' => 'date', 'groupable' => true],
                'paid_at' => ['label' => 'Fecha de pago', 'type' => 'date', 'groupable' => true],
                'created_at' => ['label' => 'Creado', 'type' => 'date', 'groupable' => true],
            ],
        ],

        'employees' => [
            'label' => 'Empleados',
            'model' => Employee::class,
            'has_company_scope' => true,
            'soft_deletes' => true,
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer', 'aggregatable' => true],
                'first_name' => ['label' => 'Nombre', 'type' => 'string', 'groupable' => true],
                'last_name' => ['label' => 'Apellido', 'type' => 'string', 'groupable' => true],
                'document_type' => ['label' => 'Tipo doc.', 'type' => 'string', 'groupable' => true],
                'payroll_mode' => ['label' => 'Modalidad nomina', 'type' => 'string', 'groupable' => true],
                'base_salary' => ['label' => 'Salario base', 'type' => 'currency', 'aggregatable' => true],
                'daily_salary' => ['label' => 'Salario diario', 'type' => 'currency', 'aggregatable' => true],
                'is_active' => ['label' => 'Activo', 'type' => 'boolean', 'groupable' => true],
                'hire_date' => ['label' => 'Fecha ingreso', 'type' => 'date', 'groupable' => true],
                'created_at' => ['label' => 'Creado', 'type' => 'date', 'groupable' => true],
            ],
        ],

        'advances' => [
            'label' => 'Anticipos',
            'model' => Advance::class,
            'has_company_scope' => true,
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer', 'aggregatable' => true],
                'employee_id' => ['label' => 'Empleado (ID)', 'type' => 'integer', 'groupable' => true],
                'amount' => ['label' => 'Monto', 'type' => 'currency', 'aggregatable' => true],
                'date' => ['label' => 'Fecha', 'type' => 'date', 'groupable' => true],
                'status' => ['label' => 'Estado', 'type' => 'string', 'groupable' => true],
                'created_at' => ['label' => 'Creado', 'type' => 'date', 'groupable' => true],
            ],
        ],

        'expenses' => [
            'label' => 'Gastos',
            'model' => Expense::class,
            'has_company_scope' => true,
            'soft_deletes' => true,
            'columns' => [
                'id' => ['label' => 'ID', 'type' => 'integer', 'aggregatable' => true],
                'category_id' => ['label' => 'Categoria (ID)', 'type' => 'integer', 'groupable' => true],
                'amount' => ['label' => 'Monto', 'type' => 'currency', 'aggregatable' => true],
                'expense_date' => ['label' => 'Fecha del gasto', 'type' => 'date', 'groupable' => true],
                'created_at' => ['label' => 'Creado', 'type' => 'date', 'groupable' => true],
            ],
        ],

        // Ampliar aqui segun necesidad real del negocio; agregar tabla = agregar entrada aqui.
        // NO incluir: users, roles, permissions, model_has_roles, personal_access_tokens,
        // password_reset_tokens, sessions, jobs, failed_jobs, migrations, companies (datos de
        // autenticacion/credenciales o tablas globales sensibles fuera del alcance de este motor).
    ],

    /*
    |--------------------------------------------------------------------------
    | Limite duro de filas devueltas por cualquier widget (guiado o SQL)
    |--------------------------------------------------------------------------
    */
    'max_rows' => 500,

    /*
    |--------------------------------------------------------------------------
    | Variables de sesion disponibles para filtros dinamicos
    |--------------------------------------------------------------------------
    |
    | Catalogo cerrado (whitelist) de atributos del usuario que esta viendo el
    | dashboard en ese momento. El super admin puede ELEGIR cualquiera de estas
    | al construir un filtro (en vez de un valor fijo); no se admite texto libre
    | ni rutas arbitrarias sobre modelos, por la misma razon que no se admite
    | "SELECT *": cada variable expuesta aqui esta resuelta por codigo explicito
    | en WidgetQueryBuilder::resolveSessionVariables(), nunca por reflexion.
    |
    | Para SQL avanzado se usan como placeholder ":nombre_variable" (ej. ":current_employee_id"),
    | igual que ":company_id".
    |
    */
    'session_variables' => [
        'current_user_id' => ['label' => 'Usuario actual (ID)'],
        'current_employee_id' => ['label' => 'Empleado vinculado al usuario actual (ID)'],
        'current_company_id' => ['label' => 'Empresa efectiva actual (ID)'],
    ],

];
