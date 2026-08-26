# Comprobante de anticipo (impresión) — especificación de implementación

Aplica al proyecto `ERP_CONFECCION`. Añade la impresión del comprobante al módulo **Anticipos**, sin tocar el rediseño ya especificado en `rediseno-anticipos.md`.

Referencia de diseño: `Comprobante de anticipo.dc.html` — hoja carta con **dos copias** (original empresa / copia empleado) separadas por línea de corte.

---

## 1. Archivos

### Nuevos
| Archivo | Qué es |
| --- | --- |
| `resources/js/Pages/Advances/Receipt.tsx` | La hoja imprimible. Mismo patrón que `Pages/Payrolls/Print.tsx`: estilos de impresión en un `<style>` local y `window.print()` al montar |
| `resources/js/lib/numberToWords.ts` | `amountToWords(n: number): string` — el valor en letras |

### Modificados
- `app/Http/Controllers/AdvanceController.php` → método `receipt`
- `routes/web.php` → ruta `advances.receipt`
- `Pages/Advances/Show.tsx` y `Components/Advances/AdvanceRow.tsx` → el botón «Comprobante» (que ya existe) abre la ruta en pestaña nueva

### No se toca
`module-ui.css` — el comprobante es papel blanco, no comparte la piel `emp-*` del módulo.

---

## 2. Ruta y controlador

| Verbo | URI | Nombre | Permiso |
| --- | --- | --- | --- |
| GET | `/advances/{advance}/receipt` | `advances.receipt` | `advances.index.view` |

```php
public function receipt(Advance $advance): Response
{
    $advance->load('employee:id,first_name,last_name,document_number,position,area,hired_at', 'creator:id,name');

    // Saldo del empleado ANTES de este anticipo: lo pendiente de anticipos anteriores.
    $previousBalance = (float) Advance::where('employee_id', $advance->employee_id)
        ->where('remaining_amount', '>', 0)
        ->where(fn ($q) => $q->where('date', '<', $advance->date)
            ->orWhere(fn ($q2) => $q2->where('date', $advance->date)->where('id', '<', $advance->id)))
        ->sum('remaining_amount');

    return Inertia::render('Advances/Receipt', [
        'advance' => $advance,
        'company' => TenantContext::currentCompany($request->user()),   // name, nit, address, phone, logo
        'previous_balance' => $previousBalance,
        'period' => /* inicio/fin del periodo en que cae $advance->date + fecha estimada de pago */,
        'issued_by' => $advance->creator?->name,
    ]);
}
```
`period` sale del mismo servicio de periodos que usa Nómina — no recalcularlo aquí.

---

## 3. La hoja — `Pages/Advances/Receipt.tsx`

### Comportamiento
```tsx
useEffect(() => { setTimeout(() => window.print(), 500); }, []);
```
Igual que el comprobante de nómina: el PDF lo produce el navegador desde esta pantalla. No se instala ninguna librería de PDF.

### Geometría (exacta — es lo que hace que quepa)
```css
@page { size: letter; margin: 0; }
.rc-sheet {
    box-sizing: border-box;
    width: 216mm;
    min-height: 279mm;
    padding: 10mm 13mm;          /* 10mm vertical: con 12mm la segunda copia se recorta */
    background: #fff;
    color: #1b1b1f;
    font-family: 'Inter', system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
}
```
- **Nunca** poner altura fija a cada copia: cada copia se dimensiona por su contenido. Con altura fija y `display:flex` la franja de saldos (que lleva `overflow:hidden` por el radio) se aplasta a 2px y desaparece.
- Presupuesto real: cada copia mide ~123mm; dos copias + la banda de corte (~8mm) + 20mm de padding entran en los 279mm de la carta con ~4mm de holgura. Cualquier bloque nuevo obliga a recortar en otro sitio.
- En pantalla, fondo de escritorio gris y la hoja centrada con sombra suave; en `@media print`, fondo blanco y sin sombra.

### Estructura de cada copia (dos veces, misma marcación)
1. **Cabecera**: caja de logo 12mm (inicial de la empresa si no hay logo, vía `mediaUrl`) + nombre 11pt/600 y una línea 7.5pt con `NIT · dirección · teléfono`. A la derecha, kicker 7pt uppercase «Comprobante de anticipo», «N.º {id con 4 dígitos}» 13pt/600 y la etiqueta de la copia en violeta 7.5pt: **«Original — empresa»** / **«Copia — empleado»**.
2. **Regla de acento** de 1.2pt en `#6f61c4` (el acento de marca ajustado para papel blanco).
3. **Valor**: label 7pt uppercase «Valor entregado», monto **19pt/600**, y debajo el **valor en letras** 8pt. A la derecha, «Fecha de entrega» 11pt/500 y «Efectivo · caja del taller».
4. **Datos** (grid `1.4fr 1fr 1fr`, separado por una línea 1px): Empleado (nombre 10pt + `C.C. documento`), Área / cargo (+ fecha de ingreso), Motivo (+ «Solicitado por el empleado»).
5. **Franja de saldos** (caja con radio 2mm y tres celdas separadas por 1px): `Saldo anterior` | `Este anticipo` | `Total a descontar` — la tercera con fondo `#f4f2fb`, texto `#3f3583` y la fecha de la nómina debajo. Es el bloque que hace que el empleado firme sabiendo el total que se le va a descontar, no solo lo que recibe.
6. **Cláusula de autorización**, 7.8pt justificada, tres líneas:
   > Declaro haber recibido de **{empresa}** la suma aquí indicada como anticipo de mi salario, y autorizo por escrito que se descuente de mi liquidación del periodo **{periodo}**; si el neto no alcanza a cubrirla, el saldo se descuenta en los periodos siguientes. Art. 149 del Código Sustantivo del Trabajo.

   La referencia al art. 149 del CST es lo que da valor a la firma: sin autorización escrita el descuento no procede.
7. **Firmas**: dos líneas sólidas al 50% — «Recibí conforme — {empleado}» con su C.C., y «Entregado por — {usuario}» con «Firma y sello de la empresa». A la derecha, casilla de **huella** de 17mm de ancho × 14mm de alto con su rótulo.
8. **Pie de trazabilidad** 6.8pt sobre una línea 1px: «Anticipo #{n} · registrado el {fecha} por {usuario} · saldo tras la entrega {total} · {etiqueta de la copia}. Documento interno de control de nómina; no constituye factura ni soporte tributario.»

### Línea de corte
Entre las dos copias: `padding: 4mm 0`, dos reglas `1px dashed #b8b8c0` con el rótulo «Corte aquí» 6.5pt uppercase centrado.

### Copias
Renderizar con un `map` sobre `[{ label: 'Original — empresa' }, { label: 'Copia — empleado' }]` — nunca marcación duplicada a mano. Aceptar `?copies=1` en la query para una sola copia (el `map` queda con un elemento).

---

## 4. Valor en letras — `lib/numberToWords.ts`

```ts
amountToWords(250000)   // 'DOSCIENTOS CINCUENTA MIL PESOS M/CTE.'
amountToWords(1000000)  // 'UN MILLÓN PESOS M/CTE.'
amountToWords(0)        // 'CERO PESOS M/CTE.'
```
Reglas del español para montos: `CIEN` exacto vs `CIENTO` con resto; `VEINTIUNO…VEINTINUEVE` en una palabra; `Y` solo entre decena y unidad (`CUARENTA Y DOS`); `UN MILLÓN` / `N MILLONES`; `MIL` sin `UN` delante. Se redondea a pesos: el módulo no maneja centavos en anticipos. Cubrir con test unitario los casos 100, 101, 21, 1.000.000, 1.001.000 y el monto máximo esperado.

---

## 5. Enganche en la UI

En `Pages/Advances/Show.tsx` y en el menú de `Components/Advances/AdvanceRow.tsx`, el botón «Comprobante» (icono `Printer`) abre:
```tsx
window.open(route('advances.receipt', advance.id), '_blank');
```
Va dentro de `Can permission="advances.index.view"`. No cambia el estilo de esos botones: siguen siendo `emp-btn emp-btn-sm` delineados.

---

## 6. Aceptación

- [ ] Las **dos copias caben completas** en una hoja carta: la firma y el pie de la copia del empleado no se recortan (verificar en la vista previa de impresión, no solo en pantalla).
- [ ] La franja de saldos se ve en ambas copias (si desaparece, alguien volvió a poner altura fija a la copia).
- [ ] El valor en letras coincide con el monto y termina en «PESOS M/CTE.».
- [ ] `Saldo anterior + Este anticipo = Total a descontar`, y el saldo anterior excluye este mismo anticipo.
- [ ] La cláusula nombra la empresa, el periodo y el art. 149 del CST.
- [ ] Aparecen las dos etiquetas: «Original — empresa» y «Copia — empleado».
- [ ] Sin logo, la caja de marca muestra la inicial de la empresa.
- [ ] El navegador no imprime su propio encabezado de fecha/URL (`@page { margin: 0 }` + el padding en la hoja).
- [ ] Al abrir la ruta se dispara el diálogo de impresión solo.
- [ ] Impreso en blanco y negro sigue legible: la franja de total y la regla de acento no dependen del color para entenderse.
