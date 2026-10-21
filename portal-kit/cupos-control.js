/* =====================================================================
   PROYECTN · Control de cupos: VIP, baneados y "Generar baneo" (sql/25)
    Disponible en cada portal con cupos, con datos separados por portal.
   PumasControl.montarVip(contId, portal, {agregar}) → horarios VIP + lista VIP (verificar y copiar)
   PumasControl.montarBaneos(contId, portal)   → baneo por equipo y/o número
   PumasControl.revisarSalas(portal, equipos)  → ventana GENERAR BANEO con los
        equipos que no jugaron 2 salas o no jugaron la última.
        equipos: [{ equipo, salas: [true/false por sala] }]
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PAISES = ['+57', '+52', '+54', '+56', '+51', '+593', '+58', '+591', '+595', '+598', '+502', '+504', '+503', '+505', '+506', '+507', '+1', '+34'];
    const fecha = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Indefinido';
    const hoy = () => new Date().toISOString().slice(0, 10);
    // Páginas ocultas de cupos VIP (solo con el link, como Registrar VIP)
    const LINK_VIP = {
        entrenamientos: '/entrenamientos/cupos-vip.html',
        pruebas: '/pruebas/cupos-vip.html',
        ascensosqfd: '/ascensosqfd/cupos-vip.html',
        row: '/row/cupos-vip.html',
        rusheo: '/rusheo/cupos-vip.html',
        dragonfest: '/dragonfest/cupos-vip.html',
        dragonfestfem: '/dragonfest/cupos-vip-femenino.html',
        zmf: '/zmf/cupos-vip.html',
        zmffem: '/zmf/cupos-vip-femenino.html'
    };
    const errorSql = e => /admin_vip|admin_baneo|PGRST202|Could not find/i.test(e.message) ? 'Falta correr sql/25_cupos_vip_y_baneos.sql en Supabase.' : e.message;

    const CSS = `
.cc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px;align-items:end}
.cc-tel{display:grid;grid-template-columns:96px 1fr;gap:8px}
.cc-form input,.cc-form select{width:100%}
.cc-form [hidden],.cc-form .form-group[hidden]{display:none!important}
.cc-masivo{margin:14px 0 4px;padding:10px 14px;border:1px dashed rgba(var(--primary-rgb,216,195,149),.35)}
.cc-masivo summary{cursor:pointer;color:var(--primary,#D8C395);font-weight:700}
.cc-masivo textarea{background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:4px;padding:10px;font-family:inherit;font-size:15px}
.cc-hora{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.cc-hora input[type=number]{width:64px!important;text-align:center}
.cc-hora select{width:auto!important;min-width:64px}
.cc-hora span{color:var(--primary,#D8C395);font-weight:800;font-size:.8rem;letter-spacing:.06em}
.cc-tabla input[type=number],.cc-tabla input[type=url],.cc-tabla input[type=text],.cc-tabla input[type=datetime-local],.cc-form input:not([type=checkbox]),.cc-form select{background:#0a0b10;color:#fff;border:1px solid rgba(216,195,149,.3);border-radius:4px;padding:9px 10px;font-size:15px}
.cc-tabla input[type=checkbox]{width:18px;height:18px;accent-color:#D8C395}
@media (max-width:640px){
  .cc-horarios thead{display:none}
  .cc-horarios,.cc-horarios tbody{display:block}
  .cc-horarios tr{display:grid;grid-template-columns:32px 1fr 90px;gap:8px 10px;align-items:center;padding:10px;border-top:1px solid rgba(255,255,255,.08)}
  .cc-horarios td{padding:0;border:0}
  .cc-horarios td:nth-child(2) input{width:100%!important}
  .cc-horarios td:nth-child(4){grid-column:1/-1}
  .cc-horarios td:nth-child(4) input{min-width:0!important}
  .cc-horarios td:nth-child(5){grid-column:1/-1;justify-self:end}
}
.cc-msg{margin:10px 0 0;font-size:.88rem}
.cc-link{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;padding:12px 14px;border:1px solid rgba(255,213,74,.55);border-radius:8px;background:rgba(255,213,74,.07)}
.cc-link small{display:block;color:#FFE38A;font-size:.72rem;letter-spacing:.04em;margin-bottom:4px}
.cc-link code{color:#fff;font-size:.9rem;word-break:break-all}
.cc-h{display:flex;align-items:center;gap:8px;margin:24px 0 10px;color:#D8C395;font-size:.85rem;letter-spacing:.06em}
.cc-h small{color:#9a9a9a;letter-spacing:0}
.cc-tabla-wrap{overflow-x:auto;border:1px solid rgba(216,195,149,.2);border-radius:6px}
.cc-tabla{width:100%;border-collapse:collapse;font-size:.86rem}
.cc-tabla th{padding:8px;color:#D8C395;font-size:.62rem;letter-spacing:.06em;text-align:left;background:rgba(0,0,0,.35);white-space:nowrap}
.cc-tabla td{padding:8px;border-top:1px solid rgba(255,255,255,.06);color:#ddd;vertical-align:middle}
.cc-tabla tr.vencido td{opacity:.5}
.cc-vacio{padding:14px;color:#9a9a9a;text-align:center}
.cc-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid rgba(216,195,149,.35);border-radius:4px;background:transparent;color:#D8C395;font-size:.78rem;cursor:pointer}
.cc-btn:hover{background:rgba(216,195,149,.1)}
.cc-btn.rojo{border-color:rgba(255,85,85,.5);color:#ff8a8d}
.cc-btn.verde{border-color:rgba(110,231,168,.5);color:#6ee7a8}
.cc-btn.lleno{background:#D8C395;color:#0a0b10;border-color:#D8C395;font-weight:bold}
.cc-btn:disabled{opacity:.5;cursor:default}
.cc-chip{display:inline-block;padding:2px 7px;border-radius:3px;font-size:.66rem;font-weight:bold;letter-spacing:.05em}
.cc-chip.vip{background:#FFD54A;color:#1a1400}
.cc-chip.pub{background:rgba(255,255,255,.12);color:#ddd}
.cc-capa{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.82);backdrop-filter:blur(4px)}
.cc-ventana{width:100%;max-width:640px;max-height:92vh;overflow:auto;padding:22px;background:#121317;border:1px solid rgba(255,85,85,.5);border-radius:10px;color:#eee}
.cc-ventana h3{margin:0 0 6px;color:#ff8a8d;font-size:1.1rem;letter-spacing:.06em}
.cc-ventana p{margin:0 0 12px;color:#bbb;font-size:.9rem}
.cc-item{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;margin-bottom:8px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:rgba(0,0,0,.3)}
.cc-item b{color:#fff}.cc-item small{display:block;color:#FFD54A;font-size:.78rem}
.cc-item.hecho{opacity:.55}
.cc-pie{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}`;
    function estilos() {
        if (document.getElementById('pgControlCss')) return;
        const st = document.createElement('style'); st.id = 'pgControlCss'; st.textContent = CSS; document.head.appendChild(st);
    }
    const campoTel = (pref) => `<div class="cc-tel"><select data-${pref}="pais">${PAISES.map(p => `<option>${p}</option>`).join('')}</select>
        <input data-${pref}="tel" inputmode="tel" maxlength="16" placeholder="Número sin espacios"></div>`;

    /* ---------------- VIP ---------------- */
    // Horas VIP por defecto (hora local del dispositivo — sin dependencia de timezone)
    const HORAS_VIP = [11, 14, 17, 19, 20];
    const toLocal = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const dtDefault = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return toLocal(d); };
    const fmtDt = v => new Date(v).toLocaleString('es', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const claveHorarios = portal => 'pg_vip_horarios_' + portal;
    const horariosGuardados = portal => {
        try { const l = JSON.parse(localStorage.getItem(claveHorarios(portal))); if (Array.isArray(l) && l.length && l[0].dt) return l; } catch (e) {}
        return HORAS_VIP.map(h => ({ dt: dtDefault(h) }));
    };
    const guardarHorarios = (portal, l) => { try { localStorage.setItem(claveHorarios(portal), JSON.stringify(l)); } catch (e) {} };
    // El link de cada horario se recuerda en este navegador (indexado por HH:MM)
    const claveLink = (portal, dt) => 'pg_vip_link_' + portal + '_' + (dt || '').slice(11, 16);
    const linkGuardado = (portal, dt) => { try { return localStorage.getItem(claveLink(portal, dt)) || ''; } catch (e) { return ''; } };
    const guardarLink = (portal, dt, v) => { try { localStorage.setItem(claveLink(portal, dt), v); } catch (e) {} };

    // opts.agregar: true = aquí se agregan equipos VIP (Pruebas). En Pumas se agregan en VIP → Registrar VIP.
    async function montarVip(contId, portal, opts) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        estilos();
        const agregar = !!(opts && opts.agregar);
        const linkVip = LINK_VIP[portal] || `/modulo/cupos-vip.html?p=${encodeURIComponent(portal)}`;
        cont.innerHTML = `
            <div class="cc-link"><div><small><i class="fa-solid fa-link"></i> LINK OCULTO DE CUPOS VIP · no sale en el portal ni en el menú: compártelo solo con los VIP</small>
                <code data-v="link">${esc(location.origin + linkVip)}</code></div>
                <div style="display:flex;gap:6px"><button class="cc-btn lleno" data-v="copiar" type="button"><i class="fa-solid fa-copy"></i> Copiar</button>
                <a class="cc-btn" href="${esc(linkVip)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir</a></div></div>

            <div class="cc-h"><i class="fa-solid fa-clock"></i> HORARIOS VIP</div>
            <div class="cc-tabla-wrap" style="margin-top:6px"><table class="cc-tabla cc-horarios"><thead><tr>
                <th style="width:40px"><input type="checkbox" data-v="todos" title="Habilitar todos"></th><th>FECHA Y HORA</th><th>CUPOS</th><th>LINK DEL GRUPO</th><th></th></tr></thead>
                <tbody data-v="filas"></tbody></table></div>
            <button class="cc-btn" type="button" data-v="masHorario" style="margin-top:8px"><i class="fa-solid fa-plus"></i> Agregar horario</button>
            <p class="muted" style="margin:6px 0 0;font-size:.8rem"><i class="fa-solid fa-circle-info"></i> Cada horario tiene su propio grupo. El link queda guardado en este navegador para la próxima vez.</p>
            <div class="cc-form" style="margin-top:12px">
                <div class="form-group"><label>Cierre de inscripciones</label>
                    <select data-v="cierre"><option value="entreno">Hasta la hora de cada entreno</option><option value="fija">Todos hasta una fecha/hora fija</option></select></div>
                <div class="form-group" data-v="cajaFija" hidden><label>Fecha y hora de cierre</label>
                    <input type="datetime-local" data-v="cierreFijo"></div>
                <div class="form-group"><button class="btn-generar" data-v="crear" type="button"><i class="fa-solid fa-crown"></i> Crear cupos VIP</button></div>
            </div>
            <p class="cc-msg" data-v="msgH" role="status"></p>

            ${agregar ? `<div class="cc-h"><i class="fa-solid fa-user-plus"></i> AGREGAR EQUIPO VIP</div>
            <div class="cc-form">
                <div class="form-group"><label>Nombre del equipo</label><input data-v="equipo" maxlength="60" placeholder="Ej: LOS TIGRES"></div>
                <div class="form-group"><label>Número con el que se anotó</label>${campoTel('v')}</div>
                <div class="form-group"><button class="btn-generar" data-v="agregar" type="button"><i class="fa-solid fa-crown"></i> Agregar a VIP</button></div>
            </div>` : ''}
            <p class="cc-msg" data-v="msg" role="status"></p>
            <div data-v="lista"><p class="cc-vacio">Cargando...</p></div>`;
        const $ = k => cont.querySelector(`[data-v="${k}"]`);
        const msg = (t, c, k) => { const n = $(k || 'msg'); n.textContent = t; n.style.color = c || ''; };
        const copiar = async (texto, k) => {
            try { await navigator.clipboard.writeText(texto); msg('✔ Copiado.', '#6ee7a8', k); }
            catch (e) { window.prompt('Copia el texto:', texto); }
        };
        if ($('copiar')) $('copiar').onclick = () => copiar($('link').textContent);

        /* --- Horarios (datetime-local, hora local del dispositivo) --- */
        const filaHorario = x => `<tr data-h>
            <td><input type="checkbox" data-hab></td>
            <td><input type="datetime-local" data-dt value="${esc(x.dt || '')}" style="min-width:180px"></td>
            <td><input type="number" data-cupos min="1" max="50" value="12" style="width:90px"></td>
            <td><input type="url" data-link placeholder="https://chat.whatsapp.com/..." value="${esc(x.dt ? linkGuardado(portal, x.dt) : '')}" style="min-width:230px;width:100%"></td>
            <td><button class="cc-btn rojo" type="button" data-quitarh title="Quitar horario" aria-label="Quitar horario"><i class="fa-solid fa-xmark"></i></button></td></tr>`;
        const tbody = $('filas');
        tbody.innerHTML = horariosGuardados(portal).map(filaHorario).join('');
        const filasH = () => [...tbody.querySelectorAll('[data-h]')];
        const recordar = () => guardarHorarios(portal, filasH().map(tr => ({ dt: tr.querySelector('[data-dt]').value })));
        tbody.addEventListener('input', e => { if (e.target.matches('[data-dt]')) recordar(); horarios(); });
        tbody.addEventListener('click', e => {
            const b = e.target.closest('[data-quitarh]');
            if (!b) return;
            if (filasH().length <= 1) { msg('Deja al menos un horario.', '#ff8a8d', 'msgH'); return; }
            b.closest('tr').remove(); recordar(); horarios();
        });
        $('masHorario').onclick = () => { tbody.insertAdjacentHTML('beforeend', filaHorario({ dt: dtDefault(20) })); recordar(); horarios(); };
        function horarios() {
            const fija = $('cierre').value === 'fija';
            $('cajaFija').hidden = !fija;
            const dtFijo = fija && $('cierreFijo').value ? new Date($('cierreFijo').value) : null;
            return filasH().map(tr => {
                const dtVal = tr.querySelector('[data-dt]').value;
                const fecha = dtVal ? new Date(dtVal) : null;
                const hab = tr.querySelector('[data-hab]').checked;
                let cierre = fecha;
                if (dtFijo && fecha && dtFijo < fecha) cierre = dtFijo;
                return { hab, dt: dtVal, txt: dtVal ? fmtDt(dtVal) : '—', fecha, cierre, cupos: Number(tr.querySelector('[data-cupos]').value), link: tr.querySelector('[data-link]').value.trim() };
            });
        }
        ['cierre', 'cierreFijo'].forEach(k => { $(k).addEventListener('input', horarios); $(k).addEventListener('change', horarios); });
        $('todos').onchange = () => { filasH().forEach(tr => { tr.querySelector('[data-hab]').checked = $('todos').checked; }); horarios(); };
        horarios();

        $('crear').onclick = async () => {
            const lista = horarios().filter(h => h.hab);
            if (!lista.length) { msg('Habilita al menos un horario.', '#ff8a8d', 'msgH'); return; }
            if (lista.some(h => !h.dt)) { msg('Completa la fecha y hora de los horarios habilitados.', '#ff8a8d', 'msgH'); return; }
            const sinLink = lista.filter(h => !/^https:\/\//.test(h.link));
            if (sinLink.length) { msg('Pon el link del grupo de: ' + sinLink.map(h => h.txt).join(', ') + ' (debe empezar con https://).', '#ff8a8d', 'msgH'); return; }
            if (lista.some(h => !(h.cupos >= 1 && h.cupos <= 50))) { msg('Los cupos van de 1 a 50.', '#ff8a8d', 'msgH'); return; }
            if (lista.some(h => !h.fecha || h.cierre <= new Date())) { msg('Hay horarios con fecha/hora ya pasada (revisa la fecha o el cierre).', '#ff8a8d', 'msgH'); return; }
            if (!confirm(`¿Crear ${lista.length} cupo(s) VIP?\n\n` + lista.map(h => `· ${h.txt} · ${h.cupos} cupos`).join('\n'))) return;
            $('crear').disabled = true;
            msg('Creando...', '', 'msgH');
            let hechos = 0;
            try {
                for (const h of lista) {
                    const titulo = `VIP · ${h.txt}`;
                    if (portal === 'entrenamientos') {
                        // Pumas: sus cupos están en entrenamientos_programados (igual que Programar)
                        const { error } = await P.db().from('entrenamientos_programados').insert([{ titulo, fecha: h.fecha.toISOString(), hay_staff: 'NO',
                            cupos_totales: h.cupos, link_grupo: h.link, tipo: 'VIP', cierra_en: h.cierre < h.fecha ? h.cierre.toISOString() : null }]);
                        if (error) throw error;
                    } else {
                        const r = await P.cupos.guardar(portal, { titulo, fecha: h.fecha, cupos: h.cupos, link: h.link, publicar_en: null, staff: [] });
                        await P.cupos.vip(portal, r.id, h.cierre < h.fecha ? h.cierre : null);
                    }
                    guardarLink(portal, h.dt, h.link);
                    hechos++;
                }
                msg(`✔ ${hechos} cupo(s) VIP creados. Salen solo en el link oculto.`, '#6ee7a8', 'msgH');
                filasH().forEach(tr => { tr.querySelector('[data-hab]').checked = false; }); $('todos').checked = false; recordar(); horarios();
                if (opts && typeof opts.alCrear === 'function') opts.alCrear();
            } catch (e) {
                msg((hechos ? `Se crearon ${hechos}; los demás no: ` : '') + (/tipo|cierra_en|admin_cupo_vip|PGRST/i.test(e.message || '') ? 'falta correr sql/25_cupos_vip_y_baneos.sql en Supabase.' : e.message), '#ff8a8d', 'msgH');
            } finally { $('crear').disabled = false; }
        };

        /* --- Lista VIP (verificar y copiar) --- */
        async function pintar() {
            let r;
            try { r = await P.control.vipLista(portal); } catch (e) { $('lista').innerHTML = `<p class="cc-vacio">${esc(errorSql(e))}</p>`; return; }
            // Una sola lista: registros aprobados (Pumas) + la lista del portal
            const todos = [...(r.registros || []).map(f => Object.assign({ origen: 'Registro VIP' }, f)), ...r.lista.map(f => Object.assign({ origen: 'Lista' }, f))];
            const conTag = todos.some(f => f.tag);
            $('lista').innerHTML = `<div class="cc-h"><i class="fa-solid fa-list-check"></i> LISTA VIP <small>(${todos.length}) · así deben inscribirse: mismo nombre y mismo número</small>
                    <button class="cc-btn" data-v="copiarLista" type="button" style="margin-left:auto"><i class="fa-solid fa-copy"></i> Copiar lista</button></div>
                ${!agregar ? '<p class="muted" style="margin:0 0 10px;font-size:.85rem"><i class="fa-solid fa-circle-info"></i> Aquí solo se verifica. Los equipos VIP se agregan en <b>VIP → Registrar VIP</b> (solicitudes aprobadas).</p>' : ''}
                ${todos.length ? `<div class="cc-tabla-wrap"><table class="cc-tabla"><thead><tr><th>#</th><th>EQUIPO</th>${conTag ? '<th>TAG</th>' : ''}<th>NÚMERO</th>${portal === 'entrenamientos' ? '<th>ORIGEN</th>' : ''}${agregar ? '<th></th>' : ''}</tr></thead><tbody>
                    ${todos.map((f, i) => `<tr><td>${i + 1}</td><td><b>${esc(f.equipo)}</b></td>${conTag ? `<td>${esc(f.tag || '')}</td>` : ''}<td>${esc(f.telefono)}</td>
                    ${portal === 'entrenamientos' ? `<td class="muted">${esc(f.origen)}</td>` : ''}
                    ${agregar ? `<td style="text-align:right">${f.id ? `<button class="cc-btn rojo" data-borrar="${f.id}"><i class="fa-solid fa-trash"></i> Quitar</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`
                    : '<p class="cc-vacio">Todavía no hay equipos VIP.</p>'}`;
            $('copiarLista').onclick = () => copiar(`LISTA VIP (${todos.length})\n` + todos.map((f, i) => `${i + 1}. ${f.equipo}${f.tag ? ' (' + f.tag + ')' : ''} · ${f.telefono}`).join('\n'));
            $('lista').querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
                if (!confirm('¿Quitar este equipo de la lista VIP?')) return;
                try { await P.control.vipBorrar(portal, Number(b.dataset.borrar)); pintar(); } catch (e) { msg(errorSql(e), '#ff8a8d'); }
            });
        }
        if (agregar) $('agregar').onclick = async () => {
            const equipo = $('equipo').value.trim(), tel = $('tel').value.replace(/[^\d]/g, '');
            if (!equipo || tel.length < 7) { msg('Escribe el nombre del equipo y un número válido.', '#ff8a8d'); return; }
            try {
                await P.control.vipGuardar(portal, equipo, $('pais').value + ' ' + tel);
                $('equipo').value = ''; $('tel').value = '';
                msg('✔ Agregado a VIP.', '#6ee7a8'); pintar();
            } catch (e) { msg(errorSql(e), '#ff8a8d'); }
        };
        pintar();
    }

    /* ---------------- Baneados (equipo y número) ---------------- */
    async function montarBaneos(contId, portal, alCambiar) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        estilos();
        cont.innerHTML = `
            <p class="tool-desc">Un equipo o un número baneado <b>no consigue cupo</b>, ni público ni VIP. Puedes banear el equipo, el número o los dos a la vez.
                La lista de equipos sale en el portal; los números nunca se muestran en público.</p>
            <div class="cc-form">
                <div class="form-group"><label>Equipo</label><input data-b="equipo" maxlength="60" placeholder="Nombre del equipo"></div>
                <div class="form-group"><label>Número (opcional)</label>${campoTel('b')}</div>
                <div class="form-group"><label>Motivo</label><input data-b="motivo" maxlength="200" placeholder="Ej: No jugó la última sala"></div>
                <div class="form-group"><label>Hasta (vacío = indefinido)</label><input data-b="hasta" type="date"></div>
                <div class="form-group"><button class="btn-generar" data-b="agregar" type="button"><i class="fa-solid fa-ban"></i> Banear</button></div>
            </div>
            <details class="cc-masivo" data-b="masivo"><summary><i class="fa-solid fa-list"></i> Carga masiva · pegar una lista o subir un archivo</summary>
                <p class="muted" style="margin:8px 0">Una línea por baneo: <code>EQUIPO, +57 3001234567</code> · solo el equipo · o solo el número. Sirven coma, punto y coma, tabulación o guion.
                    Las líneas que empiezan con # se ignoran.</p>
                <textarea data-b="lista_txt" rows="6" style="width:100%;min-height:130px" placeholder="TOXIC SQUAD, +57 3009990001&#10;GHOST TEAM&#10;+52 5599990002"></textarea>
                <div class="cc-form" style="margin-top:10px">
                    <div class="form-group"><label>O sube un archivo (.txt o .csv)</label><input type="file" data-b="archivo" accept=".txt,.csv,text/plain,text/csv"></div>
                    <div class="form-group"><label>Motivo para todos</label><input data-b="motivoM" maxlength="200" placeholder="Ej: No se presentaron"></div>
                    <div class="form-group"><label>Hasta (vacío = indefinido)</label><input data-b="hastaM" type="date"></div>
                    <div class="form-group"><button class="btn-generar" data-b="banearLista" type="button"><i class="fa-solid fa-ban"></i> Banear la lista</button></div>
                </div>
                <p class="cc-msg" data-b="msgM" role="status"></p>
            </details>
            <p class="cc-msg" data-b="msg" role="status"></p>
            <div data-b="lista"><p class="cc-vacio">Cargando...</p></div>`;
        const $ = k => cont.querySelector(`[data-b="${k}"]`);
        const msg = (t, c) => { $('msg').textContent = t; $('msg').style.color = c || ''; };
        const vencido = b => b.hasta && b.hasta < hoy();
        async function pintar() {
            let r;
            try { r = await P.control.baneos(portal); } catch (e) { $('lista').innerHTML = `<p class="cc-vacio">${esc(errorSql(e))}</p>`; return; }
            const tabla = (filas, tipo) => filas.length ? `<div class="cc-tabla-wrap"><table class="cc-tabla"><thead><tr><th>${tipo === 'telefono' ? 'NÚMERO' : 'EQUIPO'}</th>
                <th>${tipo === 'telefono' ? 'EQUIPO' : 'TAG'}</th><th>MOTIVO</th><th>HASTA</th><th></th></tr></thead><tbody>
                ${filas.map(f => `<tr class="${vencido(f) ? 'vencido' : ''}"><td><b>${esc(tipo === 'telefono' ? f.telefono : f.equipo)}</b></td><td>${esc((tipo === 'telefono' ? f.equipo : f.tag) || '—')}</td>
                    <td>${esc(f.motivo || '—')}</td><td>${fecha(f.hasta)}${vencido(f) ? ' · vencido' : ''}</td>
                    <td style="text-align:right"><button class="cc-btn verde" data-quitar="${f.id}" data-tipo="${tipo}"><i class="fa-solid fa-hand-holding-heart"></i> Desbanear</button></td></tr>`).join('')}</tbody></table></div>`
                : '<p class="cc-vacio">Nadie baneado.</p>';
            $('lista').innerHTML = `<div class="cc-h"><i class="fa-solid fa-users-slash"></i> EQUIPOS BANEADOS <small>(${r.equipos.length})</small></div>${tabla(r.equipos, 'equipo')}
                <div class="cc-h"><i class="fa-solid fa-phone-slash"></i> NÚMEROS BANEADOS <small>(${r.telefonos.length}) · privados</small></div>${tabla(r.telefonos, 'telefono')}`;
            $('lista').querySelectorAll('[data-quitar]').forEach(b => b.onclick = async () => {
                if (!confirm('¿Quitar este baneo? Podrá volver a inscribirse a los cupos.')) return;
                try { await P.control.desbanear(portal, b.dataset.tipo, Number(b.dataset.quitar)); pintar(); if (alCambiar) alCambiar(); } catch (e) { msg(errorSql(e), '#ff8a8d'); }
            });
        }
        /* --- Carga masiva --- */
        // Cada línea: equipo y/o número. El número es lo que tenga 7+ dígitos (con o sin +indicativo).
        function leerLista(texto) {
            return String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
                const partes = l.split(/\s*[,;\t]\s*|\s+-\s+/).map(x => x.trim()).filter(Boolean);
                let telefono = '', equipo = [];
                partes.forEach(x => {
                    const dig = x.replace(/[^\d]/g, '');
                    if (!telefono && dig.length >= 7 && /^[+\d\s().-]+$/.test(x)) telefono = (x.trim().startsWith('+') ? '+' : '') + dig;
                    else equipo.push(x);
                });
                return { equipo: equipo.join(' ').slice(0, 60), telefono };
            }).filter(x => x.equipo || x.telefono);
        }
        $('archivo').addEventListener('change', async () => {
            const f = $('archivo').files[0];
            if (!f) return;
            const txt = await f.text();
            $('lista_txt').value = ($('lista_txt').value.trim() ? $('lista_txt').value.trim() + '\n' : '') + txt.replace(/^\uFEFF/, '');
            $('msgM').textContent = `${leerLista($('lista_txt').value).length} línea(s) listas para banear.`; $('msgM').style.color = '';
        });
        $('banearLista').onclick = async () => {
            const lista = leerLista($('lista_txt').value), m = $('msgM');
            if (!lista.length) { m.textContent = 'Pega la lista o sube un archivo.'; m.style.color = '#ff8a8d'; return; }
            const nEq = lista.filter(x => x.equipo).length, nTel = lista.filter(x => x.telefono).length;
            if (!confirm(`¿Banear ${lista.length} línea(s)? (${nEq} equipo(s) y ${nTel} número(s))`)) return;
            const motivo = $('motivoM').value.trim(), hasta = $('hastaM').value || null;
            $('banearLista').disabled = true;
            let ok = 0; const fallos = [];
            for (const x of lista) {
                m.textContent = `Baneando ${ok + fallos.length + 1} de ${lista.length}...`; m.style.color = '';
                try { await P.control.banear(portal, { equipo: x.equipo, telefono: x.telefono || null, motivo, hasta }); ok++; }
                catch (e) { fallos.push(`${x.equipo || x.telefono}: ${errorSql(e)}`); }
            }
            $('banearLista').disabled = false;
            m.textContent = `✔ ${ok} baneado(s).` + (fallos.length ? ` ${fallos.length} con error: ${fallos.slice(0, 3).join(' · ')}${fallos.length > 3 ? '…' : ''}` : '');
            m.style.color = fallos.length ? '#FFD54A' : '#6ee7a8';
            if (ok) { $('lista_txt').value = ''; $('archivo').value = ''; pintar(); if (alCambiar) alCambiar(); }
        };

        $('agregar').onclick = async () => {
            const equipo = $('equipo').value.trim(), tel = $('tel').value.replace(/[^\d]/g, '');
            if (!equipo && tel.length < 7) { msg('Escribe el equipo, el número o los dos.', '#ff8a8d'); return; }
            try {
                await P.control.banear(portal, { equipo, telefono: tel ? $('pais').value + ' ' + tel : null, motivo: $('motivo').value.trim(), hasta: $('hasta').value || null });
                ['equipo', 'tel', 'motivo', 'hasta'].forEach(k => { $(k).value = ''; });
                msg('✔ Baneado.', '#6ee7a8'); pintar(); if (alCambiar) alCambiar();
            } catch (e) { msg(errorSql(e), '#ff8a8d'); }
        };
        pintar();
    }

    /* ---------------- GENERAR BANEO (al cargar resultados) ---------------- */
    // equipos: [{ equipo, salas: [bool...] }] → los que jugaron menos de 2 salas o no jugaron la última
    function candidatos(equipos) {
        return (equipos || []).map(e => {
            const n = e.salas.length, jugadas = e.salas.filter(Boolean).length;
            const motivos = [];
            if (n >= 2 && jugadas < 2) motivos.push(`Jugó ${jugadas} de ${n} salas`);
            if (n >= 2 && !e.salas[n - 1]) motivos.push('No jugó la última sala');
            return { equipo: e.equipo, jugadas, total: n, motivos };
        }).filter(c => c.motivos.length);
    }

    function revisarSalas(portal, equipos) {
        const lista = candidatos(equipos);
        if (!lista.length) return false;
        estilos();
        const capa = document.createElement('div');
        capa.className = 'cc-capa';
        capa.innerHTML = `<div class="cc-ventana" role="dialog" aria-modal="true" aria-labelledby="ccTitulo">
            <h3 id="ccTitulo"><i class="fa-solid fa-gavel"></i> GENERAR BANEO</h3>
            <p>Estos equipos <b>no jugaron 2 salas</b> o <b>no jugaron la última</b>. <b>Banear</b> los saca de los cupos (equipo y el número con que se inscribieron);
               <b>Perdonar</b> los quita de esta lista sin banearlos.</p>
            <div class="cc-g-lista">${lista.map((c, i) => `<div class="cc-item" data-i="${i}">
                <div><b>${esc(c.equipo)}</b><small><i class="fa-solid fa-triangle-exclamation"></i> ${esc(c.motivos.join(' · '))}</small></div>
                <div style="display:flex;gap:6px"><button class="cc-btn rojo" data-banear="${i}"><i class="fa-solid fa-ban"></i> Banear</button>
                    <button class="cc-btn verde" data-perdonar="${i}"><i class="fa-solid fa-hand-holding-heart"></i> Perdonar</button></div></div>`).join('')}</div>
            <div class="cc-form" style="margin-top:6px"><div class="form-group"><label>Baneo hasta (vacío = indefinido)</label><input type="date" data-g="hasta"></div></div>
            <div class="cc-pie"><span class="cc-msg" data-g="msg" role="status"></span>
                <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cc-btn rojo" data-g="todos"><i class="fa-solid fa-ban"></i> Banear a todos</button>
                <button class="cc-btn lleno" data-g="cerrar">Cerrar</button></div></div></div>`;
        document.body.appendChild(capa);
        const msg = (t, c) => { const m = capa.querySelector('[data-g="msg"]'); m.textContent = t; m.style.color = c || ''; };
        const cerrar = () => { capa.remove(); document.removeEventListener('keydown', tecla); };
        const tecla = e => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', tecla);
        const quedan = () => capa.querySelectorAll('.cc-item:not(.hecho)').length;
        const listo = (fila, texto) => {
            fila.classList.add('hecho');
            fila.querySelector('div:last-child').innerHTML = `<span style="color:#9a9a9a;font-size:.8rem">${texto}</span>`;
            if (!quedan()) msg('✔ Lista revisada.', '#6ee7a8');
        };
        async function banear(i) {
            const c = lista[i], fila = capa.querySelector(`.cc-item[data-i="${i}"]`);
            if (!fila || fila.classList.contains('hecho')) return;
            fila.querySelectorAll('button').forEach(b => { b.disabled = true; });
            try {
                const r = await P.control.banearResultados(portal, c.equipo, c.motivos.join(' · '), capa.querySelector('[data-g="hasta"]').value || null);
                listo(fila, `<i class="fa-solid fa-ban" style="color:#ff8a8d"></i> Baneado${r && r.telefonos ? ` (+${r.telefonos} número${r.telefonos === 1 ? '' : 's'})` : ''}`);
            } catch (e) { fila.querySelectorAll('button').forEach(b => { b.disabled = false; }); msg(errorSql(e), '#ff8a8d'); }
        }
        capa.addEventListener('click', e => {
            const b = e.target.closest('[data-banear]'), p = e.target.closest('[data-perdonar]');
            if (b) banear(Number(b.dataset.banear));
            if (p) listo(capa.querySelector(`.cc-item[data-i="${p.dataset.perdonar}"]`), '<i class="fa-solid fa-hand-holding-heart" style="color:#6ee7a8"></i> Perdonado');
            if (e.target.closest('[data-g="cerrar"]')) cerrar();
        });
        capa.querySelector('[data-g="todos"]').onclick = async () => {
            if (!confirm(`¿Banear a los ${quedan()} equipos que quedan en la lista?`)) return;
            for (let i = 0; i < lista.length; i++) await banear(i);
        };
        return true;
    }

    window.PumasControl = { montarVip, montarBaneos, revisarSalas, candidatos };
})();
