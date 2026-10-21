/* =====================================================================
   PROYECTN · Generar CSV oficiales (compartido: Entrenos PROYECTN, Pruebas...)
   Base: los replays de cada sala (.json + .bin, cruzados por el número de la partida).
   El .log (kills y puntos oficiales) y el .csv de resultados completos son opcionales.
   Descarga: equipos · jugadores (todo el entreno) · detalle por sala con todas las métricas.
   Uso: PumasGenerador.montar('idDelContenedor')   (necesita portal-kit/completos.js)
   ===================================================================== */
(function () {
    const C = () => window.PumasCompletos;
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const leerArchivos = async input => Promise.all(Array.from(($(input) || {}).files || []).map(async f => ({ nombre: f.name, texto: await f.text() })));

    // Base: los replays de cada sala (.json + .bin, cruzados por el número de la partida).
    // El .log (kills y puntos oficiales) y el .csv de resultados completos son opcionales.
    const PTS_POSICION = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 };   // solo si la sala no trae .log
    // Columnas del .csv que ya salen con su propio nombre o que son códigos/ids
    const CSV_YA = /^(nickname|team_name|account_id|match_id|kills|damage|headshots|hits|shoots|revive_teammate_times|icewall_use|assists|knock_down|booyah|weapon_usages|alive_duration|survival_time|map_id|group_mode)$/;
    const CSV_NO_SUMAR = /^(create_time|end_time|avatar_id|pet_skill_id|team_id|game_mode|match_mode|player_state|round_index|bag_inv|vest_inv|helmet_inv|win_rate|be_killed_time)$/;
    const ETIQUETAS = {
        moving_distance: 'DISTANCIA RECORRIDA (m)', vehicle_move_distance: 'DISTANCIA EN VEHÍCULO (m)', damage_taken: 'DAÑO RECIBIDO',
        healing_to_self: 'CURACIÓN PROPIA', healing_to_teammates: 'CURACIÓN A COMPAÑEROS', hp_added: 'VIDA RECUPERADA', medkit_use: 'BOTIQUINES',
        grenade_use: 'GRANADAS', grenade_kill: 'KILLS CON GRANADA', ice_grenade_kill: 'KILLS CON GRANADA DE HIELO', vehicle_kill: 'KILLS CON VEHÍCULO',
        revived_times: 'VECES REVIVIDO', rescue_times: 'RESCATES', be_knocked_down_count: 'VECES DERRIBADO', icewall_destroyed_times: 'PAREDES GLOO DESTRUIDAS',
        skyler_ice_wall_destroy: 'GLOO DESTRUIDAS (SKYLER)', headshot_killtimes: 'KILLS A LA CABEZA', knockdown_real_damage: 'DAÑO REAL EN DERRIBOS',
        knockdown_real_damage_taken: 'DAÑO REAL RECIBIDO EN DERRIBOS', torso_hits: 'IMPACTOS AL TORSO', leg_hits: 'IMPACTOS A LAS PIERNAS',
        engage_count: 'ENFRENTAMIENTOS', killing_score: 'PUNTOS POR KILLS', ranking_score: 'POSICIÓN', kill_count: 'CONTEO DE KILLS',
        chrono_block_damage: 'DAÑO BLOQUEADO (CHRONO)', alok_heal_hP: 'CURACIÓN (ALOK)', picked_coin_count: 'MONEDAS', match_duration_after_cabin: 'TIEMPO DESDE EL AVIÓN',
        kill_distance: 'DISTANCIAS DE KILL', eliminated_team_name: 'ELIMINADO POR (EQUIPO)', is_eliminated: 'ELIMINADO', final: 'FINAL',
        revive_teammate_nums: 'COMPAÑEROS REVIVIDOS', oil_kill: 'KILLS CON BARRIL', pet_skill_name: 'MASCOTA'
    };
    const etiqueta = c => ETIQUETAS[c] || c.replace(/_/g, ' ').toUpperCase();
    const esNum = v => /^-?\d+(\.\d+)?$/.test(String(v).trim());
    const esBool = v => /^(true|false)$/i.test(String(v).trim());
    const fechaNombre = n => (/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/.exec(n || '') || [])[1] || '';
    const fechaUnix = t => { if (!t) return ''; const d = new Date(t * 1000), z = x => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`; };
    const fechaBonita = f => f ? f.replace(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-\d{2}$/, '$3/$2/$1 $4:$5') : '';
    const listaArmas = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n}: ${k}`).join(' | ');

    let gen = null, turnoGen = 0;
    let oficiales = null;

    async function nombresOficiales() {
        if (oficiales) return oficiales;
        oficiales = {};
        try {
            const db = (typeof supabaseClient !== 'undefined' && supabaseClient) || (window.PumasPortal && PumasPortal.db());
            if (db) {
                const { data } = await db.from('equipos_registrados').select('nombre');
                (data || []).forEach(e => { if (e.nombre) oficiales[e.nombre.toUpperCase()] = e.nombre; });
            }
        } catch (e) { /* sin conexión: se dejan los nombres de la sala */ }
        return oficiales;
    }

    function equiposDeLog(texto) {
        const l = [];
        String(texto || '').split('\n').forEach(linea => {
            const t = linea.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (t) l.push({ nombre: t[1].trim(), rank: +t[2], kills: +t[3], rankPts: +t[4], total: +t[5] });
        });
        return l;
    }

    async function generarDatos() {
        const gInfo = $('genInfo');
        const turno = ++turnoGen;   // si suben otro archivo mientras se lee, solo cuenta la última lectura
        const [reps, logs, cs] = await Promise.all([leerArchivos('genReplays'), leerArchivos('genLogs'), leerArchivos('genCsvs')]);
        if (turno !== turnoGen) return;
        const bins = Array.from(($('genBins') || {}).files || []).map(f => ({ nombre: f.name, id: C().idDeArchivo(f.name) }));
        gen = null;
        ['genEquipos', 'genJugadores', 'genDetalle'].forEach(id => { $(id).disabled = true; });
        $('genVista').innerHTML = ''; $('genChecklist').innerHTML = '';
        if (!reps.length && !logs.length && !cs.length) { gInfo.textContent = bins.length ? 'Sube también los replays .json (el .bin solo no trae datos legibles).' : ''; gInfo.style.color = ''; return; }

        // 1) Una sala por número de partida
        const avisos = [];
        const mapa = new Map();
        const sala = (id, fecha) => { let x = mapa.get(id); if (!x) { x = { id, fecha: '' }; mapa.set(id, x); } if (fecha && !x.fecha) x.fecha = fecha; return x; };
        reps.forEach(r => {
            const id = (/"MatchID"\s*:\s*(\d+)/.exec(r.texto) || [])[1] || C().idDeArchivo(r.nombre);
            if (!id) { avisos.push(`${r.nombre}: no trae el número de la partida.`); return; }
            sala(id, (/"MatchDateTime"\s*:\s*"([^"]+)"/.exec(r.texto) || [])[1] || fechaNombre(r.nombre)).json = r;
        });
        cs.forEach(c => {
            let p;
            try { p = C().partidaDesdeCSV(c.texto, {}); } catch (e) { avisos.push(`${c.nombre}: ${e.message}`); return; }
            const id = p.match_id || C().idDeArchivo(c.nombre);
            if (!id) { avisos.push(`${c.nombre}: no trae el número de la partida.`); return; }
            const j0 = p.jugadores[0];
            sala(id, fechaUnix(+(j0 && j0.crudo.create_time))).csv = p;
        });
        const logsSinId = [];
        logs.forEach(l => { const id = C().idDeArchivo(l.nombre); if (id) sala(id, fechaNombre(l.nombre)).log = l; else logsSinId.push(l); });
        bins.forEach(b => { if (b.id) sala(b.id, fechaNombre(b.nombre)).bin = b; else avisos.push(`${b.nombre}: no trae el número de la partida.`); });
        const lista = [...mapa.values()].filter(x => x.json || x.csv || x.log)
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.id.localeCompare(b.id));
        // Logs sin número (MatchResult_0_...): por orden, a las salas que no tienen .log
        const libres = lista.filter(x => !x.log);
        logsSinId.sort((a, b) => fechaNombre(a.nombre).localeCompare(fechaNombre(b.nombre))).forEach((l, i) => {
            if (libres[i]) libres[i].log = l;
            else lista.push({ id: 'SALA ' + (lista.length + 1), fecha: fechaNombre(l.nombre), log: l });
        });
        mapa.forEach(x => { if (x.bin && !x.json && !x.csv && !x.log) avisos.push(`${x.bin.nombre}: no hay .json, .log ni .csv de esa partida.`); });
        lista.forEach(x => { if (x.json && !x.bin) avisos.push(`Sala ${x.id}: falta su .bin.`); });

        // 2) Jugadores y equipos de cada sala (.log + .json + .csv)
        const ofi = $('genOficial').value === '1' ? await nombresOficiales() : {};
        if (turno !== turnoGen) return;
        const nom = n => ofi[String(n || '').toUpperCase()] || n;
        const equipos = new Map(), jugadores = new Map(), detalle = [], colsCsv = [];
        let conLog = false, conReplay = false, conCsv = false;
        lista.forEach((x, i) => {
            x.sala = i + 1;
            const logJug = x.log ? C().jugadoresDeLog(x.log.texto) : [];
            let rep = null;
            if (x.json) { try { rep = C().partidaDesdeReplay(x.json.texto, logJug, {}); } catch (e) { avisos.push(`${x.json.nombre}: ${e.message}`); } }
            conLog = conLog || !!x.log; conReplay = conReplay || !!rep; conCsv = conCsv || !!x.csv;
            x.mapa = (rep && rep.mapa) || (x.csv && x.csv.mapa) || null;
            x.modo = (rep && rep.modo) || (x.csv && x.csv.modo) || null;
            x.duracion = rep ? rep.duracion : 0;

            // Jugadores de la sala
            const filas = [];
            const buscar = (nombre, id) => {
                if (id && id !== '0') { const f = filas.find(f => f.id === id); if (f) return f; }
                const k = norm(nombre);
                return filas.find(f => norm(f.jugador) === k)
                    || filas.find(f => { const m = norm(f.jugador); return m.length >= 4 && k.length >= 4 && (k.startsWith(m) || m.startsWith(k)); });
            };
            const fila = (nombre, id, equipo) => {
                let f = buscar(nombre, id);
                if (!f) { f = { jugador: nombre, id: id && id !== '0' ? id : '', equipo: '' }; filas.push(f); }
                if (id && id !== '0' && !f.id) f.id = id;
                if (!f.equipo && equipo) f.equipo = nom(equipo);
                return f;
            };
            logJug.forEach(j => { fila(j.jugador, j.account_id, j.equipo).killsLog = j.kills; });
            if (x.csv) x.csv.jugadores.forEach(j => { fila(j.jugador, j.account_id, j.equipo).csv = j; });
            if (rep) rep.jugadores.forEach(j => { fila(j.jugador, j.account_id, /^ESCUADRA \d+$/.test(j.equipo) ? '' : j.equipo).rep = j; });
            // Equipos del .json sin nombre (sin .log): se toma el nombre que tienen sus jugadores en el .csv
            const nombreRep = {};
            filas.forEach(f => { if (f.rep) { nombreRep[f.rep.equipo] = nombreRep[f.rep.equipo] || {}; if (f.equipo) nombreRep[f.rep.equipo][f.equipo] = (nombreRep[f.rep.equipo][f.equipo] || 0) + 1; } });
            const eqRep = n => { const o = nombreRep[n] || {}; const top = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return top ? top[0] : nom(n); };
            filas.forEach(f => { if (!f.equipo) f.equipo = f.rep ? eqRep(f.rep.equipo) : 'SIN EQUIPO'; });

            // Puntos de cada equipo en la sala: del .log; si no hay, calculados (posición + 1 por kill)
            const killsDe = f => f.killsLog !== undefined ? f.killsLog : f.csv ? f.csv.kills : f.rep ? f.rep.kills : 0;
            const porEq = new Map();
            filas.forEach(f => { const e = porEq.get(f.equipo) || { nombre: f.equipo, kills: 0, vivo: 0, booyah: false, jugadores: [] }; e.kills += killsDe(f);
                e.vivo = Math.max(e.vivo, (f.csv && f.csv.vivo) || (f.rep && f.rep.vivo) || 0); e.booyah = e.booyah || !!((f.csv && f.csv.booyah) || (f.rep && f.rep.booyah)); e.jugadores.push(f); porEq.set(f.equipo, e); });
            const logEq = x.log ? equiposDeLog(x.log.texto) : [];
            if (logEq.length) {
                logEq.forEach(t => { const e = porEq.get(nom(t.nombre)) || { nombre: nom(t.nombre), jugadores: [] }; Object.assign(e, { rank: t.rank, killPts: t.kills, rankPts: t.rankPts, total: t.total, fuente: 'LOG' }); porEq.set(e.nombre, e); });
            } else {
                // Orden: el que ganó primero; luego el último eliminado (.json) o el que más aguantó (.csv)
                const elim = rep ? rep.eliminados.map(e => eqRep(e.equipo)) : [];
                const orden = [...porEq.values()].sort((a, b) => (b.booyah - a.booyah)
                    || (elim.length ? (elim.indexOf(b.nombre) < 0 ? 1e9 : elim.indexOf(b.nombre)) - (elim.indexOf(a.nombre) < 0 ? 1e9 : elim.indexOf(a.nombre)) : 0)
                    || b.vivo - a.vivo || b.kills - a.kills);
                orden.forEach((e, k) => Object.assign(e, { rank: k + 1, killPts: e.kills, rankPts: PTS_POSICION[k + 1] || 0, total: (PTS_POSICION[k + 1] || 0) + e.kills, fuente: 'CALCULADO' }));
            }

            porEq.forEach(e => {
                const t = equipos.get(e.nombre) || { nombre: e.nombre, oficial: !!ofi[String(e.nombre).toUpperCase()] || Object.values(ofi).includes(e.nombre), salas: 0, booyahs: 0, kills: 0, rankPts: 0, total: 0,
                    porSala: {}, posSala: {}, fuentes: new Set(), rematados: 0, vs: {}, recibidas: 0, suma: {}, vivo: 0, nVivo: 0 };
                t.salas++; t.kills += e.killPts || 0; t.rankPts += e.rankPts || 0; t.total += e.total || 0;
                t.porSala[i] = e.total; t.posSala[i] = e.rank; t.fuentes.add(e.fuente);
                if (e.rank === 1) t.booyahs++;
                equipos.set(e.nombre, t);
            });

            // Filas de detalle (cada jugador en la sala) y acumulado por jugador
            filas.forEach(f => {
                const r = f.rep, c = f.csv, xr = (r && r.extra) || {}, xc = (c && c.extra) || {};
                const vs = {};
                Object.entries(xr.vs || {}).forEach(([rv, nn]) => { const nm = eqRep(rv); vs[nm] = (vs[nm] || 0) + nn; });
                const armasKills = {};
                (r ? r.armas : []).forEach(a => { armasKills[a.n] = (armasKills[a.n] || 0) + a.k; });
                const d = {
                    sala: x.sala, partida: x.id, fecha: fechaBonita(x.fecha), mapa: C().MAPAS[x.mapa] || (x.mapa ? 'MAPA ' + x.mapa : ''), modo: C().GRUPOS[x.modo] || '',
                    equipo: f.equipo, jugador: f.jugador, id: f.id || (c && c.account_id) || '', kills: killsDe(f),
                    fuenteKills: f.killsLog !== undefined ? 'LOG' : c ? 'CSV' : 'REPLAY',
                    booyah: !!((c && c.booyah) || (r && r.booyah)) || (porEq.get(f.equipo) || {}).rank === 1,
                    vivo: (c && c.vivo) || (r && r.vivo) || 0,
                    bajas: r ? r.derribos : '', caidas: r ? xr.caidas : '', levantado: r ? xr.levantado : '',
                    primera: r ? (xr.primeraSangre ? 1 : 0) : '', distancia: Math.max(xr.distancia || 0, xc.distancia || 0) || '',
                    rematados: r ? (xr.fin || 0) : '', vs, armasKills, bin: x.bin ? 'SI' : 'NO', c
                };
                detalle.push(d);
                const k = d.id ? 'id' + d.id : 'n' + norm(d.jugador);
                const a = jugadores.get(k) || { jugador: d.jugador, id: d.id, equipo: d.equipo, salas: 0, kills: 0, porSala: {}, vivo: 0, booyahs: 0, bajas: 0, caidas: 0, levantado: 0,
                    primeras: 0, distancia: 0, rematados: 0, vs: {}, armasKills: {}, salasRep: 0, salasCsv: 0, csv: {}, armasCsv: {} };
                a.salas++; a.kills += d.kills; a.porSala[i] = d.kills; a.vivo += d.vivo; a.equipo = d.equipo;
                if (d.booyah) a.booyahs++;
                if (r) {
                    a.salasRep++; a.bajas += d.bajas || 0; a.caidas += d.caidas || 0; a.levantado += d.levantado || 0; a.primeras += d.primera || 0; a.rematados += d.rematados || 0;
                    Object.entries(vs).forEach(([rv, nn]) => { a.vs[rv] = (a.vs[rv] || 0) + nn; });
                    Object.entries(armasKills).forEach(([n2, k2]) => { a.armasKills[n2] = (a.armasKills[n2] || 0) + k2; });
                }
                a.distancia = Math.max(a.distancia, +d.distancia || 0);
                if (c) {
                    a.salasCsv++;
                    (c.armas || []).forEach(w => { a.armasCsv[w.n] = (a.armasCsv[w.n] || 0) + w.d; });
                    Object.entries(c.crudo).forEach(([col, v]) => {
                        if (!colsCsv.includes(col) && !CSV_YA.test(col)) colsCsv.push(col);
                        if (CSV_NO_SUMAR.test(col)) return;
                        const base = { damage: 'dano', headshots: 'hs', hits: 'hits', shoots: 'disparos', revive_teammate_times: 'revividas', icewall_use: 'gloo', assists: 'asistencias', knock_down: 'derribos' }[col] || col;
                        if (esNum(v)) a.csv[base] = (a.csv[base] || 0) + Number(v);
                        else if (esBool(v) && /true/i.test(v)) a.csv[base] = (a.csv[base] || 0) + 1;
                    });
                }
                jugadores.set(k, a);
                // Al equipo
                const t = equipos.get(d.equipo);
                if (t) {
                    if (r) { t.rematados += d.rematados || 0; Object.entries(vs).forEach(([rv, nn]) => { t.vs[rv] = (t.vs[rv] || 0) + nn; }); t.recibidas += d.caidas || 0; }
                    if (c) ['damage', 'headshots', 'revive_teammate_times', 'icewall_use', 'assists', 'knock_down', 'healing_to_teammates', 'damage_taken', 'moving_distance']
                        .forEach(col => { if (esNum(c.crudo[col])) t.suma[col] = (t.suma[col] || 0) + Number(c.crudo[col]); });
                    t.vivo += d.vivo; t.nVivo++;
                }
            });
        });
        const colsCsvSumables = colsCsv.filter(c => !CSV_NO_SUMAR.test(c) && detalle.some(d => d.c && (esNum(d.c.crudo[c]) || esBool(d.c.crudo[c]))));

        gen = {
            numSalas: lista.length, salas: lista, conLog, conReplay, conCsv, colsCsv, colsCsvSumables, detalle,
            equipos: [...equipos.values()].sort((a, b) => b.total - a.total || b.booyahs - a.booyahs || b.kills - a.kills),
            jugadores: [...jugadores.values()].sort((a, b) => b.kills - a.kills || a.jugador.localeCompare(b.jugador))
        };
        ['genEquipos', 'genJugadores', 'genDetalle'].forEach(id => { $(id).disabled = false; });

        // Revisión por sala
        const m = v => v ? '<i class="fa-solid fa-circle-check si"></i>' : '<i class="fa-solid fa-minus" style="color:#666"></i>';
        $('genChecklist').innerHTML = `<table class="check-salas"><thead><tr><th>SALA</th><th>PARTIDA</th><th>FECHA</th><th>MAPA</th><th>.JSON</th><th>.BIN</th><th>.LOG</th><th>.CSV</th></tr></thead><tbody>
            ${lista.map(x => `<tr><td>S${x.sala}</td><td>${esc(x.id)}</td><td>${esc(fechaBonita(x.fecha))}</td><td>${esc(C().MAPAS[x.mapa] || (x.mapa ? 'MAPA ' + x.mapa : '—'))}</td>
                <td>${m(x.json)}</td><td>${m(x.bin)}</td><td>${m(x.log)}</td><td>${m(x.csv)}</td></tr>`).join('')}</tbody></table>`;
        const nOfi = gen.equipos.filter(e => e.oficial).length;
        gInfo.innerHTML = `✔ ${lista.length} sala(s) · ${gen.equipos.length} equipos (${nOfi} registrados) · ${gen.jugadores.length} jugadores · ${detalle.length} filas de detalle.` +
            (conLog ? '' : ' Sin .log: las kills salen del .csv o del replay y los puntos se calculan (posición + 1 por kill).') +
            (avisos.length ? '<br>⚠ ' + avisos.map(esc).join('<br>⚠ ') : '');
        gInfo.style.color = avisos.length ? '#FFD54A' : '#6ee7a8';
        const fe = filasEquipos();
        $('genVista').innerHTML = `<div class="gen-scroll"><table class="gen-tabla"><thead><tr>${fe.cab.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${fe.filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    const top = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0];

    function filasEquipos() {
        const s = [...Array(gen.numSalas).keys()];
        const csvCols = [['damage', 'DAÑO'], ['headshots', 'HEADSHOTS'], ['revive_teammate_times', 'REVIVIDAS'], ['icewall_use', 'PAREDES GLOO'], ['assists', 'ASISTENCIAS'],
            ['knock_down', 'DERRIBOS'], ['healing_to_teammates', 'CURACIÓN A COMPAÑEROS'], ['damage_taken', 'DAÑO RECIBIDO'], ['moving_distance', 'DISTANCIA RECORRIDA (m)']];
        return {
            cab: ['POS', 'EQUIPO', 'REGISTRADO', 'SALAS', 'BOOYAHS', 'PTS KILLS', 'PTS POSICIÓN', ...s.map(i => 'PTS S' + (i + 1)), ...s.map(i => 'POS S' + (i + 1)), 'TOTAL', 'FUENTE PUNTOS',
                'TIEMPO VIVO PROMEDIO',
                ...(gen.conReplay ? ['EQUIPOS ELIMINADOS', 'RIVAL CON MÁS BAJAS', 'BAJAS A ESE RIVAL', 'CAÍDAS SUFRIDAS'] : []),
                ...(gen.conCsv ? csvCols.map(c => c[1]) : [])],
            filas: gen.equipos.map((e, k) => {
                const t = top(e.vs);
                return [k + 1, e.nombre, e.oficial ? 'SI' : 'NO', e.salas, e.booyahs, e.kills, e.rankPts,
                    ...s.map(i => e.porSala[i] ?? ''), ...s.map(i => e.posSala[i] ?? ''), e.total, [...e.fuentes].join(' + '),
                    e.nVivo ? mmss(e.vivo / e.nVivo) : '',
                    ...(gen.conReplay ? [e.rematados, t ? t[0] : '', t ? t[1] : '', e.recibidas] : []),
                    ...(gen.conCsv ? csvCols.map(c => e.suma[c[0]] !== undefined ? Math.round(e.suma[c[0]]) : '') : [])];
            })
        };
    }

    function filasJugadores() {
        const s = [...Array(gen.numSalas).keys()];
        const cab = ['POS', 'JUGADOR', 'ID', 'EQUIPO', 'SALAS', ...s.map(i => 'K S' + (i + 1)), 'KILLS', 'BOOYAHS', 'TIEMPO VIVO PROMEDIO'];
        if (gen.conReplay) cab.push('BAJAS (REPLAY)', 'CAÍDAS', 'VECES LEVANTADO', 'PRIMERAS SANGRES', 'EQUIPOS REMATADOS', 'RIVAL CON MÁS BAJAS', 'BAJAS A ESE RIVAL', 'ARMAS DE LAS KILLS');
        cab.push('KILL MÁS LEJANA (m)');
        const csvBase = [['dano', 'DAÑO'], ['hs', 'HEADSHOTS'], ['hits', 'IMPACTOS'], ['disparos', 'DISPAROS'], ['revividas', 'REVIVIDAS'], ['gloo', 'PAREDES GLOO'], ['asistencias', 'ASISTENCIAS'], ['derribos', 'DERRIBOS']];
        if (gen.conCsv) cab.push(...csvBase.map(c => c[1]), '% HEADSHOT', 'PRECISIÓN %', 'ARMA PRINCIPAL', 'DAÑO POR ARMA', ...gen.colsCsvSumables.map(etiqueta));
        const filas = gen.jugadores.map((j, k) => {
            const f = [k + 1, j.jugador, j.id, j.equipo, j.salas, ...s.map(i => j.porSala[i] ?? ''), j.kills, j.booyahs, j.salas ? mmss(j.vivo / j.salas) : ''];
            const rep = j.salasRep > 0, csv = j.salasCsv > 0, t = top(j.vs);
            if (gen.conReplay) f.push(rep ? j.bajas : '', rep ? j.caidas : '', rep ? j.levantado : '', rep ? j.primeras : '', rep ? j.rematados : '',
                rep && t ? t[0] : '', rep && t ? t[1] : '', rep ? listaArmas(j.armasKills) : '');
            f.push(j.distancia || '');
            if (gen.conCsv) {
                const v = col => csv && j.csv[col] !== undefined ? Math.round(j.csv[col] * 100) / 100 : '';
                f.push(...csvBase.map(c => v(c[0])),
                    csv && j.csv.hits ? ((j.csv.hs || 0) / j.csv.hits * 100).toFixed(1) : '',
                    csv && j.csv.disparos ? ((j.csv.hits || 0) / j.csv.disparos * 100).toFixed(1) : '',
                    csv ? ((top(j.armasCsv) || [''])[0]) : '', csv ? listaArmas(j.armasCsv) : '',
                    ...gen.colsCsvSumables.map(v));
            }
            return f;
        });
        return { cab, filas };
    }

    // Detalle: cada jugador en cada sala, con todas las métricas (incluidas todas las columnas del .csv tal cual)
    function filasDetalle() {
        const cab = ['SALA', 'PARTIDA', 'FECHA', 'MAPA', 'MODO', '.BIN', 'EQUIPO', 'JUGADOR', 'ID', 'KILLS', 'FUENTE KILLS', 'BOOYAH', 'TIEMPO VIVO', 'KILL MÁS LEJANA (m)'];
        if (gen.conReplay) cab.push('BAJAS (REPLAY)', 'CAÍDAS', 'VECES LEVANTADO', 'PRIMERA SANGRE', 'EQUIPOS REMATADOS', 'BAJAS POR RIVAL', 'ARMAS DE LAS KILLS');
        if (gen.conCsv) cab.push('DAÑO', 'HEADSHOTS', 'IMPACTOS', 'DISPAROS', '% HEADSHOT', 'PRECISIÓN %', 'REVIVIDAS', 'PAREDES GLOO', 'ASISTENCIAS', 'DERRIBOS', 'DAÑO POR ARMA',
            ...gen.colsCsv.map(c => 'CSV · ' + etiqueta(c)));
        const filas = gen.detalle.map(d => {
            const f = [d.sala, d.partida, d.fecha, d.mapa, d.modo, d.bin, d.equipo, d.jugador, d.id, d.kills, d.fuenteKills, d.booyah ? 'SI' : 'NO', mmss(d.vivo), d.distancia];
            if (gen.conReplay) f.push(d.bajas, d.caidas, d.levantado, d.primera, d.rematados, listaArmas(d.vs), listaArmas(d.armasKills));
            if (gen.conCsv) {
                const c = d.c;
                f.push(...(c ? [c.dano, c.headshots, c.hits, c.disparos, c.hits ? (c.headshots / c.hits * 100).toFixed(1) : '', c.disparos ? (c.hits / c.disparos * 100).toFixed(1) : '',
                    c.revividos, c.gloo, c.asistencias, c.derribos, c.armas.map(w => `${w.n}: ${w.d} daño / ${w.k} k`).join(' | ')] : Array(11).fill('')),
                    ...gen.colsCsv.map(col => c ? c.crudo[col] ?? '' : ''));
            }
            return f;
        });
        return { cab, filas };
    }

    function descargarCSV(tipo) {
        if (!gen) return;
        const { cab, filas } = tipo === 'equipos' ? filasEquipos() : tipo === 'jugadores' ? filasJugadores() : filasDetalle();
        const texto = C().aCSV(cab, filas, $('genSeparador').value);
        const fecha = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
        a.download = `Pumas_${{ equipos: 'Equipos', jugadores: 'Jugadores', detalle: 'Detalle_por_sala' }[tipo]}_${fecha}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }


    const CSS = `.bloque-stats { margin-top: 15px; padding: 16px; border: 1px solid rgba(216,195,149,.3); border-radius: 8px; background: rgba(216,195,149,.05); }
.bloque-stats h3 { margin: 0 0 6px; color: #D8C395; font-family: 'Michroma'; font-size: .85rem; }
.bloque-stats .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; margin-top: 12px; }
.bloque-stats input[type=file] { width: 100%; }
.check-salas { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: .82rem; }
.check-salas th { padding: 6px; color: #D8C395; font-family: 'Michroma'; font-size: .6rem; text-align: left; }
.check-salas td { padding: 6px; border-top: 1px solid rgba(255,255,255,.07); color: #ddd; }
.check-salas .si { color: #6ee7a8; } .check-salas .no { color: #ff8a8d; }
.gen-acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.gen-acciones .btn-generar { flex: 1 1 240px; }
.gen-tabla { width: 100%; border-collapse: collapse; font-size: .82rem; }
.gen-tabla th { position: sticky; top: 0; padding: 8px 6px; background: #121317; color: #D8C395; font-family: 'Michroma'; font-size: .6rem; text-align: left; }
.gen-tabla td { padding: 6px; border-top: 1px solid rgba(255,255,255,.06); color: #ddd; white-space: nowrap; }
.gen-scroll { max-height: 420px; overflow: auto; margin-top: 12px; border: 1px solid rgba(216,195,149,.2); border-radius: 6px; }`;

    function montar(contId) {
        const cont = $(contId);
        if (!cont) return;
        if (!$('pgGeneradorCss')) {
            const st = document.createElement('style');
            st.id = 'pgGeneradorCss';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        cont.innerHTML = `
            <p class="tool-desc">
                Sube los <b>replays</b> de cada sala: el <code>.json</code> y su <code>.bin</code> (se cruzan por el número de la partida).
                El <code>.log</code> es opcional (da las kills y puntos oficiales de la sala) y el <code>.csv</code> de resultados completos también
                (suma daño, headshots, curación, distancia y todas sus columnas). Descarga el CSV de <b>equipos</b>, el de <b>jugadores</b> (todo el entreno)
                y el <b>detalle</b> (cada jugador en cada sala, con todas las métricas). No se guarda nada en la base.
            </p>
            <div class="bloque-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px">
                <div class="form-group">
                    <label>REPLAYS (.json)</label>
                    <input type="file" id="genReplays" multiple accept=".json">
                </div>
                <div class="form-group">
                    <label>REPLAYS (.bin)</label>
                    <input type="file" id="genBins" multiple accept=".bin">
                </div>
                <div class="form-group">
                    <label>MATCH LOGS (.log) · OPCIONAL</label>
                    <input type="file" id="genLogs" multiple accept=".txt,.log">
                </div>
                <div class="form-group">
                    <label>RESULTADOS COMPLETOS (.csv) · OPCIONAL</label>
                    <input type="file" id="genCsvs" multiple accept=".csv">
                </div>
            </div>
            <div id="genChecklist"></div>
            <div class="form-grid" style="margin-top: 15px;">
                <div class="form-group">
                    <label>SEPARADOR</label>
                    <select id="genSeparador">
                        <option value=",">Coma ( , ) · Google Sheets / Excel en inglés</option>
                        <option value=";">Punto y coma ( ; ) · Excel en español</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>NOMBRES DE EQUIPO</label>
                    <select id="genOficial">
                        <option value="1">Usar el nombre oficial si el equipo está registrado</option>
                        <option value="0">Dejar el nombre tal cual sale en la sala</option>
                    </select>
                </div>
            </div>
            <p class="form-hint" id="genInfo" style="margin-top:12px"></p>
            <div class="gen-acciones">
                <button class="btn-generar" id="genEquipos" disabled><i class="fa-solid fa-users"></i> DESCARGAR CSV DE EQUIPOS</button>
                <button class="btn-generar" id="genJugadores" disabled><i class="fa-solid fa-user"></i> DESCARGAR CSV DE JUGADORES</button>
                <button class="btn-generar" id="genDetalle" disabled><i class="fa-solid fa-table-list"></i> DESCARGAR DETALLE POR SALA</button>
            </div>
            <div id="genVista"></div>
`;
        ['genLogs', 'genReplays', 'genBins', 'genCsvs', 'genOficial'].forEach(id => { const el = $(id); if (el) el.addEventListener('change', generarDatos); });
        [['genEquipos', 'equipos'], ['genJugadores', 'jugadores'], ['genDetalle', 'detalle']].forEach(([id, t]) => { const el = $(id); if (el) el.addEventListener('click', () => descargarCSV(t)); });
    }

    window.PumasGenerador = { montar };
})();
