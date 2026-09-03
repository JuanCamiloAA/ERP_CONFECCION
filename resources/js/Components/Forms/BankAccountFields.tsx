import { Link } from '@inertiajs/react';
import { Check, Info, MagnifyingGlass } from '@phosphor-icons/react';
import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { BankLogo } from '@/Components/UI/BankLogo';
import { Can } from '@/Components/UI/Can';
import { EmpInput, EmpSelect } from '@/Components/UI/ModuleFields';
import type { BankOption } from '@/types';

interface Props {
    banks: BankOption[];
    bankId: number | string;
    accountType: string;
    accountNumber: string;
    bankKey: string;
    onChange: (next: {
        bank_id?: string;
        bank_account_type?: string;
        bank_account_number?: string;
        bank_key?: string;
    }) => void;
    errors: {
        bank_id?: string;
        bank_account_type?: string;
        bank_account_number?: string;
        bank_key?: string;
    };
    disabled?: boolean;
}

const ACCOUNT_TYPES = [
    { value: 'ahorros', label: 'Ahorros' },
    { value: 'corriente', label: 'Corriente' },
];

/**
 * Elección del banco y captura de la cuenta.
 *
 * Sustituye al desplegable de bancos y a los dos campos sueltos. El desplegable no podía
 * mostrar el logo ni decir cuántos dígitos pide cada entidad: había que saberlo de memoria y
 * el error salía al dispersar la nómina, no al capturar. Aquí las reglas del banco elegido
 * —formato, ayuda, si pide clave y la nota— se leen del catálogo y cambian al cambiar de
 * banco.
 */
export function BankAccountFields({
    banks,
    bankId,
    accountType,
    accountNumber,
    bankKey,
    onChange,
    errors,
    disabled = false,
}: Props) {
    const [term, setTerm] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => banks.find((bank) => String(bank.id) === String(bankId)) ?? null,
        [banks, bankId],
    );

    const visible = useMemo(() => {
        const needle = term.trim().toLowerCase();
        if (needle === '') return banks;

        return banks.filter(
            (bank) =>
                bank.display_name.toLowerCase().includes(needle) ||
                (bank.code ?? '').toLowerCase().includes(needle),
        );
    }, [banks, term]);

    /**
     * Al cambiar de banco solo se limpia la cuenta si el formato es distinto: cambiar de un
     * banco a otro con el mismo formato no debe obligar a reescribir lo ya tecleado, pero
     * conservar diez dígitos al pasar a una billetera que espera un celular sí es un error.
     */
    const pick = (bank: BankOption) => {
        if (String(bank.id) === String(bankId)) return;

        const formatChanged = (selected?.account_format ?? null) !== (bank.account_format ?? null);

        onChange({
            bank_id: String(bank.id),
            ...(formatChanged ? { bank_account_number: '', bank_key: '' } : {}),
            // Una billetera no tiene tipo de cuenta; dejarlo puesto guardaría «Ahorros» en
            // un registro donde el campo ni siquiera se muestra.
            ...(bank.type === 'wallet' ? { bank_account_type: '' } : {}),
            ...(bank.requires_key ? {} : { bank_key: '' }),
        });
    };

    /** ↑/↓ recorren la lista y Enter elige, sin salir del teclado. */
    const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (! ['ArrowDown', 'ArrowUp'].includes(e.key)) return;

        e.preventDefault();
        const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        if (buttons.length === 0) return;

        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === 'ArrowDown' ? current + 1 : current - 1;

        buttons[(next + buttons.length) % buttons.length]?.focus();
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* ------------------------------------------------ lista de bancos */}
            <div className="min-w-0">
                <div className="relative">
                    <MagnifyingGlass
                        size={15}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Filtrar bancos activos"
                        aria-label="Filtrar bancos activos"
                        disabled={disabled}
                        className="emp-field pl-8"
                    />
                </div>

                <div
                    ref={listRef}
                    role="listbox"
                    aria-label="Bancos disponibles"
                    onKeyDown={onListKeyDown}
                    className="mt-2 max-h-[340px] space-y-1 overflow-y-auto pr-0.5"
                >
                    {visible.length === 0 ? (
                        <p className="px-1 py-3 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            Ningún banco coincide con «{term}».
                        </p>
                    ) : (
                        visible.map((bank) => {
                            const on = String(bank.id) === String(bankId);

                            return (
                                <button
                                    key={bank.id}
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    disabled={disabled}
                                    onClick={() => pick(bank)}
                                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                        on
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                            : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/40'
                                    }`}
                                >
                                    <BankLogo
                                        name={bank.display_name}
                                        initials={bank.initials}
                                        logoUrl={bank.logo_url}
                                        brandColor={bank.brand_color}
                                        size={30}
                                    />

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                            {bank.display_name}
                                        </span>
                                        <span
                                            className="block truncate font-mono text-[11px]"
                                            style={{ color: 'var(--emp-subtle)' }}
                                        >
                                            {bank.code ?? 'Sin código'}
                                        </span>
                                    </span>

                                    {on ? (
                                        <Check
                                            size={15}
                                            aria-hidden="true"
                                            className="shrink-0 text-indigo-600 dark:text-indigo-400"
                                        />
                                    ) : null}
                                </button>
                            );
                        })
                    )}
                </div>

                <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    Solo bancos activos.{' '}
                    <Can permission="banks.index.view">
                        <Link
                            href={route('banks.index')}
                            className="underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            Administrar catálogo
                        </Link>
                    </Can>
                </p>

                {errors.bank_id ? <p className="emp-error mt-1">{errors.bank_id}</p> : null}
            </div>

            {/* -------------------------------------------- banco seleccionado */}
            <div className="min-w-0">
                {! selected ? (
                    <div
                        className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed p-6 text-center text-[13px]"
                        style={{ borderColor: 'var(--emp-border)', color: 'var(--emp-muted)' }}
                    >
                        Elige un banco para capturar la cuenta.
                    </div>
                ) : (
                    <div className="emp-card p-4">
                        <header className="flex items-start gap-3">
                            <BankLogo
                                name={selected.display_name}
                                initials={selected.initials}
                                logoUrl={selected.logo_url}
                                brandColor={selected.brand_color}
                                size={72}
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[19px]" style={{ color: 'var(--emp-text)' }}>
                                    {selected.display_name}
                                </p>
                                <p className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    {selected.code ?? 'Sin código'} · {selected.type_label} ·{' '}
                                    {selected.employees_count}{' '}
                                    {selected.employees_count === 1 ? 'empleado' : 'empleados'}
                                </p>
                            </div>

                            <span className={`emp-pill shrink-0 ${selected.is_active ? '' : 'emp-pill-warn'}`}>
                                {selected.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </header>

                        <div
                            className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2"
                            style={{ borderColor: 'var(--emp-border)' }}
                        >
                            {selected.type !== 'wallet' ? (
                                <EmpSelect
                                    label="Tipo de cuenta"
                                    placeholder="Seleccione"
                                    value={accountType}
                                    onChange={(e) => onChange({ bank_account_type: e.target.value })}
                                    options={ACCOUNT_TYPES}
                                    error={errors.bank_account_type}
                                    disabled={disabled}
                                />
                            ) : null}

                            <EmpInput
                                label="Número de cuenta"
                                inputMode="numeric"
                                containerClassName="[&_input]:font-mono [&_input]:tabular-nums"
                                placeholder={selected.account_format ?? 'Solo números'}
                                value={accountNumber}
                                onChange={(e) => onChange({ bank_account_number: e.target.value.replace(/\D/g, '') })}
                                error={errors.bank_account_number}
                                help={selected.account_hint ?? 'Solo números'}
                                disabled={disabled}
                            />

                            <EmpInput
                                containerClassName="sm:col-span-2 [&_input]:font-mono"
                                label="Clave / referencia de pago"
                                value={selected.requires_key ? bankKey : ''}
                                placeholder={selected.requires_key ? undefined : 'No requiere clave'}
                                onChange={(e) => onChange({ bank_key: e.target.value.replace(/[^0-9A-Za-z]/g, '') })}
                                error={errors.bank_key}
                                help={selected.requires_key ? 'Letras y números, sin espacios' : undefined}
                                disabled={disabled || ! selected.requires_key}
                            />
                        </div>

                        {selected.notes ? (
                            <div
                                className="mt-4 flex items-start gap-2.5 rounded-lg border p-3 text-[12px]"
                                style={{
                                    borderColor: 'var(--emp-accent)',
                                    backgroundColor: 'var(--emp-accent-tint)',
                                    color: 'var(--emp-text)',
                                }}
                            >
                                <Info
                                    size={16}
                                    aria-hidden="true"
                                    className="mt-px shrink-0"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                />
                                <p>{selected.notes}</p>
                            </div>
                        ) : null}

                        <p className="mt-3 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            El logo se toma del catálogo de bancos; súbelo una vez y aparece en toda la aplicación.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BankAccountFields;
