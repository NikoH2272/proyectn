/* =====================================================================
   PROYECTN · Usuarios de un portal (sql/31)
   PumasUsuariosPortal.montar(contId, portal)
   · Admin del portal: crea, edita y borra a su STAFF (solo entra a este portal).
   · Superadmin: además ve y crea los ADMINISTRADORES del portal.
   · A cada usuario del staff se le eligen las secciones del panel que ve (sql/32).
   Si quien entra no puede manejar usuarios (p. ej. es staff), la sección se oculta sola
   junto con su enlace del menú (href="#usuariosPortal").
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // Secciones del panel que se pueden dar a cada usuario del staff (sql/32).
    // Claves comunes a todos los portales; cada página tiene sus propios ids de sección o pestaña.
    const CATALOGO = [
        ['herramienta', 'Herramienta / resultados', 'fa-table'], ['cupos', 'Cupos (programar, VIP y baneos)', 'fa-ticket'],
        ['baneados', 'Baneados', 'fa-ban'], ['jornadas', 'Jornadas guardadas', 'fa-clock-rotate-left'],
        ['analisis', 'Análisis', 'fa-chart-simple'], ['csv', 'Generar CSV', 'fa-file-csv']
    ];
    const CLAVE = { resultados: 'herramienta', panelResultados: 'herramienta', gestionCupos: 'cupos', cupos: 'cupos', panelCupos: 'cupos',
        baneados: 'baneados', panelBaneados: 'baneados', panelJornadas: 'jornadas', panelAnalisis: 'analisis', panelGenerarCsv: 'csv' };
    // En el panel de un portal se ofrecen solo las secciones que ese panel tiene; en el superadmin, todas
    function catalogo() {
        const hay = new Set(Object.keys(CLAVE).filter(id => document.getElementById(id)).map(id => CLAVE[id]));
        return hay.size ? CATALOGO.filter(c => hay.has(c[0])) : CATALOGO;
    }
    // Esconde lo que el usuario no tiene habilitado (y sus enlaces o pestañas)
    async function aplicarSecciones(portal) {
        let r;
        try { r = await P.usuariosPortal.misSecciones(portal); } catch (e) { return; }   // sin sql/32: todo visible
        if (!r || !Array.isArray(r.secciones)) return;
        const ok = new Set(r.secciones);
        Object.entries(CLAVE).forEach(([id, clave]) => {
            const el = document.getElementById(id);
            if (!el || ok.has(clave)) return;
            el.hidden = true;
            document.querySelectorAll(`a[href="#${id}"]`).forEach(a => { (a.closest('li') || a).hidden = true; });
            document.querySelectorAll(`[data-tab="${id}"]`).forEach(b => { b.hidden = true; });
        });
        // Herramientas con pestañas (Pruebas): si quedó abierta una pestaña oculta, se abre la primera visible
        const abierta = document.querySelector('.asc-panel:not([hidden])');
        if (!abierta) { const t = document.querySelector('.asc-tabs [data-tab]:not([hidden])'); if (t) t.click(); }
    }
    const errorSql = e => /portal_usuario_secciones|portal_mis_secciones/i.test(e.message || '') ? 'Falta correr sql/32_secciones_por_usuario.sql en Supabase.'
        : /portal_usuario|PGRST202|Could not find/i.test(e.message || '') ? 'Falta correr sql/31_usuarios_por_portal.sql en Supabase.' : e.message;

    const CSS = `
.up-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px;align-items:end}
.up-lista{display:grid;gap:10px;margin-top:14px}
.up-item{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(140px,1fr) minmax(150px,1fr) auto auto;gap:10px;align-items:center;padding:12px 14px;
  border:1px solid rgba(var(--primary-rgb,216,195,149),.22);border-left:3px solid var(--primary,#D8C395);background:rgba(0,0,0,.28)}
.up-item.admin{border-left-color:var(--accent,#FFD54A)}
.up-item b{display:block;color:var(--light,#fff);overflow-wrap:anywhere}
.up-item input[type=text],.up-item input[type=password]{min-height:40px;padding:9px 10px;border:1px solid rgba(var(--primary-rgb,216,195,149),.3);background:#0a0b10;color:#fff;font-size:15px}
.up-item input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary,#D8C395)}
.up-item small{display:block;margin-top:3px;color:var(--gray,#9a9a9a);font-size:.74rem}
.up-item input[type=text],.up-item input[type=password]{width:100%}
.up-chip{display:inline-block;margin:4px 0 0;padding:1px 7px;font-size:.6rem;font-weight:800;letter-spacing:.06em;vertical-align:middle;background:var(--accent,#FFD54A);color:#111}
.up-acc{display:flex;gap:6px;justify-content:flex-end}
.up-secs{grid-column:1/-1;margin-top:4px;padding:8px 10px;border:1px dashed rgba(var(--primary-rgb,216,195,149),.3)}
.up-secs summary{cursor:pointer;color:var(--gray,#9a9a9a);font-size:.82rem}
.up-secs summary b{color:var(--primary,#D8C395)}
.up-secs-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:6px 14px;margin-top:8px}
.up-secs-lista .chk{display:flex;align-items:center;gap:8px;font-size:.86rem}
.up-secs-lista i{width:16px;color:var(--primary,#D8C395);text-align:center}
.up-msg{min-height:1.2em;margin:10px 0 0;font-size:.88rem}
.up-vacio{padding:14px;color:var(--gray,#9a9a9a);text-align:center}
@media (max-width:760px){.up-item{grid-template-columns:1fr}.up-acc{justify-content:flex-start}}`;
    function estilos() {
        if (document.getElementById('pgUsuariosPortalCss')) return;
        const st = document.createElement('style'); st.id = 'pgUsuariosPortalCss'; st.textContent = CSS; document.head.appendChild(st);
    }

    function ocultar(cont) {
        const sec = cont.closest('.asc-panel') || cont.closest('section') || cont;   // en Pruebas es una pestaña, no la sección entera
        sec.hidden = true;
        document.querySelectorAll('a[href="#usuariosPortal"], [data-usuarios-portal]').forEach(a => { const li = a.closest('li') || a; li.hidden = true; });
    }

    async function montar(contId, portal) {
        const cont = document.getElementById(contId);
        if (!cont || !portal) return;
        estilos();
        aplicarSecciones(portal);
        let datos;
        try { datos = await P.usuariosPortal.listar(portal); }
        catch (e) {
            if (/No puedes manejar/i.test(e.message || '')) { ocultar(cont); return; }   // staff: no ve esta sección
            cont.innerHTML = `<p class="up-vacio">${esc(errorSql(e))}</p>`;
            return;
        }
        pintar(cont, portal, datos);
    }

    const cat = () => catalogo();
    const textoSecciones = l => !l || !l.length ? 'todas' : cat().filter(c => l.includes(c[0])).map(c => c[1].split(' (')[0]).join(', ') || 'ninguna';
    const checksSecciones = l => cat().map(([k, t, ic]) => `<label class="chk"><input type="checkbox" data-sec="${k}" ${!l || !l.length || l.includes(k) ? 'checked' : ''}><i class="fa-solid ${ic}"></i> ${t}</label>`).join('');
    // Todas marcadas = sin restricción (lista vacía)
    const seccionesDe = el => { const m = [...el.querySelectorAll('[data-sec]')]; const on = m.filter(i => i.checked).map(i => i.dataset.sec); return on.length === m.length ? [] : on; };

    function pintar(cont, portal, d) {
        const fila = (u, tipo) => `<div class="up-item${tipo === 'admin' ? ' admin' : ''}" data-u="${esc(u.usuario)}" data-tipo="${tipo}">
            <div><b>${esc(u.usuario)}</b>${tipo === 'admin' ? '<span class="up-chip">ADMIN</span>' : ''}<small>${tipo === 'admin' ? 'Administrador del portal' : 'Staff · solo este portal'}</small></div>
            <input type="text" data-c="nombre" value="${esc(u.nombre || '')}" aria-label="Nombre de ${esc(u.usuario)}" placeholder="Nombre">
            <input type="password" data-c="clave" autocomplete="new-password" aria-label="Nueva clave de ${esc(u.usuario)}" placeholder="Nueva clave (opcional)">
            <label class="chk"><input type="checkbox" data-c="activo" ${u.activo ? 'checked' : ''}> Activo</label>
            ${tipo === 'staff' ? `<details class="up-secs"><summary><i class="fa-solid fa-eye"></i> Secciones que ve: <b>${textoSecciones(u.secciones)}</b></summary>
                <div class="up-secs-lista">${checksSecciones(u.secciones)}</div></details>` : ''}
            <div class="up-acc">
                <button class="btn-mini" type="button" data-acc="guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                ${tipo === 'staff' || d.super ? `<button class="btn-mini" type="button" data-acc="borrar" aria-label="Borrar ${esc(u.usuario)}"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div></div>`;
        cont.innerHTML = `
            <p class="tool-desc">Usuarios de este portal: el <b>staff</b> solo entra aquí y no ve el panel principal ni otros portales.${d.super ? ' Como superadmin también puedes crear <b>administradores</b> del portal.' : ''}</p>
            <div class="up-form">
                <div class="form-group"><label>Usuario (sin @)</label><input data-n="usuario" autocapitalize="none" spellcheck="false" placeholder="staff.${esc(portal)}"></div>
                <div class="form-group"><label>Nombre</label><input data-n="nombre" placeholder="Nombre visible"></div>
                <div class="form-group"><label>Contraseña</label><input data-n="clave" type="password" autocomplete="new-password"></div>
                ${d.super ? `<div class="form-group"><label>Tipo</label><select data-n="tipo"><option value="staff">Staff del portal</option><option value="admin">Administrador del portal</option></select></div>` : ''}
                <div class="form-group"><button class="btn-access" type="button" data-n="crear"><i class="fa-solid fa-user-plus"></i> Crear usuario</button></div>
            </div>
            <details class="up-secs" data-n="secs" open><summary><i class="fa-solid fa-eye"></i> Secciones que verá el staff nuevo</summary>
                <div class="up-secs-lista">${checksSecciones([])}</div></details>
            <p class="up-msg" data-msg role="status"></p>
            ${d.super ? `<h3 class="subtitulo-bloque" style="margin-top:22px"><i class="fa-solid fa-user-tie"></i> Administradores (${d.admins.length})</h3>
                <div class="up-lista">${d.admins.length ? d.admins.map(u => fila(u, 'admin')).join('') : '<p class="up-vacio">Este portal aún no tiene administradores.</p>'}</div>` : ''}
            <h3 class="subtitulo-bloque" style="margin-top:22px"><i class="fa-solid fa-users"></i> Staff (${d.staff.length})</h3>
            <div class="up-lista">${d.staff.length ? d.staff.map(u => fila(u, 'staff')).join('') : '<p class="up-vacio">Todavía no hay staff en este portal.</p>'}</div>`;
        const msg = (t, c) => { const m = cont.querySelector('[data-msg]'); m.textContent = t; m.style.color = c || ''; };
        const n = k => cont.querySelector(`[data-n="${k}"]`);
        const recargar = async t => {
            try { pintar(cont, portal, await P.usuariosPortal.listar(portal)); if (t) msg(t, '#6ee7a8'); }
            catch (e) { msg(errorSql(e), '#ff8a8d'); }
        };
        n('crear').onclick = async () => {
            const u = { usuario: n('usuario').value.trim().toLowerCase(), nombre: n('nombre').value.trim(), clave: n('clave').value, activo: true, tipo: n('tipo') ? n('tipo').value : 'staff' };
            if (!/^[a-z0-9._-]{3,30}$/.test(u.usuario)) { msg('Usuario: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios).', '#ff8a8d'); return; }
            if ((u.clave || '').length < 6) { msg('La contraseña debe tener al menos 6 caracteres.', '#ff8a8d'); return; }
            n('crear').disabled = true;
            try {
                await P.usuariosPortal.guardar(portal, u);
                const secs = seccionesDe(n('secs'));
                if (u.tipo === 'staff' && secs.length) { try { await P.usuariosPortal.secciones(portal, u.usuario, secs); } catch (e) { msg('Usuario creado, pero sus secciones no se guardaron: ' + errorSql(e), '#FFD54A'); } }
                await recargar(`✔ Usuario ${u.usuario} creado.`);
            }
            catch (e) { msg(errorSql(e), '#ff8a8d'); n('crear').disabled = false; }
        };
        cont.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => {
            const item = b.closest('[data-u]'), usuario = item.dataset.u, tipo = item.dataset.tipo;
            const c = k => item.querySelector(`[data-c="${k}"]`);
            b.disabled = true;
            try {
                if (b.dataset.acc === 'borrar') {
                    if (!confirm(`¿Borrar al usuario "${usuario}"? Pierde el acceso al portal.`)) { b.disabled = false; return; }
                    await P.usuariosPortal.borrar(portal, usuario);
                    await recargar(`✔ Usuario ${usuario} borrado.`);
                } else {
                    await P.usuariosPortal.guardar(portal, { usuario, tipo, nombre: c('nombre').value.trim(), clave: c('clave').value || null, activo: c('activo').checked });
                    if (tipo === 'staff') await P.usuariosPortal.secciones(portal, usuario, seccionesDe(item));
                    await recargar(`✔ Usuario ${usuario} guardado.`);
                }
            } catch (e) { msg(errorSql(e), '#ff8a8d'); b.disabled = false; }
        });
    }

    window.PumasUsuariosPortal = { montar };
})();
