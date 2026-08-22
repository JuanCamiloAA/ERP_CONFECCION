import{r as W,j as e,H as X}from"./app-FjWruXPU.js";import{m as Y}from"./mediaUrl-BguGOiaJ.js";import{f as k,b as g,a}from"./utils-Bc7dnpqY.js";const Z={operations:"Pago por operación",fixed_daily:"Salario diario por jornada",hourly_legal:"Jornada legal por horas"};function b(d){var m,c;return`${((m=d.employee)==null?void 0:m.first_name)??""} ${((c=d.employee)==null?void 0:c.last_name)??""}`.trim()||"Empleado"}function z(d){return(d.deductions??[]).reduce((m,c)=>m+Number(c.amount??0),0)}function D(d){return Number(d.production_total)+Number(d.daily_work_subtotal??0)+Number(d.legal_hourly_subtotal??0)+Number(d.adjustments_subtotal??0)}function ee(d){const c=(d.advances??[]).reduce((r,x)=>r+Number(x.remaining_amount??0),0),_=Number(d.advances_discount??0);return{entregado:c,aplicado:_,saldo:Math.max(0,c-_)}}function w(d){return(d/60).toLocaleString("es-CO",{minimumFractionDigits:1,maximumFractionDigits:1})}function ne({payroll:d,mode:m="general",productionsByEmployee:c={},workSessionsByEmployee:_={}}){var A,R;W.useEffect(()=>{setTimeout(()=>window.print(),500)},[]);const r=d.payroll_employees??[],x=m==="detailed",F=r.some(s=>Number(s.daily_work_subtotal??0)>0),v=r.some(s=>Number(s.legal_hourly_subtotal??0)>0),O=r.reduce((s,n)=>s+Number(n.production_total),0),G=r.reduce((s,n)=>s+Number(n.daily_work_subtotal??0),0),U=r.reduce((s,n)=>s+Number(n.legal_hourly_subtotal??0),0),V=r.reduce((s,n)=>s+Number(n.adjustments_subtotal??0),0),E=r.reduce((s,n)=>s+D(n),0),$=r.reduce((s,n)=>s+Number(n.advances_discount),0),L=r.reduce((s,n)=>s+z(n),0),j=((A=d.company)==null?void 0:A.name)??"Empresa",q=(R=d.company)!=null&&R.logo?Y(d.company.logo):void 0,N=`${k(d.period_start)} — ${k(d.period_end)}`,T=()=>{var s,n,t;return e.jsxs("header",{className:"pd-header",children:[e.jsxs("div",{className:"pd-brand",children:[e.jsx("div",{className:"pd-logo",children:q?e.jsx("img",{src:q,alt:j}):e.jsx("span",{children:j.charAt(0)})}),e.jsxs("div",{children:[e.jsx("p",{className:"pd-company",children:j}),(s=d.company)!=null&&s.nit?e.jsxs("p",{className:"pd-meta",children:["NIT ",d.company.nit]}):null,(n=d.company)!=null&&n.address?e.jsx("p",{className:"pd-meta",children:d.company.address}):null,(t=d.company)!=null&&t.phone?e.jsxs("p",{className:"pd-meta",children:["Tel: ",d.company.phone]}):null]})]}),e.jsxs("div",{className:"pd-doc",children:[e.jsx("p",{className:"pd-kicker",children:x?"Informe detallado por empleado":"Informe general"}),e.jsx("p",{className:"pd-title",children:"Liquidación de Nómina"}),e.jsx("p",{className:"pd-accent",children:d.name}),e.jsxs("p",{className:"pd-meta",children:["Periodo ",N]})]})]})},h=(s,n)=>e.jsxs("div",{className:"pd-sec",children:[e.jsx("span",{className:"pd-sec-t",children:s}),e.jsx("span",{className:"pd-sec-line"}),n?e.jsx("span",{className:"pd-sec-m",children:n}):null]}),S=()=>{var s;return e.jsxs("footer",{className:"pd-foot",children:[e.jsxs("span",{children:[j,(s=d.company)!=null&&s.nit?` · NIT ${d.company.nit}`:""," · Liquidación de nómina"]}),e.jsxs("span",{children:["Periodo ",N]})]})};return e.jsxs(e.Fragment,{children:[e.jsx(X,{title:`Imprimir ${d.name}`}),e.jsx("style",{children:`
                @page { size: letter; margin: 12mm; }

                .pd {
                    --ink: #111827;
                    --muted: #6b7280;
                    --faint: #9ca3af;
                    --line: #e5e7eb;
                    --accent: #c2410c;
                    --link: #1d4ed8;
                    --panel: #f9fafb;
                    color: var(--ink);
                    background: #fff;
                    font-variant-numeric: tabular-nums;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .pd-page { max-width: 62rem; margin: 0 auto; padding: 2rem; }

                .pd-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 2rem; }
                .pd-brand { display: flex; align-items: flex-start; gap: 0.875rem; }
                .pd-logo {
                    width: 3rem; height: 3rem; flex: none; border-radius: 9999px;
                    background: var(--ink); color: #fff; overflow: hidden;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; font-weight: 700;
                }
                .pd-logo img { width: 100%; height: 100%; object-fit: cover; }
                .pd-company { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
                .pd-meta { font-size: 0.6875rem; color: var(--muted); margin-top: 0.1rem; }
                .pd-doc { text-align: right; }
                .pd-kicker {
                    font-size: 0.625rem; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.11em; color: var(--accent);
                }
                .pd-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.015em; margin-top: 0.15rem; }
                .pd-accent { font-size: 0.6875rem; color: var(--accent); margin-top: 0.15rem; }

                .pd-rule { border: 0; border-top: 2px solid var(--ink); margin: 0.7rem 0 0.85rem; }

                .pd-emp { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; }
                .pd-label {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.12em; color: var(--faint);
                }
                .pd-emp-name { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em; margin-top: 0.15rem; }
                .pd-emp-meta { display: flex; flex-wrap: wrap; gap: 0.875rem; margin-top: 0.25rem; font-size: 0.6875rem; }
                .pd-docnum { color: var(--link); }
                .pd-mod { color: var(--accent); }

                .pd-stats { display: flex; border: 1px solid var(--line); border-radius: 0.375rem; background: var(--panel); }
                .pd-stat { padding: 0.55rem 0.95rem; border-left: 1px solid var(--line); }
                .pd-stat:first-child { border-left: 0; }
                .pd-stat-v { font-size: 1.05rem; font-weight: 700; line-height: 1.15; margin-top: 0.1rem; }
                .pd-stat-s { font-size: 0.5625rem; color: var(--faint); margin-top: 0.05rem; }

                .pd-sec { display: flex; align-items: center; gap: 0.625rem; margin: 0.95rem 0 0.3rem; }
                .pd-sec-t {
                    font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.12em; color: var(--ink); white-space: nowrap;
                }
                .pd-sec-line { flex: 1; height: 1px; background: var(--line); }
                .pd-sec-m { font-size: 0.625rem; color: var(--faint); white-space: nowrap; }

                .pd-table { width: 100%; border-collapse: collapse; font-size: 0.6875rem; }
                .pd-table th {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
                    color: var(--faint); text-align: left; padding: 0.35rem 0.5rem;
                    border-bottom: 1px solid var(--line);
                }
                .pd-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
                .pd-table tfoot td {
                    font-weight: 700; border-top: 1px solid var(--ink); border-bottom: 0; padding-top: 0.45rem;
                }
                .pd-r { text-align: right; }
                .pd-c { text-align: center; }
                .pd-ref { color: var(--link); }
                .pd-dim { color: var(--muted); }

                .pd-liq { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 0.5rem; }
                .pd-liq-h {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
                    color: var(--faint); padding-bottom: 0.3rem; border-bottom: 1px solid var(--line);
                }
                .pd-row {
                    display: flex; justify-content: space-between; gap: 1rem;
                    font-size: 0.6875rem; padding: 0.24rem 0; border-bottom: 1px solid #f3f4f6;
                }
                .pd-row-t {
                    display: flex; justify-content: space-between; gap: 1rem;
                    font-size: 0.75rem; font-weight: 700; padding-top: 0.4rem; border-top: 1px solid var(--ink);
                }

                .pd-net {
                    display: flex; align-items: center; justify-content: space-between;
                    background: var(--ink); color: #fff; border-radius: 0.375rem;
                    padding: 0.7rem 1.1rem; margin-top: 0.85rem;
                }
                .pd-net-l { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
                .pd-net-s { font-size: 0.5625rem; color: #9ca3af; margin-top: 0.1rem; }
                .pd-net-v { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }

                .pd-note {
                    display: flex; gap: 0.5rem; margin-top: 0.7rem; padding: 0.5rem 0.75rem;
                    border-left: 3px solid var(--accent); background: #fff7ed; font-size: 0.625rem;
                }
                .pd-note b { color: var(--accent); }

                .pd-signs { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 1.9rem; }
                .pd-sign { border-top: 1px solid var(--ink); padding-top: 0.35rem; text-align: center; }
                .pd-sign-n { font-size: 0.6875rem; font-weight: 600; }
                .pd-sign-s { font-size: 0.5625rem; color: var(--faint); margin-top: 0.05rem; }

                .pd-foot {
                    display: flex; justify-content: space-between; gap: 1rem;
                    margin-top: 1rem; padding-top: 0.4rem; border-top: 1px solid var(--line);
                    font-size: 0.5625rem; color: var(--faint);
                }

                .pd-empty { font-size: 0.6875rem; color: var(--muted); padding: 0.5rem 0; }
                .pd-hint-sm { font-size: 0.5625rem; color: var(--faint); margin-top: 0.35rem; }

                .pd-actions { text-align: center; margin-top: 2rem; }
                .pd-btn {
                    border-radius: 0.375rem; background: #4f46e5; color: #fff;
                    padding: 0.5rem 1.1rem; font-size: 0.8125rem; border: 0; cursor: pointer;
                }
                .pd-hint { font-size: 0.6875rem; color: var(--muted); margin-top: 0.5rem; }

                @media print {
                    body { background: #fff; }
                    .no-print { display: none !important; }
                    .pd-page { padding: 0; max-width: none; }
                    /* Cada empleado (y el resumen final) arranca en hoja nueva. */
                    .page-break { break-before: page; page-break-before: always; margin-top: 0 !important; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-row-group; }
                    .pd-net, .pd-note, .pd-stats { break-inside: avoid; page-break-inside: avoid; }
                }
            `}),e.jsx("div",{className:"pd",children:e.jsxs("div",{className:"pd-page",children:[x?null:e.jsxs(e.Fragment,{children:[T(),e.jsx("hr",{className:"pd-rule"})]}),x?e.jsxs(e.Fragment,{children:[r.length===0?e.jsx("p",{className:"pd-empty",children:"Esta nómina no tiene empleados calculados."}):null,r.map((s,n)=>{var M,C,B;const t=c[String(s.employee_id)]??[],i=_[String(s.employee_id)]??[],o=D(s),H=z(s),u=ee(s),P=Number(s.absence_discount_total??0),y=H+u.aplicado+P,I=Number(s.legal_hourly_subtotal??0)>0,Q=Number(s.daily_work_subtotal??0)>0,J=t.reduce((l,p)=>l+Number(p.quantity??0),0),K=t.reduce((l,p)=>l+Number(p.total_value??0),0),f=i.reduce((l,p)=>l+Number(p.duration_minutes??0),0);return e.jsxs("section",{className:n>0?"page-break":"",children:[T(),e.jsx("hr",{className:"pd-rule"}),e.jsxs("div",{className:"pd-emp",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-label",children:"Empleado"}),e.jsx("p",{className:"pd-emp-name",children:b(s)}),e.jsxs("p",{className:"pd-emp-meta",children:[e.jsxs("span",{className:"pd-docnum",children:["Documento ",((M=s.employee)==null?void 0:M.document_number)??"—"]}),e.jsxs("span",{className:"pd-mod",children:["Modalidad"," ",Z[((C=s.employee)==null?void 0:C.payroll_mode)??"operations"]??"Pago por operación"]})]})]}),e.jsxs("div",{className:"pd-stats",children:[t.length>0?e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Operaciones"}),e.jsx("p",{className:"pd-stat-v",children:g(J)}),e.jsx("p",{className:"pd-stat-s",children:"unidades"})]}):null,i.length>0?e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Jornadas"}),e.jsx("p",{className:"pd-stat-v",children:i.length}),e.jsxs("p",{className:"pd-stat-s",children:[g(f)," min · ",w(f)," h"]})]}):null,e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Bruto"}),e.jsx("p",{className:"pd-stat-v",children:a(o)}),e.jsx("p",{className:"pd-stat-s",children:"devengado"})]})]})]}),t.length>0?e.jsxs(e.Fragment,{children:[h("Detalle de operaciones",`${t.length} ${t.length===1?"registro":"registros"}`),e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Fecha"}),e.jsx("th",{children:"Referencia"}),e.jsx("th",{children:"Operación"}),e.jsx("th",{className:"pd-r",children:"Cant."}),e.jsx("th",{className:"pd-r",children:"Valor"})]})}),e.jsx("tbody",{children:t.map(l=>{var p;return e.jsxs("tr",{children:[e.jsx("td",{children:k(l.date)}),e.jsx("td",{children:l.reference?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"pd-ref",children:l.reference.code})," ",l.reference.name]}):"—"}),e.jsx("td",{className:"pd-dim",children:((p=l.operation)==null?void 0:p.name)??"—"}),e.jsx("td",{className:"pd-r",children:g(l.quantity)}),e.jsx("td",{className:"pd-r",children:a(l.total_value)})]},l.id)})}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:3,className:"pd-r",children:"Total operaciones"}),e.jsx("td",{className:"pd-r",children:g(J)}),e.jsx("td",{className:"pd-r",children:a(K)})]})})]}),Number(s.production_total)===0?e.jsx("p",{className:"pd-hint-sm",children:"Registro informativo: en esta modalidad la producción no se paga por operación, por eso no suma al devengado."}):null]}):null,i.length>0?e.jsxs(e.Fragment,{children:[h("Jornadas registradas",`${i.length} ${i.length===1?"día":"días"}`),e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Fecha"}),e.jsx("th",{children:"Entrada"}),e.jsx("th",{children:"Salida"}),e.jsx("th",{className:"pd-r",children:"Minutos"}),e.jsx("th",{className:"pd-r",children:"Horas"})]})}),e.jsx("tbody",{children:i.map(l=>e.jsxs("tr",{children:[e.jsx("td",{children:k(l.work_date)}),e.jsx("td",{className:"pd-dim",children:l.clock_in_at?new Date(l.clock_in_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}),e.jsx("td",{className:"pd-dim",children:l.clock_out_at?new Date(l.clock_out_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}),e.jsx("td",{className:"pd-r",children:g(l.duration_minutes??0)}),e.jsx("td",{className:"pd-r",children:w(Number(l.duration_minutes??0))})]},l.id))}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:3,className:"pd-r",children:"Total jornada"}),e.jsx("td",{className:"pd-r",children:g(f)}),e.jsx("td",{className:"pd-r",children:w(f)})]})})]})]}):null,I&&s.legal_hours_breakdown?e.jsxs(e.Fragment,{children:[h("Recargos y horas extra (ley)"),e.jsx("table",{className:"pd-table",children:e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("td",{children:"Salario base del periodo"}),e.jsx("td",{className:"pd-r",children:a(s.legal_hours_breakdown.base_salary_earned)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Recargo nocturno"}),e.jsx("td",{className:"pd-r",children:a(s.legal_hours_breakdown.night_surcharge_amount)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Recargo dominical / festivo"}),e.jsx("td",{className:"pd-r",children:a(s.legal_hours_breakdown.sunday_holiday_surcharge_amount)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Horas extra"}),e.jsx("td",{className:"pd-r",children:a(s.legal_hours_breakdown.overtime_amount)})]})]})})]}):null,h("Liquidación del periodo"),e.jsxs("div",{className:"pd-liq",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-liq-h",children:"Devengos"}),e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Producido (pago por operación)"}),e.jsx("span",{children:a(s.production_total)})]}),Q?e.jsxs("div",{className:"pd-row",children:[e.jsxs("span",{children:["Jornada (",w(f)," h)"]}),e.jsx("span",{children:a(s.daily_work_subtotal??0)})]}):null,I?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Jornada legal, recargos y extras"}),e.jsx("span",{children:a(s.legal_hourly_subtotal??0)})]}):null,e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Ajustes manuales"}),e.jsx("span",{children:a(s.adjustments_subtotal??0)})]}),e.jsxs("div",{className:"pd-row-t",children:[e.jsx("span",{children:"Total bruto"}),e.jsx("span",{children:a(o)})]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"pd-liq-h",children:"Descuentos"}),e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Deducciones de ley"}),e.jsxs("span",{children:["− ",a(H)]})]}),u.entregado>0?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{className:"pd-dim",children:"Anticipos entregados"}),e.jsx("span",{className:"pd-dim",children:a(u.entregado)})]}):null,e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Anticipo aplicado en este periodo"}),e.jsxs("span",{children:["− ",a(u.aplicado)]})]}),P>0?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Descuento por inasistencia"}),e.jsxs("span",{children:["− ",a(P)]})]}):null,e.jsxs("div",{className:"pd-row-t",children:[e.jsx("span",{children:"Total descuentos"}),e.jsxs("span",{children:["− ",a(y)]})]})]})]}),e.jsxs("div",{className:"pd-net",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-net-l",children:"Neto a pagar"}),e.jsxs("p",{className:"pd-net-s",children:["Periodo ",N]})]}),e.jsx("p",{className:"pd-net-v",children:a(s.net_payment)})]}),u.saldo>0?e.jsxs("div",{className:"pd-note",children:[e.jsx("b",{children:"Saldo de anticipos"}),e.jsxs("span",{children:["Quedan ",a(u.saldo)," de anticipos sin cubrir; el saldo se traslada al siguiente periodo de liquidación."]})]}):null,y>o?e.jsxs("div",{className:"pd-note",children:[e.jsx("b",{children:"Descuentos mayores al devengado"}),e.jsxs("span",{children:["Los descuentos (",a(y),") superan lo devengado (",a(o),"). El neto se ajusta a ",a(0)," y la diferencia de ",a(y-o)," no alcanza a descontarse en este periodo."]})]}):null,e.jsxs("div",{className:"pd-signs",children:[e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:"Firma responsable"}),e.jsx("p",{className:"pd-sign-s",children:j})]}),e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:b(s)}),e.jsxs("p",{className:"pd-sign-s",children:["Documento ",((B=s.employee)==null?void 0:B.document_number)??"—"]})]})]}),S()]},s.id)}),r.length>0?e.jsxs("section",{className:"page-break",children:[T(),e.jsx("hr",{className:"pd-rule"}),h("Resumen general",`${r.length} ${r.length===1?"empleado":"empleados"}`),e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Empleado"}),e.jsx("th",{children:"Documento"}),e.jsx("th",{className:"pd-r",children:"Bruto"}),e.jsx("th",{className:"pd-r",children:"Deducciones"}),e.jsx("th",{className:"pd-r",children:"Anticipos"}),e.jsx("th",{className:"pd-r",children:"Neto"})]})}),e.jsx("tbody",{children:r.map(s=>{var n;return e.jsxs("tr",{children:[e.jsx("td",{children:b(s)}),e.jsx("td",{className:"pd-dim",children:((n=s.employee)==null?void 0:n.document_number)??"—"}),e.jsx("td",{className:"pd-r",children:a(D(s))}),e.jsx("td",{className:"pd-r",children:a(z(s))}),e.jsx("td",{className:"pd-r",children:a(s.advances_discount)}),e.jsx("td",{className:"pd-r",children:e.jsx("b",{children:a(s.net_payment)})})]},s.id)})}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:2,className:"pd-r",children:"Totales"}),e.jsx("td",{className:"pd-r",children:a(E)}),e.jsx("td",{className:"pd-r",children:a(L)}),e.jsx("td",{className:"pd-r",children:a($)}),e.jsx("td",{className:"pd-r",children:a(d.total_amount)})]})})]}),e.jsxs("div",{className:"pd-net",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-net-l",children:"Total nómina"}),e.jsxs("p",{className:"pd-net-s",children:[r.length," ",r.length===1?"empleado":"empleados"," · Periodo"," ",N]})]}),e.jsx("p",{className:"pd-net-v",children:a(d.total_amount)})]}),S()]}):null]}):e.jsxs(e.Fragment,{children:[h("Detalle por empleado",`${r.length} ${r.length===1?"empleado":"empleados"}`),e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Empleado"}),e.jsx("th",{children:"Documento"}),e.jsx("th",{className:"pd-r",children:"Producido"}),F?e.jsx("th",{className:"pd-r",children:"Jornada"}):null,v?e.jsx("th",{className:"pd-r",children:"Legal (horas)"}):null,e.jsx("th",{className:"pd-r",children:"Ajustes"}),e.jsx("th",{className:"pd-r",children:"Bruto"}),e.jsx("th",{className:"pd-r",children:"Deducciones"}),e.jsx("th",{className:"pd-r",children:"Anticipos"}),e.jsx("th",{className:"pd-r",children:"Neto"})]})}),e.jsx("tbody",{children:r.length===0?e.jsx("tr",{children:e.jsx("td",{colSpan:10,className:"pd-empty pd-c",children:"Esta nómina no tiene empleados calculados."})}):r.map(s=>{var n;return e.jsxs("tr",{children:[e.jsx("td",{children:b(s)}),e.jsx("td",{className:"pd-dim",children:((n=s.employee)==null?void 0:n.document_number)??"—"}),e.jsx("td",{className:"pd-r",children:a(s.production_total)}),F?e.jsx("td",{className:"pd-r",children:a(s.daily_work_subtotal??0)}):null,v?e.jsx("td",{className:"pd-r",children:a(s.legal_hourly_subtotal??0)}):null,e.jsx("td",{className:"pd-r",children:a(s.adjustments_subtotal??0)}),e.jsx("td",{className:"pd-r",children:a(D(s))}),e.jsx("td",{className:"pd-r",children:a(z(s))}),e.jsx("td",{className:"pd-r",children:a(s.advances_discount)}),e.jsx("td",{className:"pd-r",children:e.jsx("b",{children:a(s.net_payment)})})]},s.id)})}),r.length>0?e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:2,className:"pd-r",children:"Totales"}),e.jsx("td",{className:"pd-r",children:a(O)}),F?e.jsx("td",{className:"pd-r",children:a(G)}):null,v?e.jsx("td",{className:"pd-r",children:a(U)}):null,e.jsx("td",{className:"pd-r",children:a(V)}),e.jsx("td",{className:"pd-r",children:a(E)}),e.jsx("td",{className:"pd-r",children:a(L)}),e.jsx("td",{className:"pd-r",children:a($)}),e.jsx("td",{className:"pd-r",children:a(d.total_amount)})]})}):null]}),v?e.jsxs(e.Fragment,{children:[h("Desglose modalidad por horas (ley)"),e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Empleado"}),e.jsx("th",{className:"pd-r",children:"Salario base"}),e.jsx("th",{className:"pd-r",children:"Recargo nocturno"}),e.jsx("th",{className:"pd-r",children:"Recargo dom/festivo"}),e.jsx("th",{className:"pd-r",children:"Horas extra"}),e.jsx("th",{className:"pd-r",children:"Subtotal legal"})]})}),e.jsx("tbody",{children:r.filter(s=>Number(s.legal_hourly_subtotal??0)>0).map(s=>{var n,t,i,o;return e.jsxs("tr",{children:[e.jsx("td",{children:b(s)}),e.jsx("td",{className:"pd-r",children:a(((n=s.legal_hours_breakdown)==null?void 0:n.base_salary_earned)??0)}),e.jsx("td",{className:"pd-r",children:a(((t=s.legal_hours_breakdown)==null?void 0:t.night_surcharge_amount)??0)}),e.jsx("td",{className:"pd-r",children:a(((i=s.legal_hours_breakdown)==null?void 0:i.sunday_holiday_surcharge_amount)??0)}),e.jsx("td",{className:"pd-r",children:a(((o=s.legal_hours_breakdown)==null?void 0:o.overtime_amount)??0)}),e.jsx("td",{className:"pd-r",children:e.jsx("b",{children:a(s.legal_hourly_subtotal??0)})})]},s.id)})})]})]}):null,e.jsxs("div",{className:"pd-net",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-net-l",children:"Total nómina"}),e.jsxs("p",{className:"pd-net-s",children:[r.length," ",r.length===1?"empleado":"empleados"," · Periodo ",N]})]}),e.jsx("p",{className:"pd-net-v",children:a(d.total_amount)})]}),e.jsxs("div",{className:"pd-signs",children:[e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:"Firma responsable"}),e.jsx("p",{className:"pd-sign-s",children:j})]}),e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:"Firma empleado"}),e.jsx("p",{className:"pd-sign-s",children:"Recibí conforme"})]})]}),S()]}),e.jsxs("div",{className:"no-print pd-actions",children:[e.jsx("button",{onClick:()=>window.print(),className:"pd-btn",children:"Imprimir o guardar PDF"}),e.jsxs("p",{className:"pd-hint",children:["Para guardar como PDF: en el cuadro de impresión elige el destino «Guardar como PDF»",x?" · cada empleado sale en una hoja distinta.":"."]})]})]})})]})}export{ne as default};
