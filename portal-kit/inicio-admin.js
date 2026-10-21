/* Admin del inicio (rol con "personalizar"):
   - Torneos aliados: activar la sección y editar la lista
   - Sorteo del inicio: activar/desactivar (sale el formulario para anotarse en el index)
   Necesita <main id="inicioAdmin"> y portal.js cargado antes. */
(function () {
    const raiz = document.getElementById('inicioAdmin');
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    document.documentElement.classList.add('pg-verificando');
    let ses = null;

    async function arrancar() {
        ses = await P.guard('principal', 'login.html', 'personalizar');
        if (!ses) return;
        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = ses.nombre || ses.usuario; });
        document.querySelectorAll('[data-pg-salir]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); P.logout('login.html'); }));
        await pintar();
    }

    async function pintar() {
        const db = P.db();
        const [cfg, lista, sorteo] = await Promise.all([
            db.from('sitio_config').select('valor').eq('clave', 'torneos_aliados').maybeSingle(),
            db.from('torneos_aliados').select('*').order('orden').order('id'),
            P.sorteo.publico('principal').catch(e => ({ error: e.message }))
        ]);
        if (cfg.error && P.faltaSql(cfg.error)) {
            raiz.innerHTML = `<p class="res-vacio">Falta correr <b>sql/17_ascensos_modulos_sorteos.sql</b> en Supabase.</p>`;
            return;
        }
        const c = (cfg.data && cfg.data.valor) || { activo: false };
        const filas = lista.data || [];
        raiz.innerHTML = `
            <div class="admin-grid">
                <article class="card-box">
                    <h3><i class="fa-solid fa-handshake"></i> Sección "Torneos aliados"</h3>
                    <label class="chk" style="margin-bottom:14px !important"><input type="checkbox" id="alActivo" ${c.activo ? 'checked' : ''}> Mostrar la sección en el inicio</label>
                    <div class="form-group"><label for="alTitulo">Título de la sección</label><input id="alTitulo" maxlength="60" value="${esc(c.titulo || '')}" placeholder="Torneos aliados"></div>
                    <div class="form-group"><label for="alTexto">Texto debajo del título</label><input id="alTexto" maxlength="200" value="${esc(c.texto || '')}" placeholder="Torneos de nuestras ligas aliadas: inscríbete."></div>
                    <p class="muted">El interruptor se guarda al tocarlo. Mientras esté apagada (o sin torneos visibles) no sale nada en el inicio.</p>
                    <div class="barra-guardar" style="margin-top:6px"><span class="muted" id="alMsg" role="status"></span>
                        <button class="btn-access" id="alGuardar"><i class="fa-solid fa-floppy-disk"></i> Guardar sección</button></div>
                </article>
                <article class="card-box">
                    <h3><i class="fa-solid fa-dice"></i> Sorteo del inicio</h3>
                    ${sorteo.error ? `<p class="muted">${esc(sorteo.error)}</p>` : `
                    <p>Estado: ${sorteo.activo ? '<b style="color:#6ee7a8">ACTIVO</b> · sale el formulario para anotarse en el inicio' : '<b style="color:#ff8a8d">INACTIVO</b> · no sale en el inicio'}</p>
                    <p class="muted">${sorteo.total} equipos anotados · ticket <code>${esc(sorteo.prefijo)}-XXXXX</code></p>
                    <div class="acciones" style="display:flex;flex-wrap:wrap;gap:8px">
                        <button class="btn-access" id="sgOnOff"><i class="fa-solid fa-power-off"></i> ${sorteo.activo ? 'Desactivar' : 'Activar'} sorteo</button>
                        <a class="btn-access btn-outline" href="sorteo.html?p=principal"><i class="fa-solid fa-list"></i> Ver anotados y sortear</a>
                    </div>`}
                </article>
            </div>

            <h3 class="bloque-titulo"><i class="fa-solid fa-trophy"></i> Torneos aliados (${filas.length})</h3>
            ${c.activo ? '' : `<p class="asc-aviso-ban" style="max-width:1180px;margin:0 auto 16px;padding:12px 14px;border:1px solid rgba(229,72,77,.6);background:rgba(229,72,77,.1);color:#ffb3b5">
                <i class="fa-solid fa-eye-slash"></i> La sección está <b>apagada</b>: estos torneos no se ven en el inicio. <button class="btn-mini" id="alEncender">Encender ahora</button></p>`}
            <div class="mod-grid">
                ${tarjeta({ activo: true, orden: filas.length + 1 }, true)}
                ${filas.map(a => tarjeta(a, false)).join('')}
            </div>`;
        enlazar(filas, c);
    }

    function tarjeta(a, nuevo) {
        return `<article class="card-box mod-card${nuevo ? ' nuevo' : ''}" ${nuevo ? 'data-nuevo' : `data-id="${a.id}"`}>
            <div class="mod-head"><img src="${esc(a.logo || '/imagenes/proyectn.png')}" alt="" data-prev onerror="this.onerror=null;this.src='/imagenes/proyectn.png'">
                <div><h3>${nuevo ? 'Agregar torneo' : esc(a.nombre)}</h3>${!nuevo && !a.activo ? '<small style="color:#ff8a8d">Oculto</small>' : ''}</div></div>
            <div class="form-group"><label>Nombre</label><input data-f="nombre" maxlength="80" value="${esc(a.nombre || '')}" placeholder="Copa Aliada"></div>
            <div class="form-group"><label>Descripción</label><input data-f="descripcion" maxlength="300" value="${esc(a.descripcion || '')}" placeholder="Formato, premio, cupos..."></div>
            <div class="form-grid">
                <div class="form-group"><label>Fecha / estado</label><input data-f="fecha_texto" maxlength="80" value="${esc(a.fecha_texto || '')}" placeholder="Inscripciones hasta el 20 OCT"></div>
                <div class="form-group"><label>Orden</label><input data-f="orden" type="number" min="0" max="999" value="${a.orden ?? 99}"></div>
            </div>
            <div class="form-group"><label>Logo (ruta /imagenes/... o https://)</label><input data-f="logo" maxlength="300" value="${esc(a.logo || '')}"></div>
            <div class="form-group"><label>Link del torneo (https://)</label><input data-f="link" maxlength="300" value="${esc(a.link || '')}"></div>
            <label class="chk"><input type="checkbox" data-f="activo" ${a.activo ? 'checked' : ''}> Visible</label>
            <div class="acciones">
                <button class="btn-access" data-guardar><i class="fa-solid fa-floppy-disk"></i> ${nuevo ? 'Agregar' : 'Guardar'}</button>
                ${nuevo ? '' : `<button class="btn-mini btn-borrar" data-borrar><i class="fa-solid fa-trash"></i> Borrar</button>`}
            </div>
            <p class="muted" data-msg role="status"></p>
        </article>`;
    }

    function enlazar(filas, c) {
        const msgTop = t => { raiz.querySelector('#alMsg').textContent = t; };
        // Guarda la sección (interruptor, título y texto). activo: forzar encendido/apagado
        const guardarSeccion = async activo => {
            const chk = raiz.querySelector('#alActivo');
            if (activo != null) chk.checked = activo;
            msgTop('Guardando...');
            try {
                await P.sitio.guardar('torneos_aliados', {
                    activo: chk.checked,
                    titulo: raiz.querySelector('#alTitulo').value.trim() || null,
                    texto: raiz.querySelector('#alTexto').value.trim() || null
                });
                await pintar();
                msgTop(chk.checked ? '✔ Sección encendida: ya se ve en el inicio (recárgalo).' : '✔ Sección apagada: no se ve en el inicio.');
            } catch (e) { msgTop(e.message); }
        };
        raiz.querySelector('#alGuardar').addEventListener('click', () => guardarSeccion());
        raiz.querySelector('#alActivo').addEventListener('change', () => guardarSeccion());
        const enc = raiz.querySelector('#alEncender');
        if (enc) enc.addEventListener('click', () => guardarSeccion(true));
        const onOff = raiz.querySelector('#sgOnOff');
        if (onOff) onOff.addEventListener('click', async () => {
            onOff.disabled = true;
            try { const s = await P.sorteo.publico('principal'); await P.sorteo.config('principal', { activo: !s.activo }); await pintar(); }
            catch (e) { alert(e.message); onOff.disabled = false; }
        });
        raiz.querySelectorAll('.mod-card').forEach(card => {
            const leer = f => { const n = card.querySelector(`[data-f="${f}"]`); return n.type === 'checkbox' ? n.checked : n.value.trim(); };
            const msg = (t, ok) => { const n = card.querySelector('[data-msg]'); n.textContent = t; n.style.color = ok ? '#6ee7a8' : '#ff8a8d'; };
            card.querySelector('[data-f="logo"]').addEventListener('input', e => { if (/^(\/|https:\/\/)/.test(e.target.value)) card.querySelector('[data-prev]').src = e.target.value; });
            card.querySelector('[data-guardar]').addEventListener('click', async () => {
                if (!leer('nombre')) { msg('Ponle un nombre.'); return; }
                msg('Guardando...', true);
                try {
                    await P.sitio.guardarAliado({ id: card.dataset.id ? Number(card.dataset.id) : null, nombre: leer('nombre'), descripcion: leer('descripcion'),
                        fecha_texto: leer('fecha_texto'), orden: leer('orden'), logo: leer('logo'), link: leer('link'), activo: leer('activo') });
                    // Torneo nuevo con la sección apagada: se ofrece encenderla para que se vea
                    if (!card.dataset.id && !c.activo && await P.confirmar({ titulo: 'Torneo agregado', si: 'Sí, mostrar en el inicio', no: 'Todavía no',
                        html: '<p>La sección "Torneos aliados" está <b>apagada</b>, por eso no se ve en el inicio. ¿La enciendo?</p>' })) {
                        await guardarSeccion(true);
                        return;
                    }
                    await pintar();
                } catch (e) { msg(e.message); }
            });
            const b = card.querySelector('[data-borrar]');
            if (b) b.addEventListener('click', async () => {
                const a = filas.find(x => String(x.id) === card.dataset.id);
                const ok = await P.confirmar({ titulo: '¿Borrar este torneo?', peligro: true, si: 'Sí, borrar', html: `<p><b>${esc(a.nombre)}</b> sale de la lista.</p>` });
                if (!ok) return;
                try { await P.sitio.borrarAliado(a.id); await pintar(); } catch (e) { msg(e.message); }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
