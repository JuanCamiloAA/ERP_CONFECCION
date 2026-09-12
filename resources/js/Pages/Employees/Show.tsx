import PeopleProfile from '@/Pages/People/Profile';
import AppLayout from '@/Layouts/AppLayout';
import type { EmployeeProfile } from '@/types';

/**
 * Ficha de un empleado.
 *
 * Envoltorio delgado a propósito: todo el contenido vive en `People/Profile`, que es la
 * misma pantalla que sirve `/profile`. Antes esta página tenía sus propias pestañas, sus
 * propios modales de acceso y su propia forma de pintar cada dato, y la de perfil tenía
 * otras: cualquier corrección había que hacerla dos veces y en la práctica se hacía una.
 */
export default function EmployeeShow({ profile }: { profile: EmployeeProfile }) {
    return (
        <AppLayout title={profile.identity.full_name}>
            <PeopleProfile profile={profile} />
        </AppLayout>
    );
}
