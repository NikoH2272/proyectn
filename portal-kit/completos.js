/* =====================================================================
   PROYECTN · "Resultados completos" (exportado de la sala, sql/23)
   La sala de Free Fire exporta:
     · Resultados           → MatchResult_<id>.log   (equipos, top, kills)
     · Resultados completos → <id>.csv               (1 fila por jugador: daño, headshots,
                              paredes gloo, revividos, tiempo vivo, armas...)
   Este módulo lee los .csv, los empareja con cada sala (por el id de la partida
   que va en el nombre de los dos archivos) y calcula:
     · por sala: tipo de partida, daño hecho, MVP con su arma, headshots y daño
     · del entreno: más daño, mejor % de headshots, más revivió, arma más usada,
       paredes gloo usadas, tiempo vivo promedio y la ESCUADRA DESTACADA
       (la más constante: buen promedio por sala con poca variación)
   Por defecto solo en Entrenos PROYECTN; el superadmin lo habilita para más eventos.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    // Nombres de mapa y modo según el número que trae el exportado (ajusta aquí si alguno sale distinto)
    const MAPAS = { 1: 'BERMUDA', 3: 'NEXTERRA', 4: 'KALAHARI', 22: 'PURGATORIO', 29: 'SOLARA' };
    const GRUPOS = { 1: 'SOLO', 2: 'DÚO', 3: 'ESCUADRA' };
    const MIN_HITS_HS = 15;        // para el % de headshots: mínimo de impactos
    const MIN_DISPAROS = 50;       // para la precisión: mínimo de disparos
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const ent = v => Math.round(num(v));
    const mmss = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const tipoDe = s => [MAPAS[s.mapa] || (s.mapa ? 'MAPA ' + s.mapa : ''), GRUPOS[s.modo] || ''].filter(Boolean).join(' · ') || '—';

    /* ---------------- Lectura del .csv ---------------- */
    function leerCSV(texto) {
        const t = String(texto || '').replace(/^﻿/, '');
        const filas = [];
        let fila = [], campo = '', comillas = false;
        for (let i = 0; i < t.length; i++) {
            const c = t[i];
            if (comillas) {
                if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
                else campo += c;
            } else if (c === '"') comillas = true;
            else if (c === ',') { fila.push(campo); campo = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && t[i + 1] === '\n') i++;
                fila.push(campo); campo = '';
                if (fila.length > 1 || fila[0] !== '') filas.push(fila);
                fila = [];
            } else campo += c;
        }
        if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
        const cab = (filas.shift() || []).map(h => h.trim());
        return filas.map(f => Object.fromEntries(cab.map((h, i) => [h, f[i] ?? ''])));
    }

    /* ---------------- Armas por id (el .json de la repetición solo trae el número) ---------------- */
    const ARMAS_FF = { 0: 'WOODPECKER-SUM', 1: 'FIST', 8: 'MP5', 11: 'M14', 12: 'SCAR', 13: 'VSS', 15: 'MP40', 16: 'PAN', 17: 'MACHETE', 18: 'SKS',
        21: 'KAR98K', 23: 'M79', 27: 'BASEBALLPOLE', 28: 'XM8', 30: 'M60', 32: 'P90', 34: 'KATANA', 39: 'PLASMA', 41: 'M1887', 45: 'M82B', 46: 'AUG',
        47: 'PARAFAL', 48: 'WOODPECKER', 50: 'MAG7', 51: 'SICKLE', 54: 'KORD', 55: 'M1917', 58: 'UZI', 74: 'G36', 75: 'M24', 86: 'CHARGE BUSTER', 89: 'AC80',
        93: 'TREATMENT PISTOL', 123: 'M60-III', 150: 'BIZON', 193: 'AUG-I', 196: 'FGL24', 197: 'VSK94', 228: 'MAC10-I', 601: 'GRENADE', 608: 'FLASH FREEZE',
        629: 'GROZA', 632: 'GOLDM249-X', 633: 'SVD', 635: 'AWM', 637: 'THOMPSON-GOLD', 638: 'THOMPSON-X', 805: 'M24-I', 806: 'M24-II',
        21002: 'M590', 21006: 'WINCHESTER', 21007: 'WINCHESTER-I', 21008: 'WINCHESTER-II' };
    const LS_ARMAS = 'pg_armas_ff';   // los .csv enseñan nombres nuevos (id → nombre) y se recuerdan en este navegador
    let armasAprendidas = null;
    function aprendidas() {
        if (!armasAprendidas) { try { armasAprendidas = JSON.parse(localStorage.getItem(LS_ARMAS)) || {}; } catch (e) { armasAprendidas = {}; } }
        return armasAprendidas;
    }
    function aprenderArmas(lista) {
        const m = aprendidas();
        let cambio = false;
        lista.forEach(a => {
            const id = a && a.weapon_id, n = a && a.weapon_name && String(a.weapon_name).toUpperCase();
            if (id === undefined || id === null || !n || m[id] === n || ARMAS_FF[id] === n) return;
            m[id] = n; cambio = true;
        });
        if (cambio) { try { localStorage.setItem(LS_ARMAS, JSON.stringify(m)); } catch (e) { /* sin almacenamiento: solo esta vez */ } }
    }
    const nombreArma = id => aprendidas()[id] || ARMAS_FF[id] || ('ARMA #' + id);

    // weapon_usages: JSON con comillas dobles; a veces viene con comillas simples (estilo Python)
    function leerArmas(txt) {
        if (!txt) return [];
        let l = null;
        try { l = JSON.parse(txt); } catch (e) {
            try { l = JSON.parse(txt.replace(/'/g, '"').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')); } catch (e2) { l = []; }
        }
        if (Array.isArray(l)) aprenderArmas(l);
        return (Array.isArray(l) ? l : []).map(a => ({ n: String(a.weapon_name || ('ARMA ' + a.weapon_id)).toUpperCase(), d: ent(a.damage), k: ent(a.kills), hs: ent(a.headshots), s: ent(a.shoots) }))
            .filter(a => (a.s > 0 || a.d > 0 || a.k > 0) && !/-SUM$/.test(a.n));   // "-SUM" repite el total de la misma arma
    }

    // Métricas extra del .csv que también se guardan (extra) y salen en los destacados
    const EXTRAS_CSV = { recibido: 'damage_taken', curacion: 'healing_to_teammates', curacionPropia: 'healing_to_self', recorrido: 'moving_distance',
        botiquines: 'medkit_use', granadas: 'grenade_use', derribado: 'be_knocked_down_count', levantadoCsv: 'revived_times', rescates: 'rescue_times',
        enfrentamientos: 'engage_count', vehiculo: 'vehicle_move_distance', glooRotas: 'icewall_destroyed_times' };
    function extrasCSV(r) {
        const x = {};
        Object.entries(EXTRAS_CSV).forEach(([k, col]) => { const v = ent(r[col]); if (v > 0) x[k] = v; });
        const dist = String(r.kill_distance || '').match(/\d+(\.\d+)?/g);
        if (dist) x.distancia = Math.round(Math.max(...dist.map(Number)));
        return x;
    }

    // Una partida (.csv) → { match_id, mapa, modo, jugadores }
    function partidaDesdeCSV(texto, renombres) {
        const filas = leerCSV(texto);
        if (!filas.length || !('nickname' in filas[0]) || !('damage' in filas[0])) throw new Error('El archivo no parece un "resultados completos" (.csv) de la sala.');
        const ren = renombres || {};
        const jugadores = filas.map(r => {
            const armas = leerArmas(r.weapon_usages);
            const principal = armas.filter(a => a.d > 0).sort((a, b) => b.d - a.d || b.k - a.k)[0];
            const eq = String(r.team_name || '').trim();
            return {
                equipo: ren[eq] || ren[eq.toUpperCase()] || eq, jugador: String(r.nickname || '').trim(), account_id: String(r.account_id || ''),
                kills: ent(r.kills), dano: ent(r.damage), headshots: ent(r.headshots), hits: ent(r.hits), disparos: ent(r.shoots),
                revividos: ent(r.revive_teammate_times), gloo: ent(r.icewall_use), vivo: ent(r.alive_duration || r.survival_time),
                asistencias: ent(r.assists), derribos: ent(r.knock_down), booyah: String(r.booyah).toLowerCase() === 'true',
                arma: principal ? principal.n : '', armas, extra: extrasCSV(r),
                crudo: r   // la fila completa (para el generador de CSV; no se guarda en la base)
            };
        }).filter(j => j.jugador);
        const f0 = filas[0];
        return { match_id: String(f0.match_id || '').replace(/^id/, ''), mapa: ent(f0.map_id) || null, modo: ent(f0.group_mode) || null, jugadores };
    }

    // "MatchResult_2098204312665114624_2026-..." o "2098204312665114624.csv" → "2098204312665114624"
    const idDeArchivo = nombre => ((/(\d{15,})/.exec(String(nombre || '')) || [])[1]) || null;

    /* ---------------- Repetición de la sala (ReplayInfo_<id>.json) ---------------- */
    // Jugadores de un .log: [{equipo, rank, jugador, account_id, kills}]
    function jugadoresDeLog(texto) {
        const l = [];
        let eq = '', rank = 0;
        String(texto || '').split('\n').forEach(linea => {
            const t = linea.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)/i);
            if (t) { eq = t[1].trim(); rank = +t[2]; return; }
            const p = linea.match(/NAME:\s*(.+?)\s+ID:\s*(\d+).*?KILL:\s*(\d+)/i);
            if (p) l.push({ equipo: eq, rank, jugador: p[1].trim(), account_id: p[2], kills: +p[3] });
        });
        return l;
    }

    /* El .json trae los eventos de la partida (no trae daño, gloo ni revividas: eso solo viene en el .csv):
         Evento 3: PlayerID = quien derriba/elimina · SParam = nombre de la víctima
         Evento 4: PlayerID = víctima               · SParam = nombre de quien la tumbó (mismo Time que su evento 3)
         Evento 2: PlayerID + SParam = el propio jugador: lo levantaron (FParam ≈ segundos que tardó)
         Evento 1: PlayerID = un jugador del equipo eliminado · SParam = nombre del equipo
       La escuadra va en el PlayerID (PlayerID / 2^24 = número de escuadra en la sala).
       PlayerHighlightInfos[].KillEvents: arma (weaponDataID) y posición del que mata y de la víctima. */
    function partidaDesdeReplay(texto, logJug, renombres) {
        let d;
        try { d = JSON.parse(String(texto || '').replace(/^﻿/, '')); } catch (e) { throw new Error('No se pudo leer el .json de la repetición.'); }
        if (!d || !Array.isArray(d.Events)) throw new Error('El archivo no parece un ReplayInfo (.json) de la sala.');
        const ren = renombres || {}, log = logJug || [];
        const dur = num(d.GameTotalTime);
        const ev = d.Events.filter(e => e && typeof e.Time === 'number').sort((a, b) => a.Time - b.Time);
        const escuadra = id => Math.floor(id / 16777216);

        // Nombre de cada PlayerID
        const nombre = new Map();
        ev.forEach(e => { if (e.Event === 2 && e.SParam) nombre.set(e.PlayerID, e.SParam); });
        const porTiempo = new Map();
        ev.forEach(e => { if (e.Event === 3 || e.Event === 4) { const l = porTiempo.get(e.Time) || []; l.push(e); porTiempo.set(e.Time, l); } });
        porTiempo.forEach(l => {
            const e3 = l.filter(e => e.Event === 3), e4 = l.filter(e => e.Event === 4);
            if (e3.length !== 1 || e4.length !== 1) return;
            if (!nombre.has(e3[0].PlayerID)) nombre.set(e3[0].PlayerID, e4[0].SParam);
            if (!nombre.has(e4[0].PlayerID)) nombre.set(e4[0].PlayerID, e3[0].SParam);
        });

        // Escuadra → equipo (los eliminados por el evento 1; el resto por los nombres del .log)
        const enLog = n => {
            const k = norm(n);
            return log.find(j => norm(j.jugador) === k) || log.find(j => { const m = norm(j.jugador); return m.length >= 4 && k.length >= 4 && (k.startsWith(m) || m.startsWith(k)); });
        };
        const equipoDe = new Map();
        ev.forEach(e => { if (e.Event === 1 && e.SParam) equipoDe.set(escuadra(e.PlayerID), String(e.SParam).trim()); });
        nombre.forEach((n, id) => {
            const s = escuadra(id);
            if (equipoDe.has(s)) return;
            const j = enLog(n);
            if (j && j.equipo) equipoDe.set(s, j.equipo);
        });
        const sinNombre = [...new Set([...nombre.keys()].map(escuadra))].filter(s => !equipoDe.has(s));
        const campeon = log.find(j => j.rank === 1);
        if (sinNombre.length === 1 && campeon) equipoDe.set(sinNombre[0], campeon.equipo);   // la única no eliminada ganó
        const nombreEquipo = s => { const n = equipoDe.get(s) || ('ESCUADRA ' + s); return ren[n] || ren[n.toUpperCase()] || n; };

        // Arma y distancia de cada kill: el KillEvent del mismo jugador a ±2 s
        const killEvents = [];
        (d.PlayerHighlightInfos || []).forEach(h => (h.KillEvents || []).forEach(k => killEvents.push(k)));
        const dist = (a, b) => (a && b) ? Math.hypot(num(a.x) - num(b.x), num(a.z) - num(b.z)) : 0;

        const jug = new Map();
        const J = id => {
            let j = jug.get(id);
            if (!j) {
                const n = nombre.get(id) || ('JUGADOR ' + (id % 16777216));
                const lg = enLog(n);
                j = { equipo: nombreEquipo(escuadra(id)), jugador: n, account_id: lg ? lg.account_id : '', kills: 0, dano: 0, headshots: 0, hits: 0, disparos: 0,
                    revividos: 0, gloo: 0, vivo: Math.round(dur), asistencias: 0, derribos: 0, booyah: false, arma: '', armas: [],
                    extra: { caidas: 0, levantado: 0 }, _armas: {} };
                jug.set(id, j);
            }
            return j;
        };
        nombre.forEach((n, id) => J(id));

        // Los eventos 3/4 cuentan derribos y eliminaciones (un jugador puede caer varias veces si lo levantan):
        // las kills oficiales salen del .log; del .json quedan los derribos hechos y las caídas
        const finEquipo = new Map();
        ev.forEach(e => { if (e.Event === 1) finEquipo.set(escuadra(e.PlayerID), e.Time); });
        const ultimaAccion = new Map();   // última vez que el jugador hizo algo (derribar o ser levantado)
        let primera = null, lejana = null;
        ev.forEach(e => {
            if (e.Event === 3) {
                const j = J(e.PlayerID);
                j.kills++;
                ultimaAccion.set(e.PlayerID, e.Time);
                const k = killEvents.filter(x => x.PlayerID === e.PlayerID && Math.abs(num(x.TriggerPoint) - e.Time) <= 2)
                    .sort((a, b) => Math.abs(a.TriggerPoint - e.Time) - Math.abs(b.TriggerPoint - e.Time))[0];
                const arma = k && k.weaponDataID !== undefined ? nombreArma(k.weaponDataID) : '';
                const m = k ? Math.round(dist(k.position, k.beKilledPlayerPos)) : 0;
                if (arma) j._armas[arma] = (j._armas[arma] || 0) + 1;
                if (m > (j.extra.distancia || 0)) j.extra.distancia = m;
                if (!primera) { primera = { jugador: j.jugador, equipo: j.equipo, victima: e.SParam, tiempo: Math.round(e.Time), arma }; j.extra.primeraSangre = 1; }
                if (m && (!lejana || m > lejana.metros)) lejana = { jugador: j.jugador, equipo: j.equipo, victima: e.SParam, metros: m, arma };
            } else if (e.Event === 4) {
                const j = J(e.PlayerID); j.extra.caidas++; j._caida = e.Time;
            } else if (e.Event === 2) {
                const j = J(e.PlayerID); j.extra.levantado++; ultimaAccion.set(e.PlayerID, e.Time);
            }
        });
        // Equipo contra equipo: bajas a cada rival (extra.vs) y equipos rematados (extra.fin).
        // El evento 1 (equipo eliminado) cae en el mismo instante que la baja de su último jugador.
        const parejas = [];
        porTiempo.forEach((l, t) => {
            const e3 = l.filter(e => e.Event === 3), e4 = l.filter(e => e.Event === 4);
            if (e3.length === 1 && e4.length === 1) parejas.push({ t, killer: e3[0].PlayerID, victima: e4[0].PlayerID });
        });
        parejas.forEach(p => {
            if (escuadra(p.killer) === escuadra(p.victima)) return;
            const j = J(p.killer), rival = nombreEquipo(escuadra(p.victima));
            j.extra.vs = j.extra.vs || {};
            j.extra.vs[rival] = (j.extra.vs[rival] || 0) + 1;
        });
        const eliminados = ev.filter(e => e.Event === 1).map(e => {
            const s = escuadra(e.PlayerID);
            const p = parejas.filter(x => escuadra(x.victima) === s && Math.abs(x.t - e.Time) < 0.5 && escuadra(x.killer) !== s)
                .sort((a, b) => Math.abs(a.t - e.Time) - Math.abs(b.t - e.Time))[0];
            let por = '';
            if (p) { const j = J(p.killer); j.extra.fin = (j.extra.fin || 0) + 1; por = j.equipo; }
            return { equipo: nombreEquipo(s), tiempo: Math.round(e.Time), por };
        });
        // Tiempo vivo: hasta que eliminan a su equipo; si su última caída fue antes y no volvió a hacer nada, hasta esa caída
        const ganadoras = new Set([...jug.keys()].map(escuadra).filter(s => !finEquipo.has(s)));
        jug.forEach((j, id) => {
            const fin = finEquipo.has(escuadra(id)) ? finEquipo.get(escuadra(id)) : dur;
            const caida = j._caida;
            j.vivo = Math.round(caida !== undefined && caida < fin && (ultimaAccion.get(id) || 0) <= caida ? caida : fin);
            j.booyah = ganadoras.size === 1 && ganadoras.has(escuadra(id));
        });
        const jugadores = [...jug.values()].map(j => {
            j.armas = Object.entries(j._armas).sort((a, b) => b[1] - a[1]).map(([n, k]) => ({ n, d: 0, k, hs: 0, s: 0 }));
            j.arma = j.armas.length ? j.armas[0].n : '';
            // Kills oficiales del .log (si está); los eventos del .json quedan como derribos
            j.derribos = j.kills;
            const lg = enLog(j.jugador);
            if (lg) j.kills = lg.kills;
            delete j._armas; delete j._caida;
            return j;
        });
        return {
            match_id: String(d.MatchID || ''), mapa: ent(d.MapID) || null, modo: ent(d.GroupMode) || null, fuente: 'replay', duracion: Math.round(dur),
            jugadores, primeraSangre: primera, killLejana: lejana,
            eliminados
        };
    }

    // Suma lo del .json (caídas, primera sangre, kill más lejana) a la partida del .csv, que trae el daño
    function combinar(csv, rep) {
        if (!csv) return rep;
        if (!rep) return csv;
        const porNombre = new Map(rep.jugadores.map(j => [norm(j.jugador), j]));
        csv.jugadores.forEach(j => {
            const r = porNombre.get(norm(j.jugador));
            if (!r) return;
            const dist = Math.max(j.extra && j.extra.distancia || 0, r.extra.distancia || 0);
            j.extra = Object.assign({}, j.extra, r.extra);
            if (dist) j.extra.distancia = dist;
            if (!j.vivo) j.vivo = r.vivo;
        });
        return Object.assign(csv, { duracion: rep.duracion, primeraSangre: rep.primeraSangre, killLejana: rep.killLejana, eliminados: rep.eliminados });
    }

    /* ---------------- Emparejar .csv / .json con las salas ---------------- */
    // nombresLogs: nombres de los .log en el orden de las salas · csvs y replays: [{nombre, texto}]
    // textosLogs (opcional): texto de cada .log, para saber el equipo de cada jugador del .json
    function emparejar(nombresLogs, csvs, renombres, replays, textosLogs) {
        const buscar = (lista, nombre, i, usadas) => {
            const id = idDeArchivo(nombre);
            let k = id ? lista.findIndex((p, j) => !usadas.has(j) && p.match_id === id) : -1;
            if (k < 0 && lista.length === nombresLogs.length && !usadas.has(i)) k = i;   // sin id: por orden
            if (k >= 0) usadas.add(k);
            return k >= 0 ? lista[k] : null;
        };
        const partidas = (csvs || []).map(c => { const p = partidaDesdeCSV(c.texto, renombres); p.archivo = c.nombre; p.match_id = p.match_id || idDeArchivo(c.nombre); return p; });
        const reps = (replays || []).map(r => ({ nombre: r.nombre, texto: r.texto, match_id: (/"MatchID"\s*:\s*(\d+)/.exec(r.texto) || [])[1] || idDeArchivo(r.nombre) }));
        const salas = [], usadasC = new Set(), usadasR = new Set();
        nombresLogs.forEach((nombre, i) => {
            const csv = buscar(partidas, nombre, i, usadasC);
            const r = buscar(reps, nombre, i, usadasR);
            const rep = r ? Object.assign(partidaDesdeReplay(r.texto, jugadoresDeLog((textosLogs || [])[i]), renombres), { archivo: r.nombre }) : null;
            const p = combinar(csv, rep);
            if (p) salas.push(Object.assign({ sala: i + 1 }, p));
        });
        const sobran = partidas.filter((p, j) => !usadasC.has(j)).map(p => p.archivo).concat(reps.filter((r, j) => !usadasR.has(j)).map(r => r.nombre));
        return { salas, sobran };
    }

    /* ---------------- Cálculos ---------------- */
    // salas: [{sala, mapa, modo, jugadores}] · puntosLog (opcional): [{name, salasPuntos:{i:pts}, salasKills:{i:k}}]
    function calcular(salas, puntosLog) {
        // Solo con el .json no hay daño, headshots, gloo ni revividas (eso lo trae el .csv)
        const conDano = salas.some(s => s.fuente !== 'replay');
        const porSala = salas.map(s => {
            const mvp = s.jugadores.slice().sort((a, b) => b.kills - a.kills || b.dano - a.dano || b.headshots - a.headshots || b.vivo - a.vivo)[0] || null;
            const campeon = s.jugadores.find(j => j.booyah);
            return { sala: s.sala, etiqueta: s.etiqueta || 'S' + s.sala, tipo: tipoDe(s), mapa: MAPAS[s.mapa] || (s.mapa ? 'MAPA ' + s.mapa : '—'), modo: GRUPOS[s.modo] || '—',
                conDano: s.fuente !== 'replay', dano: s.jugadores.reduce((a, j) => a + j.dano, 0), kills: s.jugadores.reduce((a, j) => a + j.kills, 0),
                duracion: s.duracion || Math.max(0, ...s.jugadores.map(j => j.vivo || 0)), booyah: campeon ? campeon.equipo : '',
                equipos: new Set(s.jugadores.map(j => norm(j.equipo))).size, mvp,
                primeraSangre: s.primeraSangre || null, killLejana: s.killLejana || null };
        });

        // Por jugador (todo el entreno)
        const jug = new Map();
        salas.forEach(s => s.jugadores.forEach(j => {
            const key = norm(j.account_id || j.jugador);
            const x = j.extra || {};
            const r = jug.get(key) || { jugador: j.jugador, equipo: j.equipo, kills: 0, dano: 0, headshots: 0, hits: 0, disparos: 0, revividos: 0, asistencias: 0,
                derribos: 0, vivo: 0, salas: 0, salasCsv: 0, armas: {}, recibido: 0, curacion: 0, recorrido: 0, levantado: 0, caidas: 0, distancia: 0, booyahs: 0 };
            r.kills += j.kills; r.vivo += j.vivo; r.salas++;
            if (j.booyah) r.booyahs++;
            if (s.fuente !== 'replay') {
                r.salasCsv++; r.dano += j.dano; r.headshots += j.headshots; r.hits += j.hits; r.disparos += j.disparos || 0;
                r.revividos += j.revividos; r.asistencias += j.asistencias || 0; r.derribos += j.derribos || 0;
            }
            r.recibido += x.recibido || 0; r.curacion += x.curacion || 0; r.recorrido += x.recorrido || 0;
            r.levantado += x.levantado || x.levantadoCsv || 0; r.caidas += x.caidas || x.derribado || 0;
            r.distancia = Math.max(r.distancia, x.distancia || 0);
            j.armas.forEach(a => { const y = r.armas[a.n] = r.armas[a.n] || { d: 0, k: 0 }; y.d += a.d; y.k += a.k; });
            jug.set(key, r);
        }));
        const jugadores = [...jug.values()].map(r => {
            r.arma = (Object.entries(r.armas).sort((a, b) => b[1].d - a[1].d || b[1].k - a[1].k)[0] || [''])[0];
            r.pctHs = r.hits ? r.headshots / r.hits * 100 : 0;
            r.precision = r.disparos ? r.hits / r.disparos * 100 : 0;
            r.vivoProm = r.salas ? r.vivo / r.salas : 0;
            return r;
        });
        const mayor = (l, f) => { const m = l.slice().sort((a, b) => f(b) - f(a))[0]; return m && f(m) > 0 ? m : null; };

        // Armas: más usada = la que usaron más jugadores (desempate: disparos); más letal = más kills
        const armas = {};
        salas.forEach(s => s.jugadores.forEach(j => j.armas.forEach(a => {
            const x = armas[a.n] = armas[a.n] || { arma: a.n, usos: 0, disparos: 0, kills: 0, dano: 0 };
            x.usos++; x.disparos += a.s; x.kills += a.k; x.dano += a.d;
        })));
        const listaArmas = Object.values(armas).filter(a => !/^(FIST|PUÑO|KATANA|PAN|SARTEN|BAT|MACHETE|SCYTHE|GUADAÑA)$/.test(a.arma));

        const todos = salas.flatMap(s => s.jugadores);
        const conCsv = salas.filter(s => s.fuente !== 'replay').flatMap(s => s.jugadores);
        // Del .json: kill más lejana del entreno y quién hizo más primeras sangres
        const lejanas = porSala.map(s => s.killLejana).filter(Boolean);
        const primeras = {};
        porSala.forEach(s => { if (s.primeraSangre) { const k = norm(s.primeraSangre.jugador); (primeras[k] = primeras[k] || Object.assign({ veces: 0 }, s.primeraSangre)).veces++; } });
        // Del .json: equipo contra equipo (bajas a un mismo rival) y equipos rematados por cada equipo
        const rivales = {}, rematados = {};
        todos.forEach(j => {
            const x = j.extra || {};
            Object.entries(x.vs || {}).forEach(([rival, n]) => {
                const k = norm(j.equipo) + '>' + norm(rival);
                (rivales[k] = rivales[k] || { equipo: j.equipo, contra: rival, veces: 0 }).veces += n;
            });
            if (x.fin) (rematados[norm(j.equipo)] = rematados[norm(j.equipo)] || { equipo: j.equipo, equipos: 0 }).equipos += x.fin;
        });
        // Por equipo (todo el entreno)
        const eqs = {};
        salas.forEach(s => {
            const enSala = new Set();
            s.jugadores.forEach(j => {
                const k = norm(j.equipo);
                const e = eqs[k] = eqs[k] || { equipo: j.equipo, kills: 0, dano: 0, booyahs: 0 };
                e.kills += j.kills; e.dano += s.fuente !== 'replay' ? j.dano : 0;
                if (j.booyah && !enSala.has(k)) { e.booyahs++; enSala.add(k); }
            });
        });
        const listaEq = Object.values(eqs);
        const destacados = {
            rivalidad: Object.values(rivales).sort((a, b) => b.veces - a.veces)[0] || null,
            masEliminoEquipos: Object.values(rematados).sort((a, b) => b.equipos - a.equipos)[0] || null,
            masDano: conDano ? mayor(jugadores, r => r.dano) : null,
            mejorHs: conDano ? mayor(jugadores.filter(r => r.hits >= MIN_HITS_HS), r => r.pctHs + r.headshots / 1000) : null,
            masRevivio: conDano ? mayor(jugadores, r => r.revividos + r.dano / 1e6) : null,
            armaMasUsada: listaArmas.slice().sort((a, b) => b.usos - a.usos || b.disparos - a.disparos)[0] || null,
            armaMasLetal: listaArmas.slice().sort((a, b) => b.kills - a.kills || b.dano - a.dano)[0] || null,
            gloo: conDano ? conCsv.reduce((a, j) => a + j.gloo, 0) : null,
            vivoPromedio: todos.length ? todos.reduce((a, j) => a + j.vivo, 0) / todos.length : 0,
            danoTotal: conDano ? conCsv.reduce((a, j) => a + j.dano, 0) : null,
            mvp: mayor(jugadores, r => r.kills * 1000 + r.dano + 1),
            killLejana: lejanas.sort((a, b) => b.metros - a.metros)[0] || null,
            primeraSangre: Object.values(primeras).sort((a, b) => b.veces - a.veces)[0] || null,
            // Más destacados del entreno
            masAsistencias: conDano ? mayor(jugadores, r => r.asistencias) : null,
            masDerribos: conDano ? mayor(jugadores, r => r.derribos) : null,
            mejorPrecision: conDano ? mayor(jugadores.filter(r => r.disparos >= MIN_DISPAROS), r => r.precision) : null,
            masCuracion: mayor(jugadores, r => r.curacion),
            masRecibido: mayor(jugadores, r => r.recibido),
            masRecorrido: mayor(jugadores, r => r.recorrido),
            masLevantado: mayor(jugadores, r => r.levantado),
            masVivo: mayor(jugadores.filter(r => r.salas >= Math.max(1, Math.ceil(salas.length / 2))), r => r.vivoProm),
            equipoMasKills: mayor(listaEq, e => e.kills),
            equipoMasDano: conDano ? mayor(listaEq, e => e.dano) : null,
            equipoMasBooyahs: mayor(listaEq, e => e.booyahs ? e.booyahs + e.kills / 1e4 : 0),
            killsTotal: todos.reduce((a, j) => a + j.kills, 0)
        };

        return { porSala, destacados, conDano, escuadra: escuadraDestacada(salas, puntosLog), jugadores };
    }

    // La escuadra más constante: buen promedio por sala y poca variación entre salas
    function escuadraDestacada(salas, puntosLog) {
        const n = salas.length;
        if (!n) return null;
        const equipos = new Map();
        salas.forEach((s, i) => {
            const porEq = {};
            s.jugadores.forEach(j => { const e = porEq[norm(j.equipo)] = porEq[norm(j.equipo)] || { nombre: j.equipo, dano: 0, kills: 0 }; e.dano += j.dano; e.kills += j.kills; });
            Object.entries(porEq).forEach(([k, e]) => {
                const r = equipos.get(k) || { nombre: e.nombre, dano: [], kills: [], pts: [] };
                r.dano.push(e.dano); r.kills.push(e.kills);
                const log = (puntosLog || []).find(x => norm(x.name) === k);
                if (log) { const p = log.salasPuntos[s.sala - 1]; if (p !== undefined) r.pts.push(p); }
                equipos.set(k, r);
            });
        });
        const media = l => l.reduce((a, b) => a + b, 0) / (l.length || 1);
        const desv = l => { const m = media(l); return Math.sqrt(media(l.map(x => (x - m) ** 2))); };
        const candidatos = [...equipos.values()].filter(r => r.dano.length >= Math.max(2, Math.ceil(n / 2))).map(r => {
            // con puntos del log; si no, con el daño; y solo con el .json (sin daño), con las kills
            const base = r.pts.length === r.dano.length ? r.pts : r.dano.some(x => x > 0) ? r.dano : r.kills;
            const m = media(base), d = desv(base);
            const constancia = m > 0 ? Math.max(0, 1 - d / m) : 0;          // 100% = todas las salas igual
            return { nombre: r.nombre, salas: r.dano.length, promPts: r.pts.length ? media(r.pts) : null, promDano: media(r.dano), promKills: media(r.kills),
                constancia, puntaje: m * (0.5 + 0.5 * constancia) };
        });
        return candidatos.sort((a, b) => b.puntaje - a.puntaje)[0] || null;
    }

    // Filas para la base (stats_jugadores)
    // meta (opcional): { fecha: ISO del entreno, titulo } para filtrar por día y por entreno
    const filasBD = (salas, meta) => salas.flatMap(s => s.jugadores.map(j => ({
        fecha: meta && meta.fecha || null, titulo: meta && meta.titulo || null,
        sala: s.sala, match_id: s.match_id, mapa: s.mapa, modo: s.modo, equipo: j.equipo, jugador: j.jugador, account_id: j.account_id,
        kills: j.kills, dano: j.dano, headshots: j.headshots, hits: j.hits, disparos: j.disparos, revividos: j.revividos, gloo: j.gloo,
        vivo: j.vivo, asistencias: j.asistencias, derribos: j.derribos, booyah: j.booyah, arma: j.arma, armas: j.armas,
        // extra: lo del .json (caídas, primera sangre, kill más lejana) y de dónde salió la sala
        extra: Object.assign({}, j.extra || {}, s.fuente === 'replay' ? { fuente: 'replay' } : {},
            s.primeraSangre && j.extra && j.extra.primeraSangre ? { victima: s.primeraSangre.victima, armaPS: s.primeraSangre.arma, tiempoPS: s.primeraSangre.tiempo } : {},
            s.killLejana && norm(s.killLejana.jugador) === norm(j.jugador) ? { lejana: 1, victimaL: s.killLejana.victima, armaL: s.killLejana.arma } : {})
    })));

    // Filas de la base → salas. Con varios entrenos juntos (general / por día) las salas se numeran seguidas
    // y llevan su etiqueta (fecha + sala del entreno).
    const diaCorto = f => f ? new Date(f).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '';
    function salasDesdeBD(filas) {
        const m = new Map();
        filas.forEach(f => {
            const x = f.extra || {};
            const k = (f.sesion_id || '') + '|' + f.sala;
            const s = m.get(k) || { sala: f.sala, sesion: f.sesion_id, fecha: f.fecha || f.creado || '', titulo: f.titulo || '',
                match_id: f.match_id, mapa: f.mapa, modo: f.modo, jugadores: [], fuente: x.fuente === 'replay' ? 'replay' : 'csv' };
            const j = { equipo: f.equipo, jugador: f.jugador, account_id: f.account_id, kills: f.kills, dano: f.dano, headshots: f.headshots,
                hits: f.hits, disparos: f.disparos, revividos: f.revividos, gloo: f.gloo, vivo: f.vivo, asistencias: f.asistencias,
                derribos: f.derribos, booyah: f.booyah, arma: f.arma, armas: f.armas || [], extra: x };
            s.jugadores.push(j);
            if (x.primeraSangre) s.primeraSangre = { jugador: j.jugador, equipo: j.equipo, victima: x.victima || '', arma: x.armaPS || '', tiempo: x.tiempoPS || 0 };
            if (x.lejana && x.distancia) s.killLejana = { jugador: j.jugador, equipo: j.equipo, victima: x.victimaL || '', metros: x.distancia, arma: x.armaL || '' };
            m.set(k, s);
        });
        const l = [...m.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.sesion).localeCompare(String(b.sesion)) || a.sala - b.sala);
        if (new Set(l.map(s => s.sesion)).size > 1) l.forEach((s, i) => { s.etiqueta = diaCorto(s.fecha) + ' S' + s.sala; s.sala = i + 1; });
        return l;
    }

    /* ---------------- Permiso por evento ---------------- */
    let cfgCache = null;
    async function habilitados() {
        if (cfgCache) return cfgCache;
        try {
            const { data, error } = await P.db().from('sitio_config').select('valor').eq('clave', 'export_completo').maybeSingle();
            cfgCache = !error && data && data.valor && Array.isArray(data.valor.portales) ? data.valor.portales : ['entrenamientos', 'pruebas'];
        } catch (e) { cfgCache = ['entrenamientos', 'pruebas']; }
        return cfgCache;
    }
    const habilitado = async portal => (await habilitados()).includes(portal);

    const fmt = n => Math.round(n || 0).toLocaleString('es');
    const pl = (n, uno, varios) => `${fmt(n)} ${n === 1 ? uno : varios}`;

    // Todos los destacados del entreno, en orden. grupo: jug (jugadores y armas) · eq (equipos) · total (números del entreno)
    function listaDestacados(r) {
        const d = r.destacados, L = [];
        const add = (x, grupo, i, t, v, s) => { if (x) L.push({ grupo, i, t, v: esc(v), s: s || '' }); };
        const arma = a => a ? ' · ' + esc(a) : '';
        add(d.mvp, 'jug', 'fa-crown', 'MVP del entreno', d.mvp && d.mvp.jugador, d.mvp && `${pl(d.mvp.kills, 'kill', 'kills')}${d.mvp.dano ? ' · ' + fmt(d.mvp.dano) + ' daño' : ''}${arma(d.mvp.arma)}`);
        add(d.masDano, 'jug', 'fa-burst', 'Más daño', d.masDano && d.masDano.jugador, d.masDano && `${fmt(d.masDano.dano)} de daño${arma(d.masDano.arma)}`);
        add(d.mejorHs, 'jug', 'fa-crosshairs', 'Mejor % a la cabeza', d.mejorHs && d.mejorHs.jugador, d.mejorHs && `${d.mejorHs.pctHs.toFixed(1)}% (${d.mejorHs.headshots}/${d.mejorHs.hits})${arma(d.mejorHs.arma)}`);
        add(d.masDerribos, 'jug', 'fa-person-falling', 'Más derribos', d.masDerribos && d.masDerribos.jugador, d.masDerribos && `${pl(d.masDerribos.derribos, 'derribo', 'derribos')} · ${esc(d.masDerribos.equipo)}`);
        add(d.masAsistencias, 'jug', 'fa-handshake-angle', 'Más asistencias', d.masAsistencias && d.masAsistencias.jugador, d.masAsistencias && `${pl(d.masAsistencias.asistencias, 'asistencia', 'asistencias')} · ${esc(d.masAsistencias.equipo)}`);
        add(d.mejorPrecision, 'jug', 'fa-bullseye', 'Mejor puntería', d.mejorPrecision && d.mejorPrecision.jugador, d.mejorPrecision && `${d.mejorPrecision.precision.toFixed(1)}% de impactos (${fmt(d.mejorPrecision.hits)}/${fmt(d.mejorPrecision.disparos)})`);
        add(d.masRevivio, 'jug', 'fa-kit-medical', 'Más revivió', d.masRevivio && d.masRevivio.jugador, d.masRevivio && `${pl(d.masRevivio.revividos, 'revivida', 'revividas')} · ${esc(d.masRevivio.equipo)}`);
        add(d.masCuracion, 'jug', 'fa-heart-pulse', 'Más curó a su equipo', d.masCuracion && d.masCuracion.jugador, d.masCuracion && `${fmt(d.masCuracion.curacion)} de vida a compañeros`);
        add(d.masVivo, 'jug', 'fa-hourglass-half', 'Más tiempo vivo', d.masVivo && d.masVivo.jugador, d.masVivo && `${mmss(d.masVivo.vivoProm)} promedio por sala`);
        add(d.masRecibido, 'jug', 'fa-shield-heart', 'Más daño aguantado', d.masRecibido && d.masRecibido.jugador, d.masRecibido && `${fmt(d.masRecibido.recibido)} de daño recibido`);
        add(d.masLevantado, 'jug', 'fa-hand-holding-medical', 'Más veces levantado', d.masLevantado && d.masLevantado.jugador, d.masLevantado && `${pl(d.masLevantado.levantado, 'vez', 'veces')} · ${esc(d.masLevantado.equipo)}`);
        add(d.masRecorrido, 'jug', 'fa-person-running', 'Más recorrió', d.masRecorrido && d.masRecorrido.jugador, d.masRecorrido && `${fmt(d.masRecorrido.recorrido)} m`);
        add(d.killLejana, 'jug', 'fa-ruler-horizontal', 'Kill más lejana', d.killLejana && d.killLejana.jugador, d.killLejana && `${d.killLejana.metros} m${arma(d.killLejana.arma)}`);
        add(d.primeraSangre, 'jug', 'fa-droplet', 'Primera sangre', d.primeraSangre && d.primeraSangre.jugador, d.primeraSangre && (d.primeraSangre.veces > 1 ? `en ${d.primeraSangre.veces} salas` : `a ${esc(d.primeraSangre.victima || '')}`));
        add(d.armaMasUsada, 'jug', 'fa-gun', 'Arma más usada', d.armaMasUsada && d.armaMasUsada.arma, d.armaMasUsada && `${pl(d.armaMasUsada.usos, 'uso', 'usos')} · ${pl(d.armaMasUsada.kills, 'kill', 'kills')}`);
        add(d.armaMasLetal && d.armaMasLetal.kills > 0, 'jug', 'fa-skull', 'Arma con más kills', d.armaMasLetal && d.armaMasLetal.arma, d.armaMasLetal && pl(d.armaMasLetal.kills, 'kill', 'kills'));
        add(d.equipoMasKills, 'eq', 'fa-fire', 'Equipo con más kills', d.equipoMasKills && d.equipoMasKills.equipo, d.equipoMasKills && pl(d.equipoMasKills.kills, 'kill', 'kills'));
        add(d.equipoMasDano, 'eq', 'fa-explosion', 'Equipo con más daño', d.equipoMasDano && d.equipoMasDano.equipo, d.equipoMasDano && `${fmt(d.equipoMasDano.dano)} de daño`);
        add(d.equipoMasBooyahs, 'eq', 'fa-trophy', 'Más booyahs', d.equipoMasBooyahs && d.equipoMasBooyahs.equipo, d.equipoMasBooyahs && pl(d.equipoMasBooyahs.booyahs, 'booyah', 'booyahs'));
        add(d.masEliminoEquipos, 'eq', 'fa-flag-checkered', 'Más equipos eliminados', d.masEliminoEquipos && d.masEliminoEquipos.equipo, d.masEliminoEquipos && `${pl(d.masEliminoEquipos.equipos, 'equipo rematado', 'equipos rematados')}`);
        add(d.rivalidad, 'eq', 'fa-people-arrows', 'Más eliminó a otro equipo', d.rivalidad && d.rivalidad.equipo, d.rivalidad && `${pl(d.rivalidad.veces, 'baja', 'bajas')} a ${esc(d.rivalidad.contra)}`);
        add(true, 'total', 'fa-skull-crossbones', 'Kills del entreno', fmt(d.killsTotal), 'entre todas las salas');
        add(d.danoTotal !== null, 'total', 'fa-bolt', 'Daño total', fmt(d.danoTotal), 'en todo el entreno');
        add(d.gloo !== null, 'total', 'fa-cubes-stacked', 'Paredes gloo', fmt(d.gloo), 'usadas en el entreno');
        add(true, 'total', 'fa-stopwatch', 'Tiempo vivo promedio', mmss(d.vivoPromedio), 'por jugador y sala');
        return L;
    }

    // Las 3 tablas por sala: tipo de partida · primera sangre (y kill más lejana) · MVP
    function tablasSalas(r) {
        const dano = r.conDano;
        const s = r.porSala;
        return [
            { titulo: 'TIPO DE PARTIDA', icono: 'fa-map-location-dot',
                cab: ['SALA', 'MAPA', 'MODO', 'DURACIÓN', 'EQUIPOS', 'KILLS', ...(dano ? ['DAÑO'] : []), 'BOOYAH'],
                filas: s.map(x => [x.etiqueta, x.mapa, x.modo, x.duracion ? mmss(x.duracion) : '—', x.equipos || '—', fmt(x.kills),
                    ...(dano ? [x.conDano ? fmt(x.dano) : '—'] : []), x.booyah || '—']) },
            { titulo: 'PRIMERA SANGRE Y KILL MÁS LEJANA', icono: 'fa-droplet',
                cab: ['SALA', 'PRIMERA SANGRE', 'EQUIPO', 'VÍCTIMA', 'MIN', 'ARMA', 'KILL MÁS LEJANA', 'METROS'],
                filas: s.map(x => { const p = x.primeraSangre, k = x.killLejana;
                    return [x.etiqueta, p ? p.jugador : '—', p ? p.equipo : '', p ? p.victima || '' : '', p && p.tiempo ? mmss(p.tiempo) : '', p ? p.arma || '—' : '',
                        k ? k.jugador : '—', k ? k.metros + ' m' : '']; }) },
            { titulo: 'MVP POR SALA', icono: 'fa-crown',
                cab: ['SALA', 'MVP', 'EQUIPO', 'KILLS', ...(dano ? ['DAÑO', 'HS'] : []), 'ARMA', 'VIVO'],
                filas: s.map(x => { const m = x.mvp;
                    return m ? [x.etiqueta, m.jugador, m.equipo, m.kills, ...(dano ? [x.conDano ? fmt(m.dano) : '—', x.conDano ? m.headshots : '—'] : []), m.arma || '—', mmss(m.vivo)]
                        : [x.etiqueta, '—', '', '', ...(dano ? ['', ''] : []), '', '']; }) }
        ].filter(t => t.titulo !== 'PRIMERA SANGRE Y KILL MÁS LEJANA' || s.some(x => x.primeraSangre || x.killLejana));
    }

    /* ---------------- HTML: tarjetas y tablas (página pública) ---------------- */
    const D = (icono, titulo, valor, detalle) => `<div class="cpl-dest"><i class="fa-solid ${icono}"></i><div><small>${titulo}</small><b>${valor}</b>${detalle ? `<span>${detalle}</span>` : ''}</div></div>`;
    function destacadosHTML(r) {
        return listaDestacados(r).map(x => D(x.i, x.t, x.v, x.s)).join('');
    }
    function escuadraHTML(e) {
        if (!e) return '';
        return `<div class="cpl-escuadra"><small><i class="fa-solid fa-shield-halved"></i> Escuadra destacada · la más constante</small><b>${esc(e.nombre)}</b>
            <div class="cpl-esc-nums">${e.promPts !== null ? `<span><b>${e.promPts.toFixed(1)}</b>pts/sala</span>` : ''}${e.promDano > 0 ? `<span><b>${Math.round(e.promDano).toLocaleString('es')}</b>daño/sala</span>` : ''}
            <span><b>${e.promKills.toFixed(1)}</b>kills/sala</span><span><b>${Math.round(e.constancia * 100)}%</b>constancia</span></div></div>`;
    }
    function salasHTML(r) {
        return tablasSalas(r).map(t => `<div class="cpl-tabla">
            <h4><i class="fa-solid ${t.icono}"></i> ${t.titulo}</h4>
            <div class="cpl-tabla-scroll"><table><thead><tr>${t.cab.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${t.filas.map(f => `<tr>${f.map((c, i) => `<td${i === 0 ? ' class="cpl-s"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('');
    }

    function estilos() {
        if (document.getElementById('pgCompletosCss')) return;
        const st = document.createElement('style');
        st.id = 'pgCompletosCss';
        st.textContent = `
.cpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:10px}
.cpl-dest{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid rgba(216,195,149,.22);border-radius:6px;background:rgba(0,0,0,.35);min-width:0}
.cpl-dest>i{flex-shrink:0;width:30px;color:#D8C395;font-size:1.3rem;text-align:center;margin-top:2px}
.cpl-dest>div{min-width:0}
.cpl-dest small{display:block;color:#9a9a9a;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}
.cpl-dest b{display:block;color:#fff;font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cpl-dest span{display:block;color:#D8C395;font-size:.78rem}
.cpl-escuadra{margin-top:12px;padding:14px;border:1px solid #D8C395;border-radius:6px;background:linear-gradient(135deg,rgba(216,195,149,.16),rgba(0,0,0,.4))}
.cpl-escuadra small{display:block;color:#D8C395;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
.cpl-escuadra>b{display:block;margin:4px 0 8px;color:#fff;font-size:1.25rem}
.cpl-esc-nums{display:flex;flex-wrap:wrap;gap:14px}.cpl-esc-nums span{color:#9a9a9a;font-size:.72rem}.cpl-esc-nums span b{display:block;color:#D8C395;font-size:1.05rem}
.cpl-tabla{margin-top:14px;padding:12px;border:1px solid rgba(216,195,149,.2);border-radius:6px;background:rgba(0,0,0,.35)}
.cpl-tabla h4{margin:0 0 8px;color:#D8C395;font-size:.8rem;letter-spacing:.06em}
.cpl-tabla-scroll{overflow-x:auto}
.cpl-tabla table{width:100%;border-collapse:collapse;font-size:.85rem}
.cpl-tabla th{padding:6px 8px;color:#9a9a9a;font-size:.66rem;text-align:left;white-space:nowrap;border-bottom:1px solid rgba(216,195,149,.25)}
.cpl-tabla td{padding:7px 8px;color:#eee;white-space:nowrap;border-top:1px solid rgba(255,255,255,.06)}
.cpl-tabla td.cpl-s{color:#D8C395;font-weight:bold}
.cpl-sel{min-height:38px;padding:6px 10px;border:1px solid rgba(216,195,149,.3);border-radius:4px;background:#0a0b10;color:#fff}
.cpl-filtros{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}
.cpl-chip{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:6px 14px;border:1px solid rgba(216,195,149,.35);border-radius:20px;background:transparent;color:#D8C395;font-size:.82rem;cursor:pointer}
.cpl-chip.activo{background:#D8C395;color:#0a0b10;font-weight:bold}
.cpl-filtros .cpl-sel{flex:1 1 220px;max-width:100%}
.cpl-resumen{margin:0 0 12px;color:#9a9a9a;font-size:.85rem}`;
        document.head.appendChild(st);
    }

    /* ---------------- Imágenes 4:5 (800×1000): 1) destacados · 2) análisis por sala ---------------- */
    const CAJA = 'background:rgba(10,11,16,.84);border:1px solid rgba(216,195,149,.35);border-radius:8px;padding:10px 12px;';
    const TIT = 'font-family:Michroma,sans-serif;color:#D8C395;font-size:.72rem;letter-spacing:.06em;margin-bottom:8px;';
    function lienzo(id, titulo, r, meta, cuerpo) {
        return `<div id="${id}" style="position:relative;width:800px;height:1000px;box-sizing:border-box;padding:222px 30px 26px;font-family:'Trebuchet MS',sans-serif;color:#fff;
                background:${meta.fondo ? `url('${meta.fondo}') center/cover` : 'radial-gradient(circle at 50% 0,#2a2418,#0b0b0d 70%)'};border:2px solid rgba(216,195,149,.3);overflow:hidden">
            ${meta.fondo ? '' : `<div style="position:absolute;top:44px;left:30px;right:30px;text-align:center">
                <div style="font-family:Michroma,sans-serif;font-size:.8rem;letter-spacing:.3em;color:#D8C395">${esc(meta.marca || 'PROYECTN')}</div>
                <div style="font-family:Michroma,sans-serif;font-size:2.3rem;line-height:1.15;margin-top:10px;color:#fff">${esc(meta.encabezado || 'ANÁLISIS DE ENTRENOS')}</div></div>`}
            <div style="position:absolute;top:178px;left:30px;right:30px;text-align:center;font-family:Michroma,sans-serif;font-size:.85rem;font-weight:bold;letter-spacing:1px;text-shadow:0 2px 4px rgba(0,0,0,.9)">
                ${titulo} | ${esc(meta.fecha || '')}${meta.moderador ? ' | MOD: ' + esc(meta.moderador) : ''}</div>
            ${cuerpo}
        </div>`;
    }

    function imagenHTML(r, meta) {
        const L = listaDestacados(r), e = r.escuadra;
        const jug = L.filter(x => x.grupo === 'jug').slice(0, 18), eq = L.filter(x => x.grupo === 'eq'), tot = L.filter(x => x.grupo === 'total');
        const carta = x => `<div style="${CAJA}padding:8px 10px;min-width:0">
            <div style="color:#aaa;font-size:.6rem;letter-spacing:.05em;text-transform:uppercase"><i class="fa-solid ${x.i}" style="color:#D8C395;margin-right:5px"></i>${x.t}</div>
            <div style="font-weight:bold;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${x.v}</div>
            <div style="color:#D8C395;font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.s}</div></div>`;
        const fila = (k, v, s) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.84rem">
            <span style="color:#aaa">${k}</span><span style="color:#fff;font-weight:bold;text-align:right">${v}${s ? `<span style="display:block;color:#D8C395;font-weight:normal;font-size:.7rem">${s}</span>` : ''}</span></div>`;
        return lienzo('capturaAvanzada', 'ESTADÍSTICAS AVANZADAS', r, meta, `
            <div style="display:grid;grid-template-columns:repeat(${tot.length},1fr);gap:8px;margin-bottom:10px">
                ${tot.map(x => `<div style="${CAJA}padding:7px 10px;text-align:center"><div style="color:#aaa;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em">${x.t}</div>
                    <div style="font-family:Michroma,sans-serif;font-size:1rem;color:#D8C395;margin-top:2px">${x.v}</div></div>`).join('')}
            </div>
            <div style="${TIT}">DESTACADOS DEL ENTRENO</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${jug.map(carta).join('')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                <div style="${CAJA}border-color:#D8C395;background:linear-gradient(135deg,rgba(216,195,149,.22),rgba(10,11,16,.85))">
                    <div style="${TIT}">ESCUADRA DESTACADA · LA MÁS CONSTANTE</div>
                    ${e ? `<div style="font-family:Michroma,sans-serif;font-size:1.05rem;margin:2px 0 6px">${esc(e.nombre)}</div>
                        ${e.promPts !== null ? fila('Puntos por sala', e.promPts.toFixed(1)) : ''}${e.promDano > 0 ? fila('Daño por sala', fmt(e.promDano)) : ''}
                        ${fila('Kills por sala', e.promKills.toFixed(1))}${fila('Constancia', Math.round(e.constancia * 100) + '%')}`
                        : '<div style="color:#aaa;font-size:.8rem">Ningún equipo jugó suficientes salas.</div>'}
                </div>
                <div style="${CAJA}"><div style="${TIT}">EQUIPO VS EQUIPO</div>
                    ${eq.length ? eq.map(x => fila(x.t, x.v, x.s)).join('') : '<div style="color:#aaa;font-size:.8rem">Sube los replays .json para ver los cruces entre equipos.</div>'}
                </div>
            </div>`);
    }

    function imagenSalasHTML(r, meta) {
        const th = 'padding:5px 6px;color:#D8C395;font-family:Michroma,sans-serif;font-size:.54rem;text-align:left;white-space:nowrap;border-bottom:1px solid rgba(216,195,149,.3)';
        const td = 'padding:5px 6px;font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;border-top:1px solid rgba(255,255,255,.07)';
        return lienzo('capturaPorSala', 'ANÁLISIS POR SALA', r, meta, tablasSalas(r).map(t => `
            <div style="${CAJA}margin-bottom:12px"><div style="${TIT}"><i class="fa-solid ${t.icono}" style="margin-right:6px"></i>${t.titulo}</div>
                <table style="width:100%;border-collapse:collapse;table-layout:auto">
                    <thead><tr>${t.cab.map(c => `<th style="${th}">${c}</th>`).join('')}</tr></thead>
                    <tbody>${t.filas.map(f => `<tr>${f.map((c, i) => `<td style="${td}${i === 0 ? ';color:#D8C395;font-weight:bold' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table></div>`).join(''));
    }

    /* ---------------- Página pública: análisis de entrenos (general · por día · por entreno) ---------------- */
    // Supabase devuelve máximo 1000 filas por consulta: se piden por páginas
    async function traerTodo(consulta, max) {
        const todas = [];
        for (let desde = 0; desde < (max || 20000); desde += 1000) {
            const { data, error } = await consulta().range(desde, desde + 999);
            if (error) throw error;
            todas.push(...(data || []));
            if (!data || data.length < 1000) break;
        }
        return todas;
    }
    const diaDe = f => { const d = new Date(f), z = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
    const diaLargo = k => new Date(k + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    async function montarPublico(contId, portal) {
        const cont = document.getElementById(contId);
        if (!cont || !(await habilitado(portal))) return;
        estilos();
        const db = P.db();
        let indice;
        try {
            indice = await traerTodo(() => db.from('stats_jugadores').select('sesion_id, fecha, titulo, creado').eq('portal', portal).order('creado', { ascending: false }));
        } catch (e) {
            // Sin las columnas nuevas (sql/23 viejo): solo con la fecha de guardado
            try { indice = await traerTodo(() => db.from('stats_jugadores').select('sesion_id, creado').eq('portal', portal).order('creado', { ascending: false })); }
            catch (e2) { return; }
        }
        if (!indice.length) return;   // sin datos todavía: queda el aviso de la página
        const ses = new Map();
        indice.forEach(r => { if (!ses.has(r.sesion_id)) ses.set(r.sesion_id, { id: r.sesion_id, fecha: r.fecha || r.creado, titulo: r.titulo || '' }); });
        const sesiones = [...ses.values()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        const dias = [...new Set(sesiones.map(s => diaDe(s.fecha)))];
        const nombreSes = s => `${new Date(s.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}${s.titulo ? ' · ' + s.titulo : ''}`;
        const bloque = cont.closest('[data-stats-avanzadas]') || cont;
        bloque.hidden = false;

        const estado = { modo: 'general', dia: dias[0], sesion: sesiones[0].id };
        const cache = new Map();
        const filasDe = async ids => {
            const falta = ids.filter(id => !cache.has(id));
            for (let i = 0; i < falta.length; i += 40) {
                const lote = falta.slice(i, i + 40);
                const filas = await traerTodo(() => db.from('stats_jugadores').select('*').eq('portal', portal).in('sesion_id', lote).order('id'));
                lote.forEach(id => cache.set(id, []));
                filas.forEach(f => cache.get(f.sesion_id).push(f));
            }
            return ids.flatMap(id => cache.get(id) || []);
        };

        const pintar = async () => {
            const ids = estado.modo === 'entreno' ? [estado.sesion]
                : estado.modo === 'dia' ? sesiones.filter(s => diaDe(s.fecha) === estado.dia).map(s => s.id)
                : sesiones.map(s => s.id);
            const chip = (m, t, i) => `<button type="button" class="cpl-chip${estado.modo === m ? ' activo' : ''}" data-modo="${m}"><i class="fa-solid ${i}"></i> ${t}</button>`;
            const selector = estado.modo === 'dia'
                ? `<select class="cpl-sel" data-dia aria-label="Día">${dias.map(d => `<option value="${d}"${d === estado.dia ? ' selected' : ''}>${esc(diaLargo(d))}</option>`).join('')}</select>`
                : estado.modo === 'entreno'
                ? `<select class="cpl-sel" data-entreno aria-label="Entreno">${sesiones.map(s => `<option value="${esc(s.id)}"${s.id === estado.sesion ? ' selected' : ''}>${esc(nombreSes(s))}</option>`).join('')}</select>`
                : '';
            cont.innerHTML = `<div class="cpl-filtros">${chip('general', 'General', 'fa-layer-group')}${chip('dia', 'Por día', 'fa-calendar-day')}${chip('entreno', 'Por entreno', 'fa-gamepad')}${selector}</div>
                <p style="color:#9a9a9a;text-align:center;padding:16px">Cargando estadísticas...</p>`;
            cont.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { estado.modo = b.dataset.modo; pintar(); });
            const sd = cont.querySelector('[data-dia]'), se = cont.querySelector('[data-entreno]');
            if (sd) sd.onchange = () => { estado.dia = sd.value; pintar(); };
            if (se) se.onchange = () => { estado.sesion = se.value; pintar(); };
            let filas, puntos = [];
            try {
                [filas, puntos] = await Promise.all([filasDe(ids), ids.length === 1 ? puntosDeSesion(portal, ids[0]) : Promise.resolve([])]);
            } catch (e) { cont.lastElementChild.textContent = 'No se pudieron cargar las estadísticas.'; return; }
            const salas = salasDesdeBD(filas);
            const r = calcular(salas, puntos);
            const resumen = estado.modo === 'general' ? `General: ${ids.length} entreno${ids.length === 1 ? '' : 's'} · ${salas.length} salas`
                : estado.modo === 'dia' ? `${diaLargo(estado.dia)}: ${ids.length} entreno${ids.length === 1 ? '' : 's'} · ${salas.length} salas`
                : `${nombreSes(ses.get(estado.sesion))} · ${salas.length} salas`;
            cont.lastElementChild.outerHTML = `<p class="cpl-resumen">${esc(resumen)}</p>
                <div class="cpl-grid">${destacadosHTML(r)}</div>${escuadraHTML(r.escuadra)}${salasHTML(r)}`;
        };
        pintar();
    }

    // Puntos por sala de cada equipo (para la escuadra destacada)
    async function puntosDeSesion(portal, sesion) {
        try {
            const db = P.db();
            const q = portal === 'entrenamientos'
                ? db.from('salas_resultados').select('equipo_nombre, numero_sala, total_score').eq('sesion_id', sesion)
                : db.from('portal_salas').select('equipo_nombre, numero_sala, total_score').eq('sesion_id', sesion);
            const { data } = await q.limit(2000);
            const m = new Map();
            (data || []).forEach(f => {
                const r = m.get(norm(f.equipo_nombre)) || { name: f.equipo_nombre, salasPuntos: {} };
                r.salasPuntos[f.numero_sala - 1] = (r.salasPuntos[f.numero_sala - 1] || 0) + f.total_score;
                m.set(norm(f.equipo_nombre), r);
            });
            return [...m.values()];
        } catch (e) { return []; }
    }

    // Filas → texto .csv (con BOM para que Excel lea bien las tildes). sep: "," o ";"
    function aCSV(cabecera, filas, sep) {
        sep = sep || ',';
        const celda = v => { const t = v === null || v === undefined ? '' : String(v); return /[",;\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
        return '﻿' + [cabecera].concat(filas).map(f => f.map(celda).join(sep)).join('\r\n') + '\r\n';
    }

    window.PumasCompletos = {
        leerCSV, partidaDesdeCSV, partidaDesdeReplay, jugadoresDeLog, nombreArma, combinar, aCSV, emparejar, calcular, filasBD, salasDesdeBD, idDeArchivo,
        habilitados, habilitado, destacadosHTML, escuadraHTML, salasHTML, imagenHTML, imagenSalasHTML, listaDestacados, tablasSalas, traerTodo, estilos, montarPublico, MAPAS, GRUPOS,
        guardar: (portal, sesion, filas) => P.stats.guardar(portal, sesion, filas),
        olvidarConfig: () => { cfgCache = null; }
    };
})();
