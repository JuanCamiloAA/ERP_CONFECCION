import {
    EmployeeAsideCard,
    EmployeeFormLayout,
    EmployeeFormNav,
    type EmployeeSectionRef,
} from '@/Components/Employees/EmployeeFormLayout';

/**
 * Armazon de los formularios de operacion.
 *
 * No reimplementa nada: reexporta el de empleados. El armazon —indice a la izquierda,
 * formulario en el centro, panel pegajoso a la derecha y una sola columna en movil— no
 * tiene nada de «empleado»; duplicarlo aqui solo garantizaria que las dos copias se
 * separen a la primera correccion. El prefijo `Employee` de los nombres es historico.
 */
export const OPERATION_SECTIONS: EmployeeSectionRef[] = [
    { id: 'identidad', label: 'Identidad' },
    { id: 'precio', label: 'Precio y tiempo' },
    { id: 'estado', label: 'Disponibilidad' },
];

export {
    EmployeeAsideCard as OperationAsideCard,
    EmployeeFormLayout as OperationFormLayout,
    EmployeeFormNav as OperationFormNav,
};
