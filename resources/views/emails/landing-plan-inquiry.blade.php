<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Solicitud de plan</title>
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
    <h1 style="font-size: 1.25rem;">Nueva solicitud desde la landing</h1>

    @if($plan)
        <p><strong>Plan de interés:</strong> {{ $plan->name }} (ID {{ $plan->id }})</p>
    @else
        <p><strong>Plan de interés:</strong> No indicado (consulta general)</p>
    @endif

    <h2 style="font-size: 1rem; margin-top: 1.5rem;">Empresa</h2>
    <ul>
        <li><strong>Nombre:</strong> {{ $payload['company_name'] }}</li>
        @if(!empty($payload['company_tax_id']))
            <li><strong>NIT / documento:</strong> {{ $payload['company_tax_id'] }}</li>
        @endif
        @if(!empty($payload['company_phone']))
            <li><strong>Teléfono:</strong> {{ $payload['company_phone'] }}</li>
        @endif
        @if(!empty($payload['company_email']))
            <li><strong>Correo:</strong> {{ $payload['company_email'] }}</li>
        @endif
    </ul>

    <h2 style="font-size: 1rem; margin-top: 1.5rem;">Administrador</h2>
    <ul>
        <li><strong>Nombre:</strong> {{ $payload['admin_full_name'] }}</li>
        <li><strong>Correo:</strong> {{ $payload['admin_email'] }}</li>
        @if(!empty($payload['admin_phone']))
            <li><strong>Teléfono:</strong> {{ $payload['admin_phone'] }}</li>
        @endif
    </ul>

    @if(!empty($payload['message']))
        <h2 style="font-size: 1rem; margin-top: 1.5rem;">Mensaje</h2>
        <p style="white-space: pre-wrap;">{{ $payload['message'] }}</p>
    @endif
</body>
</html>
