import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CaretRight, Key, Warning } from '@phosphor-icons/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmpDocumentField, EmpInput, EmpSelect, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import {
    EmployeeAsideCard,
    EmployeeFormLayout,
    EmployeeFormNav,
    EMPLOYEE_SECTIONS,
} from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { EmployeePhotoField } from '@/Components/Employees/EmployeePhotoField';
import { PayrollModeField, payrollModeLabel, type PayrollMode } from '@/Components/Employees/PayrollModeField';
import { ScheduledWorkDaysField } from '@/Components/Employees/ScheduledWorkDaysField';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import type { Employee } from '@/types';

interface BankOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface Props {
    /** `user.roles` viene del controlador para poder decir con que rol entra al sistema. */
    employee: Employee & {
        user?: { id: number; email: string; roles?: { id: number; display_name: string }[] } | null;
    };
    banks: BankOption[];
    /** Cambiar la modalidad de quien ya produjo afecta lo que se le liquide en adelante. */
    hasProductions?: boolean;
}

/** Secciones plegables de movil: que campos vigila cada una para marcar «editado». */
const SECTION_FIELDS = {
    identidad: ['first_name', 'last_name', 'document_type', 'document_number', 'hire_date', 'photo'],
    contacto: ['phone', 'email', 'address'],
    nomina: [
        'payroll_mode',
        'base_salary',
        'daily_salary',
        'minutes_per_full_workday',
        'ordinary_hours_per_day',
        'is_exempt_from_overtime',
        'scheduled_work_days',
    ],
    pago: ['bank_id', 'bank_account_number', 'bank_key'],
} as const;

/**
 * Fecha para un <input type="date">.
 *
 * El modelo castea `hire_date` y la serializa como ISO completo
 * ("2026-07-30T05:00:00.000000Z"); el control nativo solo entiende "YYYY-MM-DD" y con
 * cualquier otra cosa aparece en blanco. Se recorta la cadena en vez de parsearla:
 * construir un Date y volver a formatear corre el dia por la zona horaria.
 */
function hireDateValue(value: string | null | undefined): string {
    return String(value ?? '').slice(0, 10);
}

const WEEKS_PER_MONTH = 4.33;

export default function EmployeeEdit({ employee, banks, hasProductions = false }: Props) {
    const flash = usePage<App.PageProps>().props.flash;

    const { data, setData, processing, errors } = useForm({
        first_name: employee.first_name,
        last_name: employee.last_name,
        document_type: employee.document_type,
        document_number: employee.document_number,
        phone: employee.phone ?? '',
        email: employee.email ?? '',
        address: employee.address ?? '',
        hire_date: hireDateValue(employee.hire_date),
        photo: null as File | null,
        base_salary: String(employee.base_salary ?? ''),
        payroll_mode: (employee.payroll_mode ?? 'operations') as 'operations' | 'fixed_daily' | 'hourly_legal',
        daily_salary: employee.daily_salary != null ? String(employee.daily_salary) : '',
        minutes_per_full_workday: String(employee.minutes_per_full_workday ?? 480),
        ordinary_hours_per_day: String(employee.ordinary_hours_per_day ?? 8),
        is_exempt_from_overtime: employee.is_exempt_from_overtime ?? false,
        scheduled_work_days: employee.scheduled_work_days ?? [1, 2, 3, 4, 5, 6],
        is_active: employee.is_active,
        notes: employee.notes ?? '',
        bank_id: employee.bank_id != null ? String(employee.bank_id) : '',
        bank_account_number: employee.bank_account_number ?? '',
        bank_key: employee.bank_key ?? '',
    });

    /** Movil: una sola seccion abierta a la vez; editar un telefono no debe recorrer todo. */
    const [openSection, setOpenSection] = useState<string | null>('identidad');
    const [confirmReset, setConfirmReset] = useState(false);

    // La contrasena temporal solo llega en el flash de la respuesta y no vuelve a
    // mostrarse: si no se anuncia aqui, restablecer desde esta pantalla la perderia.
    useEffect(() => {
        if (flash?.temporary_password) {
            toast.success('Contraseña restablecida', {
                description: `Anótela, no se mostrará de nuevo: ${flash.temporary_password}`,
                duration: 15000,
            });
        }
    }, [flash?.temporary_password]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.post(route('employees.update', employee.id), {
            ...data,
            bank_id: data.bank_id === '' ? '' : Number(data.bank_id),
            _method: 'put',
        } as never, {
            forceFormData: true,
        });
    };

    /** Valores de partida, para saber que seccion cambio de verdad. */
    const initial = useMemo(
        () => ({
            first_name: employee.first_name,
            last_name: employee.last_name,
            document_type: employee.document_type,
            document_number: employee.document_number,
            phone: employee.phone ?? '',
            email: employee.email ?? '',
            address: employee.address ?? '',
            hire_date: hireDateValue(employee.hire_date),
            base_salary: String(employee.base_salary ?? ''),
            payroll_mode: employee.payroll_mode ?? 'operations',
            daily_salary: employee.daily_salary != null ? String(employee.daily_salary) : '',
            minutes_per_full_workday: String(employee.minutes_per_full_workday ?? 480),
            ordinary_hours_per_day: String(employee.ordinary_hours_per_day ?? 8),
            is_exempt_from_overtime: employee.is_exempt_from_overtime ?? false,
            scheduled_work_days: employee.scheduled_work_days ?? [1, 2, 3, 4, 5, 6],
            bank_id: employee.bank_id != null ? String(employee.bank_id) : '',
            bank_account_number: employee.bank_account_number ?? '',
            bank_key: employee.bank_key ?? '',
        }),
        [employee],
    );

    const isDirty = (section: keyof typeof SECTION_FIELDS) =>
        SECTION_FIELDS[section].some((field) => {
            if (field === 'photo') return data.photo !== null;

            const current = data[field as keyof typeof data];
            const before = initial[field as keyof typeof initial];

            return String(current ?? '') !== String(before ?? '');
        });

    const estimate = useMemo(() => {
        if (data.payroll_mode === 'fixed_daily') {
            const daily = Number(data.daily_salary);
            if (!Number.isFinite(daily) || daily <= 0) return null;

            const days = Math.round((data.scheduled_work_days.length || 6) * WEEKS_PER_MONTH);

            return {
                total: daily * days,
                detail: `${days} días hábiles × ${formatCurrency(daily)}. Sin recargos ni extras.`,
            };
        }

        if (data.payroll_mode === 'hourly_legal') {
            const base = Number(data.base_salary);
            if (!Number.isFinite(base) || base <= 0) return null;

            return { total: base, detail: 'Base mensual pactada. Sin recargos, extras ni auxilio de transporte.' };
        }

        return null;
    }, [data.payroll_mode, data.daily_salary, data.base_salary, data.scheduled_work_days]);

    const selectedBank = banks.find((b) => String(b.id) === String(data.bank_id));
    const userRole = employee.user?.roles?.[0] ?? null;

    /** Fila plegable de movil; en escritorio la seccion se muestra siempre. */
    const collapsedRow = (key: keyof typeof SECTION_FIELDS, title: string, summary: string) => (
        <button
            type="button"
            onClick={() => setOpenSection((current) => (current === key ? null : key))}
            aria-expanded={openSection === key}
            className="flex w-full items-center gap-2 text-left sm:hidden"
            style={{ minHeight: '48px', borderBottom: '1px solid var(--emp-row)' }}
        >
            <span className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                {title}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                · {summary}
            </span>
            {isDirty(key) ? <span className="emp-pill emp-pill-accent shrink-0">editado</span> : null}
            <CaretRight
                size={14}
                className={`shrink-0 transition-transform ${openSection === key ? 'rotate-90' : ''}`}
                style={{ color: 'var(--emp-subtle)' }}
            />
        </button>
    );

    /** En movil solo se pinta la seccion abierta; a partir de 640px, todas. */
    const openOnMobile = (key: string) => (openSection === key ? '' : 'max-sm:hidden');

    /* ------------------------------------------------------------- cabeceras */

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <nav
                        className="hidden items-center gap-1.5 text-[12px] sm:flex"
                        style={{ color: 'var(--emp-subtle)' }}
                    >
                        <Link href={route('employees.index')} className="hover:underline">
                            Empleados
                        </Link>
                        <span>/</span>
                        <Link href={route('employees.show', employee.id)} className="hover:underline">
                            {employee.full_name}
                        </Link>
                        <span>/</span>
                        <span>Editar</span>
                    </nav>
                    <h1 className="truncate text-[17px] sm:mt-0.5 sm:text-[19px]" style={{ color: 'var(--emp-text)' }}>
                        {employee.full_name}
                    </h1>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        Editado {formatRelativeDate(employee.updated_at)}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('employees.show', employee.id)} className="emp-btn max-sm:hidden">
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        {processing ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </header>
    );

    /* -------------------------------------------------------------- secciones */

    const secciones = (
        <>
            {hasProductions ? (
                <p className="emp-note flex items-start gap-2">
                    <Warning size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-accent-line)' }} />
                    <span>
                        Esta persona ya tiene producción registrada. Cambiar la modalidad afecta las liquidaciones de
                        aquí en adelante; lo ya liquidado conserva sus valores.
                    </span>
                </p>
            ) : null}

            <div>
                {collapsedRow('identidad', 'Identidad', employee.full_name)}
                <div className={openOnMobile('identidad')}>
                    <EmployeeFormSection id="identidad" step={1} title="Identidad" requirement="required" hideHeaderOnMobile>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                            <EmployeePhotoField
                                value={data.photo}
                                onChange={(file) => setData('photo', file)}
                                currentUrl={employee.photo}
                                error={errors.photo}
                            />

                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                                <EmpInput
                                    label="Nombres"
                                    required
                                    value={data.first_name}
                                    onChange={(e) => setData('first_name', e.target.value)}
                                    error={errors.first_name}
                                />
                                <EmpInput
                                    label="Apellidos"
                                    required
                                    value={data.last_name}
                                    onChange={(e) => setData('last_name', e.target.value)}
                                    error={errors.last_name}
                                />
                                <EmpDocumentField
                                    type={data.document_type}
                                    number={data.document_number}
                                    onTypeChange={(v) => setData('document_type', v)}
                                    onNumberChange={(v) => setData('document_number', v)}
                                    typeError={errors.document_type}
                                    numberError={errors.document_number}
                                />
                                <EmpInput
                                    label="Fecha de ingreso"
                                    type="date"
                                    required
                                    value={data.hire_date}
                                    onChange={(e) => setData('hire_date', e.target.value)}
                                    error={errors.hire_date}
                                />
                            </div>
                        </div>
                    </EmployeeFormSection>
                </div>
            </div>

            <div>
                {collapsedRow('contacto', 'Contacto', data.phone || data.email || 'Sin datos')}
                <div className={openOnMobile('contacto')}>
                    <EmployeeFormSection id="contacto" step={2} title="Contacto" requirement="optional" hideHeaderOnMobile>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <EmpInput
                                label="Teléfono"
                                inputMode="tel"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                            />
                            <EmpInput
                                label="Correo personal"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={errors.email}
                                help="Se propone como correo de acceso si creas la cuenta."
                            />
                            <EmpInput
                                label="Dirección"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                error={errors.address}
                                containerClassName="sm:col-span-2"
                            />
                        </div>
                    </EmployeeFormSection>
                </div>
            </div>

            <div>
                {collapsedRow('nomina', 'Nómina', payrollModeLabel(data.payroll_mode))}
                <div className={openOnMobile('nomina')}>
                    <EmployeeFormSection
                        id="nomina"
                        step={3}
                        title="Nómina"
                        requirement="required"
                        hideHeaderOnMobile
                        summary={<span className="emp-pill emp-pill-accent">{payrollModeLabel(data.payroll_mode)}</span>}
                    >
                        <div className="space-y-3.5">
                            <PayrollModeField
                                value={data.payroll_mode}
                                onChange={(mode: PayrollMode) => setData('payroll_mode', mode)}
                                error={errors.payroll_mode}
                            />

                            {data.payroll_mode === 'operations' ? (
                                <div className="emp-reveal grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <EmpInput
                                        label="Salario base"
                                        type="number"
                                        step="0.01"
                                        prefix="$"
                                        value={data.base_salary}
                                        onChange={(e) => setData('base_salary', e.target.value)}
                                        error={errors.base_salary}
                                        help="Opcional. Su pago sale de la producción registrada."
                                    />
                                </div>
                            ) : null}

                            {data.payroll_mode === 'fixed_daily' ? (
                                <div className="emp-reveal grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <EmpInput
                                        label="Salario diario"
                                        type="number"
                                        step="0.01"
                                        prefix="$"
                                        required
                                        value={data.daily_salary}
                                        onChange={(e) => setData('daily_salary', e.target.value)}
                                        error={errors.daily_salary}
                                    />
                                    <EmpInput
                                        label="Minutos jornada completa"
                                        type="number"
                                        min={1}
                                        value={data.minutes_per_full_workday}
                                        onChange={(e) => setData('minutes_per_full_workday', e.target.value)}
                                        error={errors.minutes_per_full_workday}
                                        help="Ej. 480 = 8 horas"
                                    />
                                    <div className="sm:col-span-2">
                                        <ScheduledWorkDaysField
                                            value={data.scheduled_work_days}
                                            onChange={(next) => setData('scheduled_work_days', next)}
                                            error={errors.scheduled_work_days}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {data.payroll_mode === 'hourly_legal' ? (
                                <div className="emp-reveal grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <EmpInput
                                        label="Salario base"
                                        type="number"
                                        step="0.01"
                                        prefix="$"
                                        required
                                        value={data.base_salary}
                                        onChange={(e) => setData('base_salary', e.target.value)}
                                        error={errors.base_salary}
                                        help="Base mensual para el valor/hora legal."
                                    />
                                    <EmpInput
                                        label="Jornada ordinaria diaria (horas)"
                                        type="number"
                                        step="0.1"
                                        min={1}
                                        max={12}
                                        required
                                        value={data.ordinary_hours_per_day}
                                        onChange={(e) => setData('ordinary_hours_per_day', e.target.value)}
                                        error={errors.ordinary_hours_per_day}
                                        help="Los minutos que excedan esto son candidatos a hora extra."
                                    />
                                    <div className="sm:col-span-2">
                                        <label className="flex cursor-pointer items-start gap-2 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={data.is_exempt_from_overtime}
                                                onChange={(e) => setData('is_exempt_from_overtime', e.target.checked)}
                                                className="mt-0.5 h-4 w-4 shrink-0 rounded"
                                                style={{ accentColor: 'var(--emp-accent)' }}
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                                    Exento de horas extra
                                                </span>
                                                <span className="emp-help block">
                                                    Cargos de dirección, confianza y manejo (art. 162 CST): nunca genera
                                                    horas extra, aunque exceda la jornada.
                                                </span>
                                            </span>
                                        </label>
                                        {errors.is_exempt_from_overtime ? (
                                            <p className="emp-error">{errors.is_exempt_from_overtime}</p>
                                        ) : null}
                                    </div>
                                    <div className="sm:col-span-2">
                                        <ScheduledWorkDaysField
                                            value={data.scheduled_work_days}
                                            onChange={(next) => setData('scheduled_work_days', next)}
                                            error={errors.scheduled_work_days}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </EmployeeFormSection>
                </div>
            </div>

            <div>
                {collapsedRow('pago', 'Datos para pago', selectedBank?.name ?? 'Falta banco')}
                <div className={openOnMobile('pago')}>
                    <EmployeeFormSection
                        id="pago"
                        step={4}
                        title="Datos para pago"
                        requirement="optional"
                        hideHeaderOnMobile
                        summary={selectedBank ? <span className="emp-pill">{selectedBank.name}</span> : undefined}
                    >
                        <p className="mb-3 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            Los tres campos van juntos o ninguno.
                        </p>

                        {banks.length === 0 ? (
                            <p className="emp-note">
                                No hay bancos activos en el catálogo.{' '}
                                <Can permission="banks.index.create">
                                    <Link
                                        href={route('banks.create')}
                                        className="underline underline-offset-2"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Registrar banco
                                    </Link>
                                </Can>
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                                <div>
                                    <EmpSelect
                                        label="Banco"
                                        placeholder="Seleccione un banco"
                                        value={data.bank_id}
                                        onChange={(e) => setData('bank_id', e.target.value)}
                                        error={errors.bank_id}
                                        options={banks.map((b) => ({ value: b.id, label: b.name }))}
                                    />
                                    {selectedBank && !selectedBank.is_active ? (
                                        <span className="emp-pill emp-pill-warn mt-1.5">Banco inactivo</span>
                                    ) : null}
                                </div>
                                <EmpInput
                                    label="Número de cuenta"
                                    inputMode="numeric"
                                    value={data.bank_account_number}
                                    onChange={(e) => setData('bank_account_number', e.target.value.replace(/\D/g, ''))}
                                    error={errors.bank_account_number}
                                    help="Solo números"
                                />
                                <EmpInput
                                    label="Llave bancaria"
                                    value={data.bank_key}
                                    onChange={(e) => setData('bank_key', e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                                    error={errors.bank_key}
                                    help="Letras y números, sin espacios"
                                />
                            </div>
                        )}
                    </EmployeeFormSection>
                </div>
            </div>
        </>
    );

    /* ------------------------------------------------------------------ panel */

    const aside = (
        <>
            <EmployeeAsideCard>
                <EmpSwitch
                    checked={data.is_active}
                    onChange={(v) => setData('is_active', v)}
                    label="Empleado activo"
                    description="Al desactivarlo también se desactiva su cuenta de usuario"
                />
            </EmployeeAsideCard>

            <EmployeeAsideCard
                id="acceso"
                title="Acceso al sistema"
                subtitle={employee.user_id ? `Con acceso · ${userRole?.display_name ?? 'Sin rol'}` : 'Sin acceso'}
            >
                {employee.user_id ? (
                    <div className="mt-2.5">
                        <p className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            {employee.user?.email}
                        </p>
                        <Can permission="employees.index.edit">
                            <button
                                type="button"
                                onClick={() => setConfirmReset(true)}
                                className="emp-btn emp-btn-sm mt-2 w-full"
                            >
                                <Key size={14} />
                                Restablecer contraseña
                            </button>
                        </Can>
                    </div>
                ) : (
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        La cuenta se crea desde la ficha del empleado.
                    </p>
                )}
            </EmployeeAsideCard>

            <EmployeeAsideCard id="notas" title="Notas internas">
                <div className="mt-2">
                    <EmpTextarea
                        rows={3}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        error={errors.notes}
                    />
                </div>
            </EmployeeAsideCard>

            {estimate ? (
                <EmployeeAsideCard>
                    <p className="emp-kicker">Costo estimado</p>
                    <p className="mt-1.5 text-[26px] leading-none" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(estimate.total)}
                        <span className="ml-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            / mes
                        </span>
                    </p>
                    <p className="mt-1.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        {estimate.detail}
                    </p>
                </EmployeeAsideCard>
            ) : null}
        </>
    );

    /* ------------------------------------------------------------------ render */

    return (
        <AppLayout title="Editar empleado">
            <Head title={`Editar ${employee.full_name}`} />

            <form onSubmit={submit}>
                <EmployeeFormLayout
                    header={header}
                    nav={<EmployeeFormNav sections={EMPLOYEE_SECTIONS} />}
                    aside={aside}
                >
                    {secciones}
                </EmployeeFormLayout>
            </form>

            <ConfirmDialog
                open={confirmReset}
                onClose={() => setConfirmReset(false)}
                onConfirm={() => {
                    router.post(
                        route('employees.access.reset-password', employee.id),
                        { require_password_change: true },
                        { preserveScroll: true, onFinish: () => setConfirmReset(false) },
                    );
                }}
                title="Restablecer contraseña"
                message={`Se genera una contraseña temporal para ${employee.full_name} y se le pedirá cambiarla en el primer ingreso. La contraseña actual deja de servir de inmediato.`}
                confirmText="Restablecer"
            />
        </AppLayout>
    );
}
