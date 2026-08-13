function i(r){if(r==null||r==="")return;const t=String(r).trim();return t.startsWith("http://")||t.startsWith("https://")?t:`/storage/${t.replace(/^\//,"")}`}export{i as m};
