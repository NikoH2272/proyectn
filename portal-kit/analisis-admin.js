/* =====================================================================
   PROYECTN · Análisis de entrenos en la herramienta (sin depender del .log)
   Se suben los replays de 4 a 6 salas: su .json y su .bin (obligatorios, uno de
   cada uno por sala), y si los hay, el match .log (kills y puntos oficiales) y el
   .csv de resultados completos (daño, headshots, gloo...).
   Genera las 2 imágenes 4:5 (estadísticas avanzadas y análisis por sala) y guarda
   el análisis con su fecha y título: sale en "Análisis de entrenos" del portal
   (general, por día y por entreno).
   Uso: PumasAnalisis.montar('idDelContenedor', { portal: 'pruebas', marca: 'MÓDULO PRUEBAS' })
   Necesita portal-kit/portal.js, portal-kit/completos.js y html2canvas.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const C = () => window.PumasCompletos;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MIN_SALAS = 4, MAX_SALAS = 6;
    const fechaNombre = n => (/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/.exec(n || '') || [])[1] || '';
    const leer = input => Promise.all(Array.from(input.files || []).map(async f => ({ nombre: f.name, texto: await f.text() })));
    const ahoraLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

    const CSS = `
.an-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px}
.an-bloque{margin-top:14px;padding:16px;border:1px solid rgba(216,195,149,.3);border-radius:8px;background:rgba(216,195,149,.05)}
.an-bloque h3{margin:0 0 8px;color:#D8C395;font-size:.85rem;letter-spacing:.05em}
.an-bloque input[type=file]{width:100%}
.an-check{width:100%;margin-top:12px;border-collapse:collapse;font-size:.82rem}
.an-check th{padding:6px;color:#D8C395;font-size:.62rem;text-align:left;letter-spacing:.05em}
.an-check td{padding:6px;border-top:1px solid rgba(255,255,255,.07);color:#ddd}
.an-check .si{color:#6ee7a8}.an-check .no{color:#ff8a8d}
.an-msg{margin-top:10px;font-size:.88rem}
.an-imgs{display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:22px;overflow-x:auto}
.an-acciones{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.an-guardados{display:grid;gap:8px;margin-top:10px}
.an-item{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;border:1px solid rgba(216,195,149,.2);border-radius:6px;background:rgba(0,0,0,.3)}
.an-item small{color:#9a9a9a}`;

    function montar(contId, opts) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        const o = Object.assign({ portal: P && P.portal, marca: 'PROYECTN', encabezado: 'ANÁLISIS DE ENTRENOS' }, opts || {});
        if (!document.getElementById('pgAnalisisCss')) {
            const st = document.createElement('style'); st.id = 'pgAnalisisCss'; st.textContent = CSS; document.head.appendChild(st);
        }
        cont.innerHTML = `
            <p class="tool-desc">Sube los replays de <b>${MIN_SALAS} a ${MAX_SALAS} salas</b>: el <code>.json</code> y el <code>.bin</code> de cada una (se cruzan por el número de la partida).
                El <code>.log</code> y el <code>.csv</code> de resultados completos son opcionales. Genera las imágenes y guarda el análisis: sale en <b>Análisis de entrenos</b> del portal.</p>
            <div class="an-grid">
                <div class="form-group"><label>Fecha y hora del entreno</label><input type="datetime-local" data-an="fecha" value="${ahoraLocal()}"></div>
                <div class="form-group"><label>Título del entreno</label><input type="text" data-an="titulo" maxlength="60" placeholder="Ej: SCRIM 8PM"></div>
                <div class="form-group"><label>Moderador</label><input type="text" data-an="mod" maxlength="40" value="${esc(o.moderador || '')}"></div>
            </div>
            <div class="an-bloque">
                <h3><i class="fa-solid fa-film"></i> REPLAYS Y RESULTADOS DE LAS SALAS</h3>
                <div class="an-grid">
                    <div class="form-group"><label>Replays (.json) · ${MIN_SALAS} a ${MAX_SALAS}</label><input type="file" data-an="json" multiple accept=".json"></div>
                    <div class="form-group"><label>Replays (.bin) · ${MIN_SALAS} a ${MAX_SALAS}</label><input type="file" data-an="bin" multiple accept=".bin"></div>
                    <div class="form-group"><label>Match logs (.log) · opcional</label><input type="file" data-an="log" multiple accept=".log,.txt"></div>
                    <div class="form-group"><label>Resultados completos (.csv) · opcional</label><input type="file" data-an="csv" multiple accept=".csv"></div>
                </div>
                <div data-an="check"></div>
                <p class="an-msg" data-an="msg" role="status"></p>
            </div>
            <div class="an-imgs" data-an="imgs"></div>
            <div class="an-acciones" data-an="acciones" hidden>
                <button class="btn-access" data-an="guardar"><i class="fa-solid fa-cloud-arrow-up"></i> Guardar análisis</button>
                <button class="btn-access btn-outline" data-an="descargar"><i class="fa-solid fa-download"></i> Descargar las 2 imágenes</button>
            </div>
            <div class="an-bloque">
                <h3><i class="fa-solid fa-clock-rotate-left"></i> ANÁLISIS GUARDADOS</h3>
                <div class="an-guardados" data-an="lista"><p class="muted">Cargando...</p></div>
            </div>`;
        const $ = k => cont.querySelector(`[data-an="${k}"]`);
        const msg = (t, color) => { $('msg').innerHTML = t; $('msg').style.color = color || ''; };
        let actual = null;   // { salas, r }
        let turno = 0;

        async function revisar() {
            const t = ++turno;
            const [reps, logs, csvs] = await Promise.all([leer($('json')), leer($('log')), leer($('csv'))]);
            if (t !== turno) return;
            const bins = Array.from($('bin').files || []).map(f => ({ nombre: f.name, id: C().idDeArchivo(f.name) }));
            actual = null; $('imgs').innerHTML = ''; $('acciones').hidden = true;
            const errores = [];
            // Salas: una por replay .json (número y fecha de la partida)
            const salas = reps.map(r => ({ r, id: (/"MatchID"\s*:\s*(\d+)/.exec(r.texto) || [])[1] || C().idDeArchivo(r.nombre),
                fecha: (/"MatchDateTime"\s*:\s*"([^"]+)"/.exec(r.texto) || [])[1] || fechaNombre(r.nombre) }))
                .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.id).localeCompare(String(b.id)));
            if (reps.length < MIN_SALAS || reps.length > MAX_SALAS) errores.push(`Sube de ${MIN_SALAS} a ${MAX_SALAS} replays .json (hay ${reps.length}).`);
            if (bins.length !== reps.length) errores.push(`Debe haber un .bin por cada .json (hay ${bins.length} .bin y ${reps.length} .json).`);
            const logSinId = logs.filter(l => !C().idDeArchivo(l.nombre));
            salas.forEach((s, i) => {
                s.bin = bins.find(b => b.id && b.id === s.id);
                s.log = logs.find(l => C().idDeArchivo(l.nombre) === s.id);
                s.csv = csvs.find(c => C().idDeArchivo(c.nombre) === s.id || (c.texto.match(/id(\d{15,})/) || [])[1] === s.id);
            });
            // Logs sin número (MatchResult_0_...): por orden
            const sinLog = salas.filter(s => !s.log);
            if (logSinId.length && logSinId.length === sinLog.length) logSinId.sort((a, b) => fechaNombre(a.nombre).localeCompare(fechaNombre(b.nombre))).forEach((l, i) => { sinLog[i].log = l; });
            const sinBin = salas.map((s, i) => s.bin ? '' : 'S' + (i + 1)).filter(Boolean);
            if (sinBin.length && bins.length) errores.push(`Sin su .bin: ${sinBin.join(', ')} (el número del nombre debe ser el mismo del .json).`);
            const marca = v => v ? '<i class="fa-solid fa-circle-check si"></i>' : '<i class="fa-solid fa-minus" style="color:#666"></i>';
            const falta = v => v ? '<i class="fa-solid fa-circle-check si"></i>' : '<i class="fa-solid fa-circle-xmark no"></i>';
            $('check').innerHTML = salas.length ? `<table class="an-check"><thead><tr><th>SALA</th><th>PARTIDA</th><th>.JSON</th><th>.BIN</th><th>.LOG</th><th>.CSV</th></tr></thead><tbody>
                ${salas.map((s, i) => `<tr><td>S${i + 1}</td><td>${esc(s.id || '—')}</td><td>${falta(true)}</td><td>${falta(s.bin)}</td><td>${marca(s.log)}</td><td>${marca(s.csv)}</td></tr>`).join('')}</tbody></table>` : '';
            if (!reps.length) { msg(''); return; }
            if (errores.length) { msg('⚠ ' + errores.map(esc).join('<br>⚠ '), '#ff8a8d'); return; }

            let res;
            try {
                res = C().emparejar(salas.map(s => s.r.nombre), salas.filter(s => s.csv).map(s => s.csv), {}, salas.map(s => s.r), salas.map(s => s.log ? s.log.texto : ''));
            } catch (e) { msg('⚠ ' + esc(e.message), '#ff8a8d'); return; }
            // Puntos por sala de los .log (para la escuadra destacada)
            const puntos = new Map();
            salas.forEach((s, i) => {
                if (!s.log) return;
                s.log.texto.split('\n').forEach(l => {
                    const m = l.match(/TeamName:\s*(.+?)\s+Rank:\s*\d+\s+KillScore:\s*\d+\s+RankScore:\s*\d+\s+TotalScore:\s*(\d+)/i);
                    if (m) { const k = m[1].trim(); const x = puntos.get(k) || { name: k, salasPuntos: {} }; x.salasPuntos[i] = +m[2]; puntos.set(k, x); }
                });
            });
            const r = C().calcular(res.salas, salas.every(s => s.log) ? [...puntos.values()] : []);
            actual = { salas: res.salas, r };
            const meta = metaImagen();
            $('imgs').innerHTML = C().imagenHTML(r, meta) + C().imagenSalasHTML(r, meta);
            $('acciones').hidden = false;
            const conCsv = salas.filter(s => s.csv).length, conLog = salas.filter(s => s.log).length;
            msg(`✔ ${salas.length} salas completas (.json + .bin)` + (conLog ? ` · ${conLog} con .log` : conCsv ? ' · sin .log: las kills salen del .csv' : ' · sin .log: las kills salen del replay (cuentan derribos y eliminaciones)') +
                (conCsv ? ` · ${conCsv} con .csv` : ' · sin .csv: no hay daño, headshots ni gloo') + '.', '#6ee7a8');
        }

        function metaImagen() {
            const f = $('fecha').value;
            return { fondo: o.fondo || null, marca: o.marca, encabezado: ($('titulo').value.trim() || o.encabezado).toUpperCase(),
                fecha: f ? f.replace('T', ' ') : '', moderador: $('mod').value.trim().toUpperCase() };
        }

        async function guardar() {
            if (!actual) return;
            const btn = $('guardar');
            btn.disabled = true;
            msg('Guardando...');
            try {
                const f = $('fecha').value;
                const sesion = 'an-' + Date.now();
                const meta = { fecha: f ? new Date(f).toISOString() : new Date().toISOString(), titulo: $('titulo').value.trim() || 'ENTRENO' };
                const r = await C().guardar(o.portal, sesion, C().filasBD(actual.salas, meta));
                msg(`✔ Análisis guardado (${r.filas} jugadores). Ya sale en el portal.`, '#6ee7a8');
                listar();
            } catch (e) {
                msg('⚠ ' + esc(/borrar_stats|guardar_stats|fecha|titulo|PGRST202|column/i.test(e.message) ? 'Falta correr sql/23_resultados_completos.sql en Supabase.' : e.message), '#ff8a8d');
            } finally { btn.disabled = false; }
        }

        async function descargar() {
            for (const [id, nombre] of [['capturaAvanzada', 'Analisis_Destacados.png'], ['capturaPorSala', 'Analisis_Por_Sala.png']]) {
                const el = document.getElementById(id);
                if (!el) continue;
                const c = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
                const a = document.createElement('a');
                a.download = nombre; a.href = c.toDataURL('image/png'); a.click();
                await new Promise(r => setTimeout(r, 400));
            }
        }

        async function listar() {
            const caja = $('lista');
            let filas;
            try {
                filas = await C().traerTodo(() => P.db().from('stats_jugadores').select('sesion_id, fecha, titulo, creado').eq('portal', o.portal).order('creado', { ascending: false }));
            } catch (e) { caja.innerHTML = `<p class="muted">${esc(P.faltaSql && P.faltaSql(e) ? 'Falta correr sql/23_resultados_completos.sql en Supabase.' : e.message)}</p>`; return; }
            const ses = new Map();
            filas.forEach(f => { const s = ses.get(f.sesion_id) || { id: f.sesion_id, fecha: f.fecha || f.creado, titulo: f.titulo || '', jugadores: 0 }; s.jugadores++; ses.set(f.sesion_id, s); });
            const lista = [...ses.values()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
            caja.innerHTML = lista.length ? lista.map(s => `<div class="an-item"><div><b>${esc(s.titulo || 'ENTRENO')}</b><br>
                <small>${new Date(s.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · ${s.jugadores} filas</small></div>
                <button class="btn-access btn-outline" data-borrar="${esc(s.id)}"><i class="fa-solid fa-trash-can"></i> Borrar</button></div>`).join('')
                : '<p class="muted">Todavía no hay análisis guardados.</p>';
            caja.querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
                if (!confirm('¿Borrar este análisis? Deja de salir en el portal.')) return;
                b.disabled = true;
                try { await P.stats.borrar(o.portal, b.dataset.borrar); listar(); }
                catch (e) { b.disabled = false; alert(/borrar_stats|PGRST202/i.test(e.message) ? 'Falta correr sql/23_resultados_completos.sql en Supabase.' : e.message); }
            });
        }

        ['json', 'bin', 'log', 'csv'].forEach(k => $(k).addEventListener('change', revisar));
        ['fecha', 'titulo', 'mod'].forEach(k => $(k).addEventListener('change', () => { if (actual) { const m = metaImagen(); $('imgs').innerHTML = C().imagenHTML(actual.r, m) + C().imagenSalasHTML(actual.r, m); } }));
        $('guardar').addEventListener('click', guardar);
        $('descargar').addEventListener('click', descargar);
        C().habilitado(o.portal).then(ok => { if (!ok) msg(`⚠ Este evento no tiene habilitado el análisis (Admin → Resultados completos): puedes generar las imágenes, pero no guardar.`, '#FFD54A'); });
        listar();
    }

    window.PumasAnalisis = { montar };
})();
