/* =====================================================================
   ASCENSOS · Herramienta (AZA y Pruebas usan este mismo archivo)
   - Lo anotado se guarda solo en este navegador (borrador): si sales o se
     cierra la página, al volver sigue ahí. Se limpia cuando la jornada se
     guarda en la base de datos con "Generar imagen y guardar".
   - Puntos por top (ASC_PUNTOS); ascenso directo: 45+ puntos de posición
     y 3 o 4 tags (ASC_REGLA).
   - Imagen 2000×2000 con el fondo de la categoría.
   Necesita portal.js (data-portal), categorias.js, baneados.js, cupos.js.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const PORTAL = P.portal;
    const CLAVE = 'pg_asc_borrador_' + PORTAL;
    const $ = id => document.getElementById(id);
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hoyISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const EQUIPOS_EJEMPLO = Array.from({ length: 12 }, (_, i) => `EQUIPO ${i + 1} - EQ${i + 1}`).join('\n');

    const BASE = () => ({
        salas: 5, modo: 'top', categoria: 'ev_9z', moderador: '', horario: '6PM MEXICO', texto: '',
        fecha: hoyISO(), equiposTxt: EQUIPOS_EJEMPLO, celdas: {}, guardado: null
    });
    let estado = BASE();

    /* ---------------- Borrador (localStorage) ---------------- */
    function leerBorrador() {
        try {
            const b = JSON.parse(localStorage.getItem(CLAVE) || 'null');
            if (b && typeof b === 'object') estado = Object.assign(BASE(), b, { celdas: b.celdas || {} });
        } catch (e) { }
    }
    let tGuardar = null;
    function guardarBorrador() {
        clearTimeout(tGuardar);
        tGuardar = setTimeout(() => {
            estado.guardado = Date.now();
            try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { }
            pintarBarraBorrador();
        }, 250);
    }
    function pintarBarraBorrador() {
        const n = Object.values(estado.celdas).filter(v => v !== '' && v != null).length;
        const t = estado.guardado ? new Date(estado.guardado).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
        $('ascBorrador').innerHTML = `<span><i class="fa-solid fa-floppy-disk"></i> Borrador guardado en este navegador · <b>${n}</b> datos anotados · ${t}.
            Se mantiene aunque salgas, hasta que la jornada se guarde en la base de datos.</span>
            <button class="btn-mini btn-borrar" id="ascLimpiar"><i class="fa-solid fa-eraser"></i> Empezar de cero</button>`;
        $('ascLimpiar').onclick = async () => {
            const ok = await P.confirmar({ titulo: '¿Borrar todo lo anotado?', peligro: true, si: 'Sí, empezar de cero',
                html: '<p>Se borran los tops, kills y tags anotados. La lista de equipos y la configuración se mantienen.</p>' });
            if (!ok) return;
            estado.celdas = {}; estado.texto = '';
            $('inputTexto').value = '';
            guardarBorrador(); construirTabla();
        };
    }

    /* ---------------- Equipos ---------------- */
    // Una línea por equipo: "Nombre - Tag" o con el número de slot de la sala: "1. Nombre - Tag"
    function equipos() {
        const vistos = new Set();
        return estado.equiposTxt.split('\n').map(l => l.trim()).filter(Boolean).map((l, n) => {
            const m = /^(\d{1,2})\s*[.):\-]\s+(.*)$/.exec(l);
            const slot = m ? parseInt(m[1], 10) : null, resto = m ? m[2].trim() : l;
            const sep = resto.lastIndexOf(' - ');
            const i = sep >= 0 ? sep : resto.lastIndexOf('-');
            const nombre = (i > 0 ? resto.slice(0, i) : resto).trim();
            const tag = i > 0 ? resto.slice(i + (sep >= 0 ? 3 : 1)).trim() : '';
            return { nombre, tag, slot: slot || n + 1 };
        }).filter(e => e.nombre && !vistos.has(norm(e.nombre)) && vistos.add(norm(e.nombre)));
    }
    const k = (tipo, eq, s) => tipo + '|' + norm(eq) + (s != null ? '|' + s : '');
    const val = (tipo, eq, s) => estado.celdas[k(tipo, eq, s)] ?? '';

    /* ---------------- Tabla para anotar ---------------- */
    function construirTabla() {
        const eqs = equipos();
        const cont = $('contenedorSalas');
        if (!eqs.length) {
            cont.innerHTML = `<p class="res-vacio">Escribe al menos un equipo en la lista (formato: <b>Equipo - Tag</b>).</p>`;
            calcular();
            return;
        }
        const kill = estado.modo === 'top_kill';
        let h = `<div class="tabla-anotar"><table><thead><tr><th>#</th><th>Equipo</th><th>Tag</th><th title="Cantidad de tags (3 o 4 para ascender)">Tags</th>`;
        for (let s = 1; s <= estado.salas; s++) h += `<th>S${s} top</th>` + (kill ? `<th class="kill">S${s} kill</th>` : '');
        h += `</tr></thead><tbody>`;
        eqs.forEach((e, i) => {
            const ban = window.PumasBaneados && PumasBaneados.buscar(e.nombre, val('tag', e.nombre) || e.tag);
            h += `<tr class="${ban ? 'baneado' : ''}" title="${ban ? 'BANEADO: ' + esc(ban.motivo || '') : ''}"><td>${i + 1}</td><td class="eq">${ban ? '⛔ ' : ''}${esc(e.nombre)}</td>
                <td><input class="celda tag" data-k="${k('tag', e.nombre)}" value="${esc(val('tag', e.nombre) || e.tag)}" maxlength="12"></td>
                <td><input class="celda" type="number" inputmode="numeric" min="0" max="4" data-k="${k('tc', e.nombre)}" value="${esc(val('tc', e.nombre))}" placeholder="0"></td>`;
            for (let s = 1; s <= estado.salas; s++) {
                h += `<td><input class="celda pos" type="number" inputmode="numeric" min="0" max="12" data-s="${s}" data-k="${k('p', e.nombre, s)}" value="${esc(val('p', e.nombre, s))}" placeholder="—"></td>`;
                if (kill) h += `<td><input class="celda" type="number" inputmode="numeric" min="0" data-k="${k('k', e.nombre, s)}" value="${esc(val('k', e.nombre, s))}" placeholder="0"></td>`;
            }
            h += `</tr>`;
        });
        h += `</tbody></table></div><p class="form-hint">Top 0 = jugó pero sin puntos · vacío = no jugó esa sala (sale la calavera). Los tops repetidos en una sala se marcan en rojo.</p>`;
        cont.innerHTML = h;
        avisoBaneados(eqs);
        marcarCeldas();
        calcular();
    }

    function avisoBaneados(eqs) {
        const caja = $('avisoBaneados');
        if (!window.PumasBaneados) { caja.hidden = true; return; }
        const bans = eqs.map(e => ({ e, b: PumasBaneados.buscar(e.nombre, val('tag', e.nombre) || e.tag) })).filter(x => x.b);
        caja.hidden = !bans.length;
        caja.innerHTML = bans.length ? `<i class="fa-solid fa-triangle-exclamation"></i> Hay <b>${bans.length}</b> equipo(s) en la lista de baneados: ` +
            bans.map(x => `<b>${esc(x.e.nombre)}</b>${x.b.motivo ? ' (' + esc(x.b.motivo) + ')' : ''}`).join(', ') : '';
    }

    // Tops repetidos en la misma sala y booyahs
    function marcarCeldas() {
        const porSala = {};
        document.querySelectorAll('.celda.pos').forEach(i => {
            i.classList.toggle('top1', i.value === '1');
            if (i.value === '' || i.value === '0') return;
            (porSala[i.dataset.s + '|' + i.value] = porSala[i.dataset.s + '|' + i.value] || []).push(i);
        });
        document.querySelectorAll('.celda.pos').forEach(i => i.classList.remove('repetido'));
        Object.values(porSala).forEach(l => { if (l.length > 1) l.forEach(i => i.classList.add('repetido')); });
    }

    /* ---------------- Cálculo ---------------- */
    let resultado = null;
    function calcular() {
        const eqs = equipos();
        const S = estado.salas, kill = estado.modo === 'top_kill';
        const conDatos = new Array(S).fill(false);
        const filas = eqs.map(e => {
            const f = { n: e.nombre, t: (val('tag', e.nombre) || e.tag || '').trim(), tc: parseInt(val('tc', e.nombre), 10) || 0, p: [], k: [], pp: [], st: [], pts: 0, kills: 0, total: 0 };
            for (let s = 1; s <= S; s++) {
                const raw = String(val('p', e.nombre, s)).trim();
                const top = raw === '' ? null : parseInt(raw, 10);
                const kl = parseInt(val('k', e.nombre, s), 10) || 0;
                const pts = top >= 1 && top <= 12 ? window.ASC_PUNTOS[top] : null;
                if (top !== null && !isNaN(top)) conDatos[s - 1] = true;
                f.p.push(top !== null && !isNaN(top) ? top : null);
                f.k.push(kill ? kl : 0);
                f.pp.push(pts);
                const sc = top === null || isNaN(top) ? null : (pts || 0) + (kill ? kl : 0);
                f.st.push(sc);
                if (pts) f.pts += pts;
                if (kill) f.kills += kl;
            }
            return f;
        });
        const activas = conDatos.map((v, i) => v ? i : -1).filter(i => i >= 0);
        filas.forEach(f => {
            f.total = activas.reduce((a, i) => a + (f.st[i] || 0), 0);
            f.sube = f.pts >= window.ASC_REGLA.puntos && window.ASC_REGLA.tags.includes(f.tc);
        });
        filas.sort((a, b) => b.total - a.total || b.pts - a.pts || b.kills - a.kills);
        resultado = { filas, activas, clasificados: filas.filter(f => f.sube) };
        pintarConfirmacion();
        pintarImagen();
    }

    /* ---------------- Vista de confirmación ---------------- */
    function pintarConfirmacion() {
        const { filas, activas, clasificados } = resultado;
        const cont = $('ascConfirmar');
        if (!filas.length) { cont.innerHTML = ''; return; }
        cont.innerHTML = `
            <div class="card-box">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-table-cells"></i> Confirmación de datos · ${activas.length} salas con datos</h3>
                <table><thead><tr><th style="width:44px">TOP</th><th>EQUIPO</th><th style="width:64px">TAG</th>${activas.map(i => `<th style="width:44px">S${i + 1}</th>`).join('')}<th style="width:60px">PTS POS</th><th style="width:56px">TOTAL</th></tr></thead>
                <tbody>${filas.map((f, i) => `<tr class="${f.sube ? 'sube' : ''}"><td>#${i + 1}</td><td>${esc(f.n)}</td><td>${esc(f.t)}</td>
                    ${activas.map(s => f.st[s] === null ? `<td class="sin"><i class="fa-solid fa-skull"></i></td>` : `<td class="${f.pp[s] === 12 ? 'b12' : ''}">${f.st[s]}</td>`).join('')}
                    <td>${f.pts}</td><td><b>${f.total}</b></td></tr>`).join('')}</tbody></table>
            </div>
            <div class="card-box">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-arrow-up-right-dots"></i> Clasificados (${clasificados.length})</h3>
                <p class="muted">Ascienden con ${window.ASC_REGLA.puntos}+ puntos de posición y ${window.ASC_REGLA.tags.join(' o ')} tags.</p>
                ${clasificados.length ? `<table><thead><tr><th>#</th><th>EQUIPO</th><th>PTS</th></tr></thead><tbody>${clasificados.map((f, i) =>
                    `<tr class="sube"><td>#${i + 1}</td><td>${esc(f.n)} 👑</td><td>${f.pts}</td></tr>`).join('')}</tbody></table>`
                    : `<p class="res-vacio">Sin clasificados todavía.</p>`}
            </div>`;
    }

    /* ---------------- Imagen 2000×2000 ---------------- */
    function pintarImagen() {
        const { filas, activas, clasificados } = resultado;
        const cat = window.ASC_CATEGORIA(estado.categoria);
        const previa = $('ascPrevia');
        if (!filas.length) { previa.innerHTML = ''; previa.style.height = '0'; return; }
        if (cat.tipo === 'evento') { previa.innerHTML = imagenEvento(cat); escalarPrevia(); return; }
        const mostrar = filas.slice(0, 15);
        while (mostrar.length < 10) mostrar.push(null);
        const modTxt = (estado.categoria === 'leviatan' || estado.categoria === 'alca') ? '#000000' : '#ffffff';
        const titulo = 'ASCENSOS ' + cat.corto;
        const ancho = { top: 100, tag: 100, sala: 100, total: 140 };
        const head = `<tr><th style="width:${ancho.top}px">TOP</th><th class="nom">${esc(titulo)}</th><th style="width:${ancho.tag}px">TAG</th>` +
            activas.map(i => `<th style="width:${ancho.sala}px">S${i + 1}</th>`).join('') + `<th style="width:${ancho.total}px">TOTAL</th></tr>`;
        const cuerpo = mostrar.map((f, i) => !f
            ? `<tr><td>&nbsp;</td><td class="nom"></td><td></td>${activas.map(() => '<td></td>').join('')}<td></td></tr>`
            : `<tr><td><b>#${i + 1}</b></td><td class="nom"><b>${esc(f.n)}</b></td><td><b>${esc(f.t)}</b></td>` +
              activas.map(s => f.st[s] === null ? `<td class="sin"><i class="fa-solid fa-skull"></i></td>` : `<td><span class="${f.pp[s] === 12 ? 'b12' : ''}">${f.st[s]}</span></td>`).join('') +
              `<td><b>${f.total}</b></td></tr>`).join('');
        const filasAsc = clasificados.length ? clasificados.map(f => `<tr><td>EQUIPO</td><td>${esc(f.n)} <i class="fa-solid fa-crown" style="color:#ffcc00"></i></td><td>${f.pts}</td><td>${esc(f.t)}</td></tr>`).join('')
            : `<tr><td colspan="4" style="opacity:.7">Sin equipos clasificados en Ascenso Directo</td></tr>`;

        previa.innerHTML = `
        <div id="tablaReducidaCaptura" class="table-reduced-wrapper tema-${esc(estado.categoria)}">
            <div class="tabla-marco-guia"><div class="table-reduced-content">
                <div class="reduced-general">
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;margin-bottom:10px">
                        <div class="horarios-badge-grande-img"><span class="et" style="background:#ff0055;color:#fff">★ HORARIO</span>
                            <b>${esc(estado.horario)}</b>${estado.texto ? `<span style="margin-left:15px;color:#ffcc00">| ${esc(estado.texto)}</span>` : ''}</div>
                        ${estado.moderador ? `<div class="horarios-badge-grande-img"><span class="et" style="background:#00ffcc;color:#0a0b10">🛡️ MODERADOR</span>
                            <b style="color:${modTxt}">${esc(estado.moderador)}</b></div>` : ''}
                    </div>
                    <table><thead>${head}</thead><tbody>${cuerpo}</tbody></table>
                </div>
                <div class="reduced-right-horizontal">
                    <h3>${esc(titulo)}</h3>
                    <table><thead><tr><th>EQUIPO</th><th>NOMBRE</th><th>PUNTOS</th><th>TAG</th></tr></thead><tbody>${filasAsc}</tbody></table>
                </div>
            </div></div>
        </div>`;
        escalarPrevia();
    }
    // "2026-10-09" → "VIE 09 OCT 2026"
    function fechaLarga(iso) {
        const d = new Date((iso || hoyISO()) + 'T12:00:00');
        return d.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase();
    }

    // Eventos: imagen SIN fondo, en formato tabla, con el logo y los colores del evento
    function imagenEvento(cat) {
        const { filas, activas, clasificados } = resultado;
        const c1 = cat.color, c2 = cat.color2 || cat.color, sobre = P.textoSobre(c1);
        const sube = new Set(clasificados.map(f => f.n));
        const mostrar = filas.slice(0, 15);
        const sala = (f, s) => f.st[s] === null ? `<td class="ev-sin"><i class="fa-solid fa-skull"></i></td>`
            : `<td class="${f.pp[s] === 12 ? 'ev-b12' : ''}">${f.st[s]}</td>`;
        const titulo = (estado.texto || '').trim();
        return `
        <div id="tablaReducidaCaptura" class="evento-img" style="--c1:${c1};--c2:${c2};--c1-rgb:${P.rgbDe(c1)};--c2-rgb:${P.rgbDe(c2)};--sobre:${sobre}">
            <div class="ev-cabecera">
                <img class="ev-logo" src="${esc(cat.logo)}" alt="">
                <div class="ev-titulos">
                    <small>ASCENSOS · RESULTADOS OFICIALES</small>
                    <h1>${esc(cat.corto)}</h1>
                    ${titulo ? `<h2>${esc(titulo)}</h2>` : ''}
                    <div class="ev-datos">
                        <span><i class="fa-solid fa-calendar-days"></i> ${esc(fechaLarga(estado.fecha))}</span>
                        <span><i class="fa-solid fa-clock"></i> ${esc(estado.horario)}</span>
                        ${estado.moderador ? `<span><i class="fa-solid fa-shield-halved"></i> MOD: ${esc(estado.moderador)}</span>` : ''}
                    </div>
                </div>
            </div>
            <table class="ev-tabla">
                <thead><tr><th class="ev-pos">#</th><th class="ev-eq">EQUIPO</th><th>TAG</th>${activas.map(i => `<th>S${i + 1}</th>`).join('')}<th>PTS</th><th class="ev-total">TOTAL</th></tr></thead>
                <tbody>${mostrar.map((f, i) => `<tr class="${i < 3 ? 'ev-top' : ''}${sube.has(f.n) ? ' ev-sube' : ''}">
                    <td class="ev-pos">${i + 1}</td><td class="ev-eq">${sube.has(f.n) ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(f.n)}</td><td class="ev-tag">${esc(f.t)}</td>
                    ${activas.map(s => sala(f, s)).join('')}<td>${f.pts}</td><td class="ev-total">${f.total}</td></tr>`).join('')}</tbody>
            </table>
            <div class="ev-pie">
                <div class="ev-ascienden"><b><i class="fa-solid fa-arrow-up-right-dots"></i> ASCIENDEN</b>
                    ${clasificados.length ? clasificados.map(f => `<span>${esc(f.n)}${f.t ? ' · ' + esc(f.t) : ''} <em>${f.pts} pts</em></span>`).join('') : '<span class="ev-nadie">Sin ascenso directo en esta jornada</span>'}</div>
                <div class="ev-firma">by <b>PROYECTN</b></div>
            </div>
        </div>`;
    }

    function escalarPrevia() {
        const previa = $('ascPrevia'), el = $('tablaReducidaCaptura');
        if (!el) return;
        const esc2 = previa.clientWidth / 2000;
        el.style.transform = `scale(${esc2})`;
        previa.style.height = Math.ceil(2000 * esc2) + 'px';
    }

    async function generarCanvas() {
        const el = $('tablaReducidaCaptura');
        if (!el) throw new Error('Primero anota los resultados.');
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        return html2canvas(el, {
            scale: 1, width: 2000, height: 2000, useCORS: true, backgroundColor: null, logging: false,
            onclone: doc => { const c = doc.getElementById('tablaReducidaCaptura'); if (c) { c.style.transform = 'none'; c.style.position = 'static'; } }
        });
    }
    function nombreArchivo() {
        const cat = window.ASC_CATEGORIA(estado.categoria);
        return `ascensos-${norm(cat.corto)}-${estado.fecha || hoyISO()}.png`;
    }
    async function descargarImagen() {
        const canvas = await generarCanvas();
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const archivo = new File([blob], nombreArchivo(), { type: 'image/png' });
        const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (ios && navigator.canShare && navigator.canShare({ files: [archivo] })) {
            try { await navigator.share({ files: [archivo], title: archivo.name }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = archivo.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }

    /* ---------------- Guardar en la base ---------------- */
    // "6PM MEXICO" → 18:00 hora de México (UTC-6)
    function fechaJornada() {
        const m = /(\d{1,2})\s*(AM|PM)/i.exec(estado.horario || '');
        let h = m ? parseInt(m[1], 10) % 12 + (m[2].toUpperCase() === 'PM' ? 12 : 0) : 12;
        return new Date(`${estado.fecha || hoyISO()}T${String(h).padStart(2, '0')}:00:00-06:00`);
    }
    function tituloJornada() {
        return (estado.texto || '').trim() || ('Ascensos ' + window.ASC_CATEGORIA(estado.categoria).nombre);
    }
    function aviso(t, tipo) { const n = $('ascEstado'); n.textContent = t; n.className = 'asc-estado ' + (tipo || ''); }

    async function generarYGuardar() {
        const { filas, activas, clasificados } = resultado || {};
        if (!filas || !filas.length || !activas.length) { aviso('Anota al menos una sala antes de guardar.', 'error'); return; }
        const cat = window.ASC_CATEGORIA(estado.categoria);
        const ok = await P.confirmar({
            titulo: '¿Generar imagen y guardar la jornada?', si: 'Sí, guardar y descargar',
            html: `<p><span class="cat-chip" style="--cat:${cat.color}">${esc(cat.nombre)}</span> · <b>${esc(tituloJornada())}</b><br>
                ${new Date(estado.fecha + 'T12:00:00').toLocaleDateString('es', { dateStyle: 'full' })} · ${esc(estado.horario)}</p>
                <div class="pg-resumen"><div><b>${filas.length}</b><small>Equipos</small></div><div><b>${activas.length}</b><small>Salas</small></div><div><b>${clasificados.length}</b><small>Ascienden</small></div></div>
                <p class="muted">Se guarda en la base de ${esc((P.PORTALES[PORTAL] || {}).nombre || PORTAL)} y se descarga la imagen. Después la tabla queda limpia para la próxima jornada (la lista de equipos se mantiene).</p>`
        });
        if (!ok) return;
        const btn = $('btnGuardarJornada');
        btn.disabled = true;
        aviso('Guardando en la base de datos...');
        let jornadaId = null;
        try {
            const resultado = await P.ascensos.guardar(PORTAL, {
                categoria: estado.categoria, titulo: tituloJornada(), fecha: fechaJornada().toISOString(),
                horario: estado.horario, moderador: estado.moderador, salas: activas.length, modo: estado.modo,
                equipos: filas.map(f => ({ n: f.n, t: f.t, tc: f.tc, p: f.p, k: estado.modo === 'top_kill' ? f.k : undefined, pts: f.pts, total: f.total, kills: f.kills })),
                clasificados: clasificados.map(f => ({ n: f.n, t: f.t, pts: f.pts }))
            });
            jornadaId = resultado?.id || null;
        } catch (e) {
            aviso('No se guardó: ' + e.message + ' · Tus datos siguen en el borrador.', 'error');
            btn.disabled = false;
            return;
        }
        aviso('✔ Jornada guardada. Generando la imagen...', 'ok');
        // GENERAR BANEO (solo donde se cargó cupos-control.js: módulo de Pruebas): equipos que no jugaron 2 salas o la última
        if (window.PumasControl && PORTAL === 'pruebas') {
            PumasControl.revisarSalas(PORTAL, filas.map(f => ({ equipo: f.n, salas: activas.map(i => f.p[i] !== null && f.p[i] !== undefined) })));
        }
        try {
            const canvas = await generarCanvas();
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            // Subir a storage y enlazar con la jornada (no bloquea el flujo si falla)
            if (jornadaId) {
                try {
                    const path = `${PORTAL}/${jornadaId}.png`;
                    const { error: upErr } = await P.db().storage.from('asc-imagenes').upload(path, blob, { upsert: true, contentType: 'image/png' });
                    if (!upErr) {
                        const pubUrl = P.db().storage.from('asc-imagenes').getPublicUrl(path).data?.publicUrl;
                        if (pubUrl) await P.ascensos.actualizarImagen(PORTAL, jornadaId, pubUrl).catch(() => {});
                    }
                } catch (_) {}
            }
            // Descargar en el dispositivo (comportamiento existente)
            const archivo = new File([blob], nombreArchivo(), { type: 'image/png' });
            const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if (ios && navigator.canShare && navigator.canShare({ files: [archivo] })) {
                try { await navigator.share({ files: [archivo], title: archivo.name }); } catch (e) { if (e.name !== 'AbortError') throw e; }
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob); a.download = archivo.name;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 3000);
            }
        } catch (e) { aviso('✔ Jornada guardada, pero la imagen falló: ' + e.message + '. Descárgala con el otro botón antes de seguir.', 'error'); btn.disabled = false; return; }
        // Jornada guardada: se limpia lo anotado (se mantienen equipos y configuración)
        estado.celdas = {}; estado.texto = '';
        $('inputTexto').value = '';
        guardarBorrador();
        construirTabla();
        aviso('✔ Jornada guardada y descargada. La tabla quedó limpia para la próxima jornada.', 'ok');
        btn.disabled = false;
        cargarJornadas();
    }

    /* ---------------- Jornadas guardadas ---------------- */
    async function cargarJornadas() {
        const cont = $('jornadasAdmin');
        if (!cont) return;
        cont.innerHTML = `<p class="res-vacio"><i class="fa-solid fa-spinner fa-spin"></i>Cargando...</p>`;
        let filas;
        try { filas = await P.ascensos.jornadas(PORTAL, 40); }
        catch (e) { cont.innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; return; }
        if (!filas.length) { cont.innerHTML = `<p class="res-vacio">Todavía no hay jornadas guardadas.</p>`; return; }
        cont.innerHTML = filas.map(j => {
            const c = window.ASC_CATEGORIA(j.categoria);
            return `<div class="jornada-fila" style="--cat:${c.color}">
                ${j.imagen ? `<img src="${esc(j.imagen)}" class="jornada-fila-thumb" alt="" loading="lazy">` : ''}
                <div class="jornada-fila-info"><span class="cat-chip" style="--cat:${c.color}">${esc(c.nombre)}</span> <b>${esc(j.titulo)}</b><br>
                <small>${new Date(j.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · ${j.equipos.length} equipos · ${j.salas} salas · ${j.clasificados.length} ascienden${j.moderador ? ' · ' + esc(j.moderador) : ''}</small></div>
                <div class="jornada-fila-acc">
                    <button class="btn-mini" data-img-toggle="${j.id}" title="Cambiar imagen"><i class="fa-solid fa-image"></i></button>
                    <button class="btn-mini btn-borrar" data-borrar="${j.id}"><i class="fa-solid fa-trash"></i> Borrar</button>
                </div>
                <div class="jornada-img-form" id="imgForm${j.id}" hidden>
                    <input type="url" class="jornada-img-inp" placeholder="URL de la imagen (https://...)" value="${j.imagen ? esc(j.imagen) : ''}">
                    <button class="btn-mini btn-access" data-img-guardar="${j.id}"><i class="fa-solid fa-check"></i> Guardar</button>
                    <button class="btn-mini" data-img-cancelar="${j.id}">Cancelar</button>
                </div>
            </div>`;
        }).join('');
        cont.addEventListener('click', async e => {
            // Toggle form
            const toggle = e.target.closest('[data-img-toggle]');
            if (toggle) {
                const form = document.getElementById('imgForm' + toggle.dataset.imgToggle);
                if (form) form.hidden = !form.hidden;
                return;
            }
            // Cancelar
            const cancelar = e.target.closest('[data-img-cancelar]');
            if (cancelar) {
                const form = document.getElementById('imgForm' + cancelar.dataset.imgCancelar);
                if (form) form.hidden = true;
                return;
            }
            // Guardar imagen
            const guardarImg = e.target.closest('[data-img-guardar]');
            if (guardarImg) {
                const id = Number(guardarImg.dataset.imgGuardar);
                const form = document.getElementById('imgForm' + id);
                const url = form ? form.querySelector('.jornada-img-inp').value.trim() : '';
                guardarImg.disabled = true;
                try {
                    await P.ascensos.actualizarImagen(PORTAL, id, url || null);
                    cargarJornadas();
                } catch (err) { alert(err.message); guardarImg.disabled = false; }
                return;
            }
            // Borrar jornada
            const borrar = e.target.closest('[data-borrar]');
            if (!borrar) return;
            const j = filas.find(x => String(x.id) === borrar.dataset.borrar);
            const ok = await P.confirmar({ titulo: '¿Borrar esta jornada?', peligro: true, si: 'Sí, borrar', html: `<p><b>${esc(j.titulo)}</b> desaparece del portal. No se puede deshacer.</p>` });
            if (!ok) return;
            try { await P.ascensos.borrar(PORTAL, j.id); cargarJornadas(); } catch (err) { alert(err.message); }
        });
    }

    /* ---------------- Con IA (función de Supabase "ascensos-ia", sql/18) ----------------
       1) capturas de SLOTS → equipos y jugadores · 2) capturas de RESULTADOS en orden → top y kills.
       Lo que lee la IA se revisa aquí y con "Pasar a la tabla" llena la anotación (queda en el borrador). */
    let iaDatos = null;

    // Achica cada captura (máx. 1600 px, JPG) para que suba rápido y gaste menos
    async function comprimir(file) {
        const img = await createImageBitmap(file);
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.85);
        return { media_type: 'image/jpeg', data: url.split(',')[1], vista: url };
    }

    const CON_IA = PORTAL === 'ascensosaza';   // la IA es solo para Ascensos LATAM
    function montarIA() {
        const cont = $('iaPanel');
        if (!cont) return;
        if (!CON_IA || !permisos.ia) {   // otros portales (ej. Pruebas) o moderador sin IA habilitada: sin pestaña
            const tab = document.querySelector('.asc-tabs [data-tab="panelIA"]');
            if (tab) tab.remove();
            cont.closest('.asc-panel').remove();
            return;
        }
        cont.innerHTML = `
            <p class="tool-desc">Pega los equipos de la sala, sube las capturas y la IA arma la tabla: las de <b>slots</b> (alineación de la sala)
                y las de <b>resultados</b> de cada partida <b>en orden</b> (partida 1, 2, 3...). Revisa lo que leyó antes de pasarlo a la tabla.</p>
            <div class="form-group">
                <label for="iaEquipos">0 · Equipos de la sala (uno por línea: <code>1. NOMBRE - TAG</code>, el número es el slot)</label>
                <textarea id="iaEquipos" class="equipos" spellcheck="false" style="min-height:150px" placeholder="1. DCN ACD - DCN&#10;2. TS OFICIAL BLUE - TS&#10;3. TS OFICIAL GREEN - TS">${esc(estado.equiposTxt)}</textarea>
                <p class="form-hint" id="iaEquiposInfo"></p>
            </div>
            <div class="form-grid">
                <div class="form-group"><label for="iaCategoria">Evento de estos resultados</label>
                    <select id="iaCategoria">${window.ASC_OPCIONES(estado.categoria, permisos.eventos)}</select></div>
                <div class="form-group"><label for="iaMotor">Motor de IA</label>
                    <select id="iaMotor" disabled><option>Buscando motores...</option></select></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label for="iaSlots">1 · Capturas de slots (hasta 4 · normalmente 3)</label>
                    <input type="file" id="iaSlots" accept="image/*" multiple><div class="ia-miniaturas" id="iaSlotsVista"></div></div>
                <div class="form-group"><label for="iaRes">2 · Capturas de resultados, en orden (hasta 12 · normalmente 4 o 5)</label>
                    <input type="file" id="iaRes" accept="image/*" multiple><div class="ia-miniaturas" id="iaResVista"></div></div>
            </div>
            <div class="asc-acciones" style="margin-top:6px"><button class="btn-access" id="iaLeer"><i class="fa-solid fa-wand-magic-sparkles"></i> Leer con IA</button></div>
            <p class="asc-estado" id="iaEstado" role="status"></p>
            <div id="iaResultado"></div>`;
        const vista = (input, destino) => input.addEventListener('change', () => {
            $(destino).innerHTML = [...input.files].map((f, i) => `<figure><img src="${URL.createObjectURL(f)}" alt=""><figcaption>${input.id === 'iaRes' ? 'Partida ' + (i + 1) : 'Slot ' + (i + 1)}</figcaption></figure>`).join('');
        });
        vista($('iaSlots'), 'iaSlotsVista');
        vista($('iaRes'), 'iaResVista');
        $('iaLeer').addEventListener('click', leerIA);
        // La lista de la IA es la misma lista de equipos de la herramienta
        const infoEquipos = () => {
            const l = equipos();
            $('iaEquiposInfo').textContent = l.length ? `${l.length} equipos · ` + l.slice(0, 4).map(e => `slot ${e.slot}: ${e.nombre}${e.tag ? ' (' + e.tag + ')' : ''}`).join(' · ') + (l.length > 4 ? ' …' : '') : 'Sin equipos todavía.';
        };
        let tEq = null;
        $('iaEquipos').addEventListener('input', e => {
            estado.equiposTxt = e.target.value;
            $('inputEquipos').value = estado.equiposTxt;
            guardarBorrador(); infoEquipos();
            clearTimeout(tEq); tEq = setTimeout(construirTabla, 400);
        });
        $('inputEquipos').addEventListener('input', () => { $('iaEquipos').value = $('inputEquipos').value; infoEquipos(); });
        infoEquipos();
        // El evento es el mismo en la anotación normal y en Con IA
        $('iaCategoria').addEventListener('change', e => {
            estado.categoria = e.target.value;
            $('selectCategoria').value = estado.categoria;
            guardarBorrador(); calcular();
        });
        $('selectCategoria').addEventListener('change', () => { $('iaCategoria').value = $('selectCategoria').value; });
        cargarMotores();
    }

    // Motores que activó el superadmin (Admin → Motores de IA)
    async function cargarMotores() {
        const sel = $('iaMotor');
        try {
            const r = await P.ia.motores();
            if (!r.motores.length) { sel.innerHTML = '<option value="">Ninguno activo</option>'; $('iaLeer').disabled = true;
                $('iaEstado').textContent = 'No hay motores de IA activos: el superadmin los activa en Admin → Motores de IA.'; return; }
            let guardado = null;
            try { guardado = localStorage.getItem('pg_ia_motor'); } catch (e) { }
            const elegido = r.motores.some(m => m.id === guardado) ? guardado : r.defecto;
            sel.innerHTML = r.motores.map(m => `<option value="${esc(m.id)}"${m.id === elegido ? ' selected' : ''}>${esc(m.nombre)}${m.id === r.defecto ? ' (por defecto)' : ''}</option>`).join('');
            sel.disabled = r.motores.length < 2;
            sel.onchange = () => { try { localStorage.setItem('pg_ia_motor', sel.value); } catch (e) { } };
        } catch (e) {
            sel.innerHTML = '<option value="">Sin conexión con la IA</option>';
            $('iaEstado').textContent = e.message; $('iaEstado').className = 'asc-estado error';
        }
    }

    // Caché de lecturas en este navegador (últimas 8)
    const CLAVE_CACHE = 'pg_ia_cache_' + PORTAL;
    async function huellaLectura(c) {
        const txt = [c.motor || '', ...c.equipos, '#', ...c.slots.map(i => i.data), '#', ...c.resultados.map(i => i.data)].join('|');
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function leerCache(h) {
        try { const x = (JSON.parse(localStorage.getItem(CLAVE_CACHE) || '[]')).find(e => e.h === h); return x ? x.data : null; } catch (e) { return null; }
    }
    function guardarCache(h, data) {
        try {
            const l = JSON.parse(localStorage.getItem(CLAVE_CACHE) || '[]').filter(e => e.h !== h);
            l.unshift({ h, data, t: Date.now() });
            localStorage.setItem(CLAVE_CACHE, JSON.stringify(l.slice(0, 8)));
        } catch (e) { }
    }

    async function leerIA() {
        const est = (t, tipo) => { const n = $('iaEstado'); n.textContent = t; n.className = 'asc-estado ' + (tipo || ''); };
        const slots = [...$('iaSlots').files].slice(0, 4), res = [...$('iaRes').files].slice(0, 12);
        if (!res.length) { est('Sube al menos una captura de resultados.', 'error'); return; }
        const ses = P.sesion();
        if (!ses || !ses.token) { est('Tu sesión expiró: vuelve a entrar.', 'error'); return; }
        const btn = $('iaLeer');
        btn.disabled = true;
        try {
            est('Preparando ' + (slots.length + res.length) + ' capturas...');
            const prep = async l => (await Promise.all(l.map(comprimir))).map(({ media_type, data }) => ({ media_type, data }));
            const cuerpo = {
                token: ses.token, portal: PORTAL, motor: $('iaMotor').value || undefined,
                slots: await prep(slots), resultados: await prep(res),
                // "Slot 1: DCN ACD - DCN" → la IA cruza el número de escuadra y el tag de los jugadores
                equipos: equipos().map(e => `Slot ${e.slot}: ${e.nombre}${e.tag ? ' - ' + e.tag : ''}`)
            };
            // Mismas capturas + misma lista + mismo motor → se reusa la lectura (no se paga dos veces)
            const huella = await huellaLectura(cuerpo);
            let data = leerCache(huella);
            if (data) est('Estas capturas ya se habían leído: se reusa el resultado (sin costo).');
            else {
                est('La IA está leyendo las capturas (puede tardar hasta un minuto)...');
                data = await P.ia.leer(cuerpo);
                guardarCache(huella, data);
            }
            iaDatos = data.datos;
            pintarIA();
            est((data.aviso ? data.aviso + ' ' : '') + `✔ ${data.motor_nombre || 'La IA'} leyó ${iaDatos.equipos.length} equipos en ${iaDatos.partidas_detectadas} partida(s).` + (data.quedan != null ? ` Te quedan ${data.quedan} lecturas hoy.` : ''), 'ok');
        } catch (e) { est(e.message, 'error'); }
        finally { btn.disabled = false; }
    }

    function pintarIA() {
        const d = iaDatos, n = Math.max(d.partidas_detectadas || 0, ...d.equipos.flatMap(e => e.partidas.map(p => p.partida)), 1);
        const celda = (e, i) => { const p = e.partidas.find(x => x.partida === i); return p ? `<td>${p.top}</td><td>${p.kills}</td>` : '<td class="sin">—</td><td class="sin">—</td>'; };
        $('iaResultado').innerHTML = `
            ${(d.avisos || []).length ? `<div class="asc-aviso-ban"><b>Revisa:</b><br>${d.avisos.map(esc).join('<br>')}</div>` : ''}
            <div class="tabla-anotar"><table><thead><tr><th>Equipo</th><th>Tag</th><th>Jug.</th>${Array.from({ length: n }, (_, i) => `<th>T${i + 1}</th><th class="kill">K${i + 1}</th>`).join('')}</tr></thead>
            <tbody>${d.equipos.map(e => `<tr><td class="eq">${esc(e.nombre)}</td><td>${esc(e.tag || '')}</td><td title="${esc((e.jugadores || []).join(', '))}">${(e.jugadores || []).length}</td>
                ${Array.from({ length: n }, (_, i) => celda(e, i + 1)).join('')}</tr>`).join('')}</tbody></table></div>
            <div class="asc-acciones"><button class="btn-access" id="iaPasar"><i class="fa-solid fa-table"></i> Pasar a la tabla</button></div>`;
        $('iaPasar').addEventListener('click', () => aplicarIA(n));
    }

    async function aplicarIA(n) {
        const d = iaDatos;
        if (Object.values(estado.celdas).some(v => v !== '' && v != null)) {
            const ok = await P.confirmar({ titulo: '¿Reemplazar lo anotado?', si: 'Sí, reemplazar',
                html: '<p>Ya hay datos en la tabla. Se reemplazan los tops y kills por lo que leyó la IA (la lista de equipos se completa, no se borra).</p>' });
            if (!ok) return;
        }
        const salas = Math.min(6, Math.max(3, n));
        const lista = equipos();
        const lineas = estado.equiposTxt.split('\n').map(l => l.trim()).filter(Boolean);
        const celdas = {};
        d.equipos.forEach(e => {
            // mismo equipo de la lista: por nombre o por tag
            // el tag solo identifica si es único (TS lo usan TS OFICIAL BLUE y GREEN)
            const porTag = e.tag ? lista.filter(x => x.tag && norm(x.tag) === norm(e.tag)) : [];
            const ya = lista.find(x => norm(x.nombre) === norm(e.nombre)) || (porTag.length === 1 ? porTag[0] : null);
            const nombre = ya ? ya.nombre : e.nombre;
            if (!ya) { lineas.push(e.nombre + (e.tag ? ' - ' + e.tag : '')); lista.push({ nombre: e.nombre, tag: e.tag }); }
            if (e.tag) celdas[k('tag', nombre)] = e.tag;
            e.partidas.filter(p => p.partida >= 1 && p.partida <= salas).forEach(p => {
                celdas[k('p', nombre, p.partida)] = String(p.top);
                celdas[k('k', nombre, p.partida)] = String(p.kills);
            });
        });
        // conserva los tags (cantidad) que ya se habían anotado
        Object.entries(estado.celdas).forEach(([c, v]) => { if (c.startsWith('tc|')) celdas[c] = v; });
        estado.celdas = celdas;
        estado.equiposTxt = lineas.join('\n');
        estado.salas = salas;
        if (d.equipos.some(e => e.partidas.some(p => p.kills > 0))) estado.modo = 'top_kill';
        $('inputEquipos').value = estado.equiposTxt;
        $('selectCantidadSalas').value = String(salas);
        $('selectModo').value = estado.modo;
        guardarBorrador();
        construirTabla();
        document.querySelector('.asc-tabs [data-tab="panelResultados"]').click();
        aviso(`✔ Datos de la IA en la tabla (${d.equipos.length} equipos, ${salas} salas${n > 6 ? ', máximo 6' : ''}). Revisa, completa los tags y guarda.`, 'ok');
    }

    /* ---------------- Arranque ---------------- */
    function enlazarCampos() {
        const campos = { selectCantidadSalas: 'salas', selectModo: 'modo', selectCategoria: 'categoria', inputModerador: 'moderador',
            selectHorario: 'horario', inputTexto: 'texto', inputFecha: 'fecha', inputEquipos: 'equiposTxt' };
        Object.entries(campos).forEach(([id, prop]) => {
            const n = $(id);
            n.value = estado[prop];
            const reconstruye = ['salas', 'modo', 'equiposTxt'].includes(prop);
            let t = null;
            n.addEventListener('input', () => {
                estado[prop] = prop === 'salas' ? Number(n.value) : n.value;
                guardarBorrador();
                clearTimeout(t);
                t = setTimeout(reconstruye ? construirTabla : calcular, reconstruye ? 350 : 120);
            });
        });
        let tc = null;
        $('contenedorSalas').addEventListener('input', e => {
            const i = e.target.closest('[data-k]');
            if (!i) return;
            estado.celdas[i.dataset.k] = i.value;
            guardarBorrador();
            marcarCeldas();
            if (i.classList.contains('tag')) avisoBaneados(equipos());
            clearTimeout(tc);
            tc = setTimeout(calcular, 150);
        });
        // Enter baja a la fila de abajo (anotar rápido sala por sala)
        $('contenedorSalas').addEventListener('keydown', e => {
            if (e.key !== 'Enter' || !e.target.matches('.celda')) return;
            e.preventDefault();
            const td = e.target.closest('td'), tr = td.parentElement, col = [...tr.children].indexOf(td);
            const sig = tr.nextElementSibling && tr.nextElementSibling.children[col];
            const inp = sig && sig.querySelector('input');
            if (inp) { inp.focus(); inp.select(); }
        });
        $('btnGuardarJornada').addEventListener('click', generarYGuardar);
        $('btnSoloImagen').addEventListener('click', async () => {
            aviso('Generando imagen...');
            try { await descargarImagen(); aviso('✔ Imagen descargada (no se guardó en la base).', 'ok'); } catch (e) { aviso(e.message, 'error'); }
        });
        addEventListener('resize', escalarPrevia);
    }

    function pestañas() {
        const tabs = document.querySelectorAll('.asc-tabs [data-tab]');
        const abrir = id => {
            tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === id));
            document.querySelectorAll('.asc-panel').forEach(p => { p.hidden = p.id !== id; });
            if (id === 'panelResultados') escalarPrevia();
            if (id === 'panelJornadas') cargarJornadas();
            try { sessionStorage.setItem('pg_asc_tab', id); } catch (e) { }
        };
        tabs.forEach(t => t.addEventListener('click', () => abrir(t.dataset.tab)));
        let ultima = 'panelResultados';
        try { ultima = sessionStorage.getItem('pg_asc_tab') || ultima; } catch (e) { }
        abrir(document.querySelector('.asc-tabs [data-tab="' + ultima + '"]:not([hidden])') && document.getElementById(ultima) ? ultima : 'panelResultados');
    }

    /* ---------------- Permisos (moderadores, sql/19) ----------------
       jefe = Administrador Ascensos o superadmin (maneja moderadores) ·
       moderador: IA solo si se la habilitaron y solo sus eventos (null = todos) */
    let permisos = { jefe: false, moderador: false, ia: true, eventos: null, nombre: '' };
    async function cargarPermisos(ses) {
        try { permisos = Object.assign(permisos, await P.ascensos.permisos(PORTAL)); }
        catch (e) {   // sin sql/19: como antes (todo permitido); el jefe se deduce del rol
            permisos.jefe = P.tiene(ses, 'gestionar') || (ses && ['administradorascensos', 'aza'].includes(ses.rol));
            permisos.nombre = (ses && (ses.nombre || ses.usuario)) || '';
        }
    }
    function aplicarPermisos() {
        const lista = permisos.eventos;
        if (lista && !lista.includes(estado.categoria)) estado.categoria = lista[0] || '';
        $('selectCategoria').innerHTML = window.ASC_OPCIONES(estado.categoria, lista) || '<option value="">Sin eventos habilitados</option>';
        if (lista && !lista.length) {
            $('btnGuardarJornada').disabled = true;
            aviso('No tienes eventos habilitados. Pídele al Administrador Ascensos que te habilite al menos uno.', 'error');
        }
        // Por defecto el moderador de la imagen es quien entra
        if (!estado.moderador && permisos.nombre) { estado.moderador = permisos.nombre; guardarBorrador(); }
        const tab = document.querySelector('.asc-tabs [data-tab="panelModeradores"]');
        if (tab) tab.hidden = !permisos.jefe;
        if (permisos.jefe) montarModeradores();
    }

    /* ---------------- Moderadores (solo Administrador Ascensos) ---------------- */
    async function montarModeradores() {
        const cont = $('moderadoresAdmin');
        if (!cont) return;
        const eventos = window.ASC_CATEGORIAS.filter(c => c.tipo === 'evento');
        const checks = (sel, nombre) => eventos.map(c => `<label class="chk mod-ev"><input type="checkbox" name="${nombre}" value="${c.id}" ${!sel || sel.includes(c.id) ? 'checked' : ''}>
            <img src="${c.logo}" alt=""> ${esc(c.nombre)}</label>`).join('');
        const leerEventos = (raiz, nombre) => {
            const marcados = [...raiz.querySelectorAll(`input[name="${nombre}"]:checked`)].map(i => i.value);
            return marcados.length === eventos.length ? null : marcados;   // todos marcados = null (también los eventos nuevos)
        };
        let lista = [];
        try { lista = await P.ascensos.moderadores.listar(); }
        catch (e) { cont.innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; return; }
        cont.innerHTML = `
            <article class="card-box mod-nuevo">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-user-plus"></i> Nuevo moderador</h3>
                <form id="modForm">
                    <div class="form-grid cuatro">
                        <div class="form-group"><label for="modUsuario">Usuario (sin @)</label><input id="modUsuario" required autocapitalize="none" spellcheck="false" placeholder="modjuan" pattern="[a-zA-Z0-9._\-]{3,30}"></div>
                        <div class="form-group"><label for="modNombre">Nombre (sale como moderador)</label><input id="modNombre" required maxlength="40" placeholder="Mod · Juan"></div>
                        <div class="form-group"><label for="modClave">Contraseña</label><input id="modClave" type="password" required minlength="6" autocomplete="new-password"></div>
                        <div class="form-group"><label>&nbsp;</label><label class="chk"><input type="checkbox" id="modIa"> Puede usar la IA</label></div>
                    </div>
                    <label>Eventos que puede hacer</label>
                    <div class="mod-eventos">${checks(null, 'modEvNuevo')}</div>
                    <button class="btn-access" type="submit" style="margin-top:14px"><i class="fa-solid fa-user-plus"></i> Crear moderador</button>
                    <p class="asc-estado" id="modMsg" role="status"></p>
                </form>
            </article>
            <h3 class="subtitulo-bloque" style="margin-top:24px"><i class="fa-solid fa-users"></i> Moderadores (${lista.length})</h3>
            ${lista.length ? lista.map(m => `
            <article class="card-box mod-fila${m.activo ? '' : ' inactivo'}" data-usuario="${esc(m.usuario)}">
                <div class="mod-cab">
                    <div><b>${esc(m.nombre || m.usuario)}</b> <code>${esc(m.usuario)}</code>${m.activo ? '' : ' <span class="cupo-estado e-cerrado">INACTIVO</span>'}</div>
                    <div class="mod-opc">
                        <label class="chk"><input type="checkbox" data-f="ia" ${m.ia ? 'checked' : ''}> IA</label>
                        <label class="chk"><input type="checkbox" data-f="activo" ${m.activo ? 'checked' : ''}> Activo</label>
                        <input type="text" data-f="nombre" value="${esc(m.nombre || '')}" maxlength="40" aria-label="Nombre">
                        <input type="password" data-f="clave" placeholder="Nueva clave (opcional)" autocomplete="new-password" aria-label="Nueva clave">
                    </div>
                </div>
                <div class="mod-eventos">${checks(m.eventos, 'ev_' + m.usuario)}</div>
                <div class="mod-acc"><button class="btn-mini" data-guardar><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                    <button class="btn-mini btn-borrar" data-eliminar><i class="fa-solid fa-trash"></i> Eliminar</button>
                    <button class="btn-mini" style="color:var(--primary);border-color:rgba(182,255,0,.3)" onclick="window.ASC_VistaModerador(${JSON.stringify(m.nombre || m.usuario)},${JSON.stringify(m.eventos)})"><i class="fa-solid fa-eye"></i> Ver como</button>
                    <span class="muted" data-msg></span></div>
            </article>`).join('') : '<p class="res-vacio">Todavía no hay moderadores.</p>'}`;

        $('modForm').addEventListener('submit', async e => {
            e.preventDefault();
            const msg = $('modMsg');
            msg.textContent = 'Creando...'; msg.className = 'asc-estado';
            try {
                await P.ascensos.moderadores.guardar({
                    usuario: $('modUsuario').value.trim().toLowerCase(), nombre: $('modNombre').value.trim(), clave: $('modClave').value,
                    ia: $('modIa').checked, eventos: leerEventos(cont, 'modEvNuevo')
                });
                await montarModeradores();
                const n = $('modMsg'); n.textContent = '✔ Moderador creado. Ya puede entrar en /ascensos/login.html'; n.className = 'asc-estado ok';
            } catch (err) { msg.textContent = err.message; msg.className = 'asc-estado error'; }
        });
        cont.querySelectorAll('.mod-fila [data-eliminar]').forEach(b => b.addEventListener('click', async () => {
            const fila = b.closest('.mod-fila'), u = fila.dataset.usuario;
            const ok = await P.confirmar({ titulo: '¿Eliminar al moderador ' + u + '?', peligro: true, si: 'Sí, eliminar',
                html: '<p>Se borra su usuario y ya no podrá entrar. Las jornadas y cupos que creó se quedan.</p><p class="muted">Si solo quieres quitarle el acceso un tiempo, desmarca "Activo".</p>' });
            if (!ok) return;
            try { await P.ascensos.moderadores.borrar(u); await montarModeradores(); }
            catch (err) { fila.querySelector('[data-msg]').textContent = err.message; }
        }));
        cont.querySelectorAll('.mod-fila').forEach(fila => fila.querySelector('[data-guardar]').addEventListener('click', async () => {
            const u = fila.dataset.usuario, f = c => fila.querySelector(`[data-f="${c}"]`);
            const msg = fila.querySelector('[data-msg]');
            msg.textContent = 'Guardando...';
            try {
                await P.ascensos.moderadores.guardar({ usuario: u, nombre: f('nombre').value.trim(), clave: f('clave').value || null,
                    activo: f('activo').checked, ia: f('ia').checked, eventos: leerEventos(fila, 'ev_' + u) });
                msg.textContent = '✔ Guardado';
                f('clave').value = '';
            } catch (err) { msg.textContent = err.message; }
        }));
    }

    async function iniciar(ev) {
        const ses = ev && ev.detail;
        await cargarPermisos(ses);
        $('selectCategoria').innerHTML = window.ASC_OPCIONES(undefined, permisos.eventos);
        leerBorrador();
        enlazarCampos();
        aplicarPermisos();
        $('inputModerador').value = estado.moderador;
        $('selectCategoria').value = estado.categoria;
        pintarBarraBorrador();
        pestañas();
        construirTabla();
        // Baneados: se cargan y se vuelve a marcar la tabla
        if (window.PumasBaneados) {
            await PumasBaneados.cargar(PORTAL);
            construirTabla();
            PumasBaneados.montarAdmin('baneadosAdmin', PORTAL, construirTabla);
        }
        if (window.PumasCupos) PumasCupos.montarAdmin('cuposAdmin', PORTAL);
        montarIA();
    }

    /* ---------------- Vista previa por rol (solo superadmin) ---------------- */
    let _permisosOrig = null;
    window.ASC_VistaModerador = function (nombre, eventos) {
        if (!_permisosOrig) _permisosOrig = { ...permisos };
        permisos.eventos = eventos;
        permisos.nombre  = nombre;
        permisos.jefe    = false;
        aplicarPermisos();
        // Cambiar al tab de Resultados
        const tabRes = document.querySelector('.asc-tabs [data-tab="panelResultados"]');
        if (tabRes) tabRes.click();
        // Banner de vista previa
        let banner = document.getElementById('ascVistaPrevia');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'ascVistaPrevia';
            banner.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:9999;background:var(--primary,#B6FF00);color:#0a0b10;padding:8px 16px;font-size:.85rem;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
            document.body.insertAdjacentElement('afterbegin', banner);
            document.body.style.paddingTop = '40px';
        }
        banner.innerHTML = `<i class="fa-solid fa-eye"></i> Vista previa como <b>${nombre}</b> · eventos: ${eventos ? eventos.join(', ') : 'todos'}
            &nbsp;<button onclick="window.ASC_SalirVistaPrevia()" style="background:rgba(0,0,0,.15);border:none;padding:3px 10px;border-radius:6px;cursor:pointer;font-weight:700">✕ Salir de vista previa</button>`;
    };
    window.ASC_SalirVistaPrevia = function () {
        if (_permisosOrig) { Object.assign(permisos, _permisosOrig); _permisosOrig = null; }
        aplicarPermisos();
        const banner = document.getElementById('ascVistaPrevia');
        if (banner) { banner.remove(); document.body.style.paddingTop = ''; }
    };

    // Arranca cuando portal.js confirma la sesión
    window.addEventListener('pg:sesion', iniciar, { once: true });
})();
