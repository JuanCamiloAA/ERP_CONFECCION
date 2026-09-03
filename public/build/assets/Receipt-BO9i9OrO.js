import{r as O,j as e,H as Z}from"./app-DAiwkGB-.js";import{m as ee}from"./mediaUrl-BguGOiaJ.js";import{e as ae,s as se,r as ne,d as de,h as N,j as U}from"./payrolls-7aC0YK2x.js";import{f as v,a as n,b as o}from"./utils-Bcr6Dmne.js";const V={operations:"Pago por operación",fixed_daily:"Salario diario por jornada",hourly_legal:"Jornada legal por horas"};function re(r){const[s,i,l]=String(r).slice(0,10).split("-").map(Number);return new Date(Date.UTC(s,(i??1)-1,l??1)).getUTCDay()===0}function pe({payroll:r,payrollEmployee:s,workSessions:i,productions:l}){var E,F,L,S,P,M,R,A,J,H,B,I;const[G,z]=O.useState(!1);O.useEffect(()=>{const a=setTimeout(()=>window.print(),500);return()=>clearTimeout(a)},[]);const p=((E=r.company)==null?void 0:E.name)??"Empresa",D=(F=r.company)!=null&&F.logo?ee(r.company.logo):void 0,x=`${v(r.period_start)} — ${v(r.period_end)}`,g=ae(s),j=((L=s.employee)==null?void 0:L.payroll_mode)??"operations",t=s.legal_hours_breakdown??null,T=Number(s.legal_hourly_subtotal??0)>0&&t!==null,Q=Number(s.daily_work_subtotal??0)>0,m=se(i),h=ne(s),q=de(s),y=Number(s.absence_discount_total??0),_=(s.advances??[]).reduce((a,d)=>a+Number(d.remaining_amount??0),0),k=Number(s.advances_discount??0),C=Math.max(0,_-k),f=q+k+y,$=l.reduce((a,d)=>a+Number(d.quantity??0),0),K=l.reduce((a,d)=>a+Number(d.total_value??0),0),W=a=>{var b;const d=(b=t==null?void 0:t.daily_detail)==null?void 0:b.find(w=>w.session_id===a.id);if(d)return Number(d.day_amount??0);const c=(s.validated_work_days??[]).find(w=>w.session_id===a.id);return c?Number(c.day_earnings??0):null},X=a=>{var c;const d=(c=t==null?void 0:t.daily_detail)==null?void 0:c.find(b=>b.session_id===a.id);return d?!!d.is_sunday_holiday:re(a.work_date)},Y=async()=>{const a=window.location.href;if(typeof navigator<"u"&&navigator.share){try{z(!0),await navigator.share({title:`Comprobante ${g}`,text:`${r.name} · ${x}`,url:a})}catch{}finally{z(!1)}return}window.print()},u=(a,d)=>e.jsxs("div",{className:"pd-sec",children:[e.jsx("span",{className:"pd-sec-t",children:a}),e.jsx("span",{className:"pd-sec-line"}),d?e.jsx("span",{className:"pd-sec-m",children:d}):null]});return e.jsxs(e.Fragment,{children:[e.jsx(Z,{title:`Comprobante ${g}`}),e.jsx("style",{children:`
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
                .pd-hi { color: var(--accent); }

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

                .pd-bar {
                    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
                    max-width: 62rem; margin: 0 auto; padding: 0.75rem 2rem;
                    border-bottom: 1px solid var(--line);
                }
                .pd-btn {
                    border-radius: 0.375rem; border: 1px solid var(--ink); background: #fff; color: var(--ink);
                    padding: 0.5rem 1.1rem; font-size: 0.8125rem; cursor: pointer;
                }
                .pd-btn-solid { background: var(--ink); color: #fff; }
                .pd-actions { display: flex; gap: 0.5rem; }

                @media (max-width: 640px) {
                    .pd-page { padding: 1rem; }
                    .pd-header, .pd-emp { flex-direction: column; gap: 0.75rem; }
                    .pd-doc { text-align: left; }
                    .pd-liq { grid-template-columns: 1fr; gap: 0.75rem; }
                    .pd-bar { padding: 0.75rem 1rem; }
                    .pd-btn { min-height: 48px; flex: 1; }
                }

                @media print {
                    body { background: #fff; }
                    .no-print { display: none !important; }
                    .pd-page { padding: 0; max-width: none; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-row-group; }
                    .pd-net, .pd-note, .pd-stats, .pd-signs { break-inside: avoid; page-break-inside: avoid; }
                }
            `}),e.jsxs("div",{className:"pd",children:[e.jsxs("div",{className:"pd-bar no-print",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-label",children:"Neto a pagar"}),e.jsx("p",{className:"pd-stat-v",children:n(s.net_payment)})]}),e.jsxs("div",{className:"pd-actions",children:[e.jsx("button",{type:"button",className:"pd-btn",onClick:()=>Y(),disabled:G,children:"Compartir PDF"}),e.jsx("button",{type:"button",className:"pd-btn pd-btn-solid",onClick:()=>window.print(),children:"Imprimir"})]})]}),e.jsxs("div",{className:"pd-page",children:[e.jsxs("header",{className:"pd-header",children:[e.jsxs("div",{className:"pd-brand",children:[e.jsx("div",{className:"pd-logo",children:D?e.jsx("img",{src:D,alt:p}):e.jsx("span",{children:p.charAt(0)})}),e.jsxs("div",{children:[e.jsx("p",{className:"pd-company",children:p}),(S=r.company)!=null&&S.nit?e.jsxs("p",{className:"pd-meta",children:["NIT ",r.company.nit]}):null,(P=r.company)!=null&&P.address?e.jsx("p",{className:"pd-meta",children:r.company.address}):null,(M=r.company)!=null&&M.phone?e.jsxs("p",{className:"pd-meta",children:["Tel: ",r.company.phone]}):null]})]}),e.jsxs("div",{className:"pd-doc",children:[e.jsx("p",{className:"pd-kicker",children:"Comprobante de pago"}),e.jsx("p",{className:"pd-title",children:"Liquidación de Nómina"}),e.jsx("p",{className:"pd-accent",children:r.name}),e.jsxs("p",{className:"pd-meta",children:["Periodo ",x]})]})]}),e.jsx("hr",{className:"pd-rule"}),e.jsxs("div",{className:"pd-emp",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-label",children:"Empleado"}),e.jsx("p",{className:"pd-emp-name",children:g}),e.jsxs("p",{className:"pd-emp-meta",children:[e.jsxs("span",{className:"pd-docnum",children:[((R=s.employee)==null?void 0:R.document_type)??"Documento"," ",((A=s.employee)==null?void 0:A.document_number)??"—"]}),e.jsxs("span",{className:"pd-mod",children:["Modalidad ",V[j]??V.operations]}),(H=(J=s.employee)==null?void 0:J.bank)!=null&&H.name?e.jsxs("span",{className:"pd-dim",children:[s.employee.bank.name,s.employee.bank_account_number?` · ${s.employee.bank_account_number}`:""]}):null]})]}),e.jsxs("div",{className:"pd-stats",children:[j==="operations"&&l.length>0?e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Operaciones"}),e.jsx("p",{className:"pd-stat-v",children:o($)}),e.jsx("p",{className:"pd-stat-s",children:"unidades"})]}):null,i.length>0?e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Jornadas"}),e.jsx("p",{className:"pd-stat-v",children:i.length}),e.jsxs("p",{className:"pd-stat-s",children:[o(m)," min · ",N(m)," h"]})]}):null,e.jsxs("div",{className:"pd-stat",children:[e.jsx("p",{className:"pd-label",children:"Bruto"}),e.jsx("p",{className:"pd-stat-v",children:n(h)}),e.jsx("p",{className:"pd-stat-s",children:"devengado"})]})]})]}),j==="operations"?e.jsxs(e.Fragment,{children:[u("Detalle de operaciones",`${l.length} ${l.length===1?"registro":"registros"}`),l.length===0?e.jsx("p",{className:"pd-empty",children:"Sin producción liquidable en el periodo."}):e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Fecha"}),e.jsx("th",{children:"Referencia"}),e.jsx("th",{children:"Operación"}),e.jsx("th",{className:"pd-r",children:"Cant."}),e.jsx("th",{className:"pd-r",children:"Valor"})]})}),e.jsx("tbody",{children:l.map(a=>{var d;return e.jsxs("tr",{children:[e.jsx("td",{children:v(a.date)}),e.jsx("td",{children:a.reference?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"pd-ref",children:a.reference.code})," ",a.reference.name]}):"—"}),e.jsx("td",{className:"pd-dim",children:((d=a.operation)==null?void 0:d.name)??"—"}),e.jsx("td",{className:"pd-r",children:o(a.quantity)}),e.jsx("td",{className:"pd-r",children:n(a.total_value)})]},a.id)})}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:3,className:"pd-r",children:"Total operaciones"}),e.jsx("td",{className:"pd-r",children:o($)}),e.jsx("td",{className:"pd-r",children:n(K)})]})})]})]}):e.jsxs(e.Fragment,{children:[u("Jornadas registradas",`${i.length} ${i.length===1?"día":"días"}`),i.length===0?e.jsx("p",{className:"pd-empty",children:"Sin jornadas registradas en el periodo."}):e.jsxs("table",{className:"pd-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Fecha"}),e.jsx("th",{children:"Entrada"}),e.jsx("th",{children:"Salida"}),e.jsx("th",{className:"pd-r",children:"Minutos"}),e.jsx("th",{className:"pd-r",children:"Horas"}),e.jsx("th",{className:"pd-r",children:"Valor del día"})]})}),e.jsx("tbody",{children:i.map(a=>{const d=X(a),c=W(a);return e.jsxs("tr",{children:[e.jsxs("td",{className:d?"pd-hi":void 0,children:[v(a.work_date),d?" · dom/festivo":""]}),e.jsx("td",{className:"pd-dim",children:U(a.clock_in_at)}),e.jsx("td",{className:"pd-dim",children:U(a.clock_out_at)}),e.jsx("td",{className:"pd-r",children:o(a.duration_minutes??0)}),e.jsx("td",{className:"pd-r",children:N(Number(a.duration_minutes??0))}),e.jsx("td",{className:"pd-r",children:c===null?"—":n(c)})]},a.id)})}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:3,className:"pd-r",children:"Total jornada"}),e.jsx("td",{className:"pd-r",children:o(m)}),e.jsx("td",{className:"pd-r",children:N(m)}),e.jsx("td",{className:"pd-r",children:n(Number(s.legal_hourly_subtotal??0)||Number(s.daily_work_subtotal??0))})]})})]})]}),T&&t?e.jsxs(e.Fragment,{children:[u("Recargos y horas extra (ley)"),e.jsx("table",{className:"pd-table",children:e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("td",{children:"Salario base del periodo"}),e.jsx("td",{className:"pd-r",children:n(t.base_salary_earned)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Recargo nocturno"}),e.jsx("td",{className:"pd-r",children:n(t.night_surcharge_amount)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Recargo dominical / festivo"}),e.jsx("td",{className:"pd-r",children:n(t.sunday_holiday_surcharge_amount)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Horas extra"}),e.jsx("td",{className:"pd-r",children:n(t.overtime_amount)})]})]})})]}):null,u("Liquidación del periodo"),e.jsxs("div",{className:"pd-liq",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-liq-h",children:"Devengos"}),j==="operations"?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Producido (pago por operación)"}),e.jsx("span",{children:n(s.production_total)})]}):null,Q?e.jsxs("div",{className:"pd-row",children:[e.jsxs("span",{children:["Jornada (",N(m)," h)"]}),e.jsx("span",{children:n(s.daily_work_subtotal??0)})]}):null,T?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Jornada legal, recargos y extras"}),e.jsx("span",{children:n(s.legal_hourly_subtotal??0)})]}):null,e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Conceptos manuales"}),e.jsx("span",{children:n(s.adjustments_subtotal??0)})]}),e.jsxs("div",{className:"pd-row-t",children:[e.jsx("span",{children:"Total bruto"}),e.jsx("span",{children:n(h)})]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"pd-liq-h",children:"Descuentos"}),e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Deducciones de ley"}),e.jsxs("span",{children:["− ",n(q)]})]}),_>0?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{className:"pd-dim",children:"Anticipos entregados"}),e.jsx("span",{className:"pd-dim",children:n(_)})]}):null,e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Anticipo aplicado en este periodo"}),e.jsxs("span",{children:["− ",n(k)]})]}),y>0?e.jsxs("div",{className:"pd-row",children:[e.jsx("span",{children:"Descuento por inasistencia"}),e.jsxs("span",{children:["− ",n(y)]})]}):null,e.jsxs("div",{className:"pd-row-t",children:[e.jsx("span",{children:"Total descuentos"}),e.jsxs("span",{children:["− ",n(f)]})]})]})]}),e.jsxs("div",{className:"pd-net",children:[e.jsxs("div",{children:[e.jsx("p",{className:"pd-net-l",children:"Neto a pagar"}),e.jsxs("p",{className:"pd-net-s",children:["Periodo ",x]})]}),e.jsx("p",{className:"pd-net-v",children:n(s.net_payment)})]}),C>0?e.jsxs("div",{className:"pd-note",children:[e.jsx("b",{children:"Saldo de anticipos"}),e.jsxs("span",{children:["Quedan ",n(C)," de anticipos sin cubrir; el saldo se traslada al siguiente periodo de liquidación."]})]}):null,f>h?e.jsxs("div",{className:"pd-note",children:[e.jsx("b",{children:"Descuentos mayores al devengado"}),e.jsxs("span",{children:["Los descuentos (",n(f),") superan lo devengado (",n(h),"). El neto se ajusta a ",n(0)," y la diferencia de"," ",n(f-h)," no alcanza a descontarse en este periodo."]})]}):null,e.jsxs("div",{className:"pd-signs",children:[e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:"Firma responsable"}),e.jsx("p",{className:"pd-sign-s",children:p})]}),e.jsxs("div",{className:"pd-sign",children:[e.jsx("p",{className:"pd-sign-n",children:g}),e.jsxs("p",{className:"pd-sign-s",children:["Documento ",((B=s.employee)==null?void 0:B.document_number)??"—"]})]})]}),e.jsxs("footer",{className:"pd-foot",children:[e.jsxs("span",{children:[p,(I=r.company)!=null&&I.nit?` · NIT ${r.company.nit}`:""," · Comprobante de nómina"]}),e.jsxs("span",{children:["Periodo ",x]})]})]})]})]})}export{pe as default};
