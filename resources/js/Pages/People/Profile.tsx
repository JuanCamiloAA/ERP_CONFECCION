import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Bank,
    CheckCircle,
    Circle,
    DownloadSimple,
    HandCoins,
    NotePencil,
    PencilSimple,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmployeeFormNav, type EmployeeSectionRef } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeePhotoField } from '@/Components/Employees/EmployeePhotoField';
import { PayrollModeField, type PayrollMode } from '@/Components/Employees/PayrollModeField';
import { ScheduledWorkDaysField } from '@/Components/Employees/ScheduledWorkDaysField';
import { ProfileAccess } from '@/Components/People/ProfileAccess';
import { ProfileAudit } from '@/Components/People/ProfileAudit';
import { ProfileHeader } from '@/Components/People/ProfileHeader';
import { ProfileHistory } from '@/Components/People/ProfileHistory';
import { ProfileRequests } from '@/Components/People/ProfileRequests';
import { ProfileSection } from '@/Components/People/ProfileSection';
import { DataRow, Empty, Restricted, StatusTag } from '@/Components/People/primitives';
import { RequestDialogs, type RequestKind } from '@/Components/People/RequestDialogs';
import { BankLogo } from '@/Components/UI/BankLogo';
import { EmpInput, EmpSelect, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EmployeeProfile } from '@/types';
import '../../../css/module-ui.css';

const DAY_LABELS: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };

function scheduledDaysLabel(days: number[]): string {
    if (!days || days.length === 0) {
        return '—';
    }

    return days
        .slice()
        .sort((a, b) => a - b)
        .map((iso) => DAY_LABELS[iso] ?? String(iso))
        .join(', ');
}

/** `<input type="date">` solo entiende YYYY-MM-DD; el modelo serializa ISO completo. */
function dateValue(value: string | null | undefined): string {
    return String(value ?? '').slice(0, 10);
}

/**
 * Ficha de una persona. Una sola implementación para las dos rutas.
 *
 * `/profile` la monta en modo `self` y `/employees/{id}` en modo `admin`; lo que cambia
 * entre las dos no es este archivo sino `profile.permissions`, que viene ya resuelto de
 * `EmployeePolicy`. Aquí no se evalúa ni un permiso: se leen booleanos. Si esta pantalla
 * empezara a decidir quién ve qué, el servidor y el cliente acabarían discrepando y la
 * pantalla sería la que miente.
 */
export default function PeopleProfile({ profile }: { profile: EmployeeProfile }) {
    const { identity, contact, payroll, bankAccount, lifecycle, permissions, requests, history, options } = profile;
    const isSelf = profile.mode === 'self';
    const flash = usePage<App.PageProps>().props.flash;

    const [requestKind, setRequestKind] = useState<RequestKind>(null);
    const [openCreateAccess, setOpenCreateAccess] = useState(false);

    // La contraseña temporal se muestra una sola vez; el aviso se queda un rato largo
    // en pantalla porque no hay forma de recuperarla después.
    useEffect(() => {
        if (flash?.temporary_password) {
            toast.success('Contraseña generada', {
                description: `Anótala, no se mostrará de nuevo: ${flash.temporary_password}`,
                duration: 30000,
            });
        }
    }, [flash?.temporary_password]);

    // ---------------------------------------------------------------- borradores
    const [identityDraft, setIdentityDraft] = useState(() => ({ ...identity, photo: null as File | null }));
    const [contactDraft, setContactDraft] = useState(() => ({ ...contact }));
    const [payrollDraft, setPayrollDraft] = useState(() => ({ ...payroll }));
    const [bankDraft, setBankDraft] = useState(() => ({
        bank_id: bankAccount.bank ? String(bankAccount.bank.id) : '',
        bank_account_number: '',
        bank_key: '',
        bank_account_type: bankAccount.account_type ?? 'ahorros',
    }));
    const [notesDraft, setNotesDraft] = useState('');
    const [lifecycleDraft, setLifecycleDraft] = useState(() => ({
        lifecycle_status: lifecycle.status,
        termination_date: dateValue(lifecycle.termination_date),
        termination_reason: lifecycle.termination_reason ?? '',
    }));

    const sectionUrl = (section: string) => route('employees.section.update', [profile.employeeId, section]);

    // --------------------------------------------------------------- índice lateral
    const sections = useMemo<EmployeeSectionRef[]>(() => {
        const list: EmployeeSectionRef[] = [
            { id: 'identidad', label: 'Identidad' },
            { id: 'contacto', label: 'Contacto' },
            { id: 'nomina', label: 'Nómina' },
            { id: 'pago', label: 'Datos de pago' },
        ];

        if (permissions.canManageAccess || profile.account.exists) {
            list.push({ id: 'acceso', label: 'Cuenta de acceso' });
        }
        list.push({ id: 'ciclo', label: 'Ciclo de vida' });
        if (permissions.canViewRequests) {
            list.push({ id: 'solicitudes', label: isSelf ? 'Mis solicitudes' : 'Solicitudes' });
        }
        list.push({ id: 'historial', label: 'Historial' });
        if (!isSelf || permissions.canEditNotes) {
            list.push({ id: 'notas', label: 'Notas' });
        }
        if (permissions.canViewAudit) {
            list.push({ id: 'bitacora', label: 'Bitácora' });
        }

        return list;
    }, [permissions, profile.account.exists, isSelf]);

    /** Desprendible más reciente disponible: lo que el empleado viene a buscar. */
    const latestReceipt = useMemo(
        () => history.payrolls.find((row) => row.receipt_available) ?? null,
        [history.payrolls],
    );

    const goTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        }
    };

    /** Las alertas son atajos a lo que ya existe en la ficha, no una vía paralela. */
    const handleAlert = (action: string) => {
        switch (action) {
            case 'create_access':
                setOpenCreateAccess(true);
                goTo('acceso');
                break;
            case 'toggle_access':
                goTo('acceso');
                break;
            case 'complete_data':
                goTo('contacto');
                break;
            case 'review_production':
                goTo('historial');
                break;
            case 'approve_requests':
            case 'view_requests':
                goTo('solicitudes');
                break;
            default:
                break;
        }
    };

    return (
        <>
            <Head title={isSelf ? 'Mi perfil' : identity.full_name} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] sm:pb-8 lg:pb-8">
                {/* ------------------------------------------------------ barra superior */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="min-w-0">
                        {!isSelf ? (
                            <Link href={route('employees.index')} className="emp-btn emp-btn-sm emp-btn-ghost">
                                <ArrowLeft size={14} aria-hidden="true" /> Empleados
                            </Link>
                        ) : (
                            <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                Tu ficha, tus cifras del periodo y tus solicitudes.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {permissions.canCreateRequests && isSelf ? (
                            <>
                                <button type="button" className="emp-btn emp-btn-sm" onClick={() => setRequestKind('advance')}>
                                    <HandCoins size={14} aria-hidden="true" /> Solicitar anticipo
                                </button>
                                <button
                                    type="button"
                                    className="emp-btn emp-btn-sm"
                                    onClick={() => setRequestKind('profile_change')}
                                >
                                    <Bank size={14} aria-hidden="true" /> Actualizar cuenta
                                </button>
                                <button
                                    type="button"
                                    className="emp-btn emp-btn-sm"
                                    onClick={() => setRequestKind('production_correction')}
                                >
                                    <NotePencil size={14} aria-hidden="true" /> Reportar corrección
                                </button>
                            </>
                        ) : null}

                        {latestReceipt ? (
                            <a
                                className="emp-btn emp-btn-sm emp-btn-primary"
                                href={route('employees.receipt', [profile.employeeId, latestReceipt.id])}
                                target="_blank"
                                rel="noopener"
                            >
                                <DownloadSimple size={14} aria-hidden="true" />
                                {isSelf ? 'Mi desprendible' : 'Desprendible'}
                            </a>
                        ) : null}

                        {permissions.canEditFullForm ? (
                            <Link href={route('employees.edit', profile.employeeId)} className="emp-btn emp-btn-sm">
                                <PencilSimple size={14} aria-hidden="true" /> Formulario completo
                            </Link>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4">
                    <ProfileHeader profile={profile} onAlertAction={(alert) => handleAlert(alert.action)} />
                </div>

                {/* --------------------------------------------- índice + secciones */}
                <div className="mt-7 flex flex-col items-start gap-5 lg:flex-row lg:gap-[26px]">
                    <nav
                        className="sticky top-[84px] hidden w-[196px] shrink-0 self-start lg:block"
                        aria-label="Secciones de la ficha"
                    >
                        <EmployeeFormNav sections={sections} />
                    </nav>

                    <div className="flex w-full min-w-0 flex-1 flex-col gap-7">
                        {/* -------------------------------------------------- identidad */}
                        <ProfileSection
                            id="identidad"
                            title="Identidad"
                            canEdit={permissions.canEditIdentity}
                            action={sectionUrl('identity')}
                            onEditStart={() => setIdentityDraft({ ...identity, photo: null })}
                            payload={() => {
                                const body = new FormData();
                                body.append('first_name', identityDraft.first_name ?? '');
                                body.append('last_name', identityDraft.last_name ?? '');
                                if (permissions.canEditAsAdministrator) {
                                    body.append('document_type', identityDraft.document_type ?? '');
                                    body.append('document_number', identityDraft.document_number ?? '');
                                    body.append('hire_date', dateValue(identityDraft.hire_date));
                                }
                                if (identityDraft.photo) {
                                    body.append('photo', identityDraft.photo);
                                }

                                return body;
                            }}
                            form={({ errors }) => (
                                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                    <EmpInput
                                        label="Nombre"
                                        required
                                        value={identityDraft.first_name ?? ''}
                                        onChange={(event) =>
                                            setIdentityDraft((current) => ({ ...current, first_name: event.target.value }))
                                        }
                                        error={errors.first_name}
                                    />
                                    <EmpInput
                                        label="Apellido"
                                        required
                                        value={identityDraft.last_name ?? ''}
                                        onChange={(event) =>
                                            setIdentityDraft((current) => ({ ...current, last_name: event.target.value }))
                                        }
                                        error={errors.last_name}
                                    />

                                    {permissions.canEditAsAdministrator ? (
                                        <>
                                            <EmpSelect
                                                label="Tipo de documento"
                                                required
                                                value={identityDraft.document_type ?? 'CC'}
                                                onChange={(event) =>
                                                    setIdentityDraft((current) => ({
                                                        ...current,
                                                        document_type: event.target.value,
                                                    }))
                                                }
                                                options={options.document_types.map((value) => ({ value, label: value }))}
                                                error={errors.document_type}
                                            />
                                            <EmpInput
                                                label="Número de documento"
                                                required
                                                value={identityDraft.document_number ?? ''}
                                                onChange={(event) =>
                                                    setIdentityDraft((current) => ({
                                                        ...current,
                                                        document_number: event.target.value,
                                                    }))
                                                }
                                                error={errors.document_number}
                                            />
                                            <EmpInput
                                                label="Fecha de ingreso"
                                                type="date"
                                                required
                                                value={dateValue(identityDraft.hire_date)}
                                                onChange={(event) =>
                                                    setIdentityDraft((current) => ({
                                                        ...current,
                                                        hire_date: event.target.value,
                                                    }))
                                                }
                                                error={errors.hire_date}
                                            />
                                        </>
                                    ) : (
                                        <p className="emp-note sm:col-span-2">
                                            El documento y la fecha de ingreso son datos del contrato: los cambia
                                            administración.
                                        </p>
                                    )}

                                    <div className="sm:col-span-2">
                                        <EmployeePhotoField
                                            value={identityDraft.photo}
                                            currentUrl={identity.photo}
                                            onChange={(file) => setIdentityDraft((current) => ({ ...current, photo: file }))}
                                            error={errors.photo}
                                        />
                                    </div>
                                </div>
                            )}
                        >
                            <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                <DataRow label="Nombre completo">{identity.full_name}</DataRow>
                                <DataRow label="Documento">
                                    {identity.document_type} {identity.document_number}
                                </DataRow>
                                <DataRow label="Fecha de ingreso">{formatDate(identity.hire_date)}</DataRow>
                                <DataRow label="Estado">
                                    <StatusTag
                                        label={identity.is_active ? 'Activo' : 'Inactivo'}
                                        tone={identity.is_active ? 'ok' : 'warn'}
                                    />
                                </DataRow>
                            </dl>
                        </ProfileSection>

                        {/* --------------------------------------------------- contacto */}
                        <ProfileSection
                            id="contacto"
                            title="Contacto"
                            canEdit={permissions.canEditContact}
                            action={sectionUrl('contact')}
                            onEditStart={() => setContactDraft({ ...contact })}
                            payload={() => ({
                                phone: contactDraft.phone ?? '',
                                email: contactDraft.email ?? '',
                                address: contactDraft.address ?? '',
                                emergency_contact_name: contactDraft.emergency_contact_name ?? '',
                                emergency_contact_phone: contactDraft.emergency_contact_phone ?? '',
                            })}
                            form={({ errors }) => (
                                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                    <EmpInput
                                        label="Teléfono"
                                        value={contactDraft.phone ?? ''}
                                        onChange={(event) => setContactDraft((c) => ({ ...c, phone: event.target.value }))}
                                        error={errors.phone}
                                    />
                                    <EmpInput
                                        label="Correo personal"
                                        type="email"
                                        value={contactDraft.email ?? ''}
                                        onChange={(event) => setContactDraft((c) => ({ ...c, email: event.target.value }))}
                                        error={errors.email}
                                    />
                                    <EmpInput
                                        label="Dirección"
                                        containerClassName="sm:col-span-2"
                                        value={contactDraft.address ?? ''}
                                        onChange={(event) => setContactDraft((c) => ({ ...c, address: event.target.value }))}
                                        error={errors.address}
                                    />
                                    <EmpInput
                                        label="Contacto de emergencia"
                                        value={contactDraft.emergency_contact_name ?? ''}
                                        onChange={(event) =>
                                            setContactDraft((c) => ({ ...c, emergency_contact_name: event.target.value }))
                                        }
                                        error={errors.emergency_contact_name}
                                    />
                                    <EmpInput
                                        label="Teléfono de emergencia"
                                        value={contactDraft.emergency_contact_phone ?? ''}
                                        onChange={(event) =>
                                            setContactDraft((c) => ({ ...c, emergency_contact_phone: event.target.value }))
                                        }
                                        error={errors.emergency_contact_phone}
                                    />
                                </div>
                            )}
                        >
                            <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                <DataRow label="Teléfono">{contact.phone ?? <Empty />}</DataRow>
                                <DataRow label="Correo personal">{contact.email ?? <Empty />}</DataRow>
                                <DataRow label="Dirección" wide>
                                    {contact.address ?? <Empty />}
                                </DataRow>
                                <DataRow label="Contacto de emergencia">
                                    {contact.emergency_contact_name ?? <Empty />}
                                </DataRow>
                                <DataRow label="Teléfono de emergencia">
                                    {contact.emergency_contact_phone ?? <Empty />}
                                </DataRow>
                            </dl>
                        </ProfileSection>

                        {/* ----------------------------------------------------- nómina */}
                        <ProfileSection
                            id="nomina"
                            title="Nómina"
                            summary={<span className="emp-pill">{payroll.payroll_mode_label}</span>}
                            canEdit={permissions.canEditPayroll}
                            action={sectionUrl('payroll')}
                            onEditStart={() => setPayrollDraft({ ...payroll })}
                            payload={() => ({
                                payroll_mode: payrollDraft.payroll_mode,
                                base_salary: payrollDraft.base_salary ?? 0,
                                daily_salary: payrollDraft.daily_salary ?? '',
                                minutes_per_full_workday: payrollDraft.minutes_per_full_workday,
                                ordinary_hours_per_day: payrollDraft.ordinary_hours_per_day ?? '',
                                is_exempt_from_overtime: payrollDraft.is_exempt_from_overtime,
                                scheduled_work_days: payrollDraft.scheduled_work_days,
                            })}
                            form={({ errors }) => (
                                <div className="space-y-3.5">
                                    <PayrollModeField
                                        value={payrollDraft.payroll_mode as PayrollMode}
                                        onChange={(mode) =>
                                            setPayrollDraft((c) => ({ ...c, payroll_mode: mode as typeof c.payroll_mode }))
                                        }
                                        error={errors.payroll_mode}
                                    />

                                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                        <EmpInput
                                            label="Salario base mensual"
                                            prefix="$"
                                            inputMode="numeric"
                                            value={String(payrollDraft.base_salary ?? '')}
                                            onChange={(event) =>
                                                setPayrollDraft((c) => ({
                                                    ...c,
                                                    base_salary: Number(event.target.value.replace(/[^\d]/g, '')) || 0,
                                                }))
                                            }
                                            error={errors.base_salary}
                                        />

                                        {payrollDraft.payroll_mode === 'fixed_daily' ? (
                                            <EmpInput
                                                label="Salario diario"
                                                prefix="$"
                                                inputMode="numeric"
                                                value={String(payrollDraft.daily_salary ?? '')}
                                                onChange={(event) =>
                                                    setPayrollDraft((c) => ({
                                                        ...c,
                                                        daily_salary: Number(event.target.value.replace(/[^\d]/g, '')) || 0,
                                                    }))
                                                }
                                                error={errors.daily_salary}
                                            />
                                        ) : null}

                                        {payrollDraft.payroll_mode === 'hourly_legal' ? (
                                            <EmpInput
                                                label="Jornada ordinaria diaria (horas)"
                                                inputMode="decimal"
                                                value={String(payrollDraft.ordinary_hours_per_day ?? '')}
                                                onChange={(event) =>
                                                    setPayrollDraft((c) => ({
                                                        ...c,
                                                        ordinary_hours_per_day: Number(event.target.value) || 0,
                                                    }))
                                                }
                                                error={errors.ordinary_hours_per_day}
                                            />
                                        ) : null}

                                        {payrollDraft.payroll_mode !== 'operations' ? (
                                            <EmpInput
                                                label="Minutos de jornada completa"
                                                inputMode="numeric"
                                                value={String(payrollDraft.minutes_per_full_workday ?? 480)}
                                                onChange={(event) =>
                                                    setPayrollDraft((c) => ({
                                                        ...c,
                                                        minutes_per_full_workday:
                                                            Number(event.target.value.replace(/[^\d]/g, '')) || 0,
                                                    }))
                                                }
                                                error={errors.minutes_per_full_workday}
                                            />
                                        ) : null}
                                    </div>

                                    {payrollDraft.payroll_mode === 'hourly_legal' ? (
                                        <EmpSwitch
                                            checked={payrollDraft.is_exempt_from_overtime}
                                            onChange={(value) =>
                                                setPayrollDraft((c) => ({ ...c, is_exempt_from_overtime: value }))
                                            }
                                            label="Exento de horas extra (art. 162 CST)"
                                            description="Cargos de dirección, confianza o manejo."
                                        />
                                    ) : null}

                                    {payrollDraft.payroll_mode !== 'operations' ? (
                                        <ScheduledWorkDaysField
                                            value={payrollDraft.scheduled_work_days}
                                            onChange={(days) => setPayrollDraft((c) => ({ ...c, scheduled_work_days: days }))}
                                            error={errors.scheduled_work_days}
                                        />
                                    ) : null}
                                </div>
                            )}
                        >
                            <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                <DataRow label="Modalidad">{payroll.payroll_mode_label}</DataRow>
                                <DataRow label="Salario base">
                                    {payroll.restricted ? <Restricted /> : formatCurrency(payroll.base_salary ?? 0)}
                                </DataRow>
                                {payroll.payroll_mode === 'fixed_daily' ? (
                                    <DataRow label="Salario diario">
                                        {payroll.restricted ? <Restricted /> : formatCurrency(payroll.daily_salary ?? 0)}
                                    </DataRow>
                                ) : null}
                                {payroll.payroll_mode === 'hourly_legal' ? (
                                    <>
                                        <DataRow label="Jornada ordinaria diaria">
                                            {payroll.ordinary_hours_per_day ?? 8} horas
                                        </DataRow>
                                        <DataRow label="Horas extra">
                                            {payroll.is_exempt_from_overtime ? 'Exento (art. 162 CST)' : 'Aplica'}
                                        </DataRow>
                                    </>
                                ) : null}
                                {payroll.payroll_mode !== 'operations' ? (
                                    <DataRow label="Días hábiles esperados" wide>
                                        {scheduledDaysLabel(payroll.scheduled_work_days)}
                                    </DataRow>
                                ) : null}
                            </dl>
                        </ProfileSection>

                        {/* --------------------------------------------- datos de pago */}
                        <ProfileSection
                            id="pago"
                            title="Datos de pago"
                            canEdit={permissions.canEditBankAccount}
                            action={sectionUrl('bank')}
                            onEditStart={() =>
                                setBankDraft({
                                    bank_id: bankAccount.bank ? String(bankAccount.bank.id) : '',
                                    bank_account_number: '',
                                    bank_key: '',
                                    bank_account_type: bankAccount.account_type ?? 'ahorros',
                                })
                            }
                            payload={() => ({ ...bankDraft })}
                            actions={
                                isSelf && permissions.canCreateRequests ? (
                                    <button
                                        type="button"
                                        className="emp-btn emp-btn-sm"
                                        onClick={() => setRequestKind('profile_change')}
                                    >
                                        Solicitar cambio
                                    </button>
                                ) : null
                            }
                            form={({ errors }) => (
                                <div className="space-y-3.5">
                                    <p className="emp-note">
                                        La cuenta se reescribe completa: el número actual no viaja al navegador, así que
                                        hay que escribirlo de nuevo. Dejar los tres campos vacíos borra los datos de pago.
                                    </p>
                                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                        <EmpSelect
                                            label="Banco o billetera"
                                            placeholder="Sin datos de pago"
                                            value={bankDraft.bank_id}
                                            onChange={(event) => setBankDraft((c) => ({ ...c, bank_id: event.target.value }))}
                                            options={options.banks.map((row) => ({ value: String(row.id), label: row.name }))}
                                            error={errors.bank_id}
                                        />
                                        <EmpSelect
                                            label="Tipo de cuenta"
                                            value={bankDraft.bank_account_type}
                                            onChange={(event) =>
                                                setBankDraft((c) => ({ ...c, bank_account_type: event.target.value }))
                                            }
                                            options={[
                                                { value: 'ahorros', label: 'Ahorros' },
                                                { value: 'corriente', label: 'Corriente' },
                                            ]}
                                            error={errors.bank_account_type}
                                        />
                                        <EmpInput
                                            label="Número de cuenta"
                                            inputMode="numeric"
                                            value={bankDraft.bank_account_number}
                                            onChange={(event) =>
                                                setBankDraft((c) => ({
                                                    ...c,
                                                    bank_account_number: event.target.value.replace(/[^\d]/g, ''),
                                                }))
                                            }
                                            error={errors.bank_account_number}
                                        />
                                        <EmpInput
                                            label="Clave de dispersión"
                                            value={bankDraft.bank_key}
                                            onChange={(event) =>
                                                setBankDraft((c) => ({
                                                    ...c,
                                                    bank_key: event.target.value.replace(/[^0-9A-Za-z]/g, ''),
                                                }))
                                            }
                                            error={errors.bank_key}
                                        />
                                    </div>
                                </div>
                            )}
                        >
                            {bankAccount.restricted ? (
                                <p className="text-[13px]">
                                    <Restricted label={bankAccount.has_account ? 'Restringido' : 'Restringido · sin datos'} />
                                </p>
                            ) : (
                                <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                    <DataRow label="Banco">
                                        {bankAccount.bank ? (
                                            <span className="inline-flex items-center gap-2">
                                                <BankLogo
                                                    name={bankAccount.bank.name}
                                                    initials={bankAccount.bank.initials ?? '??'}
                                                    logoUrl={bankAccount.bank.logo_url}
                                                    brandColor={bankAccount.bank.brand_color}
                                                    size={30}
                                                />
                                                <span>{bankAccount.bank.name}</span>
                                                {!bankAccount.bank.is_active ? <StatusTag label="Inactivo" tone="warn" /> : null}
                                            </span>
                                        ) : (
                                            <Empty />
                                        )}
                                    </DataRow>
                                    <DataRow label="Tipo de cuenta">{bankAccount.account_type ?? <Empty />}</DataRow>
                                    <DataRow label="Cuenta" mono>
                                        {bankAccount.account_masked ?? <Empty />}
                                    </DataRow>
                                    <DataRow label="Llave bancaria" mono>
                                        {bankAccount.key_masked ?? <Empty />}
                                    </DataRow>
                                </dl>
                            )}
                        </ProfileSection>

                        {/* --------------------------------------------- cuenta acceso */}
                        {permissions.canManageAccess || profile.account.exists ? (
                            <ProfileSection id="acceso" title="Cuenta de acceso">
                                <ProfileAccess
                                    profile={profile}
                                    openCreate={openCreateAccess}
                                    onOpenCreateHandled={() => setOpenCreateAccess(false)}
                                />
                            </ProfileSection>
                        ) : null}

                        {/* ----------------------------------------------- ciclo de vida */}
                        <ProfileSection
                            id="ciclo"
                            title="Ciclo de vida"
                            summary={<StatusTag label={lifecycle.status_label} tone="accent" />}
                            canEdit={permissions.canManageLifecycle}
                            editLabel="Cambiar estado"
                            action={sectionUrl('lifecycle')}
                            onEditStart={() =>
                                setLifecycleDraft({
                                    lifecycle_status: lifecycle.status,
                                    termination_date: dateValue(lifecycle.termination_date),
                                    termination_reason: lifecycle.termination_reason ?? '',
                                })
                            }
                            payload={() => ({ ...lifecycleDraft })}
                            form={({ errors }) => (
                                <div className="space-y-3.5">
                                    <EmpSelect
                                        label="Estado"
                                        required
                                        value={lifecycleDraft.lifecycle_status}
                                        onChange={(event) =>
                                            setLifecycleDraft((c) => ({ ...c, lifecycle_status: event.target.value }))
                                        }
                                        options={options.lifecycle_statuses.map((row) => ({
                                            value: row.value,
                                            label: row.label,
                                        }))}
                                        error={errors.lifecycle_status}
                                    />

                                    {lifecycleDraft.lifecycle_status === 'retirado' ? (
                                        <div className="emp-reveal space-y-3.5">
                                            <p className="emp-note">
                                                Retirar inactiva al empleado y revoca su acceso al sistema en el mismo paso.
                                            </p>
                                            <EmpInput
                                                label="Fecha de retiro"
                                                type="date"
                                                required
                                                value={lifecycleDraft.termination_date}
                                                onChange={(event) =>
                                                    setLifecycleDraft((c) => ({ ...c, termination_date: event.target.value }))
                                                }
                                                error={errors.termination_date}
                                            />
                                            <EmpTextarea
                                                label="Motivo del retiro"
                                                required
                                                rows={3}
                                                value={lifecycleDraft.termination_reason}
                                                onChange={(event) =>
                                                    setLifecycleDraft((c) => ({
                                                        ...c,
                                                        termination_reason: event.target.value,
                                                    }))
                                                }
                                                error={errors.termination_reason}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        >
                            <div className="space-y-3.5">
                                <ol className="flex flex-wrap gap-1.5" aria-label="Etapas del ciclo de vida">
                                    {lifecycle.flow.map((step) => (
                                        <li key={step.key}>
                                            <span className={`emp-pill ${step.key === lifecycle.status ? 'emp-pill-accent' : ''}`}>
                                                {step.label}
                                            </span>
                                        </li>
                                    ))}
                                </ol>

                                <ul className="space-y-1.5" aria-label="Checklist de incorporación">
                                    {lifecycle.checklist.map((item) => (
                                        <li key={item.key} className="flex items-center gap-2 text-[13px]">
                                            <span
                                                aria-hidden="true"
                                                style={{ color: item.done ? 'var(--emp-ok)' : 'var(--emp-faint)' }}
                                            >
                                                {item.done ? <CheckCircle size={16} weight="fill" /> : <Circle size={16} />}
                                            </span>
                                            <span style={{ color: item.done ? 'var(--emp-muted)' : 'var(--emp-text)' }}>
                                                {item.label}
                                            </span>
                                            <span className="sr-only">{item.done ? ' (completado)' : ' (pendiente)'}</span>
                                        </li>
                                    ))}
                                </ul>

                                {lifecycle.termination_date ? (
                                    <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                        <DataRow label="Fecha de retiro">{formatDate(lifecycle.termination_date)}</DataRow>
                                        <DataRow label="Motivo">{lifecycle.termination_reason ?? <Empty />}</DataRow>
                                    </dl>
                                ) : null}
                            </div>
                        </ProfileSection>

                        {/* ----------------------------------------------- solicitudes */}
                        {permissions.canViewRequests ? (
                            <ProfileSection
                                id="solicitudes"
                                title={isSelf ? 'Mis solicitudes' : 'Solicitudes'}
                                summary={
                                    requests.pending.length > 0 ? (
                                        <StatusTag label={`${requests.pending.length} en revisión`} tone="accent" />
                                    ) : undefined
                                }
                            >
                                <ProfileRequests
                                    requests={requests.mine}
                                    canApprove={permissions.canApproveRequests}
                                    isSelf={isSelf}
                                />
                            </ProfileSection>
                        ) : null}

                        {/* -------------------------------------------------- historial */}
                        <ProfileSection id="historial" title="Historial">
                            <ProfileHistory profile={profile} />
                        </ProfileSection>

                        {/* ------------------------------------------------------ notas */}
                        {!isSelf || permissions.canEditNotes ? (
                            <ProfileSection
                                id="notas"
                                title="Notas"
                                canEdit={permissions.canEditNotes}
                                action={sectionUrl('notes')}
                                onEditStart={() => setNotesDraft(profile.notes ?? '')}
                                payload={() => ({ notes: notesDraft })}
                                form={({ errors }) => (
                                    <EmpTextarea
                                        label="Notas internas"
                                        rows={5}
                                        value={notesDraft}
                                        onChange={(event) => setNotesDraft(event.target.value)}
                                        error={errors.notes}
                                        help="No las ve el empleado en su propio perfil."
                                    />
                                )}
                            >
                                <p className="whitespace-pre-line text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                    {profile.notes || 'Sin notas.'}
                                </p>
                            </ProfileSection>
                        ) : null}

                        {/* ---------------------------------------------------- bitácora */}
                        {permissions.canViewAudit ? (
                            <ProfileSection
                                id="bitacora"
                                title="Bitácora"
                                summary={
                                    profile.auditLog.length > 0 ? (
                                        <span className="emp-pill">{profile.auditLog.length} movimientos</span>
                                    ) : undefined
                                }
                            >
                                <ProfileAudit entries={profile.auditLog} />
                            </ProfileSection>
                        ) : null}
                    </div>
                </div>
            </div>

            <RequestDialogs profile={profile} kind={requestKind} onClose={() => setRequestKind(null)} />
        </>
    );
}
