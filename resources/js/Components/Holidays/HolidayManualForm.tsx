import { useForm } from '@inertiajs/react';
import { Plus } from '@phosphor-icons/react';
import type { FormEvent } from 'react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmpInput } from '@/Components/UI/ModuleFields';
import { formatDate } from '@/lib/utils';

/**
 * Alta manual de un festivo.
 *
 * Vive en el panel, no en una tarjeta a todo el ancho: es una accion puntual (una ley que
 * agrega un dia suelto), no el trabajo principal de la pantalla.
 */
export function HolidayManualForm({ year }: { year: number }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        date: '',
        name: '',
    });

    const ready = Boolean(data.date) && data.name.trim().length > 0;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!ready) {
            return;
        }

        post(route('holidays.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <EmployeeAsideCard title="Agregar festivo manual" subtitle="Para días que el algoritmo no cubre">
            <form onSubmit={submit} className="mt-2 flex flex-col gap-2.5">
                <EmpInput
                    label="Fecha"
                    type="date"
                    value={data.date}
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                    onChange={(e) => setData('date', e.target.value)}
                    error={errors.date}
                />

                <EmpInput
                    label="Nombre"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Ej. Virgen de Chiquinquirá"
                    error={errors.name}
                />

                <button type="submit" disabled={!ready || processing} className="emp-btn w-full">
                    <Plus size={15} />
                    {processing ? 'Agregando…' : 'Agregar'}
                </button>

                <p className="emp-help">
                    {ready
                        ? `Se agrega el ${formatDate(data.date)} y queda marcado como manual: la sincronización no lo borra.`
                        : 'Escribe la fecha y el nombre para habilitar el botón.'}
                </p>
            </form>
        </EmployeeAsideCard>
    );
}

export default HolidayManualForm;
