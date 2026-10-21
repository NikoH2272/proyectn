/* Superadmin: borrar entrenos y corregir nombres de equipos en cualquier portal.
   Necesita <main id="correcciones"> y portal.js cargado antes. */
(function () {
    const raiz = document.getElementById('correcciones');
    const loginUrl = raiz.dataset.login || 'login.html';
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    const PORTALES = [
        ['entrenamientos', 'PROYECTN'], ['rusheo', 'Rusheo'], ['row', 'ROW x Maya'], ['ascensosqfd', 'Ascensos QFD'],
        ['dragonfest', 'Dragon Fest Mixto'], ['dragonfestfem', 'Dragon Fest Femenino'], ['zmf', 'ZMF Mixto'], ['zmffem', 'ZMF Femenino']
    ];
    const nombreDe = id => (PORTALES.find(p => p[0] === id) || [id, id])[1];
    const fmt = f => new Date(f).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

    document.documentElement.classList.add('pg-verificando');
    let portal = 'entrenamientos', entrenos = [], equipos = [];

    async function arrancar() {
        const s = await P.guard('principal', loginUrl, 'gestionar');
        if (!s) return;
        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = s.nombre || s.usuario; });
        document.querySelectorAll('[data-pg-salir]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); P.logout(loginUrl); }));
        // + módulos creados desde el panel
        try { (await P.cargarModulos()).filter(r => r.tipo === 'modulo').forEach(r => PORTALES.push([r.id, r.nombre])); } catch (e) { }
        raiz.innerHTML = `
            <div class="corr-portales" role="group" aria-label="Portal">${PORTALES.map(([id, n]) =>
                `<button class="chip${id === portal ? ' on' : ''}" data-portal="${id}">${esc(n)}</button>`).join('')}</div>
            <p id="corrMsg" class="auth-msg" role="status" style="text-align:center"></p>
            <div class="admin-grid corr-grid">
                <article class="card-box">
                    <h3><i class="fa-solid fa-pen-to-square"></i> Corregir nombre de un equipo</h3>
                    <div class="form-group"><label for="cViejo">Equipo (como está guardado)</label>
                        <input id="cViejo" list="cEquipos" autocomplete="off" placeholder="Escribe o elige"><datalist id="cEquipos"></datalist></div>
                    <div class="form-group"><label for="cNuevo">Nombre correcto</label>
                        <input id="cNuevo" autocomplete="off" placeholder="Ej. PUMAS SUR"></div>
                    <div class="form-group"><label for="cDonde">Dónde corregir</label><select id="cDonde"></select></div>
                    <p class="muted">Si el nombre correcto ya existe, los dos quedan unidos como un solo equipo.</p>
                    <button class="btn-access" id="cCorregir"><i class="fa-solid fa-check"></i> Corregir nombre</button>
                </article>
                <article class="card-box">
                    <h3><i class="fa-solid fa-list"></i> Entrenos guardados</h3>
                    <div class="pg-tabla-wrap corr-tabla"><table class="pg-tabla">
                        <thead><tr><th>Fecha</th><th>Título</th><th>Equipos</th><th>Salas</th><th></th></tr></thead>
                        <tbody id="cEntrenos"></tbody></table></div>
                </article>
            </div>`;
        raiz.querySelector('.corr-portales').addEventListener('click', e => {
            const b = e.target.closest('[data-portal]'); if (!b) return;
            portal = b.dataset.portal;
            raiz.querySelectorAll('.corr-portales .chip').forEach(c => c.classList.toggle('on', c === b));
            cargar();
        });
        raiz.querySelector('#cCorregir').addEventListener('click', corregir);
        raiz.querySelector('#cEntrenos').addEventListener('click', e => {
            const b = e.target.closest('[data-borrar]'); if (b) borrar(b.dataset.borrar);
            const ed = e.target.closest('[data-editar]'); if (ed) editar(ed.dataset.editar);
        });
        await cargar();
    }

    function avisar(t, ok) { const n = document.getElementById('corrMsg'); n.textContent = t; n.className = 'auth-msg' + (ok ? ' ok' : ''); }

    async function cargar() {
        const tb = document.getElementById('cEntrenos');
        tb.innerHTML = '<tr class="vacio"><td colspan="5"><i class="fa-solid fa-spinner fa-spin"></i>Cargando...</td></tr>';
        try {
            [entrenos, equipos] = await Promise.all([P.entrenos.listar(portal), P.entrenos.equipos(portal)]);
        } catch (err) {
            tb.innerHTML = `<tr class="vacio"><td colspan="5">No se pudo cargar: ${esc(err.message)}</td></tr>`;
            return;
        }
        tb.innerHTML = entrenos.length ? entrenos.map(s => `<tr>
                <td>${fmt(s.fecha)}</td>
                <td>${esc(s.titulo)}<small class="muted" style="display:block">${esc(s.jornada || '')}${s.moderador ? ' · Mod: ' + esc(s.moderador) : ''}</small></td>
                <td>${s.equipos}</td><td>${s.salas}</td>
                <td style="white-space:nowrap"><button class="btn-mini" data-editar="${esc(s.id)}" title="Corregir fecha, hora o jornada"><i class="fa-solid fa-clock"></i></button>
                    <button class="btn-mini btn-borrar" data-borrar="${esc(s.id)}" title="Borrar este entreno"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('')
            : `<tr class="vacio"><td colspan="5">${esc(nombreDe(portal))} no tiene entrenos guardados.</td></tr>`;
        document.getElementById('cEquipos').innerHTML = equipos.map(e => `<option value="${esc(e.equipo)}">${e.entrenos} entreno${e.entrenos === 1 ? '' : 's'}</option>`).join('');
        document.getElementById('cDonde').innerHTML = `<option value="">En todos los entrenos de ${esc(nombreDe(portal))}</option>` +
            entrenos.map(s => `<option value="${esc(s.id)}">Solo en: ${fmt(s.fecha)} · ${esc(s.titulo)}</option>`).join('');
    }

    async function borrar(id) {
        const s = entrenos.find(x => String(x.id) === String(id));
        if (!s) return;
        const ok = await P.confirmar({
            titulo: '¿Borrar este entreno?', peligro: true,
            html: `<p>Vas a borrar <b>${esc(s.titulo)}</b> del <b>${fmt(s.fecha)}</b> en <b>${esc(nombreDe(portal))}</b>
                   (${s.equipos} equipos, ${s.salas} salas).</p>
                   <p>Se borran también sus resultados y killers, y deja de contar en el portal y en Entrenos LATAM. <b>No se puede deshacer.</b></p>`,
            si: 'Sí, borrar', no: 'No, cancelar'
        });
        if (!ok) return;
        try {
            await P.entrenos.borrar(portal, id);
            avisar(`Entreno "${s.titulo}" borrado.`, true);
            cargar();
        } catch (err) { avisar('No se pudo borrar: ' + err.message); }
    }

    // Corregir la fecha/hora (y la jornada, ej. BLOQUE A) de un entreno guardado
    const aLocal = iso => { const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    async function editar(id) {
        const s = entrenos.find(x => String(x.id) === String(id));
        if (!s) return;
        const r = await P.confirmar({
            titulo: 'Corregir fecha y hora',
            html: `<p><b>${esc(s.titulo)}</b> · ${esc(nombreDe(portal))}<br><span class="muted">Ahora: ${fmt(s.fecha)}</span></p>
                <div class="form-group"><label>Fecha y hora correctas (tu hora local)</label><input type="datetime-local" data-campo="fecha" value="${aLocal(s.fecha)}"></div>
                <div class="form-group"><label>Jornada / tipo</label><input type="text" data-campo="jornada" maxlength="60" value="${esc(s.jornada || '')}" placeholder="NORMAL, BLOQUE A..."></div>`,
            si: 'Guardar cambios', no: 'Cancelar'
        });
        if (!r.ok) return;
        const fecha = new Date(r.campos.fecha);
        if (!r.campos.fecha || isNaN(fecha)) { avisar('Elige una fecha y hora válidas.'); return; }
        try {
            await P.entrenos.editar(portal, id, fecha, r.campos.jornada.trim());
            avisar(`Listo: "${s.titulo}" quedó el ${fmt(fecha.toISOString())}.`, true);
            cargar();
        } catch (err) {
            avisar('No se pudo corregir: ' + (/admin_editar_entreno|PGRST202|Could not find/i.test(err.message) ? 'falta correr sql/21_corregir_hora_entreno.sql en Supabase.' : err.message));
        }
    }

    async function corregir() {
        const viejo = document.getElementById('cViejo').value.trim();
        const nuevo = document.getElementById('cNuevo').value.trim();
        const sesion = document.getElementById('cDonde').value || null;
        if (!viejo || !nuevo) { avisar('Escribe el equipo y el nombre correcto.'); return; }
        if (viejo.toLowerCase() === nuevo.toLowerCase() && viejo === nuevo) { avisar('El nombre es el mismo.'); return; }
        const existe = equipos.find(e => e.equipo.toLowerCase() === viejo.toLowerCase());
        const une = equipos.find(e => e.equipo.toLowerCase() === nuevo.toLowerCase() && e.equipo.toLowerCase() !== viejo.toLowerCase());
        const donde = sesion ? 'solo en el entreno elegido' : `en ${existe ? existe.entrenos : 'todos los'} entreno(s) de ${nombreDe(portal)}`;
        const ok = await P.confirmar({
            titulo: '¿Corregir el nombre?',
            html: `<p>Cambiar <b>${esc(viejo)}</b> por <b>${esc(nuevo)}</b> ${esc(donde)}.</p>` +
                  (une ? `<p>⚠ <b>${esc(une.equipo)}</b> ya existe: los dos quedarán unidos como un solo equipo.</p>` : '') +
                  (existe ? '' : '<p>⚠ Ese nombre no aparece en la lista de equipos de este portal.</p>'),
            si: 'Sí, corregir', no: 'No, cancelar'
        });
        if (!ok) return;
        try {
            const r = await P.entrenos.renombrar(portal, viejo, nuevo, sesion);
            avisar(`Listo: "${viejo}" ahora es "${nuevo}" (${r.salas} resultados de sala corregidos).`, true);
            document.getElementById('cViejo').value = ''; document.getElementById('cNuevo').value = '';
            cargar();
        } catch (err) { avisar('No se pudo corregir: ' + err.message); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
})();
