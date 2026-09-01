import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from '@phosphor-icons/react';
import { ProductionRegisterForm, type ReferenceWithOps } from '@/Components/Productions/ProductionRegisterForm';
import { WorkDayBanner } from '@/Components/Productions/WorkDayBanner';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import type { Employee } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    employees: Employee[];
    references: ReferenceWithOps[];
    workDaySelectableEmployees?: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
}

export default function ProductionCreate({ employees, references, workDaySelectableEmployees = [] }: Props) {
    return (
        <AppLayout title="Registrar producción">
            <Head title="Registrar producción" />

            <div className="emp-form emp-bleed min-h-screen">
                <header
                    className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
                    style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
                >
                    <div className="flex items-center gap-3">
                        <Link
                            href={route('productions.index')}
                            aria-label="Volver al listado"
                            className="emp-btn emp-btn-ghost shrink-0 px-2"
                        >
                            <ArrowLeft size={17} />
                            <span className="max-sm:sr-only">Volver</span>
                        </Link>
                        <div className="min-w-0">
                            <nav className="hidden items-center gap-1.5 text-[12px] sm:flex" style={{ color: 'var(--emp-subtle)' }}>
                                <Link href={route('productions.index')} className="hover:underline">
                                    Producción
                                </Link>
                                <span>/</span>
                                <span>Nueva</span>
                            </nav>
                            <h1 className="truncate text-[17px] sm:mt-0.5 sm:text-[19px]" style={{ color: 'var(--emp-text)' }}>
                                Registrar producción
                            </h1>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-4 px-4 pb-8 pt-5 sm:px-[34px] sm:pt-6">
                    {/*
                      * El control de jornada vive aqui y solo aqui: en el listado ocupaba la
                      * primera pantalla sin decir nada de la produccion del dia.
                      */}
                    {workDaySelectableEmployees.length > 0 ? (
                        <Can any={['productions.index.workday_start', 'productions.index.workday_close']}>
                            <div className="w-full max-w-[640px]">
                                <WorkDayBanner
                                    variant="admin"
                                    selectableEmployees={workDaySelectableEmployees}
                                    note="El control de jornada solo aparece aquí; el listado ya no lo muestra."
                                />
                            </div>
                        </Can>
                    ) : null}

                    <ProductionRegisterForm
                        employees={employees}
                        references={references}
                        submitButtonText="Guardar registro"
                        cancelHref={route('productions.index')}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
