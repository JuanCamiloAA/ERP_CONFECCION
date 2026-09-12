import { Head } from '@inertiajs/react';
import { AccountScreen } from '@/Components/Account/AccountScreen';
import AppLayout from '@/Layouts/AppLayout';
import PeopleProfile from '@/Pages/People/Profile';
import type { AccountPayloadData, EmployeeProfile } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    /** Cuenta de acceso. La tiene todo el mundo. */
    account: AccountPayloadData;
    /**
     * Ficha de empleado en modo `self`. null cuando la cuenta no está vinculada —un
     * administrador de la cuenta, el super admin—, y entonces la pantalla es solo la de
     * la cuenta: sin producción, sin nómina y sin anticipos.
     */
    profile: EmployeeProfile | null;
}

/**
 * «Mi perfil».
 *
 * Envoltorio delgado: no dibuja cabecera de aplicación, marca ni navegación —eso lo pone
 * `AppLayout`— y no duplica nada. Solo decide qué capas se apilan:
 *
 *  - Con ficha: la ficha 360 en modo `self` (identidad, producción, nómina, solicitudes) y
 *    debajo el bloque de la cuenta, sin repetir la identidad que la ficha ya edita.
 *  - Sin ficha: solo la cuenta, con su propio encabezado y su bloque de identidad.
 */
export default function ProfileEdit({ account, profile }: Props) {
    return (
        <AppLayout title="Mi perfil">
            <Head title="Mi perfil" />

            {profile ? (
                <>
                    <PeopleProfile profile={profile} />
                    <div className="emp-form emp-bleed px-4 pb-16 sm:px-[34px]">
                        <AccountScreen account={account} identityHandledElsewhere />
                    </div>
                </>
            ) : (
                <div className="emp-form emp-bleed min-h-screen px-4 pb-16 pt-5 sm:px-[34px]">
                    <AccountScreen account={account} />
                </div>
            )}
        </AppLayout>
    );
}
