/* Gestión de usuarios y roles. Solo roles con permiso "gestionar".
   Necesita <main id="gestionUsuarios"> y portal.js cargado antes. */
(function () {
    const raiz = document.getElementById('gestionUsuarios');
    const loginUrl = raiz.dataset.login || 'login.html';
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    document.documentElement.classList.add('pg-verificando');

    let datos = { usuarios: [], roles: [], portales: [] };
    let yo = null;
    let vista = 'principal';   // 'principal' · 'aza'

    // Ascensos AZA es un portal aparte: sus roles (solo ven ese portal) y sus usuarios
    // (admins y moderadores creados allá) NO salen en el panel principal: se manejan en su propia ventana.
    const esRolAza = r => !!r && Array.isArray(r.portales) && r.portales.length === 1 && r.portales[0] === 'ascensosaza';
    // Entrenos PROYECTN también es aparte: su staff (rol que solo ve 'entrenamientos') se maneja en su propia ventana
    const esRolPumas = r => !!r && Array.isArray(r.portales) && r.portales.length === 1 && r.portales[0] === 'entrenamientos';
    const esRolStaff = r => !!r && /^staff_/.test(r.id);
    const esRolAparte = r => esRolAza(r) || esRolPumas(r) || esRolStaff(r);
    let portalElegido = '';
    const nombreEvento = id => { const c = window.ASC_CATEGORIA && window.ASC_CATEGORIA(id); return c ? c.nombre : id; };

    async function arrancar() {
        yo = await P.guard('principal', loginUrl, 'gestionar');
        if (!yo) return;
        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = yo.nombre || yo.usuario; });
        document.querySelectorAll('[data-pg-salir]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); P.logout(loginUrl); }));
        await recargar();
    }

    async function recargar(mensaje) {
        try {
            datos = await P.usuarios.listar();
            pintar();
            if (mensaje) avisar(mensaje, true);
        } catch (err) {
            raiz.innerHTML = `<p class="tool-desc">No se pudo cargar: ${esc(err.message)}</p>`;
        }
    }

    function avisar(t, ok) {
        const n = document.getElementById('gestionMsg');
        n.textContent = t;
        n.className = 'auth-msg' + (ok ? ' ok' : '');
    }

    async function ejecutar(btn, accion, exito) {
        btn.disabled = true;
        avisar('Guardando...', true);
        try { await accion(); await recargar(exito); }
        catch (err) { avisar('Error: ' + err.message); btn.disabled = false; }
    }

    const opcionesRol = (sel, soloAza) => datos.roles.filter(r => soloAza ? esRolAza(r) && r.id !== 'moderador_aza' : !esRolAparte(r) || r.id === sel).map(r =>
        `<option value="${esc(r.id)}" ${r.id === sel ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('');

    function checksPortales(r) {
        const lista = r.portales || [];
        const todos = lista.includes('*');
        return `<label class="chk"><input type="checkbox" value="*" ${todos ? 'checked' : ''}> <b>Todos</b></label>` +
            datos.portales.map(p => `<label class="chk"><input type="checkbox" value="${esc(p.id)}" ${lista.includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)}</label>`).join('');
    }

    function pintar() {
        const rolesAza = new Set(datos.roles.filter(esRolAza).map(r => r.id));
        const rolesPumas = new Set(datos.roles.filter(esRolPumas).map(r => r.id));
        const nPumas = datos.usuarios.filter(u => rolesPumas.has(u.rol)).length;
        const usuariosAza = datos.usuarios.filter(u => rolesAza.has(u.rol));
        const filaUsuario = (u, soloAza) => `
            <tr data-usuario="${esc(u.usuario)}">
                <td><b>${esc(u.usuario)}</b>${u.usuario === yo.usuario ? ' <small class="muted">(tú)</small>' : ''}</td>
                <td><input type="text" data-campo="nombre" value="${esc(u.nombre || '')}" aria-label="Nombre de ${esc(u.usuario)}"></td>
                <td><select data-campo="rol" aria-label="Rol de ${esc(u.usuario)}">${u.rol ? '' : '<option value="">— sin rol —</option>'}${opcionesRol(u.rol, soloAza)}</select></td>
                <td style="text-align:center"><input type="checkbox" data-campo="activo" ${u.activo ? 'checked' : ''} aria-label="Activo"></td>
                <td><input type="password" data-campo="clave" placeholder="Nueva clave (opcional)" autocomplete="new-password" aria-label="Nueva clave de ${esc(u.usuario)}"></td>
                <td><button class="btn-mini" data-accion="guardar-usuario"><i class="fa-solid fa-floppy-disk"></i> Guardar</button></td>
            </tr>`;
        const rolesStaff = new Set(datos.roles.filter(esRolStaff).map(r => r.id));
        const filasUsuarios = datos.usuarios.filter(u => !rolesAza.has(u.rol) && !rolesPumas.has(u.rol) && !rolesStaff.has(u.rol)).map(u => filaUsuario(u)).join('');
        // En la ventana de AZA: sus admins (los moderadores van en su propia tabla)
        const filasAdminsAza = usuariosAza.filter(u => u.rol !== 'moderador_aza').map(u => filaUsuario(u, true)).join('');

        // Roles padre primero y cada sub rol justo debajo de su padre
        const nombreRol = id => (datos.roles.find(x => x.id === id) || { nombre: id }).nombre;
        const ordenados = datos.roles.filter(r => !r.padre || !datos.roles.some(x => x.id === r.padre))
            .flatMap(r => [r, ...datos.roles.filter(h => h.padre === r.id)]);
        const opcionesPadre = r => `<option value="">— Rol principal —</option>` + datos.roles.filter(x => x.id !== r.id && x.padre !== r.id)
            .map(x => `<option value="${esc(x.id)}" ${x.id === r.padre ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
        const tarjeta = r => `
            <article class="card-box rol-card${r.padre ? ' sub-rol' : ''}" data-rol="${esc(r.id)}" data-padre="${esc(r.padre || '')}">
                <div class="rol-head"><code>${esc(r.id)}</code><small class="muted">${r.usuarios} usuario(s)</small></div>
                ${r.padre ? `<p class="muted" style="margin:-4px 0 8px"><i class="fa-solid fa-turn-up fa-rotate-90"></i> Sub rol de <b>${esc(nombreRol(r.padre))}</b></p>` : ''}
                ${datos.roles.some(h => h.padre === r.id) ? `<p class="muted" style="margin:-4px 0 8px"><i class="fa-solid fa-sitemap"></i> Sub roles: ${datos.roles.filter(h => h.padre === r.id).map(h => esc(h.nombre)).join(', ')}</p>` : ''}
                <div class="form-group"><label>Nombre</label><input type="text" data-campo="nombre" value="${esc(r.nombre)}"></div>
                <div class="form-group"><label>Portales que puede ver</label><div class="chks" data-campo="portales">${checksPortales(r)}</div></div>
                ${'padre' in r ? `<div class="form-group"><label>Sub rol de</label><select data-campo="padre">${opcionesPadre(r)}</select></div>` : ''}
                <div class="chks">
                    <label class="chk"><input type="checkbox" data-campo="personalizar" ${r.personalizar ? 'checked' : ''}> Personalizar efecto</label>
                    <label class="chk"><input type="checkbox" data-campo="gestionar" ${r.gestionar ? 'checked' : ''}> Gestionar usuarios y roles</label>
                </div>
                <div class="acciones">
                    <button class="btn-mini" data-accion="guardar-rol"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                    ${r.id !== 'superadmin' && !r.usuarios ? '<button class="btn-mini" data-accion="eliminar-rol"><i class="fa-solid fa-trash"></i> Borrar</button>' : ''}
                </div>
            </article>`;
        const tarjetasRoles = ordenados.filter(r => !rolesAza.has(r.id) && !rolesPumas.has(r.id) && !rolesStaff.has(r.id)).map(tarjeta).join('');
        const portalesLista = (datos.portales || []).filter(p => p.id !== 'principal');
        const tarjetasAza = ordenados.filter(r => rolesAza.has(r.id)).map(tarjeta).join('');
        const nMods = usuariosAza.filter(u => u.rol === 'moderador_aza').length;

        raiz.innerHTML = `
        <p id="gestionMsg" class="auth-msg" role="status" style="text-align:center"></p>

        <div class="us-tabs" role="tablist">
            <button type="button" class="us-tab${vista === 'principal' ? ' on' : ''}" data-vista-btn="principal"><i class="fa-solid fa-users"></i> Panel principal</button>
            <button type="button" class="us-tab${vista === 'aza' ? ' on' : ''}" data-vista-btn="aza"><i class="fa-solid fa-wand-magic-sparkles"></i> Ascensos AZA · subusuarios <b>${usuariosAza.length}</b></button>
            <button type="button" class="us-tab${vista === 'pumas' ? ' on' : ''}" data-vista-btn="pumas"><i class="fa-solid fa-paw"></i> Entrenos PROYECTN · subusuarios <b>${nPumas}</b></button>
            <button type="button" class="us-tab${vista === 'portales' ? ' on' : ''}" data-vista-btn="portales"><i class="fa-solid fa-sitemap"></i> Usuarios por portal</button>
        </div>

        <div data-vista="principal"${vista === 'principal' ? '' : ' hidden'}>

        <h3 class="bloque-titulo"><i class="fa-solid fa-users"></i> Usuarios</h3>
        <article class="card-box">
            <form id="formNuevoUsuario" class="form-grid nuevo">
                <div class="form-group"><label for="nuUsuario">Usuario (sin @)</label><input id="nuUsuario" required autocapitalize="none" spellcheck="false" placeholder="adminliga" pattern="[a-zA-Z0-9._\\-]{3,30}"></div>
                <div class="form-group"><label for="nuNombre">Nombre</label><input id="nuNombre" placeholder="Admin Liga"></div>
                <div class="form-group"><label for="nuRol">Rol</label><select id="nuRol" required>${opcionesRol()}</select></div>
                <div class="form-group"><label for="nuClave">Contraseña</label><input id="nuClave" type="password" required minlength="6" autocomplete="new-password"></div>
                <div class="form-group"><label>&nbsp;</label><button class="btn-access" type="submit" style="width:100%"><i class="fa-solid fa-user-plus"></i> Crear</button></div>
            </form>
            <div class="pg-tabla-wrap" style="margin-top:18px">
                <table class="pg-tabla tabla-usuarios">
                    <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th>Cambiar clave</th><th></th></tr></thead>
                    <tbody>${filasUsuarios}</tbody>
                </table>
            </div>
        </article>

        <h3 class="bloque-titulo"><i class="fa-solid fa-id-badge"></i> Roles</h3>
        <div class="roles-grid">
            ${tarjetasRoles}
            <article class="card-box rol-card nuevo-rol" data-rol="">
                <div class="rol-head"><b>Nuevo rol</b></div>
                <div class="form-group"><label>Código (sin espacios)</label><input type="text" data-campo="id" placeholder="liga_staff"></div>
                <div class="form-group"><label>Nombre</label><input type="text" data-campo="nombre" placeholder="Staff de liga"></div>
                <div class="form-group"><label>Portales que puede ver</label><div class="chks" data-campo="portales">${checksPortales({ portales: [] })}</div></div>
                <div class="chks">
                    <label class="chk"><input type="checkbox" data-campo="personalizar"> Personalizar efecto</label>
                    <label class="chk"><input type="checkbox" data-campo="gestionar"> Gestionar usuarios y roles</label>
                </div>
                <div class="acciones"><button class="btn-mini" data-accion="guardar-rol"><i class="fa-solid fa-plus"></i> Crear rol</button></div>
            </article>
        </div>
        </div>

        <div data-vista="portales"${vista === 'portales' ? '' : ' hidden'}>
            <p class="tool-desc">Elige un portal para ver sus usuarios, crear su <b>administrador</b> o su <b>staff</b>. El staff solo entra a ese portal; el admin del portal maneja a su staff desde su propio panel.</p>
            <div class="form-group" style="max-width:420px;margin:0 auto 18px">
                <label for="usPortal">Portal</label>
                <select id="usPortal"><option value="">— Elige un portal —</option>${portalesLista.map(p => `<option value="${esc(p.id)}" ${p.id === portalElegido ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
            </div>
            <div class="card-box" style="max-width:1180px;margin:0 auto"><div id="usPortalCaja"><p class="muted" style="text-align:center">Elige un portal.</p></div></div>
        </div>

        <div data-vista="pumas"${vista === 'pumas' ? '' : ' hidden'}>
            <p class="tool-desc">Entrenos PROYECTN es un portal aparte: su staff <b>solo entra al panel de Pumas</b>, a los módulos que le habiliten.
                Esto mismo lo tienen los admins de Pumas en <a href="/entrenamientos/admin.html" style="color:var(--primary)">Admin Pumas → Configuración</a>.</p>
            <div class="card-box" style="max-width:1180px;margin:0 auto"><div id="pumasConfigSuper"><p class="muted" style="text-align:center">Cargando...</p></div></div>
        </div>

        <div data-vista="aza"${vista === 'aza' ? '' : ' hidden'}>
            <p class="tool-desc">Ascensos AZA es un portal aparte: sus usuarios <b>solo entran a ese portal</b> y no ven el panel principal ni otros portales.
                Aquí, solo desde el superadmin, ves y manejas a todos (admins de AZA y los moderadores que ellos crean).</p>

            <h3 class="bloque-titulo"><i class="fa-solid fa-user-tie"></i> Admins de Ascensos AZA</h3>
            <article class="card-box">
                <form id="formNuevoAza" class="form-grid nuevo">
                    <div class="form-group"><label for="azUsuario">Usuario (sin @)</label><input id="azUsuario" required autocapitalize="none" spellcheck="false" placeholder="adminaza2" pattern="[a-zA-Z0-9._\\-]{3,30}"></div>
                    <div class="form-group"><label for="azNombre">Nombre</label><input id="azNombre" placeholder="Admin AZA"></div>
                    <div class="form-group"><label for="azRol">Rol</label><select id="azRol" required>${opcionesRol(undefined, true)}</select></div>
                    <div class="form-group"><label for="azClave">Contraseña</label><input id="azClave" type="password" required minlength="6" autocomplete="new-password"></div>
                    <div class="form-group"><label>&nbsp;</label><button class="btn-access" type="submit" style="width:100%"><i class="fa-solid fa-user-plus"></i> Crear</button></div>
                </form>
                <div class="pg-tabla-wrap" style="margin-top:18px">
                    <table class="pg-tabla tabla-usuarios">
                        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th>Cambiar clave</th><th></th></tr></thead>
                        <tbody>${filasAdminsAza || '<tr><td colspan="6" class="muted" style="text-align:center">Sin admins de AZA.</td></tr>'}</tbody>
                    </table>
                </div>
            </article>

            <h3 class="bloque-titulo"><i class="fa-solid fa-user-shield"></i> Moderadores de Ascensos AZA <small class="muted">(${nMods})</small></h3>
            <article class="card-box">
                <form id="formNuevoMod" class="form-grid nuevo">
                    <div class="form-group"><label for="moUsuario">Usuario (sin @)</label><input id="moUsuario" required autocapitalize="none" spellcheck="false" placeholder="mod.aza1" pattern="[a-zA-Z0-9._\\-]{3,30}"></div>
                    <div class="form-group"><label for="moNombre">Nombre</label><input id="moNombre" placeholder="Mod AZA"></div>
                    <div class="form-group"><label for="moClave">Contraseña</label><input id="moClave" type="password" required minlength="6" autocomplete="new-password"></div>
                    <div class="form-group"><label class="chk" style="margin-top:28px"><input type="checkbox" id="moIa"> Puede usar IA</label></div>
                    <div class="form-group"><label>&nbsp;</label><button class="btn-access" type="submit" style="width:100%"><i class="fa-solid fa-user-plus"></i> Crear moderador</button></div>
                </form>
                <div id="tablaMods" style="margin-top:18px"><p class="muted" style="text-align:center">Cargando moderadores...</p></div>
            </article>

            <h3 class="bloque-titulo"><i class="fa-solid fa-id-badge"></i> Roles de Ascensos AZA</h3>
            <div class="roles-grid">${tarjetasAza || '<p class="muted">No hay roles solo de AZA.</p>'}</div>
        </div>`;

        raiz.querySelectorAll('[data-vista-btn]').forEach(b => b.addEventListener('click', () => {
            vista = b.dataset.vistaBtn;
            raiz.querySelectorAll('[data-vista-btn]').forEach(x => x.classList.toggle('on', x === b));
            raiz.querySelectorAll('[data-vista]').forEach(v => { v.hidden = v.dataset.vista !== vista; });
            if (vista === 'pumas') montarPumas();
        }));
        if (vista === 'pumas') montarPumas();
        const selPortal = raiz.querySelector('#usPortal');
        selPortal.addEventListener('change', () => { portalElegido = selPortal.value; montarPortal(); });
        if (portalElegido) montarPortal();
        raiz.querySelector('#formNuevoAza').addEventListener('submit', e => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const u = { usuario: raiz.querySelector('#azUsuario').value.trim().toLowerCase(), nombre: raiz.querySelector('#azNombre').value.trim(),
                rol: raiz.querySelector('#azRol').value, clave: raiz.querySelector('#azClave').value };
            if (!u.rol) { avisar('No hay un rol de AZA para asignar.'); return; }
            if (datos.usuarios.some(x => x.usuario.toLowerCase() === u.usuario)) { avisar('Ese usuario ya existe.'); return; }
            ejecutar(btn, () => P.usuarios.guardarUsuario(u), `Usuario ${u.usuario} creado en Ascensos AZA.`);
        });
        raiz.querySelector('#formNuevoMod').addEventListener('submit', e => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const m = { usuario: raiz.querySelector('#moUsuario').value.trim().toLowerCase(), nombre: raiz.querySelector('#moNombre').value.trim(),
                clave: raiz.querySelector('#moClave').value, ia: raiz.querySelector('#moIa').checked, activo: true, eventos: null };
            if (datos.usuarios.some(x => x.usuario.toLowerCase() === m.usuario)) { avisar('Ese usuario ya existe.'); return; }
            ejecutar(btn, () => P.ascensos.moderadores.guardar(m), `Moderador ${m.usuario} creado.`);
        });
        pintarModeradores();

        raiz.querySelector('#formNuevoUsuario').addEventListener('submit', e => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const u = {
                usuario: raiz.querySelector('#nuUsuario').value.trim().toLowerCase(),
                nombre: raiz.querySelector('#nuNombre').value.trim(),
                rol: raiz.querySelector('#nuRol').value,
                clave: raiz.querySelector('#nuClave').value
            };
            if (datos.usuarios.some(x => x.usuario.toLowerCase() === u.usuario)) { avisar('Ese usuario ya existe: edítalo en la tabla.'); return; }
            ejecutar(btn, () => P.usuarios.guardarUsuario(u), `Usuario ${u.usuario} creado.`);
        });

        raiz.querySelectorAll('[data-accion="guardar-usuario"]').forEach(btn => btn.addEventListener('click', () => {
            const fila = btn.closest('tr');
            const campo = c => fila.querySelector(`[data-campo="${c}"]`);
            const u = {
                usuario: fila.dataset.usuario,
                nombre: campo('nombre').value.trim(),
                rol: campo('rol').value,
                activo: campo('activo').checked,
                clave: campo('clave').value
            };
            if (!u.rol) { avisar('Elige un rol.'); return; }
            ejecutar(btn, () => P.usuarios.guardarUsuario(u), `Usuario ${u.usuario} actualizado${u.clave ? ' (clave cambiada)' : ''}.`);
        }));

        raiz.querySelectorAll('[data-accion="guardar-rol"]').forEach(btn => btn.addEventListener('click', () => {
            const card = btn.closest('.rol-card');
            const campo = c => card.querySelector(`[data-campo="${c}"]`);
            const r = {
                id: card.dataset.rol || campo('id').value.trim().toLowerCase(),
                nombre: campo('nombre').value.trim(),
                portales: [...campo('portales').querySelectorAll('input:checked')].map(i => i.value),
                personalizar: campo('personalizar').checked,
                gestionar: campo('gestionar').checked
            };
            if (r.portales.includes('*')) r.portales = ['*'];
            if (!card.dataset.rol && datos.roles.some(x => x.id === r.id)) { avisar('Ya existe un rol con ese código.'); return; }
            const padre = campo('padre') ? campo('padre').value : null;
            ejecutar(btn, async () => {
                await P.usuarios.guardarRol(r);
                if (padre !== null && padre !== (card.dataset.padre || '')) await P.usuarios.padreRol(r.id, padre);
            }, `Rol ${r.id} guardado.`);
        }));

        raiz.querySelectorAll('[data-accion="eliminar-rol"]').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.closest('.rol-card').dataset.rol;
            if (!confirm(`¿Borrar el rol "${id}"?`)) return;
            ejecutar(btn, () => P.usuarios.eliminarRol(id), `Rol ${id} borrado.`);
        }));
    }

    // Usuarios de un portal (sql/31). Pumas tiene además los módulos por usuario; AZA, sus moderadores.
    function montarPortal() {
        const caja = raiz.querySelector('#usPortalCaja');
        if (!caja) return;
        if (!portalElegido) { caja.innerHTML = '<p class="muted" style="text-align:center">Elige un portal.</p>'; return; }
        const aviso = portalElegido === 'entrenamientos'
            ? '<p class="muted" style="margin:0 0 12px"><i class="fa-solid fa-circle-info"></i> Los módulos que puede usar cada staff de Pumas se eligen en la pestaña <b>Entrenos PROYECTN · subusuarios</b>.</p>'
            : portalElegido === 'ascensosaza'
            ? '<p class="muted" style="margin:0 0 12px"><i class="fa-solid fa-circle-info"></i> Los moderadores de AZA (con sus eventos e IA) se manejan en la pestaña <b>Ascensos AZA · subusuarios</b>.</p>' : '';
        caja.innerHTML = aviso + '<div id="usPortalUsuarios"><p class="muted" style="text-align:center">Cargando...</p></div>';
        if (window.PumasUsuariosPortal) window.PumasUsuariosPortal.montar('usPortalUsuarios', portalElegido);
        else caja.innerHTML = '<p class="muted" style="text-align:center">No se pudo cargar el módulo de usuarios por portal.</p>';
    }

    function montarPumas() {
        const caja = raiz.querySelector('#pumasConfigSuper');
        if (!caja || caja.dataset.listo) return;
        caja.dataset.listo = '1';
        if (window.PumasConfig) window.PumasConfig.montar('pumasConfigSuper');
        else caja.innerHTML = '<p class="muted" style="text-align:center">No se pudo cargar la configuración de PROYECTN.</p>';
    }

    async function pintarModeradores() {
        const caja = raiz.querySelector('#tablaMods');
        if (!caja) return;
        let mods;
        try { mods = await P.ascensos.moderadores.listar(); }
        catch (e) { caja.innerHTML = `<p class="muted" style="text-align:center">${esc(P.faltaSql(e) ? 'Falta correr sql/19 a sql/20 en Supabase.' : e.message)}</p>`; return; }
        if (!mods.length) { caja.innerHTML = '<p class="muted" style="text-align:center">Todavía no hay moderadores.</p>'; return; }
        const cats = window.ASC_CATEGORIAS || [];
        const eventosHtml = m => `<details class="us-eventos"><summary>${m.eventos ? m.eventos.length + ' evento(s)' : 'Todos los eventos'}</summary>
            <label class="chk"><input type="checkbox" data-todos ${m.eventos ? '' : 'checked'}> <b>Todos</b></label>
            ${cats.map(c => `<label class="chk"><input type="checkbox" data-ev="${esc(c.id)}" ${!m.eventos || m.eventos.includes(c.id) ? 'checked' : ''}> ${esc(c.nombre)}</label>`).join('')}</details>`;
        caja.innerHTML = `<div class="pg-tabla-wrap"><table class="pg-tabla tabla-usuarios">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Activo</th><th>IA</th><th>Eventos que puede cargar</th><th>Cambiar clave</th><th></th></tr></thead>
            <tbody>${mods.map(m => `<tr data-mod="${esc(m.usuario)}">
                <td><b>${esc(m.usuario)}</b></td>
                <td><input type="text" data-campo="nombre" value="${esc(m.nombre || '')}"></td>
                <td style="text-align:center"><input type="checkbox" data-campo="activo" ${m.activo ? 'checked' : ''}></td>
                <td style="text-align:center"><input type="checkbox" data-campo="ia" ${m.ia ? 'checked' : ''}></td>
                <td>${cats.length ? eventosHtml(m) : esc(m.eventos ? m.eventos.map(nombreEvento).join(', ') : 'Todos')}</td>
                <td><input type="password" data-campo="clave" placeholder="Nueva clave (opcional)" autocomplete="new-password"></td>
                <td style="white-space:nowrap"><button class="btn-mini" data-mod-accion="guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                    <button class="btn-mini" data-mod-accion="borrar"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`;
        caja.querySelectorAll('[data-todos]').forEach(t => t.addEventListener('change', () => {
            t.closest('details').querySelectorAll('[data-ev]').forEach(c => { c.checked = t.checked; });
        }));
        caja.querySelectorAll('[data-mod-accion]').forEach(btn => btn.addEventListener('click', () => {
            const fila = btn.closest('tr'), usuario = fila.dataset.mod;
            const campo = c => fila.querySelector(`[data-campo="${c}"]`);
            if (btn.dataset.modAccion === 'borrar') {
                if (!confirm(`¿Borrar al moderador "${usuario}"? Pierde el acceso a Ascensos AZA.`)) return;
                ejecutar(btn, () => P.ascensos.moderadores.borrar(usuario), `Moderador ${usuario} borrado.`);
                return;
            }
            const m = mods.find(x => x.usuario === usuario);
            let eventos = m.eventos;
            const det = fila.querySelector('details');
            if (det) {
                const marcados = [...det.querySelectorAll('[data-ev]:checked')].map(c => c.dataset.ev);
                eventos = det.querySelector('[data-todos]').checked || marcados.length === cats.length ? null : marcados;
            }
            ejecutar(btn, () => P.ascensos.moderadores.guardar({ usuario, nombre: campo('nombre').value.trim(), clave: campo('clave').value || null,
                activo: campo('activo').checked, ia: campo('ia').checked, eventos }), `Moderador ${usuario} actualizado.`);
        }));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
})();
