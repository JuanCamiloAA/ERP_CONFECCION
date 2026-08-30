import { Head } from '@inertiajs/react';
import { BankForm } from '@/Components/Banks/BankForm';
import AppLayout from '@/Layouts/AppLayout';
import type { BankType } from '@/types';

interface Props {
    types: { value: BankType; label: string }[];
}

export default function BankCreate({ types }: Props) {
    return (
        <AppLayout title="Nuevo banco">
            <Head title="Nuevo banco" />
            <BankForm types={types} />
        </AppLayout>
    );
}
