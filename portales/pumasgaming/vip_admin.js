/* =====================================================================
   Entrenos PROYECTN · Admin VIP (sección "Registrar VIP" del panel)
   - Exportar los equipos VIP que NO tienen resultados (nunca jugaron un entreno)
   - Solicitudes de la página pública /entrenamientos/vip.html (sql/19):
     aprobar (pasa a la lista VIP), rechazar o borrar
   Necesita portal.js (sesión) y los contenedores #vipExportar y #vipSolicitudes.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const $ = id => document.getElementById(id);
    const clave = s => String(s || '').trim().toUpperCase();   // igual que la tabla pública de VIP

    // Todas las filas de una consulta (Supabase entrega de a 1000)
    async function todas(consulta) {
        const filas = [];
        for (let desde = 0; ; desde += 1000) {
            const { data, error } = await consulta().range(desde, desde + 999);
            if (error) throw error;
            filas.push(...(data || []));
            if (!data || data.length < 1000) return filas;
        }
    }

    /* ---------------- VIP sin resultados ---------------- */
    async function vipSinResultados() {
        const db = P.db();
        const [vip, conResultados] = await Promise.all([
            todas(() => db.from('equipos_registrados').select('nombre, tag').order('nombre')),
            todas(() => db.from('v_tabla_general').select('equipo').eq('portal', 'entrenamientos'))
        ]);
        const jugaron = new Set(conResultados.map(r => clave(r.equipo)));
        return { total: vip.length, lista: vip.filter(v => !jugaron.has(clave(v.nombre))) };
    }

    function descargar(nombre, texto, tipo) {
        const blob = new Blob([texto], { type: tipo });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    function montarExportar() {
        const cont = $('vipExportar');
        if (!cont) return;
        cont.innerHTML = `<button class="btn-generar" id="btnVipSinRes" style="margin:0;max-width:420px">
            <i class="fa-solid fa-file-export"></i> EXPORTAR VIP SIN RESULTADOS</button>
            <p class="form-hint" id="vipSinResMsg" style="margin-top:8px">Equipos VIP que todavía no aparecen en ningún entreno.</p>
            <div id="vipSinResLista"></div>`;
        $('btnVipSinRes').addEventListener('click', async () => {
            const msg = $('vipSinResMsg');
            msg.textContent = 'Revisando resultados...';
            try {
                const { total, lista } = await vipSinResultados();
                const hoy = new Date().toISOString().slice(0, 10);
                const texto = lista.map((v, i) => `${i + 1}. ${v.nombre}${v.tag ? ' - ' + v.tag : ''}`).join('\n');
                msg.textContent = `${lista.length} de ${total} equipos VIP no tienen resultados.`;
                $('vipSinResLista').innerHTML = lista.length ? `
                    <textarea readonly style="width:100%;height:180px;margin-top:10px;background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:6px;padding:10px;font-family:Consolas,monospace">${esc(texto)}</textarea>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
                        <button class="btn-mini" id="vipCopiar"><i class="fa-solid fa-copy"></i> Copiar</button>
                        <button class="btn-mini" id="vipTxt"><i class="fa-solid fa-file-lines"></i> Descargar .txt</button>
                        <button class="btn-mini" id="vipCsv"><i class="fa-solid fa-file-csv"></i> Descargar Excel (.csv)</button>
                    </div>` : '<p style="color:#6ee7a8;margin-top:8px">✔ Todos los VIP tienen resultados.</p>';
                if (!lista.length) return;
                $('vipCopiar').onclick = async () => { try { await navigator.clipboard.writeText(texto); msg.textContent = '✔ Lista copiada.'; } catch (e) { msg.textContent = 'No se pudo copiar: selecciona el texto.'; } };
                $('vipTxt').onclick = () => descargar(`vip-sin-resultados-${hoy}.txt`, texto, 'text/plain;charset=utf-8');
                $('vipCsv').onclick = () => descargar(`vip-sin-resultados-${hoy}.csv`,
                    '﻿Equipo;Tag\n' + lista.map(v => `"${v.nombre.replace(/"/g, '""')}";"${(v.tag || '').replace(/"/g, '""')}"`).join('\n'), 'text/csv;charset=utf-8');
            } catch (e) { msg.textContent = 'Error: ' + (e.message || e); }
        });
    }

    /* ---------------- Solicitudes de registro VIP ---------------- */
    const COLOR = { PENDIENTE: '#FFD54A', APROBADO: '#6ee7a8', RECHAZADO: '#ff8a8d' };
    async function montarSolicitudes() {
        const cont = $('vipSolicitudes');
        if (!cont) return;
        cont.innerHTML = '<p style="color:var(--gray)">Cargando registros...</p>';
        let filas;
        try { filas = await P.vip.listar(); }
        catch (e) { cont.innerHTML = `<p style="color:#ff8a8d">${esc(e.message)}</p>`; return; }
        const pendientes = filas.filter(f => f.estado === 'PENDIENTE').length;
        cont.innerHTML = `
            <p style="color:var(--gray);margin-bottom:10px">${filas.length} registros · <b style="color:#FFD54A">${pendientes} pendientes</b>.
                Al <b>aprobar</b>, el equipo pasa a la lista VIP. La página <b>entrenamientos/vip.html</b> no aparece en el sitio: se entra con un código de arriba.</p>
            <div style="width:100%;overflow-x:auto"><table style="width:100%;min-width:760px;border-collapse:collapse;color:#fff;font-size:.9rem">
                <thead><tr style="color:var(--primary);font-family:'Michroma';font-size:.75rem;border-bottom:2px solid rgba(216,195,149,.3)">
                    <th style="text-align:left;padding:8px">EQUIPO</th><th>TAG</th><th>REPRESENTANTE</th><th>HORARIOS</th><th>ESTADO</th><th>FECHA</th><th></th></tr></thead>
                <tbody>${filas.length ? filas.map(f => `<tr style="border-bottom:1px solid rgba(255,255,255,.06)" data-id="${f.id}">
                    <td style="padding:8px;font-weight:bold">${esc(f.nombre)}</td><td style="text-align:center">${esc(f.tag)}</td>
                    <td style="text-align:center"><a href="https://wa.me/${esc(String(f.telefono).replace(/[^\d]/g, ''))}" target="_blank" rel="noopener" style="color:#25D366"><i class="fa-brands fa-whatsapp"></i> ${esc(f.telefono)}</a></td>
                    <td style="text-align:center">${(f.horarios || []).map(h => `<span style="display:inline-block;margin:1px;padding:2px 6px;border:1px solid rgba(216,195,149,.4);border-radius:4px;font-size:.75rem">${esc(h)}</span>`).join('')}</td>
                    <td style="text-align:center;color:${COLOR[f.estado]};font-weight:bold">${f.estado}</td>
                    <td style="text-align:center;color:var(--gray);font-size:.8rem">${new Date(f.creado).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style="white-space:nowrap;text-align:right">
                        ${f.estado !== 'APROBADO' ? '<button class="btn-mini" data-acc="APROBADO" title="Aprobar: pasa a la lista VIP"><i class="fa-solid fa-check"></i></button>' : ''}
                        ${f.estado !== 'RECHAZADO' ? '<button class="btn-mini" data-acc="RECHAZADO" title="Rechazar"><i class="fa-solid fa-xmark"></i></button>' : ''}
                        <button class="btn-mini" data-acc="BORRAR" title="Borrar" style="color:#ff8a8d"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
                    : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray)">Todavía no hay registros.</td></tr>'}</tbody></table></div>`;
        cont.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', async () => {
            const id = Number(b.closest('tr').dataset.id), acc = b.dataset.acc;
            if (acc === 'BORRAR' && !confirm('¿Borrar este registro?')) return;
            b.disabled = true;
            try {
                if (acc === 'BORRAR') await P.vip.borrar(id); else await P.vip.estado(id, acc);
                await montarSolicitudes();
                if (acc === 'APROBADO' && typeof cargarListaEquiposVipAdmin === 'function') cargarListaEquiposVipAdmin();
            } catch (e) { alert(e.message); b.disabled = false; }
        }));
    }

    /* ---------------- Códigos de acceso (sql/22) ---------------- */
    // La página /entrenamientos/vip.html no está en ningún menú y pide un código que se genera aquí
    const linkDe = c => location.origin + '/entrenamientos/vip.html?c=' + encodeURIComponent(c);
    async function copiar(texto, nodo) {
        try { await navigator.clipboard.writeText(texto); nodo.textContent = '✔ Copiado'; }
        catch (e) { nodo.textContent = texto; }
    }
    async function montarCodigos() {
        const cont = $('vipCodigos');
        if (!cont) return;
        cont.innerHTML = `
            <p style="color:var(--gray);margin:0 0 10px">La página de registro VIP no aparece en el sitio. Genera un código y compártelo (o el link directo) con el representante del equipo.</p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
                <label style="display:flex;flex-direction:column;gap:4px;color:var(--primary);font-family:'Michroma';font-size:.7rem">USOS
                    <input id="vcUsos" type="number" min="1" max="100" value="1" style="width:90px;padding:8px;background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:6px"></label>
                <label style="display:flex;flex-direction:column;gap:4px;color:var(--primary);font-family:'Michroma';font-size:.7rem">VENCE EN (DÍAS)
                    <input id="vcDias" type="number" min="1" max="60" value="7" style="width:110px;padding:8px;background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:6px"></label>
                <label style="display:flex;flex-direction:column;gap:4px;color:var(--primary);font-family:'Michroma';font-size:.7rem;flex:1 1 180px">NOTA (PARA QUIÉN)
                    <input id="vcNota" maxlength="80" placeholder="Ej: DCN ACD" style="padding:8px;background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:6px"></label>
                <button class="btn-generar" id="vcCrear" style="margin:0;width:auto;padding:10px 18px"><i class="fa-solid fa-key"></i> GENERAR CÓDIGO</button>
            </div>
            <div id="vcNuevo" style="margin-top:12px"></div>
            <div id="vcLista" style="margin-top:12px"></div>`;
        $('vcCrear').addEventListener('click', async () => {
            const nuevo = $('vcNuevo');
            nuevo.innerHTML = '<p style="color:var(--gray)">Generando...</p>';
            try {
                const r = await P.vip.codigos.crear(Number($('vcUsos').value) || 1, Number($('vcDias').value) || 7, $('vcNota').value.trim());
                nuevo.innerHTML = `<div style="padding:14px;border:2px dashed var(--primary);border-radius:8px;text-align:center">
                    <div style="color:var(--gray);font-size:.8rem">Código nuevo</div>
                    <div style="font:900 1.6rem 'Michroma';color:var(--primary);letter-spacing:.08em;margin:6px 0">${esc(r.codigo)}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                        <button class="btn-mini" id="vcCopiarCod"><i class="fa-solid fa-copy"></i> Copiar código</button>
                        <button class="btn-mini" id="vcCopiarLink"><i class="fa-solid fa-link"></i> Copiar link directo</button>
                    </div><p id="vcCopiado" style="color:#6ee7a8;margin:8px 0 0;word-break:break-all"></p></div>`;
                $('vcCopiarCod').onclick = () => copiar(r.codigo, $('vcCopiado'));
                $('vcCopiarLink').onclick = () => copiar(linkDe(r.codigo), $('vcCopiado'));
                $('vcNota').value = '';
                listarCodigos();
            } catch (e) { nuevo.innerHTML = `<p style="color:#ff8a8d">${esc(/admin_vip_codigo|PGRST202|Could not find/i.test(e.message) ? 'Falta correr sql/22_vip_codigos.sql en Supabase.' : e.message)}</p>`; }
        });
        listarCodigos();
    }
    async function listarCodigos() {
        const cont = $('vcLista');
        let filas;
        try { filas = await P.vip.codigos.listar(); }
        catch (e) { cont.innerHTML = /admin_vip_codigos|PGRST202|Could not find/i.test(e.message) ? '<p style="color:#ff8a8d">Falta correr sql/22_vip_codigos.sql en Supabase.</p>' : `<p style="color:#ff8a8d">${esc(e.message)}</p>`; return; }
        if (!filas.length) { cont.innerHTML = '<p style="color:var(--gray)">Todavía no hay códigos.</p>'; return; }
        const ahora = new Date();
        const estado = c => !c.activo ? ['DESACTIVADO', '#888'] : c.usos >= c.usos_max ? ['USADO', '#888'] : new Date(c.vence) < ahora ? ['VENCIDO', '#ff8a8d'] : ['ACTIVO', '#6ee7a8'];
        cont.innerHTML = `<div style="width:100%;overflow-x:auto"><table style="width:100%;min-width:620px;border-collapse:collapse;color:#fff;font-size:.88rem">
            <thead><tr style="color:var(--primary);font-family:'Michroma';font-size:.7rem;border-bottom:2px solid rgba(216,195,149,.3)">
                <th style="text-align:left;padding:6px">CÓDIGO</th><th>USOS</th><th>VENCE</th><th>NOTA</th><th>ESTADO</th><th></th></tr></thead>
            <tbody>${filas.map(c => { const [t, col] = estado(c); return `<tr style="border-bottom:1px solid rgba(255,255,255,.06)" data-cod="${esc(c.codigo)}">
                <td style="padding:6px;font-family:'Michroma';letter-spacing:.05em">${esc(c.codigo)}</td><td style="text-align:center">${c.usos}/${c.usos_max}</td>
                <td style="text-align:center;font-size:.8rem">${new Date(c.vence).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style="text-align:center;color:var(--gray)">${esc(c.nota || '')}</td><td style="text-align:center;color:${col};font-weight:bold">${t}</td>
                <td style="white-space:nowrap;text-align:right">${t === 'ACTIVO' ? `<button class="btn-mini" data-link title="Copiar link directo"><i class="fa-solid fa-link"></i></button>
                    <button class="btn-mini" data-off title="Desactivar" style="color:#ff8a8d"><i class="fa-solid fa-ban"></i></button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
        cont.querySelectorAll('[data-link]').forEach(b => b.addEventListener('click', () => copiar(linkDe(b.closest('tr').dataset.cod), b)));
        cont.querySelectorAll('[data-off]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('¿Desactivar este código? Ya no servirá para registrarse.')) return;
            try { await P.vip.codigos.desactivar(b.closest('tr').dataset.cod); listarCodigos(); } catch (e) { alert(e.message); }
        }));
    }

    function iniciar() { montarExportar(); montarCodigos(); montarSolicitudes(); }
    window.addEventListener('pg:sesion', iniciar, { once: true });
    window.PumasVipAdmin = { recargar: montarSolicitudes };
})();
