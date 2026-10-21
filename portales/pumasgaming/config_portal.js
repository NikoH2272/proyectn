/* =====================================================================
   Entrenos PROYECTN · Configuración del portal (sql/28)
   · Portal público: qué secciones ven los usuarios en /entrenamientos/
   · Usuarios de Pumas: staff que solo entra al panel de Pumas, con los
     módulos del panel que cada uno puede usar.
   · Permisos: al entrar al panel se esconden los módulos que el usuario no tiene.
   Lo usan el superadmin y los admins de Pumas (rol 'pumas').
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const errorSql = e => /pumas_|sitio_config|PGRST202|Could not find/i.test(e.message || '') ? 'Falta correr sql/28_pumas_portal_aparte.sql en Supabase.' : e.message;

    // Secciones del portal público (/entrenamientos/)
    const SECCIONES = [
        ['apartar_cupo', 'Apartar cupo', 'Enlace del menú a la página de cupos', 'fa-ticket'],
        ['calendario', 'Calendario e historial', 'Calendario de entrenos y sesiones', 'fa-calendar-days'],
        ['equipos', 'Tabla general de equipos', 'Ranking de equipos', 'fa-table'],
        ['killers', 'Top killers', 'Jugadores con más kills', 'fa-skull'],
        ['top100', 'Top 100', 'Ranking de jugadores', 'fa-ranking-star'],
        ['destacados', 'Destacados', 'Destacados del entreno', 'fa-star'],
        ['analisis', 'Análisis de entrenos', 'Pestaña con estadísticas avanzadas', 'fa-chart-simple'],
        ['vip', 'Resultados equipos VIP', 'Pestaña de resultados VIP', 'fa-shield-halved']
    ];
    // Módulos del panel (los mismos de la navegación del admin)
    const MODULOS = [
        ['cargar', 'Cargar', 'fa-file-lines'], ['cargarStats', 'Cargar con estadísticas', 'fa-chart-simple'], ['generarCsv', 'Generar CSV', 'fa-file-csv'],
        ['resultadosOficiales', 'VIP · Oficiales', 'fa-shield-halved'], ['registrarVip', 'VIP · Registrar VIP', 'fa-user-plus'],
        ['borrarEntrenos', 'Borrar', 'fa-trash-can'], ['metricas', 'Métricas', 'fa-chart-pie'],
        ['programar', 'Cupos · Programar', 'fa-calendar-plus'], ['cuposVip', 'Cupos · VIP', 'fa-crown'], ['baneados', 'Cupos · Baneados', 'fa-ban'],
        ['caidas', 'Caídas', 'fa-parachute-box']
    ];

    const CSS = `
.pc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.pc-tab{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid rgba(216,195,149,.35);border-radius:3px;background:transparent;color:#D8C395;font:700 .7rem 'Michroma',sans-serif;letter-spacing:.05em;cursor:pointer}
.pc-tab.on{background:#D8C395;color:#0a0b10}
.pc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:10px}
.pc-sw{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(216,195,149,.22);border-radius:6px;background:rgba(0,0,0,.3);cursor:pointer}
.pc-sw input{width:20px;height:20px;accent-color:#D8C395;flex-shrink:0}
.pc-sw i{width:22px;color:#D8C395;text-align:center}
.pc-sw b{display:block;color:#fff;font-size:.92rem}.pc-sw small{display:block;color:#9a9a9a;font-size:.76rem}
.pc-sw.off{opacity:.55}
.pc-pie{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-top:16px}
.pc-msg{font-size:.88rem}
.pc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;align-items:end}
.pc-form input{width:100%;background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:3px;padding:11px 12px;font-size:15px}
.pc-usr{margin-top:12px;padding:14px;border:1px solid rgba(216,195,149,.2);border-radius:6px;background:rgba(0,0,0,.3)}
.pc-usr-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.pc-usr-top b{color:#fff;font-size:1rem}
.pc-usr .pc-form{margin-bottom:10px}
.pc-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:6px}
.pc-mods label{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#ddd;font-size:.85rem;cursor:pointer}
.pc-mods input{width:18px;height:18px;accent-color:#D8C395}
.pc-mods i{width:16px;color:#D8C395;text-align:center}
.pc-acc{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pc-vacio{padding:16px;color:#9a9a9a;text-align:center}`;
    function estilos() {
        if (document.getElementById('pgPumasConfigCss')) return;
        const st = document.createElement('style'); st.id = 'pgPumasConfigCss'; st.textContent = CSS; document.head.appendChild(st);
    }
    const checksModulos = (sel, todos) => MODULOS.map(([id, txt, ic]) => `<label><input type="checkbox" data-mod="${id}" ${todos || (sel || []).includes(id) ? 'checked' : ''}><i class="fa-solid ${ic}"></i>${txt}</label>`).join('');

    async function montar(contId) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        estilos();
        cont.innerHTML = `<div class="pc-tabs">
                <button type="button" class="pc-tab on" data-pc="portal"><i class="fa-solid fa-eye"></i> Portal público</button>
                <button type="button" class="pc-tab" data-pc="usuarios"><i class="fa-solid fa-users-gear"></i> Usuarios de Pumas</button></div>
            <div data-panel="portal"></div><div data-panel="usuarios" hidden></div>`;
        cont.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
            cont.querySelectorAll('[data-pc]').forEach(x => x.classList.toggle('on', x === b));
            cont.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.pc; });
        });
        pintarPortal(cont.querySelector('[data-panel="portal"]'));
        pintarUsuarios(cont.querySelector('[data-panel="usuarios"]'));
    }

    /* ---------------- Portal público ---------------- */
    async function pintarPortal(caja) {
        caja.innerHTML = '<p class="pc-vacio">Cargando...</p>';
        let cfg;
        try { cfg = await P.pumas.portal(); } catch (e) { cfg = { ocultos: [] }; }
        const ocultos = new Set(cfg.ocultos || []);
        caja.innerHTML = `<p class="tool-desc">Marca lo que ven los usuarios en el portal público de Entrenos PROYECTN (<a href="./" target="_blank" style="color:#D8C395">/entrenamientos/</a>). Lo que desmarques deja de mostrarse para todos.</p>
            <div class="pc-grid">${SECCIONES.map(([id, txt, det, ic]) => `<label class="pc-sw${ocultos.has(id) ? ' off' : ''}">
                <input type="checkbox" data-sec="${id}" ${ocultos.has(id) ? '' : 'checked'}><i class="fa-solid ${ic}"></i><span><b>${txt}</b><small>${det}</small></span></label>`).join('')}</div>
            <div class="pc-pie"><span class="pc-msg" data-msg role="status"></span>
                <button class="btn-generar" type="button" data-guardar style="max-width:320px"><i class="fa-solid fa-floppy-disk"></i> Guardar portal</button></div>`;
        caja.querySelectorAll('[data-sec]').forEach(i => i.addEventListener('change', () => i.closest('.pc-sw').classList.toggle('off', !i.checked)));
        caja.querySelector('[data-guardar]').onclick = async () => {
            const msg = caja.querySelector('[data-msg]');
            const lista = [...caja.querySelectorAll('[data-sec]')].filter(i => !i.checked).map(i => i.dataset.sec);
            msg.textContent = 'Guardando...'; msg.style.color = '';
            try { await P.pumas.guardarPortal(lista); msg.textContent = '✔ Guardado. El portal ya muestra solo lo marcado.'; msg.style.color = '#6ee7a8'; }
            catch (e) { msg.textContent = errorSql(e); msg.style.color = '#ff8a8d'; }
        };
    }

    /* ---------------- Usuarios de Pumas ---------------- */
    async function pintarUsuarios(caja) {
        caja.innerHTML = `<p class="tool-desc">Usuarios del staff de Pumas: <b>solo entran a este panel</b> (no ven el panel principal ni otros portales) y solo a los módulos que les marques.</p>
            <div class="pc-usr"><div class="pc-usr-top"><b><i class="fa-solid fa-user-plus"></i> Nuevo usuario</b></div>
                <div class="pc-form">
                    <div class="form-group"><label>Usuario (sin @)</label><input data-n="usuario" autocapitalize="none" spellcheck="false" placeholder="staff.niko"></div>
                    <div class="form-group"><label>Nombre</label><input data-n="nombre" placeholder="Staff Niko"></div>
                    <div class="form-group"><label>Contraseña</label><input data-n="clave" type="password" autocomplete="new-password"></div>
                </div>
                <div class="pc-mods" data-n="mods">${checksModulos(['cargar'])}</div>
                <div class="pc-acc"><button class="btn-generar" type="button" data-n="crear" style="max-width:320px"><i class="fa-solid fa-user-plus"></i> Crear usuario</button></div>
            </div>
            <p class="pc-msg" data-msg role="status" style="margin-top:10px"></p>
            <div data-lista><p class="pc-vacio">Cargando usuarios...</p></div>`;
        const msg = (t, c) => { const m = caja.querySelector('[data-msg]'); m.textContent = t; m.style.color = c || ''; };
        const n = k => caja.querySelector(`[data-n="${k}"]`);
        const modsDe = el => [...el.querySelectorAll('[data-mod]:checked')].map(i => i.dataset.mod);

        async function lista() {
            const cont = caja.querySelector('[data-lista]');
            let us;
            try { us = await P.pumas.usuarios.listar(); } catch (e) { cont.innerHTML = `<p class="pc-vacio">${esc(errorSql(e))}</p>`; return; }
            if (!us.length) { cont.innerHTML = '<p class="pc-vacio">Todavía no hay usuarios de staff.</p>'; return; }
            cont.innerHTML = us.map(u => `<div class="pc-usr" data-u="${esc(u.usuario)}">
                <div class="pc-usr-top"><b><i class="fa-solid fa-user"></i> ${esc(u.usuario)}</b>
                    <label class="pc-sw" style="padding:6px 10px"><input type="checkbox" data-c="activo" ${u.activo ? 'checked' : ''}><span><b style="font-size:.8rem">Activo</b></span></label></div>
                <div class="pc-form">
                    <div class="form-group"><label>Nombre</label><input data-c="nombre" value="${esc(u.nombre || '')}"></div>
                    <div class="form-group"><label>Nueva clave (opcional)</label><input data-c="clave" type="password" autocomplete="new-password"></div>
                </div>
                <div class="pc-mods">${checksModulos(u.modulos)}</div>
                <div class="pc-acc"><button class="btn-mini" type="button" data-acc="guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                    <button class="btn-mini peligro" type="button" data-acc="borrar"><i class="fa-solid fa-trash"></i> Borrar</button></div></div>`).join('');
            cont.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => {
                const tarjeta = b.closest('[data-u]'), usuario = tarjeta.dataset.u;
                const c = k => tarjeta.querySelector(`[data-c="${k}"]`);
                try {
                    if (b.dataset.acc === 'borrar') {
                        if (!confirm(`¿Borrar al usuario "${usuario}"? Pierde el acceso al panel de Pumas.`)) return;
                        await P.pumas.usuarios.borrar(usuario);
                        msg(`✔ Usuario ${usuario} borrado.`, '#6ee7a8');
                    } else {
                        const mods = modsDe(tarjeta);
                        if (!mods.length) { msg('Marca al menos un módulo.', '#ff8a8d'); return; }
                        await P.pumas.usuarios.guardar({ usuario, nombre: c('nombre').value.trim(), clave: c('clave').value || null, activo: c('activo').checked, modulos: mods });
                        msg(`✔ Usuario ${usuario} guardado.`, '#6ee7a8');
                    }
                    lista();
                } catch (e) { msg(errorSql(e), '#ff8a8d'); }
            });
        }
        n('crear').onclick = async () => {
            const u = { usuario: n('usuario').value.trim().toLowerCase(), nombre: n('nombre').value.trim(), clave: n('clave').value, activo: true, modulos: modsDe(n('mods')) };
            if (!/^[a-z0-9._-]{3,30}$/.test(u.usuario)) { msg('Usuario: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios).', '#ff8a8d'); return; }
            if ((u.clave || '').length < 6) { msg('La contraseña debe tener al menos 6 caracteres.', '#ff8a8d'); return; }
            if (!u.modulos.length) { msg('Marca al menos un módulo.', '#ff8a8d'); return; }
            try {
                await P.pumas.usuarios.guardar(u);
                ['usuario', 'nombre', 'clave'].forEach(k => { n(k).value = ''; });
                msg(`✔ Usuario ${u.usuario} creado. Entra por /entrenamientos/login.html`, '#6ee7a8');
                lista();
            } catch (e) { msg(errorSql(e), '#ff8a8d'); }
        };
        lista();
    }

    /* ---------------- Permisos al entrar al panel ---------------- */
    // pestanas: el mapa PESTANAS del admin · abrir(id): cambia de pestaña
    async function aplicarPermisos(pestanas, abrir) {
        let p;
        try { p = await P.pumas.misPermisos(); } catch (e) { return; }   // sin sql/28: todo queda como antes
        const navConfig = document.getElementById('navConfigLi');
        if (navConfig) navConfig.hidden = !p.jefe;
        if (!Array.isArray(p.modulos)) return;                         // jefes: todo
        const permitidos = new Set(p.modulos);
        Object.entries(pestanas).forEach(([id, def]) => {
            if (id === 'config' || permitidos.has(id)) return;
            const a = document.getElementById(def.nav);
            if (a && a.closest('li')) a.closest('li').hidden = true;
        });
        // Grupos (CARGAR ▾, VIP ▾, Programar Cupos ▾) sin nada visible: fuera
        document.querySelectorAll('.nav-grupo').forEach(g => { g.hidden = !g.querySelector('.nav-sub li:not([hidden])'); });
        // El staff no puede vaciar la base
        const limpiar = document.querySelector('[onclick^="limpiarBaseDeDatosCompletamente"]');
        if (limpiar) limpiar.closest('div').hidden = true;
        const primero = MODULOS.map(m => m[0]).find(id => permitidos.has(id));
        if (primero) abrir(primero);
        else document.querySelectorAll('section.tool-section').forEach(s => { s.style.display = 'none'; });
    }

    window.PumasConfig = { montar, aplicarPermisos, SECCIONES };
})();
