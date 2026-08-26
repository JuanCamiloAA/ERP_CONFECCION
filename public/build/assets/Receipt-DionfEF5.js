import{r as _,j as e,H as D}from"./app-CQ9teLQE.js";import{m as R}from"./mediaUrl-BguGOiaJ.js";import{f as d,a as m}from"./utils-Bh8LSCk8.js";const k=["","UNO","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE","DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISÉIS","DIECISIETE","DIECIOCHO","DIECINUEVE","VEINTE","VEINTIUNO","VEINTIDÓS","VEINTITRÉS","VEINTICUATRO","VEINTICINCO","VEINTISÉIS","VEINTISIETE","VEINTIOCHO","VEINTINUEVE"],z=["","","VEINTE","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"],q=["","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS","SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"];function g(r){return r.endsWith("VEINTIUNO")?`${r.slice(0,-9)}VEINTIÚN`:r.endsWith("UNO")?`${r.slice(0,-3)}UN`:r}function H(r){if(r===100)return"CIEN";const s=q[Math.floor(r/100)],i=r%100;let a;if(i<30)a=k[i];else{const l=i%10;a=l===0?z[Math.floor(i/10)]:`${z[Math.floor(i/10)]} Y ${k[l]}`}return[s,a].filter(Boolean).join(" ")}function n(r){if(r<1e3)return H(r);if(r<1e6){const l=Math.floor(r/1e3),c=r%1e3,t=l===1?"MIL":`${g(n(l))} MIL`;return c===0?t:`${t} ${n(c)}`}if(r<1e12){const l=Math.floor(r/1e6),c=r%1e6,t=l===1?"UN MILLÓN":`${g(n(l))} MILLONES`;return c===0?t:`${t} ${n(c)}`}const s=Math.floor(r/1e12),i=r%1e12,a=s===1?"UN BILLÓN":`${g(n(s))} BILLONES`;return i===0?a:`${a} ${n(i)}`}function F(r){const s=typeof r=="string"?Number.parseFloat(r):Number(r),i=Number.isFinite(s)?s:0,a=Math.round(Math.abs(i)),l=a===0?"CERO":g(n(a)),c=a===1?"PESO":"PESOS";return`${i<0&&a!==0?"MENOS ":""}${l} ${c} M/CTE.`}const U=["Original — empresa","Copia — empleado"],P={operations:"Pago por operación",fixed_daily:"Salario diario por jornada",hourly_legal:"Jornada legal por horas"};function Q({advance:r,company:s,previous_balance:i,period:a,issued_by:l,copies:c}){var w,S,C,O,y;_.useEffect(()=>{const o=setTimeout(()=>window.print(),500);return()=>clearTimeout(o)},[]);const t=Number(r.amount),u=Number(i)||0,f=u+t,p=(s==null?void 0:s.name)??"La empresa",x=s!=null&&s.logo?R(s.logo):void 0,N=[s!=null&&s.nit?`NIT ${s.nit}`:null,(s==null?void 0:s.address)??null,(s==null?void 0:s.phone)??null].filter(Boolean).join(" · "),b=`${((w=r.employee)==null?void 0:w.first_name)??""} ${((S=r.employee)==null?void 0:S.last_name)??""}`.trim()||"Empleado",j=((C=r.employee)==null?void 0:C.document_type)||"C.C.",E=((O=r.employee)==null?void 0:O.document_number)??"—",$=P[((y=r.employee)==null?void 0:y.payroll_mode)??"operations"]??"Pago por operación",I=String(r.id).padStart(4,"0"),M=d(r.date,"d 'de' MMMM 'de' yyyy"),v=!!(a.start&&a.end),A=v?`${d(a.start)} — ${d(a.end)}`:"",V=a.payroll_date?`Nómina del ${d(a.payroll_date)}`:"Próxima nómina",T=c===1?U.slice(0,1):U,L=o=>{var h;return e.jsxs("section",{className:"rc-copy",children:[e.jsxs("header",{className:"rc-head",children:[e.jsxs("div",{className:"rc-brand",children:[e.jsx("div",{className:"rc-logo",children:x?e.jsx("img",{src:x,alt:p}):e.jsx("span",{children:p.charAt(0)})}),e.jsxs("div",{children:[e.jsx("p",{className:"rc-co",children:p}),N?e.jsx("p",{className:"rc-co-meta",children:N}):null]})]}),e.jsxs("div",{className:"rc-doc",children:[e.jsx("p",{className:"rc-kicker",children:"Comprobante de anticipo"}),e.jsxs("p",{className:"rc-num",children:["N.º ",I]}),e.jsx("p",{className:"rc-copy-label",children:o})]})]}),e.jsx("div",{className:"rc-accent"}),e.jsxs("div",{className:"rc-value",children:[e.jsxs("div",{children:[e.jsx("p",{className:"rc-label",children:"Valor entregado"}),e.jsx("p",{className:"rc-amount",children:m(t)}),e.jsx("p",{className:"rc-words",children:F(t)})]}),e.jsxs("div",{className:"rc-value-right",children:[e.jsx("p",{className:"rc-label",children:"Fecha de entrega"}),e.jsx("p",{className:"rc-date",children:M}),e.jsx("p",{className:"rc-way",children:"Efectivo · caja del taller"})]})]}),e.jsxs("div",{className:"rc-data",children:[e.jsxs("div",{children:[e.jsx("p",{className:"rc-label",children:"Empleado"}),e.jsx("p",{className:"rc-name",children:b}),e.jsxs("p",{className:"rc-sub",children:[j," ",E]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"rc-label",children:"Vinculación"}),e.jsx("p",{className:"rc-name",children:$}),e.jsx("p",{className:"rc-sub",children:(h=r.employee)!=null&&h.hire_date?`Ingreso ${d(r.employee.hire_date)}`:"Ingreso —"})]}),e.jsxs("div",{children:[e.jsx("p",{className:"rc-label",children:"Motivo"}),e.jsx("p",{className:"rc-name",children:r.reason||"—"}),e.jsx("p",{className:"rc-sub",children:"Solicitado por el empleado"})]})]}),e.jsxs("div",{className:"rc-strip",children:[e.jsxs("div",{className:"rc-cell",children:[e.jsx("p",{className:"rc-label",children:"Saldo anterior"}),e.jsx("p",{className:"rc-cell-v",children:m(u)}),e.jsx("p",{className:"rc-cell-m",children:"Anticipos sin descontar"})]}),e.jsxs("div",{className:"rc-cell",children:[e.jsx("p",{className:"rc-label",children:"Este anticipo"}),e.jsx("p",{className:"rc-cell-v",children:m(t)}),e.jsx("p",{className:"rc-cell-m",children:"Entregado hoy"})]}),e.jsxs("div",{className:"rc-cell rc-cell-total",children:[e.jsx("p",{className:"rc-label",children:"Total a descontar"}),e.jsx("p",{className:"rc-cell-v",children:m(f)}),e.jsx("p",{className:"rc-cell-m",children:V})]})]}),e.jsxs("p",{className:"rc-clause",children:["Declaro haber recibido de ",e.jsx("strong",{children:p})," la suma aquí indicada como anticipo de mi salario, y autorizo por escrito que se descuente de mi liquidación"," ",v?e.jsxs(e.Fragment,{children:["del periodo ",e.jsx("strong",{children:A})]}):e.jsxs(e.Fragment,{children:["de ",e.jsx("strong",{children:"la próxima nómina que se liquide"})]}),"; si el neto no alcanza a cubrirla, el saldo se descuenta en los periodos siguientes. Art. 149 del Código Sustantivo del Trabajo."]}),e.jsxs("div",{className:"rc-signs",children:[e.jsx("div",{className:"rc-sign-space"}),e.jsx("div",{className:"rc-sign-space"}),e.jsx("div",{className:"rc-fp-box",children:e.jsx("span",{children:"Huella"})}),e.jsxs("div",{children:[e.jsxs("p",{className:"rc-sign-t",children:["Recibí conforme — ",b]}),e.jsxs("p",{className:"rc-sub",children:[j," ",E]})]}),e.jsxs("div",{children:[e.jsxs("p",{className:"rc-sign-t",children:["Entregado por — ",l??"—"]}),e.jsx("p",{className:"rc-sub",children:"Firma y sello de la empresa"})]})]}),e.jsxs("p",{className:"rc-foot",children:["Anticipo #",r.id," · registrado el ",d(r.created_at)," por ",l??"—"," · saldo tras la entrega ",m(f)," · ",o,". Documento interno de control de nómina; no constituye factura ni soporte tributario."]})]},o)};return e.jsxs(e.Fragment,{children:[e.jsx(D,{title:`Comprobante de anticipo N.º ${I}`}),e.jsx("style",{children:`
                /* Sin margen de pagina: el navegador deja de imprimir su encabezado de URL y fecha. */
                @page { size: letter; margin: 0; }

                .rc-desk { background: #ececef; padding: 8mm 0; min-height: 100vh; }

                .rc-sheet {
                    box-sizing: border-box;
                    width: 216mm;
                    min-height: 279mm;
                    margin: 0 auto;
                    /* 10mm vertical: con 12mm la segunda copia se recorta. */
                    padding: 10mm 13mm;
                    background: #fff;
                    color: #1b1b1f;
                    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
                    font-variant-numeric: tabular-nums;
                    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.12);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .rc-copy { break-inside: avoid; page-break-inside: avoid; }

                /* ------------------------------------------------------ cabecera */
                .rc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
                .rc-brand { display: flex; align-items: center; gap: 3mm; min-width: 0; }
                .rc-logo {
                    width: 12mm; height: 12mm; flex: 0 0 12mm;
                    display: flex; align-items: center; justify-content: center;
                    border: 1px solid #d9d9e0; border-radius: 1.6mm; overflow: hidden;
                    background: #fafafc; color: #6f61c4; font-size: 13pt; font-weight: 600;
                }
                .rc-logo img { width: 100%; height: 100%; object-fit: contain; }
                .rc-co {
                    font-size: 11pt; font-weight: 600; line-height: 1.2; margin: 0;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-co-meta {
                    font-size: 7.5pt; color: #5c5c66; line-height: 1.35; margin: 0.7mm 0 0;
                    /* Una linea: una direccion larga no puede empujar la segunda copia fuera de la hoja. */
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 105mm;
                }
                .rc-doc { text-align: right; flex: 0 0 auto; }
                .rc-kicker {
                    font-size: 7pt; text-transform: uppercase; letter-spacing: 0.09em;
                    color: #6b6b75; margin: 0;
                }
                .rc-num { font-size: 13pt; font-weight: 600; line-height: 1.15; margin: 0.6mm 0 0; }
                .rc-copy-label { font-size: 7.5pt; color: #6f61c4; margin: 0.6mm 0 0; }

                .rc-accent { height: 1.2pt; background: #6f61c4; margin: 2.5mm 0 0; }

                /* --------------------------------------------------------- valor */
                .rc-label {
                    font-size: 7pt; text-transform: uppercase; letter-spacing: 0.09em;
                    color: #6b6b75; margin: 0;
                }
                .rc-value {
                    display: flex; align-items: flex-end; justify-content: space-between;
                    gap: 8mm; padding: 2.5mm 0 2mm;
                }
                .rc-amount { font-size: 19pt; font-weight: 600; line-height: 1.1; margin: 1mm 0 0; }
                .rc-words {
                    font-size: 8pt; color: #3f3f48; line-height: 1.35; margin: 1mm 0 0; max-width: 130mm;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-value-right { text-align: right; flex: 0 0 auto; }
                .rc-date { font-size: 11pt; font-weight: 500; line-height: 1.2; margin: 1mm 0 0; }
                .rc-way { font-size: 7.5pt; color: #6b6b75; margin: 0.8mm 0 0; }

                /* --------------------------------------------------------- datos */
                .rc-data {
                    display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 6mm;
                    border-top: 1px solid #e3e3e9; padding-top: 2.5mm;
                }
                .rc-name {
                    font-size: 10pt; line-height: 1.25; margin: 1.2mm 0 0;
                    /* Dos lineas como techo: el motivo es texto libre y la hoja no puede crecer. */
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
                }
                .rc-sub { font-size: 7.5pt; color: #6b6b75; line-height: 1.3; margin: 0.7mm 0 0; }

                /* -------------------------------------------------- franja saldos */
                .rc-strip {
                    display: grid; grid-template-columns: 1fr 1fr 1fr;
                    border: 1px solid #dcdce3; border-radius: 2mm; overflow: hidden;
                    margin-top: 3mm;
                }
                .rc-cell { padding: 2.2mm 3mm; border-left: 1px solid #dcdce3; }
                .rc-cell:first-child { border-left: 0; }
                .rc-cell-v { font-size: 11.5pt; font-weight: 600; line-height: 1.15; margin: 1mm 0 0; }
                .rc-cell-m {
                    font-size: 7pt; color: #6b6b75; margin: 0.8mm 0 0;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                /* Tinte y color de marca; en blanco y negro el rotulo sigue diciendo que es el total. */
                .rc-cell-total { background: #f4f2fb; color: #3f3583; }
                .rc-cell-total .rc-label, .rc-cell-total .rc-cell-m { color: #5b5195; }

                /* ------------------------------------------------------ clausula */
                .rc-clause {
                    font-size: 7.8pt; line-height: 1.5; text-align: justify;
                    color: #35353d; margin: 2.5mm 0 0;
                }
                .rc-clause strong { font-weight: 600; }

                /* -------------------------------------------------------- firmas */
                .rc-signs {
                    display: grid; grid-template-columns: 1fr 1fr 17mm;
                    /* Fila 1: el hueco donde se firma, con la linea como borde inferior.
                       Al compartir fila, las dos lineas quedan siempre a la misma altura. */
                    grid-template-rows: 8mm auto;
                    column-gap: 7mm; margin-top: 3mm;
                }
                .rc-sign-space { border-bottom: 1px solid #33333c; }
                .rc-sign-t {
                    font-size: 8pt; line-height: 1.3; margin: 1.4mm 0 0;
                    /* Un renglon: si el rotulo creciera, las dos copias dejarian de caber
                       en la hoja. El nombre completo esta arriba, en el bloque Empleado. */
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .rc-fp-box {
                    /* Sin span: se desborda 6mm sobre una celda vacia y no alarga la hoja. */
                    align-self: start;
                    width: 17mm; height: 14mm; border: 1px solid #b8b8c0; border-radius: 1mm;
                    display: flex; align-items: flex-start; justify-content: center; padding-top: 1mm;
                }
                .rc-fp-box span {
                    font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: #9a9aa4;
                }

                /* ---------------------------------------------------------- pie */
                .rc-foot {
                    font-size: 6.8pt; color: #7a7a84; line-height: 1.4;
                    border-top: 1px solid #e3e3e9; padding-top: 1.5mm; margin: 2.5mm 0 0;
                }

                /* ------------------------------------------------------- corte */
                .rc-cut { padding: 1.5mm 0; }
                .rc-cut-rule { height: 0; border-top: 1px dashed #b8b8c0; }
                .rc-cut-t {
                    font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.12em;
                    color: #9a9aa4; text-align: center; margin: 1mm 0;
                }

                /* ------------------------------------------------- solo pantalla */
                .rc-bar {
                    position: fixed; right: 6mm; top: 6mm; z-index: 10;
                    display: flex; gap: 6px;
                }
                .rc-btn {
                    border: 1px solid #6f61c4; background: #fff; color: #4a3fa0;
                    border-radius: 6px; padding: 7px 14px; font-size: 12px; cursor: pointer;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                @media print {
                    .rc-desk { background: #fff; padding: 0; min-height: 0; }
                    .rc-sheet { box-shadow: none; min-height: 0; margin: 0; }
                    .rc-noprint { display: none !important; }
                }
            `}),e.jsxs("div",{className:"rc-desk",children:[e.jsx("div",{className:"rc-bar rc-noprint",children:e.jsx("button",{type:"button",className:"rc-btn",onClick:()=>window.print(),children:"Imprimir"})}),e.jsx("div",{className:"rc-sheet",children:T.map((o,h)=>e.jsxs("div",{children:[L(o),h<T.length-1?e.jsxs("div",{className:"rc-cut","aria-hidden":"true",children:[e.jsx("div",{className:"rc-cut-rule"}),e.jsx("p",{className:"rc-cut-t",children:"Corte aquí"}),e.jsx("div",{className:"rc-cut-rule"})]}):null]},o))})]})]})}export{Q as default};
