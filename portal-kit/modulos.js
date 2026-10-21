/* Superadmin: módulos (portales).
   - Crear módulos nuevos (entrenos con la herramienta genérica /modulo/?p=<id>)
   - Cambiar nombre, título, colores, logo y link de cualquier portal
   - Borrar los módulos creados aquí (los del código solo se editan o restablecen)
   Necesita <main id="modulos"> y portal.js cargado antes. */
(function () {
    const raiz = document.getElementById('modulos');
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const TIPOS = { fijo: 'Portal del sitio', modulo: 'Módulo', ascensos: 'Ascensos' };
    const LOGO_PUMAS = '/imagenes/proyectn.png';
    // Logo que usa cada portal del código cuando no se le cambió
    const LOGOS = {
        principal: LOGO_PUMAS, entrenamientos: LOGO_PUMAS, ascensosqfd: '/ascensosqfd/imagenes/qfd.png', row: '/row/imagenes/row.png',
        rusheo: '/rusheo/imagenes/rusheo.png', zmf: '/zmf/imagenes/zmf.png', zmffem: '/zmf/imagenes/zmffem.png',
        dragonfest: '/dragonfest/imagenes/dragonfest.png', dragonfestfem: '/dragonfest/imagenes/dragonfestfem.png',
        ascensosaza: '/ascensos/imagenes/aza.png', pruebas: LOGO_PUMAS, entrenoslatam: '/entrenoslatam/imagenes/latam.png'
    };
    const hex = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : null;

    document.documentElement.classList.add('pg-verificando');
    let filas = [];

    async function arrancar() {
        const s = await P.guard('principal', 'login.html', 'gestionar');
        if (!s) return;
        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = s.nombre || s.usuario; });
        document.querySelectorAll('[data-pg-salir]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); P.logout('login.html'); }));
        await cargar();
    }

    async function cargar() {
        P.olvidarModulos();
        filas = (await P.cargarModulos(true)).slice().sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.id.localeCompare(b.id));
        const sinSql = filas.length && !('tipo' in filas[0]);
        raiz.innerHTML = `
            ${sinSql ? `<p class="asc-aviso-ban" style="max-width:1180px;margin:0 auto 18px">Falta correr <b>sql/17_ascensos_modulos_sorteos.sql</b> en Supabase: sin él no se pueden crear ni editar módulos.</p>` : ''}
            <h3 class="bloque-titulo"><i class="fa-solid fa-plus"></i> Crear un módulo nuevo</h3>
            <div class="mod-grid">${tarjetaNueva()}</div>
            <h3 class="bloque-titulo"><i class="fa-solid fa-palette"></i> Portales y módulos (${filas.length})</h3>
            <p class="muted" style="max-width:1180px;margin:-6px auto 14px">Los cambios de color, logo y título se ven en la página de ese portal al recargarla. "Restablecer" vuelve a lo que trae el código.</p>
            <div class="mod-grid">${filas.filter(r => r.id !== 'entrenoslatam').map(tarjeta).join('')}</div>`;
        enlazar();
    }

    function campos(r, nuevo) {
        const c1 = hex(r.color_tema) || hex(r.color) || '#D8C395', c2 = hex(r.color2) || '#F4EEDC';
        return `
            ${nuevo ? `<div class="form-grid">
                <div class="form-group"><label>Código (en la dirección)</label><input data-f="id" maxlength="30" placeholder="ej. ligamax" pattern="[a-z0-9_]{2,30}"></div>
                <div class="form-group"><label>Nombre</label><input data-f="nombre" maxlength="60" placeholder="Liga Max"></div></div>`
            : `<div class="form-group"><label>Nombre</label><input data-f="nombre" maxlength="60" value="${esc(r.nombre || '')}"></div>`}
            <div class="form-grid">
                <div class="form-group"><label>Título (logo y portada)</label><input data-f="titulo" maxlength="60" value="${esc(r.titulo || '')}" placeholder="${nuevo ? 'Igual al nombre' : 'El del código'}"></div>
                <div class="form-group"><label>Subtítulo</label><input data-f="subtitulo" maxlength="120" value="${esc(r.subtitulo || '')}" placeholder="Texto de la portada"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Color principal</label><input type="color" data-f="color" value="${c1}" data-ini="${nuevo ? '' : (hex(r.color_tema) ? c1 : '')}"></div>
                <div class="form-group"><label>Color secundario</label><input type="color" data-f="color2" value="${c2}" data-ini="${nuevo ? '' : (hex(r.color2) ? c2 : '')}"></div>
            </div>
            <div class="form-group"><label>Logo (ruta /imagenes/... o link https://)</label><input data-f="logo" maxlength="300" value="${esc(r.logo || '')}" placeholder="/imagenes/milogo.png"></div>
            <div class="form-group"><label>Link del grupo (WhatsApp / Discord)</label><input data-f="link" maxlength="300" value="${esc(r.link || '')}" placeholder="https://chat.whatsapp.com/..."></div>
            ${nuevo || r.tipo === 'modulo' ? `<label class="chk"><input type="checkbox" data-f="activo" ${r.activo === false ? '' : 'checked'}> Activo (visible en el sitio y en Entrenos LATAM)</label>` : ''}`;
    }

    function tarjetaNueva() {
        return `<article class="card-box mod-card nuevo" data-nuevo style="--c:#D8C395">
            <div class="mod-head"><img src="${LOGO_PUMAS}" alt="" data-prev><div><h3>Nuevo módulo</h3><small>Entrenos con su herramienta, portal de resultados, cupos y sorteo</small></div></div>
            ${campos({ activo: true }, true)}
            <p class="muted">Se crea en <code>/modulo/?p=código</code> y entra a Entrenos LATAM. Después dale acceso a un rol en <a href="usuarios.html">Usuarios y roles</a>.</p>
            <div class="acciones"><button class="btn-access" data-crear><i class="fa-solid fa-plus"></i> Crear módulo</button></div>
            <p class="muted" data-msg role="status"></p>
        </article>`;
    }

    function tarjeta(r) {
        const color = hex(r.color_tema) || hex(r.color) || '#D8C395';
        const p = P.PORTALES[r.id] || {};
        const ver = r.tipo === 'modulo' ? '/modulo/?p=' + r.id : (p.url || r.ruta || '/');
        const tool = r.tipo === 'modulo' ? '/modulo/admin.html?p=' + r.id : p.admin;
        return `<article class="card-box mod-card" data-id="${esc(r.id)}" style="--c:${color}">
            <div class="mod-head"><img src="${esc(r.logo || LOGOS[r.id] || LOGO_PUMAS)}" alt="" data-prev onerror="this.onerror=null;this.src='${LOGO_PUMAS}'">
                <div><h3>${esc(r.nombre)}</h3><small><code>${esc(r.id)}</code> · <span class="mod-tipo">${TIPOS[r.tipo] || 'Portal'}</span>${r.activo === false ? ' · <b style="color:#ff8a8d">inactivo</b>' : ''}</small></div></div>
            ${campos(r, false)}
            <div class="acciones">
                <button class="btn-access" data-guardar><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                <a class="btn-access btn-outline" href="${esc(ver)}" target="_blank"><i class="fa-solid fa-eye"></i> Ver</a>
                ${tool ? `<a class="btn-access btn-outline" href="${esc(tool)}" target="_blank"><i class="fa-solid fa-screwdriver-wrench"></i> Herramienta</a>` : ''}
                ${r.tipo === 'modulo' ? `<button class="btn-mini btn-borrar" data-borrar><i class="fa-solid fa-trash"></i> Borrar</button>`
                    : `<button class="btn-mini" data-restablecer title="Quitar color, logo y título personalizados"><i class="fa-solid fa-rotate-left"></i> Restablecer</button>`}
            </div>
            <p class="muted" data-msg role="status"></p>
        </article>`;
    }

    const leer = (card, f) => { const n = card.querySelector(`[data-f="${f}"]`); return !n ? undefined : n.type === 'checkbox' ? n.checked : n.value.trim(); };
    const msg = (card, t, ok) => { const n = card.querySelector('[data-msg]'); n.textContent = t; n.style.color = ok ? '#6ee7a8' : '#ff8a8d'; };

    function enlazar() {
        raiz.querySelectorAll('.mod-card').forEach(card => {
            // Vista previa del logo y del color mientras se edita
            card.querySelector('[data-f="logo"]').addEventListener('input', e => {
                const v = e.target.value.trim();
                if (/^(\/|https:\/\/)/.test(v)) card.querySelector('[data-prev]').src = v;
            });
            card.querySelector('[data-f="color"]').addEventListener('input', e => { card.style.setProperty('--c', e.target.value); e.target.dataset.cambio = '1'; });
            card.querySelector('[data-f="color2"]').addEventListener('input', e => { e.target.dataset.cambio = '1'; });
        });

        const nueva = raiz.querySelector('[data-nuevo]');
        nueva.querySelector('[data-crear]').addEventListener('click', async () => {
            const id = (leer(nueva, 'id') || '').toLowerCase();
            if (!/^[a-z0-9_]{2,30}$/.test(id)) { msg(nueva, 'Código: 2 a 30 letras minúsculas, números o guion bajo (sin espacios).'); return; }
            if (!leer(nueva, 'nombre')) { msg(nueva, 'Ponle un nombre al módulo.'); return; }
            msg(nueva, 'Creando...', true);
            try {
                await P.modulos.guardar({
                    crear: true, id, nombre: leer(nueva, 'nombre'), titulo: leer(nueva, 'titulo'), subtitulo: leer(nueva, 'subtitulo'),
                    color: leer(nueva, 'color'), color2: leer(nueva, 'color2'), logo: leer(nueva, 'logo'), link: leer(nueva, 'link'),
                    latam: true, activo: leer(nueva, 'activo')
                });
                await cargar();
                const card = raiz.querySelector(`[data-id="${id}"]`);
                if (card) { msg(card, '✔ Módulo creado. Ábrelo con "Ver" o "Herramienta".', true); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            } catch (e) { msg(nueva, e.message); }
        });

        raiz.querySelectorAll('[data-id]').forEach(card => {
            const id = card.dataset.id, r = filas.find(x => x.id === id);
            card.querySelector('[data-guardar]').addEventListener('click', async () => {
                const c1 = card.querySelector('[data-f="color"]'), c2 = card.querySelector('[data-f="color2"]');
                const cambios = {
                    id, nombre: leer(card, 'nombre'), titulo: leer(card, 'titulo'), subtitulo: leer(card, 'subtitulo'),
                    logo: leer(card, 'logo'), link: leer(card, 'link'),
                    // los colores solo se mandan si se tocaron (así un portal del código no queda "pintado" sin querer)
                    color: c1.dataset.cambio ? c1.value : null, color2: c2.dataset.cambio ? c2.value : null,
                    activo: r.tipo === 'modulo' ? leer(card, 'activo') : null
                };
                msg(card, 'Guardando...', true);
                try { await P.modulos.guardar(cambios); await cargar(); msg(raiz.querySelector(`[data-id="${id}"]`), '✔ Guardado', true); }
                catch (e) { msg(card, e.message); }
            });
            const rest = card.querySelector('[data-restablecer]');
            if (rest) rest.addEventListener('click', async () => {
                const ok = await P.confirmar({ titulo: '¿Restablecer ' + r.nombre + '?', si: 'Sí, restablecer',
                    html: '<p>Vuelve al color, logo, título y subtítulo que trae el código. El nombre y el link no cambian.</p>' });
                if (!ok) return;
                try { await P.modulos.guardar({ id, titulo: '', subtitulo: '', color: '', color2: '', logo: '' }); await cargar(); }
                catch (e) { msg(card, e.message); }
            });
            const borrar = card.querySelector('[data-borrar]');
            if (borrar) borrar.addEventListener('click', async () => {
                const res = await P.confirmar({
                    titulo: '¿Borrar el módulo ' + r.nombre + '?', peligro: true, si: 'Sí, borrar todo',
                    html: `<p>Se borran el módulo y <b>todos sus entrenos, cupos y sorteo</b>. No se puede deshacer (haz un respaldo antes).</p>
                        <div class="form-group"><label>Escribe <b>${esc(id)}</b> para confirmar</label><input data-campo="ok" autocomplete="off"></div>`
                });
                if (!res.ok) return;
                if ((res.campos.ok || '').trim() !== id) { msg(card, 'No coincide el código: no se borró nada.'); return; }
                try { const x = await P.modulos.borrar(id); await cargar(); alert('Módulo borrado (' + (x.entrenos_borrados || 0) + ' entrenos).'); }
                catch (e) { msg(card, e.message); }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
