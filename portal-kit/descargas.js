/* =====================================================================
   PROYECTN · Descargar la imagen de un entreno, IGUAL que en su herramienta
   - Solo se ofrece en el portal de cada entreno (no en LATAM ni en el index).
   - Al tocar "Descargar" se abre un marco oculto con el MISMO script y estilos
     de la herramienta (admin) de ese portal, se le pasan los resultados
     guardados en la base y se usa su propia función de descarga:
     mismo fondo, tamaño y acomodo que cuando se generó en el admin.
   - Los datos se piden solo al tocar el botón (una consulta pequeña).
   - fecha(iso) → "mié 07 oct 2026 · 19:00" para mostrar junto al título.
   Necesita portal.js cargado antes.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const ZONA = 'America/Bogota';
    const V = '20261008h';

    // Herramienta de cada portal: carpeta, estilos, script y tipo de imagen
    const HERRAMIENTAS = {
        entrenamientos: { carpeta: '/portales/pumasgaming/', css: 'styleadmin.css', js: 'admin_logica.js', tipo: 'pumas' },
        row:            { carpeta: '/portales/row/',            css: 'style.css', js: 'script.js', tipo: 'salas' },
        rusheo:         { carpeta: '/portales/rusheo/',         css: 'style.css', js: 'script.js', tipo: 'salas' },
        zmf:            { carpeta: '/portales/zmf/',            css: 'style.css', js: 'script.js', tipo: 'salas', cat: 'zmf' },
        zmffem:         { carpeta: '/portales/zmf/',            css: 'style.css', js: 'script.js', tipo: 'salas', cat: 'zmffem' },
        ascensosqfd:    { carpeta: '/portales/quisqueya/',      css: 'style.css', js: 'script.js', tipo: 'reducida', tema: 'fdquisqueya' },
        dragonfest:     { carpeta: '/portales/dragonfest/',     css: 'style.css', js: 'script.js', tipo: 'reducida', tema: 'dragonfest' },
        dragonfestfem:  { carpeta: '/portales/dragonfest/',     css: 'style.css', js: 'script.js', tipo: 'reducida', tema: 'dragonfestfem' }
    };

    /* ---------------- Fecha con día de la semana ---------------- */
    function fecha(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const dia = d.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: ZONA }).replace(/,/g, '');
        const hora = d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', timeZone: ZONA });
        return `${dia} · ${hora}`;
    }
    const fechaHTML = iso => `<span class="pg-fecha"><i class="fa-regular fa-calendar"></i> ${esc(fecha(iso))}</span>`;
    // "2026-10-07T19:00" en hora de Colombia (para los campos de fecha de las herramientas)
    const fechaLocal = iso => new Date(iso).toLocaleString('sv-SE', { timeZone: ZONA }).replace(' ', 'T').slice(0, 16);

    /* ---------------- Botón ---------------- */
    function botones(s) {
        if (!HERRAMIENTAS[s.portal]) return '';
        const datos = esc(JSON.stringify({ portal: s.portal, id: String(s.id), titulo: s.titulo, fecha: s.fecha, jornada: s.jornada || '' }));
        return `<span class="pg-dl">
            <button type="button" class="pg-dl-btn" data-dl="png" data-ses="${datos}" title="Descargar la imagen como sale en la herramienta" aria-label="Descargar imagen de ${esc(s.titulo)}"><i class="fa-solid fa-download"></i><span>Descargar</span></button>
        </span>`;
    }

    /* ---------------- Datos del entreno (solo al tocar) ---------------- */
    async function detalle(s) {
        const db = P.db();
        const pumas = s.portal === 'entrenamientos';
        const [ses, sal, kil] = await Promise.all([
            db.from(pumas ? 'entrenamientos_sesiones' : 'portal_sesiones').select('moderador, jornada').eq('id', s.id).maybeSingle(),
            db.from(pumas ? 'salas_resultados' : 'portal_salas').select('numero_sala, equipo_nombre, rank, kill_score, rank_score, total_score, es_booyah').eq('sesion_id', s.id),
            db.from(pumas ? 'top_killers' : 'portal_killers').select('jugador_nombre, equipo_nombre, kills').eq('sesion_id', s.id)
        ]);
        if (sal.error) throw sal.error;
        const filas = sal.data || [];
        if (!filas.length) throw new Error('Este entreno no tiene resultados guardados en la base.');
        const n = Math.max(...filas.map(r => r.numero_sala || 1));

        // Equipos en el formato de las herramientas
        const eqM = {};
        filas.forEach(r => {
            const k = r.equipo_nombre.trim().toLowerCase(), i = (r.numero_sala || 1) - 1;
            const e = eqM[k] = eqM[k] || { name: r.equipo_nombre, totalScore: 0, killScore: 0, rankScore: 0,
                salasPuntos: {}, salasKills: {}, salasRank: {}, salasBooyah: {}, salasJugadas: 0, booyahsCount: 0 };
            e.totalScore += r.total_score || 0; e.killScore += r.kill_score || 0; e.rankScore += r.rank_score || 0;
            e.salasPuntos[i] = (e.salasPuntos[i] || 0) + (r.total_score || 0);
            e.salasKills[i] = (e.salasKills[i] || 0) + (r.kill_score || 0);
            e.salasRank[i] = (e.salasRank[i] || 0) + (r.rank_score || 0);
            e.salasJugadas++;
            if (r.es_booyah) { e.salasBooyah[i] = true; e.booyahsCount++; }
        });
        // Booyah por sala
        const rW = Array.from({ length: n }, (_, i) => {
            const b = filas.find(r => (r.numero_sala || 1) === i + 1 && r.es_booyah);
            return b ? { sala: i + 1, team: b.equipo_nombre, points: b.total_score || 0, kills: b.kill_score || 0 }
                     : { sala: i + 1, team: 'N/D', points: 0, kills: 0 };
        });
        // Killers (en Pumas hay una fila por sala: se suman)
        const kM = {};
        (kil.data || []).forEach(r => {
            const k = r.jugador_nombre.trim().toLowerCase();
            const j = kM[k] = kM[k] || { name: r.jugador_nombre, team: r.equipo_nombre, kills: 0 };
            j.kills += r.kills || 0;
        });
        const killers = Object.values(kM).sort((a, b) => b.kills - a.kills);
        return { n, filas, eqs: Object.values(eqM), rW, killers,
                 moderador: (ses.data && ses.data.moderador) || '', jornada: (ses.data && ses.data.jornada) || s.jornada || 'NORMAL' };
    }

    // Salas en el formato de QFD / Dragon Fest: [Map(equipo → {rank, killScore, rankScore, totalScore, players})]
    function salasReducida(d) {
        const salas = Array.from({ length: d.n }, () => new Map());
        d.filas.forEach(r => {
            const rank = r.rank || (r.es_booyah ? 1 : 0);
            salas[(r.numero_sala || 1) - 1].set(r.equipo_nombre, {
                rank, killScore: r.kill_score || 0, rankScore: r.rank_score || 0, totalScore: r.total_score || 0, isManual: false, players: []
            });
        });
        // Los killers se guardan sumados por entreno: se ponen en la primera sala donde jugó su equipo
        d.killers.forEach(k => {
            const t = (k.team || '').trim().toLowerCase();
            for (const sala of salas) {
                const e = [...sala.entries()].find(([nombre]) => nombre.trim().toLowerCase() === t);
                if (e) { e[1].players.push({ name: k.name, kills: k.kills }); break; }
            }
        });
        return salas;
    }

    /* ---------------- Marco oculto con la herramienta ---------------- */
    function abrirHerramienta(h, s, d) {
        return new Promise((ok, mal) => {
            const f = document.createElement('iframe');
            f.setAttribute('aria-hidden', 'true');
            f.tabIndex = -1;
            f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1500px;height:1300px;border:0;visibility:visible';
            const opt = (id, v) => `<select id="${id}"><option value="${esc(v)}" selected>${esc(v)}</option></select>`;
            f.srcdoc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                <base href="${h.carpeta}">
                <link href="https://fonts.googleapis.com/css2?family=Michroma&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;700&family=Carter+One&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <link rel="stylesheet" href="${h.css}?v=${V}">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
                <script src="${h.js}?v=${V}"><\/script>
                </head><body style="margin:0;background:#000">
                <div id="outputTablasLadoALado" class="result-box"></div>
                <div id="outputTablaReducida" class="result-box"></div>
                ${opt('selectModoCalculo', h.tipo === 'pumas' ? '1' : 'normal')}
                ${opt('selectTemaVisual', h.tema || '')}
                ${opt('selectCategoria', h.cat || '')}
                ${opt('selectTipoPartida', d.jornada)}
                ${opt('selectBloque', ((/^BLOQUE\s+([AB])$/i.exec(d.jornada || '') || [])[1] || '').toUpperCase())}
                <input id="inputFechaHora" type="datetime-local" value="${fechaLocal(s.fecha)}">
                <input id="inputFechaHoraEntreno" type="datetime-local" value="${fechaLocal(s.fecha)}">
                <input id="inputModerador" value="${esc(d.moderador)}">
                </body></html>`;
            f.onload = () => ok(f);
            f.onerror = () => mal(new Error('No se pudo abrir la herramienta.'));
            document.body.appendChild(f);
        });
    }

    // iPhone / iPad: hoja de compartir (deja "Guardar imagen" en Fotos). Si no se puede, descarga normal.
    const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    async function guardar(href, nombre) {
        if (esIOS && navigator.canShare) {
            try {
                const blob = await (await fetch(href)).blob();
                const archivo = new File([blob], nombre, { type: blob.type || 'image/png' });
                if (navigator.canShare({ files: [archivo] })) { await navigator.share({ files: [archivo], title: nombre }); return; }
            } catch (e) {
                if (e && e.name === 'AbortError') return;   // la persona cerró la hoja de compartir
            }
        }
        const a = document.createElement('a');   // se descarga desde la página (no desde el marco oculto)
        a.href = href; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
    }

    async function descargarImagen(s) {
        const h = HERRAMIENTAS[s.portal];
        if (!h) throw new Error('Este entreno no tiene herramienta de imagen.');
        const d = await detalle(s);
        const f = await abrirHerramienta(h, s, d);
        const w = f.contentWindow;
        try {
            if (w.document.fonts && w.document.fonts.ready) await w.document.fonts.ready;
            if (typeof w.html2canvas !== 'function') throw new Error('No se pudo cargar el generador de imágenes.');
            // Se espera a que la herramienta dispare su propia descarga
            const listo = new Promise((ok, mal) => {
                const clickOriginal = w.HTMLAnchorElement.prototype.click;
                w.HTMLAnchorElement.prototype.click = function () {
                    if (this.download) { guardar(this.href, this.download).then(ok, ok); }
                    else clickOriginal.call(this);
                };
                setTimeout(() => mal(new Error('La imagen tardó demasiado en generarse.')), 30000);
            });
            const mod = (d.moderador || 'ADMIN').toUpperCase();
            if (h.tipo === 'salas') {
                // ROW, Rusheo, ZMF: renderizarResultados(eqs, killers, salas, moderador, fecha, hora) + descargar()
                const [ymd, hm] = fechaLocal(s.fecha).split('T');
                const [hh, mm] = hm.split(':'); const hn = +hh;
                const hora = `${hn % 12 || 12}:${mm} ${hn >= 12 ? 'PM' : 'AM'}`;
                w._rWGlobal = d.rW;
                w.renderizarResultados(d.eqs, d.killers.map(k => ({ name: k.name, kills: k.kills })), d.n, mod,
                    new Date(ymd + 'T00:00:00').toLocaleDateString(), hora);
                w.descargar();
            } else if (h.tipo === 'reducida') {
                // QFD y Dragon Fest: usan las salas en memoria + descargarTablaReducida()
                w.__salasBD = salasReducida(d);
                w.eval('salasProcesadas = window.__salasBD; correccionesNombres = {}; equiposEliminados = new Set();');
                w.renderizarResultados();
                w.descargarTablaReducida();
            } else {
                // Pumas: renderizarResultados(eqs, killers, salas) + descargar()
                w._rWGlobal = d.rW;
                w.renderizarResultados(d.eqs, d.killers.map(k => ({ name: k.name, team: k.team, kills: k.kills })), d.n);
                w.descargar();
            }
            await listo;
        } finally {
            setTimeout(() => f.remove(), 1500);
        }
    }

    document.addEventListener('click', async e => {
        const b = e.target.closest('[data-dl]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        const s = JSON.parse(b.dataset.ses);
        const html = b.innerHTML;
        b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Generando...</span>';
        try { await descargarImagen(s); }
        catch (err) { alert('No se pudo descargar: ' + err.message); }
        finally { b.disabled = false; b.innerHTML = html; }
    }, true);

    // Estilos de la fecha y el botón (iguales en todas las páginas)
    const st = document.createElement('style');
    st.textContent = `
.pg-fecha{display:inline-flex;align-items:center;gap:5px;margin:2px 0;padding:2px 8px;border:1px solid rgba(216,195,149,.35);border-radius:12px;color:#e9dcb8;background:rgba(216,195,149,.08);font:700 .72rem 'Trebuchet MS',sans-serif;white-space:nowrap}
.pg-fecha+small{display:block;margin-top:3px}
.pg-dl{display:inline-flex;gap:6px;flex-wrap:wrap}
.pg-dl-btn{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 12px;border:1px solid rgba(216,195,149,.45);border-radius:2px;color:#f4eedc;background:transparent;font:700 .74rem 'Trebuchet MS',sans-serif;cursor:pointer}
.pg-dl-btn:hover{color:#0a0a0a;background:#D8C395}
.pg-dl-btn:disabled{opacity:.7;cursor:wait}
.pg-ses-acc{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px}
@media(max-width:640px){.res-row,.ses-row{flex-wrap:wrap}.pg-ses-acc{width:100%;justify-content:flex-start}.pg-dl-btn{min-height:38px}}`;
    document.head.appendChild(st);

    window.PumasDescargas = { botones, fecha, fechaHTML };
})();
