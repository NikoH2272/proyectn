/* =====================================================================
   PROYECTN · Sorteos por portal (sql/17)
   - montarPublico(portal): formulario para anotarse. portal.js lo carga solo
     cuando el superadmin activó el sorteo de ese portal. Va en <div id="pgSorteo">
     si la página lo tiene; si no, antes del footer.
   - montarAdmin(raiz, portal, sesion): inscritos, ruleta, fecha límite y
     configuración (activar y código del ticket: solo superadmin).
   El ticket sale con el código del portal: PUMAS-XXXXX, QFD-XXXXX, AZA-XXXXX...
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const PAISES = [['+57', '🇨🇴'], ['+52', '🇲🇽'], ['+54', '🇦🇷'], ['+56', '🇨🇱'], ['+51', '🇵🇪'], ['+593', '🇪🇨'], ['+58', '🇻🇪'],
        ['+591', '🇧🇴'], ['+595', '🇵🇾'], ['+598', '🇺🇾'], ['+502', '🇬🇹'], ['+504', '🇭🇳'], ['+503', '🇸🇻'], ['+505', '🇳🇮'],
        ['+506', '🇨🇷'], ['+507', '🇵🇦'], ['+1', '🇺🇸'], ['+34', '🇪🇸']];

    function estilos() {
        if (document.getElementById('pgSorteoCss')) return;
        const st = document.createElement('style');
        st.id = 'pgSorteoCss';
        st.textContent = `
.pgs{width:min(100%,1180px);margin:0 auto;padding:clamp(40px,5vw,64px) clamp(18px,4vw,40px)}
.pgs-caja{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:24px;align-items:start;padding:clamp(18px,3vw,30px);
  border:1px solid rgba(var(--primary-rgb,216,195,149),.35);border-top:3px solid var(--primary,#D8C395);border-radius:3px;
  background:linear-gradient(145deg,rgba(var(--primary-rgb,216,195,149),.07),transparent 45%),#121212;color:var(--light,#F4EEDC)}
.pgs h2{margin:0 0 6px;color:var(--primary,#D8C395);font:900 clamp(1.2rem,2.6vw,1.8rem)/1.15 var(--font-display,'Michroma',sans-serif);text-transform:uppercase}
.pgs p{margin:0 0 14px;color:var(--gray,#B9B2A4);line-height:1.6}
.pgs form{display:grid;gap:12px}
.pgs label{display:block;margin-bottom:6px;color:var(--primary,#D8C395);font:800 .66rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;text-transform:uppercase}
.pgs input,.pgs select{width:100%;min-height:46px;padding:10px 12px;border:1px solid rgba(var(--primary-rgb,216,195,149),.3);border-radius:2px;
  color:var(--light,#F4EEDC);background:#0c0c0c;font-size:16px}
.pgs .pgs-tel{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px}
.pgs button{min-height:48px;border:1px solid var(--primary,#D8C395);border-radius:2px;color:var(--on-primary,#0A0A0A);background:var(--primary,#D8C395);
  font:900 .8rem var(--font-display,'Michroma',sans-serif);letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
.pgs button:disabled{opacity:.55;cursor:not-allowed}
.pgs-msg{min-height:1.2em;margin:0;color:#ff8a8d;font-size:.9rem}
.pgs-ticket{padding:22px 16px;border:2px dashed var(--primary,#D8C395);text-align:center;background:#0b0b0b}
.pgs-ticket small{display:block;color:var(--gray,#B9B2A4);font-size:.75rem;letter-spacing:.14em;text-transform:uppercase}
.pgs-ticket b{display:block;margin:8px 0;color:var(--primary,#D8C395);font:900 clamp(1.5rem,5vw,2.3rem)/1.1 var(--font-display,'Michroma',sans-serif);letter-spacing:.06em}
.pgs-reloj{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 16px}
.pgs-reloj div{padding:10px 4px;border:1px solid rgba(var(--primary-rgb,216,195,149),.25);background:#0c0c0c;text-align:center}
.pgs-reloj b{display:block;color:var(--primary,#D8C395);font:900 1.4rem var(--font-display,'Michroma',sans-serif)}
.pgs-reloj small{color:var(--gray,#B9B2A4);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase}
.pgs-lista{display:flex;flex-wrap:wrap;gap:6px;max-height:260px;overflow:auto;padding:2px}
.pgs-lista span{padding:5px 9px;border:1px solid rgba(var(--primary-rgb,216,195,149),.22);background:rgba(255,255,255,.03);font-size:.8rem}
.pgs-lista span em{margin-left:6px;color:var(--primary,#D8C395);font:normal .62rem var(--font-display,'Michroma',sans-serif)}
.pgs-ganador{margin-bottom:14px;padding:14px;border:1px solid #FFD54A;background:rgba(255,213,74,.08);color:#FFE38A;text-align:center;font-weight:700}
.pgs-cerrado{padding:14px;border:1px solid rgba(229,72,77,.5);color:#ff8a8d;text-align:center}
@media (max-width:820px){.pgs-caja{grid-template-columns:1fr}}`;
        document.head.appendChild(st);
    }

    function dosDig(n) { return String(n).padStart(2, '0'); }

    /* ---------------- Público ---------------- */
    async function montarPublico(portal, destino) {
        let cfg;
        try { cfg = await P.sorteo.publico(portal); } catch (e) { return; }
        if (!cfg || !cfg.activo) return;
        estilos();

        let cont = destino ? document.getElementById(destino) : document.getElementById('pgSorteo');
        if (!cont) {
            cont = document.createElement('section');
            cont.id = 'sorteo';
            const pie = document.querySelector('footer');
            if (pie) pie.before(cont); else document.body.appendChild(cont);
        }
        cont.classList.add('pgs');
        cont.hidden = false;

        const clave = 'pg_sorteo_' + portal;
        let mio = null;
        try { mio = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (e) { }

        const limite = cfg.fecha_limite ? new Date(cfg.fecha_limite) : null;
        const cerrado = limite && limite < new Date();
        const ganador = cfg.ganador ? `<div class="pgs-ganador">🏆 Ganador: ${esc(cfg.ganador.equipo)} · ${esc(cfg.ganador.codigo)}</div>` : '';
        const lista = (cfg.equipos || []).length ? `<h3 class="subtitulo-bloque" style="margin-top:18px">Equipos anotados (${cfg.total})</h3>
            <div class="pgs-lista">${cfg.equipos.map(e => `<span>${esc(e.equipo)}<em>${esc(e.codigo)}</em></span>`).join('')}</div>`
            : `<p style="margin-top:16px">Anotados: <b>${cfg.total || 0}</b></p>`;

        const formulario = cerrado ? `<div class="pgs-cerrado">⛔ Las inscripciones ya cerraron.</div>`
            : mio ? ticketHTML(mio)
            : `<form id="pgsForm" autocomplete="on">
                <div><label for="pgsEq">Nombre del equipo</label><input id="pgsEq" required maxlength="60" placeholder="Ej: PROYECTN Squad"></div>
                <div><label for="pgsRep">Representante</label><input id="pgsRep" required maxlength="60" placeholder="Nombre de quien inscribe"></div>
                <div><label for="pgsIg">Instagram del equipo</label><input id="pgsIg" maxlength="60" placeholder="@equipo" autocapitalize="none"></div>
                <div><label for="pgsTel">WhatsApp de contacto</label>
                    <div class="pgs-tel"><select id="pgsPais" aria-label="País">${PAISES.map(([c, b]) => `<option value="${c}">${b} ${c}</option>`).join('')}</select>
                    <input id="pgsTel" required inputmode="tel" maxlength="16" placeholder="Número sin espacios"></div></div>
                <button type="submit">🎟️ Anotarme y generar ticket</button>
                <p class="pgs-msg" id="pgsMsg" role="alert"></p>
            </form>`;

        cont.innerHTML = `<div class="pgs-caja">
            <div>
                <h2>🎲 ${esc(cfg.titulo || 'Sorteo')}</h2>
                <p>Anota a tu equipo y recibe tu ticket con el código <b>${esc(cfg.prefijo)}-XXXXX</b>. Un ticket por equipo.</p>
                ${ganador}
                <div id="pgsCuenta"></div>
                ${lista}
            </div>
            <div id="pgsLado">${formulario}</div>
        </div>`;

        if (limite && !cerrado) cuentaRegresiva(cont.querySelector('#pgsCuenta'), limite);
        const form = cont.querySelector('#pgsForm');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault();
            const msg = cont.querySelector('#pgsMsg');
            const btn = form.querySelector('button');
            const d = {
                equipo: form.querySelector('#pgsEq').value.trim(),
                representante: form.querySelector('#pgsRep').value.trim(),
                instagram: form.querySelector('#pgsIg').value.trim(),
                contacto: form.querySelector('#pgsPais').value + ' ' + form.querySelector('#pgsTel').value.replace(/[^\d]/g, '')
            };
            if (!d.equipo || !d.representante || d.contacto.split(' ')[1].length < 6) { msg.textContent = 'Completa equipo, representante y un WhatsApp válido.'; return; }
            btn.disabled = true; msg.textContent = 'Registrando...';
            try {
                const r = await P.sorteo.inscribir(portal, d);
                mio = { codigo: r.codigo, equipo: r.equipo };
                try { localStorage.setItem(clave, JSON.stringify(mio)); } catch (er) { }
                cont.querySelector('#pgsLado').innerHTML = ticketHTML(mio);
            } catch (err) {
                msg.textContent = err.message;
                btn.disabled = false;
            }
        });
    }

    function ticketHTML(t) {
        return `<div class="pgs-ticket"><small>Tu ticket</small><b>${esc(t.codigo)}</b><small>${esc(t.equipo)}</small>
            <p style="margin:12px 0 0">Guarda una captura de este código. Con él se anuncia al ganador.</p></div>`;
    }

    function cuentaRegresiva(nodo, limite) {
        const pintar = () => {
            const d = limite - new Date();
            if (d <= 0) { nodo.innerHTML = `<div class="pgs-cerrado">⛔ Las inscripciones ya cerraron.</div>`; clearInterval(t); return; }
            const s = Math.floor(d / 1000);
            nodo.innerHTML = `<p style="margin:0 0 6px">Cierra el <b>${limite.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</b></p>
                <div class="pgs-reloj"><div><b>${dosDig(Math.floor(s / 86400))}</b><small>Días</small></div><div><b>${dosDig(Math.floor(s % 86400 / 3600))}</b><small>Horas</small></div>
                <div><b>${dosDig(Math.floor(s % 3600 / 60))}</b><small>Min</small></div><div><b>${dosDig(s % 60)}</b><small>Seg</small></div></div>`;
        };
        const t = setInterval(pintar, 1000);
        pintar();
    }

    /* ---------------- Admin del portal ---------------- */
    const aLocal = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

    async function montarAdmin(raiz, portal, ses) {
        estilos();
        const jefe = P.tiene(ses, 'gestionar') || (portal === 'principal' && P.tiene(ses, 'personalizar'));
        let datos;
        const aviso = (t, ok) => { const n = raiz.querySelector('#sgEstado'); if (n) { n.textContent = t; n.style.color = ok ? '#6ee7a8' : '#ff8a8d'; } };

        async function recargar() {
            raiz.innerHTML = `<p class="res-vacio"><i class="fa-solid fa-spinner fa-spin"></i>Cargando sorteo...</p>`;
            try { datos = await P.sorteo.listar(portal); }
            catch (e) { raiz.innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; return; }
            pintar();
        }

        function pintar() {
            const c = datos.config, regs = datos.registros || [];
            raiz.innerHTML = `
            <div class="admin-grid">
                <article class="card-box">
                    <h3><i class="fa-solid fa-sliders"></i> ${esc(c.nombre)} · ${c.activo ? '<span style="color:#6ee7a8">ACTIVO</span>' : '<span style="color:#ff8a8d">INACTIVO</span>'}</h3>
                    ${jefe ? `<label class="chk" style="margin-bottom:12px !important"><input type="checkbox" id="sgActivo" ${c.activo ? 'checked' : ''}> Sorteo activo (sale el formulario en el portal)</label>`
                           : `<p class="muted">Solo el superadmin activa o desactiva el sorteo.</p>`}
                    <div class="form-grid">
                        <div class="form-group"><label for="sgTitulo">Título</label><input id="sgTitulo" value="${esc(c.titulo || '')}" maxlength="80"></div>
                        <div class="form-group"><label for="sgPrefijo">Código del ticket</label><input id="sgPrefijo" value="${esc(c.prefijo)}" maxlength="10" ${jefe ? '' : 'disabled'}></div>
                    </div>
                    <div class="form-grid">
                        <div class="form-group"><label for="sgLimite">Fecha límite (opcional)</label><input id="sgLimite" type="datetime-local" value="${aLocal(c.fecha_limite)}"></div>
                        <div class="form-group"><label>&nbsp;</label><label class="chk"><input type="checkbox" id="sgLista" ${c.mostrar_lista ? 'checked' : ''}> Mostrar la lista de anotados en el portal</label></div>
                    </div>
                    <div class="barra-guardar" style="margin-top:0">
                        <span id="sgEstado" class="muted" role="status"></span>
                        <button class="btn-access" id="sgGuardar"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                    </div>
                </article>
                <article class="card-box" style="text-align:center">
                    <h3><i class="fa-solid fa-dice"></i> Sorteo en vivo</h3>
                    <div class="pgs-ticket" style="margin-bottom:14px"><small>Ticket</small><b id="sgTicket">${esc(c.prefijo)}-XXXXX</b><small id="sgEquipo">${regs.length} equipos anotados</small></div>
                    ${c.ganador ? `<div class="pgs-ganador">Último ganador: ${esc(c.ganador.equipo)} · ${esc(c.ganador.codigo)}</div>` : ''}
                    <button class="btn-access" id="sgGirar" ${regs.length ? '' : 'disabled'}><i class="fa-solid fa-play"></i> Iniciar sorteo</button>
                </article>
            </div>
            <h3 class="bloque-titulo"><i class="fa-solid fa-list"></i> Equipos anotados (${regs.length})
                <span style="float:right;display:flex;gap:8px">
                    <button class="btn-mini" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button>
                    <button class="btn-mini btn-borrar" id="sgVaciar" ${regs.length ? '' : 'disabled'}><i class="fa-solid fa-broom"></i> Vaciar lista</button>
                </span></h3>
            <div class="card-box pg-tabla-wrap" style="max-width:1180px">
                <table class="pg-tabla" style="min-width:760px"><thead><tr><th>#</th><th>Equipo</th><th>Representante</th><th>Instagram</th><th>WhatsApp</th><th>Ticket</th><th>Fecha</th><th></th></tr></thead>
                <tbody>${regs.length ? regs.map((r, i) => `<tr>
                    <td>${regs.length - i}</td><td><b>${esc(r.equipo)}</b></td><td>${esc(r.representante || '')}</td>
                    <td>${r.instagram ? `<a href="https://instagram.com/${esc(r.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">${esc(r.instagram)}</a>` : ''}</td>
                    <td>${r.contacto ? `<a href="https://wa.me/${esc(r.contacto.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener" style="color:#25D366">${esc(r.contacto)}</a>` : ''}</td>
                    <td><code>${esc(r.codigo)}</code></td><td><small>${new Date(r.creado).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</small></td>
                    <td><button class="btn-mini btn-borrar" data-borrar="${r.id}" title="Quitar"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
                    : `<tr class="vacio"><td colspan="8"><i class="fa-solid fa-inbox"></i>Todavía no hay equipos anotados.</td></tr>`}</tbody></table>
            </div>`;

            raiz.querySelector('#sgGuardar').addEventListener('click', async () => {
                const lim = raiz.querySelector('#sgLimite').value;
                const cambios = {
                    titulo: raiz.querySelector('#sgTitulo').value,
                    fecha_limite: lim ? new Date(lim).toISOString() : null,
                    quitar_fecha: !lim,
                    mostrar_lista: raiz.querySelector('#sgLista').checked
                };
                if (jefe) {
                    cambios.activo = raiz.querySelector('#sgActivo').checked;
                    cambios.prefijo = raiz.querySelector('#sgPrefijo').value.trim().toUpperCase();
                }
                aviso('Guardando...', true);
                try { await P.sorteo.config(portal, cambios); await recargar(); aviso('✔ Guardado', true); }
                catch (e) { aviso(e.message); }
            });
            raiz.querySelector('#sgGirar').addEventListener('click', () => girar(regs));
            raiz.querySelector('#sgVaciar').addEventListener('click', async () => {
                const ok = await P.confirmar({ titulo: '¿Vaciar la lista?', peligro: true, si: 'Sí, vaciar',
                    html: `<p>Se borran los <b>${regs.length}</b> equipos anotados y el último ganador. Úsalo para empezar un sorteo nuevo. No se puede deshacer.</p>` });
                if (!ok) return;
                try { await P.sorteo.vaciar(portal); await recargar(); } catch (e) { aviso(e.message); }
            });
            raiz.querySelectorAll('[data-borrar]').forEach(b => b.addEventListener('click', async () => {
                const r = regs.find(x => String(x.id) === b.dataset.borrar);
                const ok = await P.confirmar({ titulo: '¿Quitar este equipo?', peligro: true, si: 'Sí, quitar', html: `<p><b>${esc(r.equipo)}</b> · ${esc(r.codigo)}</p>` });
                if (!ok) return;
                try { await P.sorteo.borrar(portal, r.id); await recargar(); } catch (e) { aviso(e.message); }
            }));
        }

        function girar(regs) {
            const t = raiz.querySelector('#sgTicket'), eq = raiz.querySelector('#sgEquipo'), btn = raiz.querySelector('#sgGirar');
            btn.disabled = true;
            t.classList.remove('pgs-ganador');
            const fin = Date.now() + 3200;
            let paso = 45;
            const tick = () => {
                const r = regs[Math.floor(Math.random() * regs.length)];
                t.textContent = r.codigo; eq.textContent = r.equipo;
                if (Date.now() < fin) { paso *= 1.06; setTimeout(tick, paso); return; }
                const g = regs[crypto.getRandomValues(new Uint32Array(1))[0] % regs.length];
                t.textContent = '🏆 ' + g.codigo; eq.textContent = '¡GANADOR: ' + g.equipo.toUpperCase() + '!';
                eq.style.color = '#FFD54A';
                P.confirmar({ titulo: '🏆 ¡Tenemos ganador!', si: 'Guardar como ganador', no: 'Solo mostrar',
                    html: `<p style="font-size:1.2rem"><b>${esc(g.equipo)}</b><br><code>${esc(g.codigo)}</code></p><p class="muted">Si lo guardas, sale en la página pública del portal.</p>` })
                    .then(async ok => {
                        btn.disabled = false;
                        if (!ok) return;
                        try { await P.sorteo.ganador(portal, g.id); aviso('✔ Ganador guardado', true); } catch (e) { aviso(e.message); }
                    });
            };
            tick();
        }

        await recargar();
    }

    window.PumasSorteo = { montarPublico, montarAdmin, estilos };
})();
