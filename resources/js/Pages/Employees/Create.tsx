import { Head, Link, useForm } from '@inertiajs/react';
import { Check, Circle } from '@phosphor-icons/react';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    AccessPasswordData,
    AccessPasswordFields,
    createAccessPasswordData,
    stripAccessPasswordData,
} from '@/Components/Employees/AccessPasswordFields';
import { EmpDocumentField, EmpInput, EmpSelect, EmpSwitch, EmpTextarea } from '@/Components/Employees/EmployeeFields';
import {
    EmployeeAsideCard,
    EmployeeFormLayout,
    EmployeeFormNav,
    EMPLOYEE_SECTIONS,
} from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { EmployeeStepsBar, EmployeeStepsHeader, type FormStep } from '@/Components/Employees/EmployeeFormSteps';
import { EmployeePhotoField } from '@/Components/Employees/EmployeePhotoField';
import { PayrollModeField, payrollModeLabel, type PayrollMode } from '@/Components/Employees/PayrollModeField';
import { ScheduledWorkDaysField } from '@/Components/Employees/ScheduledWorkDaysField';
import { MembershipLimitAlert } from '@/Components/Membership/MembershipLimitAlert';
import { Can } from '@/Components/UI/Can';
import { collectUnmappedErrors, FormErrorAlert } from '@/Components/UI/FormErrorAlert';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatRoleSelectLabel } from '@/lib/utils';

interface Role {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company?: { id: number; name: string } | null;
}

interface BankOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface Props {
    roles: Role[];
    banks: BankOption[];
}

/** Pasos de movil. Reagrupan las mismas secciones, en el mismo orden. */
const STEPS: FormStep[] = [
    { key: 'identidad', label: 'Identidad' },
    { key: 'nomina', label: 'Nómina y pago' },
    { key: 'acceso', label: 'Acceso' },
];

/** Semanas por mes; convierte los dias habiles pactados en dias de un mes tipico. */
const WEEKS_PER_MONTH = 4.33;

export default function EmployeeCreate({ roles, banks }: Props) {
    const { data, setData, post, processing, errors, transform } = useForm({
        first_name: '',
        last_name: '',
        document_type: 'CC',
        document_number: '',
        phone: '',
        email: '',
        address: '',
        hire_date: new Date().toISOString().split('T')[0],
        photo: null as File | null,
        base_salary: '',
        payroll_mode: 'operations' as 'operations' | 'fixed_daily' | 'hourly_legal',
        daily_salary: '',
        minutes_per_full_workday: '480',
        ordinary_hours_per_day: '8',
        is_exempt_from_overtime: false,
        scheduled_work_days: [1, 2, 3, 4, 5, 6] as number[],
        is_active: true,
        notes: '',
        bank_id: '' as string | number,
        bank_account_number: '',
        bank_key: '',
        create_user_account: false,
        user_email: '',
        user_role_id: roles.find((r) => !r.is_system)?.id ?? roles[0]?.id ?? '',
        ...createAccessPasswordData(),
    });

    const [step, setStep] = useState(0);

    const updateAccessPassword = (patch: Partial<AccessPasswordData>) =>
        setData((current) => ({ ...current, ...patch }));

    // `membership_limit` ya se muestra con MembershipLimitAlert.
    const unmappedErrors = collectUnmappedErrors(errors, Object.keys(data), ['membership_limit']);

    /**
     * Lo que falta para poder guardar.
     *
     * Es la unica fuente de verdad del progreso: de aqui salen el contador de la
     * cabecera, el checklist del panel y la validacion al pasar de paso en movil. Tener
     * tres listas separadas era la forma segura de que dijeran cosas distintas.
     */
    const requirements = useMemo(() => {
        const items: { key: string; label: string; done: boolean; step: number }[] = [
            { key: 'first_name', label: 'Nombres', done: data.first_name.trim() !== '', step: 0 },
            { key: 'last_name', label: 'Apellidos', done: data.last_name.trim() !== '', step: 0 },
            { key: 'document_number', label: 'Documento', done: data.document_number.trim() !== '', step: 0 },
            { key: 'hire_date', label: 'Fecha de ingreso', done: data.hire_date !== '', step: 0 },
        ];

        if (data.payroll_mode === 'fixed_daily') {
            items.push({ key: 'daily_salary', label: 'Salario diario', done: Number(data.daily_salary) > 0, step: 1 });
        }

        if (data.payroll_mode === 'hourly_legal') {
            items.push(
                { key: 'base_salary', label: 'Salario base', done: Number(data.base_salary) > 0, step: 1 },
                {
                    key: 'ordinary_hours_per_day',
                    label: 'Jornada ordinaria diaria',
                    done: Number(data.ordinary_hours_per_day) > 0,
                    step: 1,
                },
            );
        }

        if (data.create_user_account) {
            items.push(
                { key: 'user_email', label: 'Correo de acceso', done: data.user_email.trim() !== '', step: 2 },
                // Se compara como texto: el valor puede venir vacio si la empresa aun no
                // tiene roles propios, y ahi `user_role_id` deja de ser un numero.
                { key: 'user_role_id', label: 'Rol', done: String(data.user_role_id ?? '').trim() !== '', step: 2 },
            );
        }

        return items;
    }, [data]);

    const pending = requirements.filter((item) => !item.done);
    const pendingInStep = (index: number) => pending.filter((item) => item.step === index);
    const stepsCompleted = STEPS.map((_, index) => pendingInStep(index).length === 0);

    /** Costo mensual estimado; solo cuando la modalidad lo hace calculable. */
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

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((current) => (current.create_user_account ? current : stripAccessPasswordData(current)));
        post(route('employees.store'), {
            forceFormData: true,
            onError: (formErrors) => {
                const blocking = collectUnmappedErrors(formErrors, Object.keys(data), ['membership_limit']);
                toast.error(blocking[0] ?? 'Revisa los campos marcados en el formulario.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
        });
    };

    /** Avanzar valida solo el paso actual y deja el foco en lo que falta. */
    const goNext = () => {
        const missing = pendingInStep(step)[0];

        if (missing) {
            toast.error(`Falta ${missing.label.toLowerCase()}.`);
            const field = document.getElementById(missing.key);
            field?.focus();
            field?.scrollIntoView({ block: 'center', behavior: 'smooth' });

            return;
        }

        setStep((current) => Math.min(current + 1, STEPS.length - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** En el modo por pasos, Enter no debe enviar un formulario a medio llenar. */
    const guardEnter = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter') return;
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
        if (step < STEPS.length - 1 && window.matchMedia('(max-width: 639px)').matches) {
            e.preventDefault();
        }
    };

    /** Oculta en movil lo que no pertenece al paso visible; en escritorio no aplica. */
    const onStep = (index: number) => (step === index ? '' : 'max-sm:hidden');

    const selectedRole = roles.find((r) => String(r.id) === String(data.user_role_id));
    const selectedBank = banks.find((b) => String(b.id) === String(data.bank_id));
    const pendingLabel =
        pending.length === 0
            ? 'Listo para guardar'
            : `${pending.length} ${pending.length === 1 ? 'campo obligatorio pendiente' : 'campos obligatorios pendientes'}`;

    /* ------------------------------------------------------------- cabeceras */

    const header = (
        <>
            <header
                className="sticky top-0 z-30 hidden px-4 py-4 sm:block sm:px-[34px]"
                style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            <Link href={route('employees.index')} className="hover:underline">
                                Empleados
                            </Link>
                            <span>/</span>
                            <span>Nuevo</span>
                        </nav>
                        <h1 className="mt-0.5 text-[19px]" style={{ color: 'var(--emp-text)' }}>
                            Nuevo empleado
                        </h1>
                        <p className="mt-0.5 text-[11px]" style={{ color: pending.length ? 'var(--emp-muted)' : 'var(--emp-ok)' }}>
                            {pendingLabel}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <Link href={route('employees.index')} className="emp-btn">
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                            {processing ? 'Guardando…' : 'Guardar empleado'}
                        </button>
                    </div>
                </div>
            </header>

            <EmployeeStepsHeader
                steps={STEPS}
                current={step}
                completed={stepsCompleted}
                onSelect={setStep}
                title="Nuevo empleado"
                backHref={route('employees.index')}
            />
        </>
    );

    /* -------------------------------------------------------------- secciones */

    const secciones = (
        <>
            <div className={onStep(0)}>
                <MembershipLimitAlert />
                <FormErrorAlert messages={unmappedErrors} />
            </div>

            <div className={onStep(0)}>
                <EmployeeFormSection id="identidad" step={1} title="Identidad" requirement="required">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                        <EmployeePhotoField
                            value={data.photo}
                            onChange={(file) => setData('photo', file)}
                            error={errors.photo}
                        />

                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                            <EmpInput
                                id="first_name"
                                label="Nombres"
                                required
                                value={data.first_name}
                                onChange={(e) => setData('first_name', e.target.value)}
                                error={errors.first_name}
                            />
                            <EmpInput
                                id="last_name"
                                label="Apellidos"
                                required
                                value={data.last_name}
                                onChange={(e) => setData('last_name', e.target.value)}
                                error={errors.last_name}
                            />
                            <EmpDocumentField
                                id="document_number"
                                type={data.document_type}
                                number={data.document_number}
                                onTypeChange={(v) => setData('document_type', v)}
                                onNumberChange={(v) => setData('document_number', v)}
                                typeError={errors.document_type}
                                numberError={errors.document_number}
                            />
                            <EmpInput
                                id="hire_date"
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

            <div className={onStep(0)}>
                <EmployeeFormSection id="contacto" step={2} title="Contacto" requirement="optional">
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

            <div className={onStep(1)}>
                <EmployeeFormSection
                    id="nomina"
                    step={3}
                    title="Nómina"
                    requirement="required"
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
                                    id="base_salary"
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
                                    id="daily_salary"
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
                                    id="base_salary"
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
                                    id="ordinary_hours_per_day"
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
                                                Cargos de dirección, confianza y manejo (art. 162 CST): nunca genera horas
                                                extra, aunque exceda la jornada.
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

            <div className={onStep(1)}>
                <EmployeeFormSection
                    id="pago"
                    step={4}
                    title="Datos para pago"
                    requirement="optional"
                    summary={
                        selectedBank ? <span className="emp-pill">{selectedBank.name}</span> : undefined
                    }
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
                                    value={data.bank_id === '' || data.bank_id === null ? '' : String(data.bank_id)}
                                    onChange={(e) => setData('bank_id', e.target.value === '' ? '' : Number(e.target.value))}
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
        </>
    );

    /* ------------------------------------------------------------------ panel */

    const aside = (
        <>
            <div className={onStep(2)}>
                <EmployeeAsideCard>
                    <EmpSwitch
                        checked={data.is_active}
                        onChange={(v) => setData('is_active', v)}
                        label="Empleado activo"
                        description="Aparece en registros de producción"
                    />
                </EmployeeAsideCard>
            </div>

            <div className={onStep(2)}>
                <EmployeeAsideCard id="acceso">
                    <EmpSwitch
                        checked={data.create_user_account}
                        onChange={(v) => {
                            setData('create_user_account', v);
                            if (v && !data.user_email && data.email) {
                                setData('user_email', data.email);
                            }
                        }}
                        label="Acceso al sistema"
                        description="Crear cuenta para esta persona"
                    />

                    {data.create_user_account ? (
                        <div
                            className="emp-reveal mt-3 space-y-3 pt-3"
                            style={{ borderTop: '1px solid var(--emp-border)' }}
                        >
                            <EmpInput
                                id="user_email"
                                label="Correo de acceso"
                                type="email"
                                required
                                value={data.user_email}
                                onChange={(e) => setData('user_email', e.target.value)}
                                error={errors.user_email}
                            />
                            <EmpSelect
                                id="user_role_id"
                                label="Rol"
                                required
                                value={data.user_role_id}
                                onChange={(e) => setData('user_role_id', Number(e.target.value))}
                                error={errors.user_role_id}
                                options={roles.map((r) => ({ value: r.id, label: formatRoleSelectLabel(r) }))}
                                help={selectedRole?.description ?? undefined}
                            />
                            <AccessPasswordFields
                                value={data}
                                onChange={updateAccessPassword}
                                errors={{
                                    password_mode: errors.password_mode,
                                    user_password: errors.user_password,
                                    user_password_confirmation: errors.user_password_confirmation,
                                    require_password_change: errors.require_password_change,
                                }}
                            />
                        </div>
                    ) : null}
                </EmployeeAsideCard>
            </div>

            <div className={onStep(2)}>
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
            </div>

            {estimate ? (
                <div className={onStep(1)}>
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
                </div>
            ) : null}

            {/* En movil este checklist vive en la barra fija; aqui seria una lista repetida. */}
            <div className="max-sm:hidden">
                <EmployeeAsideCard>
                    <p className="emp-kicker">Falta para guardar</p>
                    <ul className="mt-2 space-y-1.5">
                        {requirements.map((item) => (
                            <li key={item.key} className="flex items-center gap-2 text-[12px]">
                                {item.done ? (
                                    <Check size={13} weight="bold" style={{ color: 'var(--emp-ok)' }} />
                                ) : (
                                    <Circle size={13} style={{ color: 'var(--emp-faint)' }} />
                                )}
                                <span style={{ color: item.done ? 'var(--emp-subtle)' : 'var(--emp-text)' }}>
                                    {item.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </EmployeeAsideCard>
            </div>
        </>
    );

    /* ------------------------------------------------------------------ render */

    return (
        <AppLayout title="Nuevo empleado">
            <Head title="Nuevo empleado" />

            <form onSubmit={submit} onKeyDown={guardEnter}>
                <EmployeeFormLayout
                    header={header}
                    nav={<EmployeeFormNav sections={EMPLOYEE_SECTIONS} />}
                    aside={aside}
                    mobileBar={
                        <EmployeeStepsBar
                            pending={pendingInStep(step)[0] ? `Falta ${pendingInStep(step)[0].label.toLowerCase()}` : undefined}
                            onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
                            onNext={goNext}
                            nextLabel={step === STEPS.length - 1 ? 'Guardar empleado' : 'Continuar'}
                            submit={step === STEPS.length - 1}
                            processing={processing}
                        />
                    }
                >
                    {secciones}
                </EmployeeFormLayout>
            </form>
        </AppLayout>
    );
}
