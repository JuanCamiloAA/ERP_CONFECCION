import { AxiosInstance } from 'axios';
import { Config as ZiggyConfig } from 'ziggy-js';

declare global {
    interface Window {
        axios: AxiosInstance;
    }

    var route: typeof import('ziggy-js').route;

    namespace App {
        /** Props compartidas; el índice cumple PageProps de @inertiajs/core para usePage<T>(). */
        interface PageProps extends import('@inertiajs/core').PageProps {
            appName: string;
            /** URL del icono de marca (Firebase o public/images); favicon y login sin empresa. */
            brandIconUrl: string;
            auth: {
                user: AuthUser | null;
            };
            flash: FlashMessages;
            ziggy: ZiggyConfig & { location: string };
            activeCompany: Company | null;
            /** null = vista consolidada (super admin). */
            activeCompanyId?: number | null;
            companiesForSelector?: Array<{ id: number; name: string; is_active: boolean }>;
            isConsolidatedView?: boolean;
            /** Presente en la pagina de login cuando la URL incluye ?company= o ?empresa= (id). */
            loginCompany?: { id: number; name: string; logo_url: string | null } | null;
            permissionMatrix?: PermissionMatrix;
            /** Opciones activas del maestro (Nomina / Configuracion). */
            payrollPeriodicities?: PayrollPeriodicityOption[];
            errors: Record<string, string>;
            [key: string]: unknown;
        }
    }
}

export interface PayrollPeriodicityOption {
    id: number;
    code: string;
    name: string;
    sort_order: number;
}

export interface FlashMessages {
    success?: string | null;
    error?: string | null;
    warning?: string | null;
    info?: string | null;
    temporary_password?: string | null;
}

export interface AuthUser {
    id: number;
    name: string;
    last_name: string | null;
    full_name: string;
    email: string;
    avatar: string | null;
    phone: string | null;
    is_active: boolean;
    is_employee: boolean;
    is_super_admin: boolean;
    is_admin: boolean;
    employee_id: number | null;
    company_id: number | null;
    company: { id: number; name: string; logo: string | null } | null;
    role: {
        id: number;
        name: string;
        display_name: string;
        color: string;
        is_system: boolean;
    } | null;
    permissions: string[];
    /** Union of permission names from the user's Spatie roles (sin excepciones). Opcional por compatibilidad. */
    role_permissions?: string[];
    accessible_pages: string[];
    password_change_required: boolean;
    last_login_at: string | null;
    initials: string;
    employee_profile?: { id: number; payroll_mode: string; full_name: string } | null;
}

export interface MembershipPlan {
    id: number;
    name: string;
    slug?: string;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly?: string | number | null;
    features_json?: string[] | null;
    is_active?: boolean;
    sort_order?: number;
}

export interface Company {
    id: number;
    name: string;
    nit: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
    is_active: boolean;
    settings: Record<string, unknown> | null;
    membership_plan_id?: number | null;
    membership_started_at?: string | null;
    membership_ends_at?: string | null;
    membership_plan?: MembershipPlan | null;
    staff_users_count?: number;
    created_at: string;
    updated_at: string;
}

export interface DataImportBatch {
    id: number;
    user_id: number;
    original_filename: string;
    stored_path: string;
    type: string;
    status: string;
    rows_total: number;
    rows_success: number;
    rows_failed: number;
    error_report_path: string | null;
    meta: Record<string, unknown> | null;
    ip_address: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
    user?: { id: number; name: string; last_name: string | null; email?: string };
}

export interface Bank {
    id: number;
    company_id: number;
    code: string | null;
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    employees_count?: number;
}

export interface ExpenseCategory {
    id: number;
    company_id: number;
    company?: { id: number; name: string } | null;
    name: string;
    slug: string | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    expenses_count?: number;
}

export interface ExpenseListRow {
    id: number;
    amount: number;
    description: string;
    expense_date: string;
    created_at: string | null;
    receipt_url: string | null;
    receipt_mime: string | null;
    category: { id: number; name: string } | null;
    creator: { id: number; full_name: string } | null;
    company?: { id: number; name: string } | null;
}

export interface ExpenseDetail extends ExpenseListRow {
    notes: string | null;
    receipt_original_name: string | null;
    creator: { id: number; full_name: string; email: string } | null;
}

export interface Employee {
    id: number;
    company_id: number;
    company?: { id: number; name: string } | null;
    user_id: number | null;
    first_name: string;
    last_name: string;
    full_name: string;
    initials?: string;
    document_type: string;
    document_number: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    hire_date: string;
    photo: string | null;
    base_salary: string | number;
    payroll_mode?: 'operations' | 'fixed_daily';
    daily_salary?: string | number | null;
    minutes_per_full_workday?: number;
    bank_id?: number | null;
    bank_account_number?: string | null;
    bank_key?: string | null;
    bank?: Pick<Bank, 'id' | 'name' | 'is_active'> | null;
    is_active: boolean;
    notes: string | null;
    user?: AuthUser | null;
    productions_count?: number;
    created_at: string;
    updated_at: string;
}

export interface WorkDaySession {
    id: number;
    company_id: number;
    employee_id: number;
    work_date: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    duration_minutes: number | null;
    status: string;
    source?: string;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ValidatedWorkDaySnapshot {
    work_date: string;
    session_id: number;
    clock_in_at?: string | null;
    clock_out_at?: string | null;
    duration_minutes: number;
    effective_minutes: number;
    daily_salary_applied?: number;
    minutes_full_workday?: number;
    day_earnings: number;
}

export interface ReferenceEconomicsComparison {
    payment_per_unit: number;
    production_cost_per_unit: number;
    margin_per_unit: number;
    has_operations: boolean;
    payment_per_unit_incomplete: boolean;
    currency: string;
    operational_lot_qty_at_cost_fix: number;
    total_operational_at_creation: number;
}

export interface Reference {
    id: number;
    company_id: number;
    code: string;
    name: string;
    /** Valor unitario que reciben por la prenda (pago del cliente); puede ser null en datos antiguos. */
    payment_per_unit?: string | number | null;
    /** Costo operacional unitario fijado al crear (suma precios operaciones al guardar). */
    operational_cost_per_unit_fixed?: string | number | null;
    /** Unidades del lote registradas al fijar el costo operacional. */
    operational_lot_qty_at_cost_fix?: number | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    /** Tope del lote: maximo de unidades registrables por operacion en produccion para esta referencia. */
    lot_total_quantity?: number | null;
    /** Suma de cantidades en produccion (todas las operaciones; informativo). */
    productions_sum_quantity?: number | null;
    /** Maximo entre operaciones de la suma registrada por operacion (listado referencias). */
    productions_max_per_operation?: number | null;
    /** Cantidad producida por operation_id (clave string) para tope de lote por operacion. */
    productions_quantity_by_operation?: Record<string, number>;
    operations?: ReferenceOperationPivot[];
    operations_count?: number;
    created_at: string;
    updated_at: string;
}

export interface Operation {
    id: number;
    company_id: number;
    name: string;
    description: string | null;
    base_price: string | number;
    is_active: boolean;
    references_count?: number;
    created_at: string;
    updated_at: string;
}

export interface ReferenceOperationPivot extends Operation {
    pivot: {
        id: number;
        reference_id: number;
        operation_id: number;
        price: string | number;
        is_active: boolean;
    };
}

export interface Production {
    id: number;
    company_id: number;
    company?: { id: number; name: string } | null;
    employee_id: number;
    reference_id: number;
    operation_id: number;
    quantity: number;
    unit_price: string | number;
    total_value: string | number;
    date: string;
    shift: 'manana' | 'tarde' | 'noche';
    status: 'pendiente' | 'confirmado';
    notes: string | null;
    employee?: Employee;
    reference?: Reference;
    operation?: Operation;
    created_at: string;
}

export interface Payroll {
    id: number;
    company_id: number;
    company?: { id: number; name: string } | null;
    name: string;
    period_start: string;
    period_end: string;
    /** Codigo alineado con maestro `payroll_periodicities.code`. */
    type: string;
    status: 'borrador' | 'calculado' | 'aprobado' | 'pagado';
    total_amount: string | number;
    paid_at: string | null;
    notes: string | null;
    payroll_employees?: PayrollEmployee[];
    payroll_employees_count?: number;
    created_at: string;
}

export interface PayrollEmployee {
    id: number;
    payroll_id: number;
    employee_id: number;
    production_total: string | number;
    daily_work_subtotal?: string | number;
    /** Suma de conceptos manuales (>= 0); forma parte del bruto antes de deducciones. */
    adjustments_subtotal?: string | number;
    validated_work_days?: ValidatedWorkDaySnapshot[] | null;
    deductions: Array<{ key: string; label: string; amount: number }> | null;
    additions: Array<{ key: string; label: string; amount: number }> | null;
    advances_discount: string | number;
    net_payment: string | number;
    is_paid: boolean;
    paid_at: string | null;
    notes: string | null;
    employee?: Employee;
    adjustments?: PayrollEmployeeAdjustment[];
}

export interface PayrollConcept {
    id: number;
    company_id?: number;
    name: string;
    code: string | null;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
    company?: { id: number; name: string } | null;
    adjustments_count?: number;
}

export interface PayrollEmployeeAdjustment {
    id: number;
    company_id: number;
    payroll_employee_id: number;
    payroll_concept_id: number;
    amount: string | number;
    notes: string | null;
    payroll_concept?: Pick<PayrollConcept, 'id' | 'name' | 'code'>;
}

export interface Advance {
    id: number;
    company_id: number;
    employee_id: number;
    amount: string | number;
    date: string;
    reason: string;
    status: 'pendiente' | 'descontado';
    payroll_employee_id: number | null;
    employee?: Employee;
    created_at: string;
}

export interface Setting {
    id: number;
    company_id: number;
    key: string;
    value: string | null;
    group: string;
}

export interface Role {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company_id: number | null;
    permissions?: { id: number; name: string }[];
    users_count?: number;
}

export interface PermissionMatrix {
    [module: string]: {
        display: string;
        icon: string;
        order?: number;
        super_admin_only?: boolean;
        pages: {
            [page: string]: {
                display: string;
                route?: string;
                actions: string[];
            };
        };
    };
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    links: PaginationLink[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    path: string;
}

export interface SelectOption {
    value: string | number;
    label: string;
    color?: string;
    description?: string;
}

export {};
