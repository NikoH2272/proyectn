/* =====================================================================
   PROYECTN · Cupos por portal, igual que los de Pumas (sql/17)
   PumasCupos.montarPublico(contId, portal) → entrenos/jornadas abiertas e inscripción
   PumasCupos.montarAdmin(contId, portal)   → programar, ver inscritos, cerrar, borrar
   El teléfono solo lo ve el admin; el link del grupo se abre al inscribirse.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const PAISES = ['+57', '+52', '+54', '+56', '+51', '+593', '+58', '+591', '+595', '+598', '+502', '+504', '+503', '+505', '+506', '+507', '+1', '+34'];
    const fmt = iso => new Date(iso).toLocaleString('es', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    // "2d 03:14:22" · "03:14:22"
    function restante(ms) {
        const t = Math.max(0, Math.floor(ms / 1000));
        const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), sg = t % 60;
        const z = n => String(n).padStart(2, '0');
        return (d ? d + 'd ' : '') + z(h) + ':' + z(m) + ':' + z(sg);
    }
    // Un solo reloj por página: actualiza los contadores y recarga cuando un cupo se abre
    let reloj = null;
    function arrancarReloj(cont, alAbrir) {
        clearInterval(reloj);
        const tic = () => {
            const ahora = Date.now();
            let abrio = false;
            cont.querySelectorAll('[data-abre]').forEach(el => {
                const falta = Number(el.dataset.abre) - ahora;
                if (falta <= 0) abrio = true;
                else el.textContent = restante(falta);
            });
            if (abrio) { clearInterval(reloj); alAbrir(); }
        };
        if (cont.querySelector('[data-abre]')) { tic(); reloj = setInterval(tic, 1000); }
    }

    function chips(lista) {
        return lista.map(e => `<span class="cupo-eq${e.staff ? ' staff' : ''}">${esc(e.equipo)}${e.staff ? ' <i class="fa-solid fa-shield-halved" title="Asegurado por staff"></i>' : ''}</span>`).join('');
    }

    /* ---------------- Público ---------------- */
    // opts.tipo: 'PUBLICO' (cupos.html, por defecto) o 'VIP' (cupos-vip.html: página oculta, se entra con el link)
    async function montarPublico(contId, portal, opts) {
        const soloVip = !!(opts && opts.tipo === 'VIP');
        const cont = document.getElementById(contId);
        if (!cont) return;
        cont.innerHTML = `<p class="res-vacio"><i class="fa-solid fa-spinner fa-spin"></i>Buscando cupos abiertos...</p>`;
        let lista;
        try { lista = await P.cupos.publicos(portal); }
        catch (e) { cont.innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; return; }
        if (!lista.length) { cont.innerHTML = `<p class="res-vacio"><i class="fa-regular fa-calendar"></i>No hay cupos abiertos en este momento. Vuelve pronto.</p>`; return; }
        // Solo los cupos de ESTE portal (la base ya filtra; esto es por si acaso)
        lista = lista.filter(g => (!g.portal || g.portal === portal) && (g.tipo === 'VIP') === soloVip);
        if (!lista.length) { cont.innerHTML = `<p class="res-vacio"><i class="fa-regular fa-calendar"></i>${soloVip ? 'No hay cupos VIP abiertos en este momento.' : 'No hay cupos abiertos en este momento. Vuelve pronto.'}</p>`; return; }
        cont.innerHTML = `<div class="cupos-grid">${lista.map(g => {
            const quedan = g.cupos - g.inscritos.length;
            const abre = g.abre_en ? new Date(g.abre_en).getTime() : 0;
            if (g.pendiente || abre > Date.now()) {
                return `<article class="card-box cupo-card cupo-pendiente">
                <div class="cupo-top">
                    <div><h3>${g.tipo === 'VIP' ? '<span class="cupo-vip"><i class="fa-solid fa-crown"></i> SOLO VIP</span> ' : ''}${esc(g.titulo)}</h3><p class="muted"><i class="fa-regular fa-clock"></i> ${fmt(g.fecha)}</p></div>
                    <div class="cupo-cuenta"><b>${Math.max(quedan, 0)}</b><small>de ${g.cupos} cupos</small></div>
                </div>
                <div class="cupo-contador"><small><i class="fa-solid fa-hourglass-half"></i> Las inscripciones se abren en</small>
                    <b data-abre="${abre}">${restante(abre - Date.now())}</b><small>${esc(fmt(g.abre_en))}</small></div>
                ${g.inscritos.length ? `<div class="cupo-lista">${chips(g.inscritos)}</div>` : ''}
                <button class="btn-access" disabled><i class="fa-solid fa-lock"></i> Aún no abre</button>
            </article>`;
            }
            return `<article class="card-box cupo-card">
                <div class="cupo-top">
                    <div><h3>${g.tipo === 'VIP' ? '<span class="cupo-vip"><i class="fa-solid fa-crown"></i> SOLO VIP</span> ' : ''}${esc(g.titulo)}</h3><p class="muted"><i class="fa-regular fa-clock"></i> ${fmt(g.fecha)}</p>
                        ${g.cierra_en ? `<p style="color:#FFE38A;font-size:.85rem"><i class="fa-solid fa-hourglass-end"></i> Inscripciones hasta ${fmt(g.cierra_en)}</p>` : ''}</div>
                    <div class="cupo-cuenta"><b>${Math.max(quedan, 0)}</b><small>de ${g.cupos} cupos</small></div>
                </div>
                <div class="cupo-barra"><span style="width:${Math.min(100, g.inscritos.length / g.cupos * 100)}%"></span></div>
                ${g.inscritos.length ? `<div class="cupo-lista">${chips(g.inscritos)}</div>` : ''}
                <button class="btn-access" data-inscribir="${g.id}" ${quedan > 0 ? '' : 'disabled'}>${quedan > 0 ? '<i class="fa-solid fa-ticket"></i> Inscribir equipo' : 'Cupos agotados'}</button>
            </article>`;
        }).join('')}</div>`;
        cont.querySelectorAll('[data-inscribir]').forEach(b => b.addEventListener('click', () => inscribir(lista.find(g => String(g.id) === b.dataset.inscribir), portal, () => montarPublico(contId, portal, opts))));
        arrancarReloj(cont, () => montarPublico(contId, portal, opts));
    }

    async function inscribir(g, portal, recargar) {
        const r = await P.confirmar({
            titulo: 'Inscripción · ' + g.titulo, si: 'Confirmar inscripción', no: 'Cancelar',
            html: `${g.tipo === 'VIP' ? `<div class="cupo-aviso-grupo"><i class="fa-solid fa-crown"></i><div><b>Cupo solo para VIP:</b> escribe el <b>mismo nombre de equipo</b> y el <b>mismo número</b> con que te anotaron como VIP. Si no coinciden, no te da el cupo.</div></div>` : ''}
                   <div class="form-group"><label>Nombre del equipo</label><input data-campo="equipo" maxlength="60" placeholder="Ej: PROYECTN Squad"></div>
                   <div class="form-group"><label>WhatsApp de contacto</label><div style="display:grid;grid-template-columns:100px 1fr;gap:8px">
                   <select data-campo="pais">${PAISES.map(p => `<option>${p}</option>`).join('')}</select>
                   <input data-campo="tel" inputmode="tel" maxlength="16" placeholder="Número sin espacios"></div></div>`
        });
        if (!r.ok) return;
        const equipo = (r.campos.equipo || '').trim(), tel = (r.campos.tel || '').replace(/[^\d]/g, '');
        if (!equipo || tel.length < 6) { alert('Completa el nombre del equipo y un WhatsApp válido.'); return; }
        try {
            const res = await P.cupos.inscribir(g.id, equipo, r.campos.pais + ' ' + tel, portal);
            const ir = await P.confirmar({ titulo: '¡Inscripción exitosa!', si: res.link ? 'Abrir' : 'Listo', no: 'Cerrar',
                html: `<p><b>${esc(equipo)}</b> quedó inscrito en <b>${esc(g.titulo)}</b>.</p>${res.link ? `
                    <div class="cupo-aviso-grupo"><i class="fa-solid fa-circle-exclamation"></i>
                        <div><b>Antes de unirte:</b> al entrar al grupo escribe el <b>nombre de tu equipo</b>
                        (<b>${esc(equipo)}</b>) para que el staff te identifique y te pase la sala.</div></div>
                    <p>Para unirte al grupo toca <b>Abrir</b>.</p>` : ''}` });
            if (ir && res.link) window.open(res.link, '_blank', 'noopener');
        } catch (e) { alert(e.message); }
        recargar();
    }

    /* ---------------- Admin ---------------- */
    async function montarAdmin(contId, portal) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        const conTipo = portal !== 'ascensosaza';
        const conCat  = !!window.ASC_OPCIONES;
        cont.innerHTML = `
            ${conCat ? `<div id="cpCatBanner" style="display:none;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;margin-bottom:14px;border-left:5px solid var(--cp-cat,var(--primary));background:color-mix(in srgb,var(--cp-cat,var(--primary)) 8%,var(--surface));transition:border-color .25s,background .25s">
                <img id="cpCatLogo" src="" alt="" style="width:52px;height:52px;object-fit:contain;display:none" onerror="this.style.display='none'">
                <div>
                    <div style="font-size:.7rem;letter-spacing:.08em;opacity:.7;text-transform:uppercase">Ascenso seleccionado</div>
                    <strong id="cpCatNombre" style="font-size:1.1rem;color:var(--cp-cat,var(--primary))"></strong>
                </div>
            </div>
            <div class="form-grid" style="margin-bottom:4px">
                <div class="form-group"><label for="cpCategoria">Evento de ascensos</label>
                    <select id="cpCategoria"><option value="">— elige el evento —</option>${window.ASC_OPCIONES('')}</select>
                </div>
            </div>` : ''}
            <div class="form-grid">
                <div class="form-group"><label for="cpTitulo">Título</label><input id="cpTitulo" maxlength="120" placeholder="Ej: Jornada de ascensos · Lunes"></div>
                <div class="form-group"><label for="cpFecha">Fecha y hora</label><input id="cpFecha" type="datetime-local"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label for="cpCupos">Cupos totales</label><input id="cpCupos" type="number" min="1" max="100" value="12"></div>
                ${conTipo ? `<div class="form-group"><label for="cpTipo">Tipo de cupo</label><select id="cpTipo">
                    <option value="PUBLICO">PÚBLICO (cualquier equipo)</option><option value="VIP">VIP (solo la lista VIP · sale solo en el link oculto)</option></select></div>` : ''}
                <div class="form-group"><label for="cpLink">Link del grupo (WhatsApp / Discord)</label><input id="cpLink" type="url" placeholder="https://chat.whatsapp.com/..."></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label for="cpStaff">Equipos asegurados por staff (uno por línea)</label><textarea id="cpStaff" rows="3" style="min-height:90px" placeholder="PROYECTN Squad&#10;Team Alpha"></textarea></div>
                <div class="form-group"><label for="cpPub">Publicar el (vacío = al instante)</label><input id="cpPub" type="datetime-local">
                    <p class="muted" style="margin-top:8px">Los de staff se restan de los cupos y salen en la lista pública.</p></div>
            </div>
            <button class="btn-generar" id="cpGuardar"><i class="fa-solid fa-floppy-disk"></i> Abrir cupos</button>
            <p class="muted" id="cpMsg" role="status" style="margin-top:10px"></p>
        `;
        if (conCat) {
            const selCat = cont.querySelector('#cpCategoria');
            const banner = cont.querySelector('#cpCatBanner');
            const catLogo = cont.querySelector('#cpCatLogo');
            const catNom  = cont.querySelector('#cpCatNombre');
            selCat.addEventListener('change', () => {
                const id = selCat.value;
                if (!id) { banner.style.display = 'none'; return; }
                const c = window.ASC_CATEGORIA(id);
                banner.style.display = 'flex';
                banner.style.setProperty('--cp-cat', c.color);
                catNom.textContent = c.nombre;
                if (c.logo) { catLogo.src = c.logo; catLogo.style.display = ''; }
                else catLogo.style.display = 'none';
                // Pre-rellenar título si está vacío
                const tit = cont.querySelector('#cpTitulo');
                if (!tit.value) tit.value = c.nombre + ' · Jornada';
            });
        }
        cont.insertAdjacentHTML('beforeend', `<h3 class="subtitulo-bloque" style="margin-top:26px"><i class="fa-solid fa-list-check"></i> Programados (últimos 60 días)
                <button class="btn-mini" id="cpRefrescar" style="float:right"><i class="fa-solid fa-rotate-right"></i></button></h3>
            <div id="cpLista"></div>`);
        const msg = t => { cont.querySelector('#cpMsg').textContent = t; };

        cont.querySelector('#cpGuardar').addEventListener('click', async () => {
            const f = cont.querySelector('#cpFecha').value, pub = cont.querySelector('#cpPub').value;
            const d = {
                titulo: cont.querySelector('#cpTitulo').value.trim(), fecha: f ? new Date(f) : null,
                cupos: Number(cont.querySelector('#cpCupos').value), link: cont.querySelector('#cpLink').value.trim(),
                publicar_en: pub ? new Date(pub) : null,
                staff: cont.querySelector('#cpStaff').value.split('\n').map(x => x.trim()).filter(Boolean)
            };
            if (!d.titulo || !d.fecha) { msg('Completa título y fecha.'); return; }
            msg('Guardando...');
            try {
                const res = await P.cupos.guardar(portal, d);
                const tipo = conTipo ? cont.querySelector('#cpTipo').value : 'PUBLICO';
                if (tipo === 'VIP' && res && res.id) {
                    try { await P.cupos.tipo(portal, res.id, 'VIP'); }
                    catch (e) { msg('Se abrieron como PÚBLICOS: para VIP falta correr sql/25_cupos_vip_y_baneos.sql. ' + e.message); lista(); return; }
                }
                msg(tipo === 'VIP' ? '✔ Cupos VIP abiertos (solo la lista VIP).' : '✔ Cupos abiertos.');
                if (conTipo) cont.querySelector('#cpTipo').value = 'PUBLICO';
                ['cpTitulo', 'cpStaff', 'cpPub'].forEach(id => { cont.querySelector('#' + id).value = ''; });
                lista();
            } catch (e) { msg(e.message); }
        });
        cont.querySelector('#cpRefrescar').addEventListener('click', lista);

        async function lista() {
            const caja = cont.querySelector('#cpLista');
            caja.innerHTML = `<p class="res-vacio"><i class="fa-solid fa-spinner fa-spin"></i>Cargando...</p>`;
            let filas;
            try { filas = await P.cupos.listar(portal); }
            catch (e) { caja.innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; return; }
            if (!filas.length) { caja.innerHTML = `<p class="res-vacio">Todavía no hay cupos programados.</p>`; return; }
            const ahora = new Date();
            caja.innerHTML = filas.map(g => {
                const programado = g.publicar_en && new Date(g.publicar_en) > ahora;
                const estado = programado ? 'PROGRAMADO' : g.estado;
                return `<article class="cupo-admin">
                    <div class="cupo-top">
                        <div>${g.tipo === 'VIP' ? '<span class="cupo-vip">VIP</span> ' : ''}<b>${esc(g.titulo)}</b> <span class="cupo-estado e-${estado.toLowerCase()}">${estado}</span>
                            <p class="muted">${fmt(g.fecha)} · ${g.inscritos.length}/${g.cupos} inscritos${programado ? ' · se publica ' + fmt(g.publicar_en) : ''}</p></div>
                        <div class="cupo-acciones">
                            ${programado ? `<button class="btn-mini" data-acc="PUBLICAR" data-id="${g.id}">Publicar ya</button>` : ''}
                            ${g.estado === 'ABIERTO' ? `<button class="btn-mini" data-acc="CERRADO" data-id="${g.id}">Cerrar</button>` : `<button class="btn-mini" data-acc="ABIERTO" data-id="${g.id}">Abrir</button>`}
                            ${g.estado !== 'FINALIZADO' ? `<button class="btn-mini" data-acc="FINALIZADO" data-id="${g.id}">Finalizar</button>` : ''}
                            <button class="btn-mini btn-borrar" data-borrar="${g.id}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    ${g.inscritos.length ? `<div class="cupo-lista">${g.inscritos.map(e => `<span class="cupo-eq${e.staff ? ' staff' : ''}">${esc(e.equipo)}
                        ${!e.staff && e.telefono ? `<a href="https://wa.me/${esc(e.telefono.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener" title="${esc(e.telefono)}"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                        <button class="cupo-x" data-quitar="${e.id}" title="Quitar">×</button></span>`).join('')}</div>` : ''}
                </article>`;
            }).join('');
            caja.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', async () => {
                try { await P.cupos.estado(portal, Number(b.dataset.id), b.dataset.acc); lista(); } catch (e) { msg(e.message); }
            }));
            caja.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', async () => {
                const ok = await P.confirmar({ titulo: '¿Borrar estos cupos?', peligro: true, si: 'Sí, borrar', html: '<p>Se borran también los equipos inscritos.</p>' });
                if (!ok) return;
                try { await P.cupos.borrar(portal, Number(b.dataset.borrar)); lista(); } catch (e) { msg(e.message); }
            }));
            caja.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', async () => {
                if (!confirm('¿Quitar este equipo de los cupos?')) return;
                try { await P.cupos.quitar(portal, Number(b.dataset.quitar)); lista(); } catch (e) { msg(e.message); }
            }));
        }
        lista();
    }

    window.PumasCupos = { montarPublico, montarAdmin };
})();
