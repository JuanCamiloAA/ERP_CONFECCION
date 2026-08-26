import{r as v,j as e,H as w}from"./app-CQ9teLQE.js";import{m as k}from"./mediaUrl-BguGOiaJ.js";import{b as i,a as r}from"./utils-Bh8LSCk8.js";function h(n){return n==null?"—":`${(n*100).toLocaleString("es-CO",{maximumFractionDigits:1})}%`}function E({company:n,currency:s,generated_at:j,totals:l,references:p}){var b;v.useEffect(()=>{let a=!1;const t=()=>{a||(a=!0,window.print())},c=Array.from(document.images).filter(d=>!d.complete),_=window.setTimeout(t,6e3);if(c.length===0){const d=window.setTimeout(t,400);return()=>{window.clearTimeout(d),window.clearTimeout(_)}}let f=c.length;const m=()=>{f-=1,f<=0&&window.setTimeout(t,250)};return c.forEach(d=>{d.addEventListener("load",m),d.addEventListener("error",m)}),()=>{window.clearTimeout(_),c.forEach(d=>{d.removeEventListener("load",m),d.removeEventListener("error",m)})}},[]);const g=n.logo?k(n.logo):void 0,x=p.length>1,u=(a,t)=>e.jsxs("header",{className:"rp-header",children:[e.jsxs("div",{className:"rp-brand",children:[e.jsx("div",{className:"rp-logo",children:g?e.jsx("img",{src:g,alt:n.name}):e.jsx("span",{children:n.name.charAt(0)})}),e.jsxs("div",{children:[e.jsx("p",{className:"rp-company",children:n.name}),n.nit?e.jsxs("p",{className:"rp-meta",children:["NIT ",n.nit]}):null,n.address?e.jsx("p",{className:"rp-meta",children:n.address}):null,n.phone?e.jsxs("p",{className:"rp-meta",children:["Tel: ",n.phone]}):null]})]}),e.jsxs("div",{className:"rp-doc",children:[e.jsx("p",{className:"rp-kicker",children:"Catálogo de referencias"}),e.jsx("p",{className:"rp-title",children:a}),e.jsx("p",{className:"rp-accent",children:t}),e.jsxs("p",{className:"rp-meta",children:["Generado el ",j]})]})]}),N=e.jsxs("footer",{className:"rp-foot",children:[e.jsxs("span",{children:[n.name,n.nit?` · NIT ${n.nit}`:""," · Ficha técnica de referencia"]}),e.jsxs("span",{children:["Valores en ",s," · ",j]})]}),o=(a,t,c)=>e.jsxs("div",{className:"rp-box",children:[e.jsx("p",{className:"rp-box-k",children:a}),e.jsx("p",{className:"rp-box-v",children:t}),c?e.jsx("p",{className:"rp-box-h",children:c}):null]});return e.jsxs(e.Fragment,{children:[e.jsx(w,{title:x?`Imprimir ${p.length} referencias`:`Imprimir ${((b=p[0])==null?void 0:b.code)??"referencia"}`}),e.jsx("style",{children:`
                @page { size: letter; margin: 12mm; }

                .rp {
                    --ink: #111827;
                    --muted: #6b7280;
                    --faint: #9ca3af;
                    --line: #e5e7eb;
                    --accent: #4338ca;
                    --panel: #f9fafb;
                    color: var(--ink);
                    background: #fff;
                    font-variant-numeric: tabular-nums;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .rp-page { max-width: 62rem; margin: 0 auto; padding: 2rem; }
                .rp-sheet + .rp-sheet { margin-top: 3rem; padding-top: 2rem; border-top: 2px dashed var(--line); }

                .rp-header { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start;
                    padding-bottom: 0.9rem; border-bottom: 2px solid var(--ink); }
                .rp-brand { display: flex; gap: 0.75rem; align-items: flex-start; }
                .rp-logo { width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
                    display: flex; align-items: center; justify-content: center; background: var(--panel);
                    font-size: 18px; font-weight: 700; color: var(--muted); flex: none; }
                .rp-logo img { width: 100%; height: 100%; object-fit: contain; }
                .rp-company { font-size: 14px; font-weight: 700; }
                .rp-meta { font-size: 10px; color: var(--muted); }
                .rp-doc { text-align: right; }
                .rp-kicker { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
                .rp-title { font-size: 17px; font-weight: 700; }
                .rp-accent { font-size: 12px; font-weight: 600; color: var(--accent); }

                .rp-sec { display: flex; align-items: center; gap: 0.6rem; margin: 1.3rem 0 0.6rem; }
                .rp-sec-t { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
                .rp-sec-line { flex: 1; height: 1px; background: var(--line); }
                .rp-sec-m { font-size: 10px; color: var(--faint); }

                .rp-id { display: flex; gap: 1.25rem; align-items: flex-start; }
                .rp-photo { width: 190px; height: 190px; flex: none; border: 1px solid var(--line); border-radius: 10px;
                    overflow: hidden; background: var(--panel); display: flex; align-items: center; justify-content: center; }
                .rp-photo img { width: 100%; height: 100%; object-fit: cover; }
                .rp-photo span { font-size: 10px; color: var(--faint); text-align: center; padding: 0 0.5rem; }
                .rp-id-data { flex: 1; min-width: 0; }
                .rp-ref-code { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
                .rp-ref-name { font-size: 13px; color: var(--muted); }
                .rp-chip { display: inline-block; margin-left: 0.5rem; padding: 0.1rem 0.5rem; border-radius: 999px;
                    border: 1px solid var(--line); font-size: 10px; font-weight: 600; vertical-align: middle; }
                .rp-chip-on { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
                .rp-chip-off { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
                .rp-desc { margin-top: 0.6rem; font-size: 11px; white-space: pre-line; }
                .rp-dates { margin-top: 0.6rem; font-size: 10px; color: var(--muted); }

                .rp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
                .rp-grid-3 { grid-template-columns: repeat(3, 1fr); }
                .rp-box { border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem 0.6rem; background: #fff; }
                .rp-box-k { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
                .rp-box-v { font-size: 14px; font-weight: 700; margin-top: 0.1rem; }
                .rp-box-h { font-size: 9px; color: var(--muted); margin-top: 0.1rem; }
                .rp-box-strong { background: #eef2ff; border-color: #c7d2fe; }

                .rp-note { margin-top: 0.5rem; font-size: 10px; color: var(--muted); line-height: 1.5; }

                table.rp-t { width: 100%; border-collapse: collapse; font-size: 10.5px; }
                table.rp-t th { background: #312e81; color: #fff; font-weight: 600; text-align: left;
                    padding: 0.35rem 0.45rem; border: 1px solid #312e81; }
                table.rp-t td { padding: 0.32rem 0.45rem; border: 1px solid var(--line); }
                table.rp-t tbody tr:nth-child(even) td { background: #fafafa; }
                table.rp-t .n { text-align: right; }
                table.rp-t .c { text-align: center; }
                table.rp-t tfoot td { background: #eef2ff; font-weight: 700; border-color: #c7d2fe; }
                .rp-off { color: var(--muted); }

                .rp-foot { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem;
                    padding-top: 0.5rem; border-top: 1px solid var(--line); font-size: 9px; color: var(--faint); }

                .rp-actions { margin-top: 2rem; text-align: center; }
                .rp-btn { background: var(--accent); color: #fff; border: 0; border-radius: 8px;
                    padding: 0.6rem 1.4rem; font-size: 13px; font-weight: 600; cursor: pointer; }
                .rp-hint { margin-top: 0.5rem; font-size: 11px; color: var(--muted); }

                @media print {
                    .rp-page { padding: 0; max-width: none; }
                    .no-print { display: none !important; }
                    .rp-sheet { break-after: page; page-break-after: always; }
                    .rp-sheet:last-of-type { break-after: auto; page-break-after: auto; }
                    .rp-sheet + .rp-sheet { margin-top: 0; padding-top: 0; border-top: 0; }
                    table.rp-t { break-inside: auto; }
                    table.rp-t tr { break-inside: avoid; page-break-inside: avoid; }
                    .rp-id { break-inside: avoid; page-break-inside: avoid; }
                }
            `}),e.jsx("div",{className:"rp",children:e.jsxs("div",{className:"rp-page",children:[x?e.jsxs("section",{className:"rp-sheet",children:[u("Resumen de la selección",`${l.references} referencias`),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Consolidado"}),e.jsx("span",{className:"rp-sec-line"}),e.jsxs("span",{className:"rp-sec-m",children:[l.active," activas · ",l.inactive," inactivas · ",l.operations," operaciones"]})]}),e.jsxs("div",{className:"rp-grid",children:[o("Unidades de lote",i(l.lot_units),"Suma de los lotes"),o("Total pago de los lotes",r(l.lot_payment_total,s)),o("Total costo operacional",r(l.lot_operational_total,s)),o("Margen de los lotes",r(l.lot_margin_total,s))]}),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Referencias"}),e.jsx("span",{className:"rp-sec-line"})]}),e.jsxs("table",{className:"rp-t",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Código"}),e.jsx("th",{children:"Nombre"}),e.jsx("th",{className:"c",children:"Estado"}),e.jsx("th",{className:"n",children:"Lote"}),e.jsx("th",{className:"n",children:"Pago u."}),e.jsx("th",{className:"n",children:"Costo op. u."}),e.jsx("th",{className:"n",children:"Margen u."}),e.jsx("th",{className:"n",children:"Total costo op. lote"}),e.jsx("th",{className:"n",children:"Margen del lote"}),e.jsx("th",{className:"c",children:"Ops."})]})}),e.jsx("tbody",{children:p.map(a=>e.jsxs("tr",{children:[e.jsx("td",{children:a.code}),e.jsx("td",{children:a.name}),e.jsx("td",{className:`c ${a.is_active?"":"rp-off"}`,children:a.status_label}),e.jsx("td",{className:"n",children:i(a.lot_total_quantity)}),e.jsx("td",{className:"n",children:a.payment_defined?r(a.payment_per_unit,s):"—"}),e.jsx("td",{className:"n",children:r(a.operational_cost_per_unit,s)}),e.jsx("td",{className:"n",children:r(a.margin_per_unit,s)}),e.jsx("td",{className:"n",children:r(a.lot_operational_total,s)}),e.jsx("td",{className:"n",children:r(a.lot_margin_total,s)}),e.jsxs("td",{className:"c",children:[a.operations_completed_count,"/",a.operations_count]})]},a.id))}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsxs("td",{colSpan:3,children:["TOTAL · ",l.references," referencias"]}),e.jsx("td",{className:"n",children:i(l.lot_units)}),e.jsx("td",{className:"n"}),e.jsx("td",{className:"n"}),e.jsx("td",{className:"n"}),e.jsx("td",{className:"n",children:r(l.lot_operational_total,s)}),e.jsx("td",{className:"n",children:r(l.lot_margin_total,s)}),e.jsx("td",{className:"c",children:l.operations})]})})]}),N]}):null,p.map(a=>e.jsxs("section",{className:"rp-sheet",children:[u("Ficha técnica de referencia",`${a.code} · ${a.name}`),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Identidad"}),e.jsx("span",{className:"rp-sec-line"}),e.jsxs("span",{className:"rp-sec-m",children:[a.created_at?`Creada el ${a.created_at}`:"",a.updated_at?` · Actualizada el ${a.updated_at}`:""]})]}),e.jsxs("div",{className:"rp-id",children:[e.jsx("div",{className:"rp-photo",children:a.image_url?e.jsx("img",{src:a.image_url,alt:`${a.code} — ${a.name}`}):e.jsx("span",{children:"Sin imagen cargada"})}),e.jsxs("div",{className:"rp-id-data",children:[e.jsxs("p",{className:"rp-ref-code",children:[a.code,e.jsx("span",{className:`rp-chip ${a.is_active?"rp-chip-on":"rp-chip-off"}`,children:a.status_label})]}),e.jsx("p",{className:"rp-ref-name",children:a.name}),e.jsx("p",{className:"rp-desc",children:a.description||"Sin descripción."}),e.jsxs("p",{className:"rp-dates",children:[a.operations_count," ",a.operations_count===1?"operación":"operaciones"," ·"," ",i(a.total_minutes)," min por unidad · lote de ",i(a.lot_total_quantity)," u."]})]})]}),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Dinero y costo operacional"}),e.jsx("span",{className:"rp-sec-line"}),e.jsxs("span",{className:"rp-sec-m",children:["Valores en ",s]})]}),e.jsxs("div",{className:"rp-grid",children:[o("Valor unitario de pago",a.payment_defined?r(a.payment_per_unit,s):"Sin definir","Lo que reciben por unidad"),o("Costo operacional por unidad",r(a.operational_cost_per_unit,s),"Suma del detalle"),o("Margen por unidad",r(a.margin_per_unit,s),`Margen ${h(a.margin_ratio)}`),o("Cantidad total del lote",i(a.lot_total_quantity),"Tope por operación")]}),e.jsxs("div",{className:"rp-grid rp-grid-3",style:{marginTop:"0.5rem"},children:[e.jsxs("div",{className:"rp-box rp-box-strong",children:[e.jsx("p",{className:"rp-box-k",children:"Total pago del lote"}),e.jsx("p",{className:"rp-box-v",children:r(a.lot_payment_total,s)}),e.jsxs("p",{className:"rp-box-h",children:[r(a.payment_per_unit,s)," × ",i(a.lot_total_quantity)," u."]})]}),e.jsxs("div",{className:"rp-box rp-box-strong",children:[e.jsx("p",{className:"rp-box-k",children:"Total costo operacional del lote"}),e.jsx("p",{className:"rp-box-v",children:r(a.lot_operational_total,s)}),e.jsxs("p",{className:"rp-box-h",children:[r(a.operational_cost_per_unit,s)," × ",i(a.lot_total_quantity)," u."]})]}),e.jsxs("div",{className:"rp-box rp-box-strong",children:[e.jsx("p",{className:"rp-box-k",children:"Margen del lote"}),e.jsx("p",{className:"rp-box-v",children:r(a.lot_margin_total,s)}),e.jsxs("p",{className:"rp-box-h",children:[r(a.margin_per_unit,s)," × ",i(a.lot_total_quantity)," u."]})]})]}),e.jsxs("p",{className:"rp-note",children:["El costo operacional por unidad es la suma de los precios de las ",a.operations_count," ",a.operations_count===1?"operación":"operaciones"," de la referencia, incluidas las cerradas por lote completo; el total del lote lo multiplica por las ",i(a.lot_total_quantity)," unidades vigentes."]}),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Producción registrada"}),e.jsx("span",{className:"rp-sec-line"}),e.jsx("span",{className:"rp-sec-m",children:"Avance medido con la operación más adelantada"})]}),e.jsxs("div",{className:"rp-grid",children:[o("Operación más avanzada",i(a.produced_max_per_operation),"Unidades"),o("Pendientes del lote",a.pending_units==null?"—":i(a.pending_units),"Unidades"),o("Avance del lote",h(a.progress_ratio),a.progress_ratio==null?"Sin lote definido":void 0),o("Operaciones completadas",`${a.operations_completed_count} de ${a.operations_count}`,`Acumulado total: ${i(a.produced_total)} u.`)]}),e.jsxs("div",{className:"rp-sec",children:[e.jsx("span",{className:"rp-sec-t",children:"Operaciones · detalle del costo operacional"}),e.jsx("span",{className:"rp-sec-line"}),e.jsxs("span",{className:"rp-sec-m",children:[a.operations_active_count," activas de ",a.operations_count]})]}),a.operations.length===0?e.jsx("p",{className:"rp-note",children:"La referencia no tiene operaciones vinculadas."}):e.jsxs("table",{className:"rp-t",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Operación"}),e.jsx("th",{className:"n",children:"Precio u."}),e.jsx("th",{className:"n",children:"% del costo"}),e.jsx("th",{className:"n",children:"Minutos"}),e.jsx("th",{className:"c",children:"Dificultad"}),e.jsx("th",{className:"c",children:"Estado"}),e.jsx("th",{className:"n",children:"Producidas"}),e.jsx("th",{className:"n",children:"Pendientes"}),e.jsx("th",{className:"n",children:"Total en el lote"})]})}),e.jsx("tbody",{children:a.operations.map(t=>e.jsxs("tr",{children:[e.jsx("td",{children:t.name}),e.jsx("td",{className:"n",children:r(t.price,s)}),e.jsx("td",{className:"n",children:h(t.cost_share)}),e.jsxs("td",{className:"n",children:[i(t.minutes),t.minutes_inherited?e.jsx("span",{className:"rp-off",children:" *"}):null]}),e.jsx("td",{className:"c",children:t.difficulty_label}),e.jsx("td",{className:`c ${t.is_active?"":"rp-off"}`,children:t.status_label}),e.jsx("td",{className:"n",children:i(t.produced)}),e.jsx("td",{className:"n",children:t.pending==null?"—":i(t.pending)}),e.jsx("td",{className:"n",children:r(t.lot_total,s)})]},t.operation_id))}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{children:"Costo operacional por unidad"}),e.jsx("td",{className:"n",children:r(a.operational_cost_per_unit,s)}),e.jsx("td",{className:"n",children:"100%"}),e.jsx("td",{className:"n",children:i(a.total_minutes)}),e.jsx("td",{className:"c",colSpan:4}),e.jsx("td",{className:"n",children:r(a.lot_operational_total,s)})]})})]}),a.operations.some(t=>t.minutes_inherited)?e.jsx("p",{className:"rp-note",children:"* Minutos heredados del dato maestro de la operación (la línea no tiene los suyos)."}):null,N]},a.id)),e.jsxs("div",{className:"no-print rp-actions",children:[e.jsx("button",{onClick:()=>window.print(),className:"rp-btn",children:"Imprimir o guardar PDF"}),e.jsxs("p",{className:"rp-hint",children:["Para guardar como PDF: en el cuadro de impresión elige el destino «Guardar como PDF»",x?" · cada referencia sale en su propia hoja.":"."]})]})]})})]})}export{E as default};
