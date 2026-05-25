export type DashboardVariant = 'super_admin' | 'company_admin' | 'employee' | null;

export interface MembershipRow {
    id: number;
    name: string;
    nit: string | null;
    is_active: boolean;
    plan_name: string;
    membership_ends_at: string | null;
    badge: 'ok' | 'warning' | 'critical' | 'expired';
}

export interface FocusedCompanySummary {
    company_id: number;
    company_name: string;
    employees_active_count: number;
    users_staff_count: number;
    users_linked_employee_count: number;
}

export interface SuperAdminStats {
    focused_company_id: number | null;
    companies_active_count: number;
    companies_total_count: number;
    employees_active_count: number;
    users_staff_count: number;
    users_linked_employee_count: number;
    memberships: MembershipRow[];
    focused_company_summary: FocusedCompanySummary | null;
}

export interface ProductionRowBrief {
    id: number;
    date: string;
    quantity: number;
    total_value: number;
    status?: 'pendiente' | 'confirmado';
    company?: { id: number; name: string } | null;
    employee?: { first_name: string; last_name: string };
    reference?: { code: string; name: string };
    operation?: { name: string };
}

export interface PayrollRowBrief {
    id: number;
    name: string;
    period_start: string | null;
    period_end: string | null;
    status: string;
    total_amount: number;
}

export interface CompanyAdminStats {
    company_id: number;
    productivity_days: number;
    producido_pendiente_pago: number;
    empleados_activos_count: number;
    nomina_calculado_count: number;
    nomina_aprobado_count: number;
    nomina_sin_pagar_count: number;
    productividad_por_empleado: Array<{
        employee_id: number;
        name: string;
        short_name?: string;
        total_quantity: number;
        total_value: number;
    }>;
    latest_productions: ProductionRowBrief[];
    recent_payrolls: PayrollRowBrief[];
}

export interface AdvancePreviewRow {
    id: number;
    date: string | null;
    amount: number;
    reason: string | null;
}

export interface EmployeePayrollHistPoint {
    period_end: string | null;
    label: string;
    net_payment: number;
}

export interface EmployeeStats {
    employee_id: number;
    payroll_mode: string;
    unidades_pendientes_pagar: number;
    valor_estimado_pendiente_pago: number | null;
    anticipos_total_pendiente: number;
    anticipos_preview: AdvancePreviewRow[];
    nomina_abierta_count: number;
    payroll_history_pagadas: EmployeePayrollHistPoint[];
    latest_productions: ProductionRowBrief[];
}
