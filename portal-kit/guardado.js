/* =====================================================================
   PROYECTN · Botón "Cargar a la base de datos" de las herramientas
   Cada herramienta llama a PumasGuardado.montar({...}) con una función
   `datos()` que devuelve lo que ya procesó (con nombres corregidos).
   Antes de guardar se pide confirmación con el resumen del entreno.
   Necesita portal.js cargado antes.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    // Log de sala → Map(nombre → { rank, killScore, rankScore, totalScore, players:[{name,kills}] })
    function parsearLog(texto) {
        const mapa = new Map();
        let actual = null;
        String(texto).split('\n').forEach(l => {
            const t = l.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (t) {
                actual = { rank: +t[2], killScore: +t[3], rankScore: +t[4], totalScore: +t[5], isManual: false, players: [] };
                mapa.set(t[1].trim(), actual);
                return;
            }
            const p = l.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
            if (p && actual) actual.players.push({ name: p[1].trim(), kills: +p[2] });
        });
        return mapa;
    }

    // salas: array de Map(nombreOriginal → datos). nombreVisible(orig) → nombre final, o null para excluir.
    // Devuelve filas para portal_salas (1 por equipo por sala) y portal_killers (1 por jugador).
    function construir(salas, nombreVisible) {
        const filas = [], jugadores = {};
        salas.forEach((mapa, i) => {
            const enSala = {};
            mapa.forEach((eq, orig) => {
                const nombre = (nombreVisible(orig) || '').trim();
                if (!nombre) return;
                const k = nombre.toLowerCase();
                const f = enSala[k] = enSala[k] || {
                    numero_sala: i + 1, equipo_nombre: nombre, rank: null,
                    kill_score: 0, rank_score: 0, total_score: 0, es_booyah: false
                };
                if (eq.isManual) {                       // sala manual: solo puntos
                    f.rank_score += eq.totalScore || 0;
                    f.total_score += eq.totalScore || 0;
                } else {
                    f.rank = f.rank === null ? eq.rank : Math.min(f.rank, eq.rank);
                    f.kill_score += eq.killScore || 0;
                    f.rank_score += eq.rankScore || 0;
                    f.total_score += eq.totalScore || 0;
                    f.es_booyah = f.es_booyah || eq.rank === 1;
                    (eq.players || []).forEach(p => {
                        const pk = p.name.trim().toLowerCase();
                        const j = jugadores[pk] = jugadores[pk] || { jugador_nombre: p.name.trim(), equipo_nombre: nombre, kills: 0, salas: 0 };
                        j.kills += p.kills || 0; j.salas++; j.equipo_nombre = nombre;
                    });
                }
            });
            filas.push(...Object.values(enSala));
        });
        return { salas: filas, killers: Object.values(jugadores) };
    }

    const fmtFecha = d => d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    // op: { contenedor, portal(), nombrePortal(), tituloPorDefecto(), jornadaPorDefecto()?, datos() → { salas:[Map], nombreVisible, fecha:Date, moderador } | null }
    function montar(op) {
        const cont = typeof op.contenedor === 'string' ? document.getElementById(op.contenedor) : op.contenedor;
        if (!cont) return;
        cont.classList.add('guardar-bd');
        cont.innerHTML = `<p><i class="fa-solid fa-database"></i> Cuando la tabla esté lista, cárgala para que aparezca en el portal y en Entrenos LATAM.</p>
            <button type="button" class="btn-access" data-guardar><i class="fa-solid fa-cloud-arrow-up"></i> Cargar a la base de datos</button>
            <p class="estado" role="status"></p>`;
        const btn = cont.querySelector('[data-guardar]');
        const estado = cont.querySelector('.estado');

        // Resultados completos (.csv): solo si el superadmin los habilitó para este evento (sql/23)
        let inputCsv = null;
        P.cargarKit('completos.js').then(() => window.PumasCompletos && PumasCompletos.habilitados()).then(lista => {
            if (!lista || !lista.some(p => p === op.portal() || (op.portales && op.portales().includes(p)))) return;
            const caja = document.createElement('label');
            caja.className = 'guardar-csv';
            caja.innerHTML = `<span><i class="fa-solid fa-chart-simple"></i> Resultados completos (.csv) · opcional: daño, headshots, revividas, paredes gloo</span>
                <input type="file" accept=".csv" multiple>`;
            btn.before(caja);
            inputCsv = caja.querySelector('input');
        }).catch(() => { });
        const avisar = (t, tipo) => { estado.textContent = t; estado.className = 'estado' + (tipo ? ' ' + tipo : ''); };

        btn.addEventListener('click', async () => {
            const d = op.datos();
            if (!d || !d.salas || !d.salas.length) { avisar('Primero sube los archivos y genera la tabla.', 'error'); return; }
            const { salas, killers } = construir(d.salas, d.nombreVisible || (n => n));
            if (!salas.length) { avisar('No hay equipos para guardar.', 'error'); return; }
            const portal = op.portal(), nombre = op.nombrePortal();
            const equipos = new Set(salas.map(s => s.equipo_nombre.toLowerCase())).size;
            const fecha = d.fecha instanceof Date && !isNaN(d.fecha) ? d.fecha : new Date();

            const r = await P.confirmar({
                titulo: `¿Cargar este entreno a ${nombre}?`,
                html: `<p>Se guardará en la base de datos de <b>${esc(nombre)}</b> y aparecerá en su portal y en Entrenos LATAM.</p>
                    <div class="pg-resumen">
                        <div><b>${d.salas.length}</b><small>Salas</small></div>
                        <div><b>${equipos}</b><small>Equipos</small></div>
                        <div><b>${killers.length}</b><small>Jugadores</small></div>
                    </div>
                    <p class="muted">${fmtFecha(fecha)}${d.moderador ? ' · Mod: ' + esc(d.moderador) : ''}</p>
                    <div class="form-group"><label for="gTitulo">Título del entreno</label>
                        <input id="gTitulo" data-campo="titulo" type="text" maxlength="120" value="${esc(op.tituloPorDefecto())}"></div>
                    <div class="form-group"><label for="gJornada">Jornada / tipo</label>
                        <input id="gJornada" data-campo="jornada" type="text" maxlength="60" value="${esc(op.jornadaPorDefecto ? op.jornadaPorDefecto() : 'NORMAL')}"></div>`,
                si: 'Sí, cargar', no: 'No, cancelar'
            });
            if (!r.ok) { avisar('Carga cancelada. No se guardó nada.'); return; }

            btn.disabled = true;
            avisar('Guardando...');
            try {
                const res = await P.entrenos.guardar({
                    portal, titulo: (r.campos.titulo || op.tituloPorDefecto()).trim(), jornada: r.campos.jornada,
                    fecha, moderador: d.moderador, salas, killers
                });
                avisar(`✔ Entreno guardado (#${res.id}). Ya aparece en el portal y en Entrenos LATAM.`, 'ok');
                // Estadísticas avanzadas con el id del entreno (se emparejan por el id de la partida o por orden)
                if (inputCsv && inputCsv.files.length) {
                    try {
                        const csvs = await Promise.all(Array.from(inputCsv.files).map(async f => ({ nombre: f.name, texto: await f.text() })));
                        const logs = document.querySelector('input[type="file"][accept*=".log"]');
                        const nombres = logs && logs.files.length === d.salas.length ? Array.from(logs.files).map(f => f.name) : d.salas.map((_, i) => 'sala' + (i + 1));
                        const ren = {};
                        d.salas.forEach(sala => { if (sala instanceof Map) sala.forEach((v, nombre) => { const vis = (d.nombreVisible || (n => n))(nombre); if (vis) ren[nombre] = vis; }); });
                        const { salas: conStats } = PumasCompletos.emparejar(nombres, csvs, ren);
                        if (conStats.length) {
                            const r2 = await PumasCompletos.guardar(portal, res.id, PumasCompletos.filasBD(conStats));
                            avisar(`✔ Entreno guardado (#${res.id}) con estadísticas avanzadas de ${conStats.length} sala(s) (${r2.filas} jugadores).`, 'ok');
                        } else avisar(`✔ Entreno guardado (#${res.id}). ⚠ Los .csv no coinciden con las salas: no se guardaron estadísticas avanzadas.`, 'ok');
                    } catch (e2) { avisar(`✔ Entreno guardado (#${res.id}). ⚠ Estadísticas avanzadas no guardadas: ${e2.message}`, 'ok'); }
                }
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
                // Si cargan otros archivos, se puede volver a guardar
                setTimeout(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Cargar a la base de datos'; }, 4000);
            } catch (err) {
                avisar('No se pudo guardar: ' + err.message, 'error');
                btn.disabled = false;
            }
        });
    }

    window.PumasGuardado = { parsearLog, construir, montar };
})();
