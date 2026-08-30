import { Head } from '@inertiajs/react';
import { BankForm, type BankFormBank } from '@/Components/Banks/BankForm';
import AppLayout from '@/Layouts/AppLayout';
import type { BankType } from '@/types';

interface Props {
    bank: BankFormBank;
    types: { value: BankType; label: string }[];
}

export default function BankEdit({ bank, types }: Props) {
    return (
        <AppLayout title={`Editar ${bank.name}`}>
            <Head title={`Editar ${bank.name}`} />
            <BankForm types={types} bank={bank} />
        </AppLayout>
    );
}
