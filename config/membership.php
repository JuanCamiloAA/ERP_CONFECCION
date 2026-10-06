<?php

/*
 * Ciclo de vida de la membresia.
 *
 * Al vencer, la empresa entra en gracia: sigue trabajando normal los dias de abajo. Si
 * no paga en ese plazo queda suspendida y sus usuarios solo pueden entrar a «Mi empresa»
 * a pagar (ver `EnsureUserBelongsToCompany`). Pagar la reactiva sola.
 */
return [
    /** Dias de gracia despues del vencimiento, con todo funcionando. */
    'grace_days' => (int) env('MEMBERSHIP_GRACE_DAYS', 5),

    /** Dias antes del vencimiento en que se avisa por correo. */
    'reminder_days' => array_values(array_filter(array_map(
        'intval',
        explode(',', (string) env('MEMBERSHIP_REMINDER_DAYS', '7,3,1')),
    ))),

    /** Codigo del periodo con que nace una empresa si nadie elige otro. */
    'default_cycle' => 'mensual',
];
