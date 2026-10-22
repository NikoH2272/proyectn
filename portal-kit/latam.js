/* =====================================================================
   PROYECTN · Entrenos LATAM
   Junta los entrenos de Pumas, Rusheo, ROW, QFD, Dragon Fest y ZMF.
   Los rankings los calcula la base (latam_resumen, sql/12) y llegan listos:
   pocos KB por visita aunque haya miles de entrenos. Misma fórmula que el portal de Pumas:
     PG  = puntos generales (total)
     PR  = PG ÷ sesiones (entero)  · orden: PR → booyah → PG
     KDA = kills ÷ salas jugadas    · orden: KDA → kills
   Al tocar un equipo o jugador se despliega en qué entrenos jugó (% con colores).
   Necesita portal.js cargado antes.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const ZONA = 'America/Bogota';

    // Orden: Pumas, Rusheo, ROW, QFD, Dragon Fest, ZMF.
    // `color` es el del % de participación (ROW usa su verde para no confundirse con ZMF).
    const PORTALES = [
        { id: 'entrenamientos', nombre: 'PROYECTN',           color: '#D8C395', logo: '/portales/pumasgaming/imagenes/LOGO PUMAS WEB.png',   url: '/portales/pumasgaming/' },
        { id: 'rusheo',         nombre: 'Rusheo',          color: '#FF8A00', logo: '/portales/rusheo/imagenes/rusheo.png',                   url: '/portales/rusheo/' },
        { id: 'row',            nombre: 'ROW x Maya',      color: '#2ECC71', logo: '/portales/row/imagenes/row.png',                         url: '/portales/row/' },
        { id: 'ascensosqfd',    nombre: 'Ascensos QFD',    color: '#4FC3F7', logo: '/portales/quisqueya/imagenes/qfd.png',                   url: '/portales/quisqueya/' },
        { id: 'dragonfest',     nombre: 'Dragon Fest',     color: '#2E6BFF', logo: '/portales/dragonfest/imagenes/dragonfest.png',           url: '/portales/dragonfest/' },
        { id: 'dragonfestfem',  nombre: 'Dragon Fest Fem', color: '#FF4FA3', logo: '/portales/dragonfest/imagenes/dragonfestfem.png',        url: '/portales/dragonfest/femenino.html' },
        { id: 'zmf',            nombre: 'ZMF',             color: '#E10600', logo: '/portales/zmf/imagenes/zmf.png',                         url: '/portales/zmf/' },
        { id: 'zmffem',         nombre: 'ZMF Fem',         color: '#B620E0', logo: '/portales/zmf/imagenes/zmffem.png',                      url: '/portales/zmf/femenino.html' }
    ];
    const POR_ID = Object.fromEntries(PORTALES.map(p => [p.id, p]));

    // Módulos creados en el panel (sql/17) + color/logo que el superadmin cambió en los portales fijos
    let modulosListos = null;
    function sumarModulos() {
        return modulosListos || (modulosListos = (async () => {
            let filas = [];
            try { filas = await P.cargarModulos(); } catch (e) { return; }
            filas.forEach(r => {
                const p = POR_ID[r.id];
                if (p) {
                    if (r.color_tema) p.color = r.color_tema;
                    if (r.logo) p.logo = r.logo;
                    return;
                }
                if (r.tipo !== 'modulo' || r.activo === false || !r.latam) return;
                const m = { id: r.id, nombre: r.nombre, color: r.color_tema || r.color || '#9AA0A6', logo: r.logo || LOGO_PUMAS, url: '/modulo/?p=' + r.id, modulo: true };
                PORTALES.push(m);
                POR_ID[r.id] = m;
            });
        })());
    }
    const LOGO_PUMAS = '/imagenes/proyectn.png';
    // Grupos de WhatsApp de cada entreno. Si la base (portales.link) tiene otro link, manda el de la base.
    const LINKS_POR_DEFECTO = {
        entrenamientos: 'https://chat.whatsapp.com/DW7DWlsOKKDENaW3S8aZCd',
        rusheo:         'https://chat.whatsapp.com/Lqu9o94aq9XIBI1QlYR6M0',
        row:            'https://chat.whatsapp.com/GMp7e5AUHpa6qoiJuhQ8wA',
        ascensosqfd:    'https://chat.whatsapp.com/GHpSM5xUyWdHr79DIsW2p8',
        zmf:            'https://chat.whatsapp.com/KSCHFXzg3XJGNIU6dt6UAl'
    };
    // Grupos extra (botón adicional en la tarjeta)
    const LINKS_EXTRA = { entrenamientos: [{ texto: 'Unirse Ligas', url: 'https://chat.whatsapp.com/CVnTo8XyLTv0PRRYRFYUr9' }] };
    // Instagram de cada entreno (por ahora solo Pumas)
    const INSTAGRAM = { entrenamientos: 'https://www.instagram.com/entrenos.pumas.gg/' };

    /* ---------------- Datos ---------------- */
    // Supabase devuelve máx. 1000 filas por consulta: se pide por páginas
    async function todas(vista, columnas, orden) {
        const filas = [];
        for (let desde = 0; ; desde += 1000) {
            let q = P.db().from(vista).select(columnas).range(desde, desde + 999);
            if (orden) q = q.order(orden, { ascending: false });
            const { data, error } = await q;
            if (error) throw error;
            filas.push(...data);
            if (data.length < 1000) return filas;
        }
    }

    async function cargarDatos() {
        const [sesiones, equipos, killers] = await Promise.all([
            todas('v_latam_sesiones', 'id, portal, titulo, jornada, fecha, moderador', 'fecha'),
            todas('v_latam_equipos', 'sesion_id, portal, fecha, equipo, salas, pts, kills, booyahs'),
            todas('v_latam_killers', 'sesion_id, portal, fecha, jugador, equipo, kills, salas')
        ]);
        return { sesiones, equipos, killers };
    }

    async function cargarLinks() {
        try {
            const { data, error } = await P.db().from('portales').select('id, link').eq('latam', true);
            if (error) return { ...LINKS_POR_DEFECTO };
            return { ...LINKS_POR_DEFECTO, ...Object.fromEntries((data || []).filter(r => r.link).map(r => [r.id, r.link])) };
        } catch (e) { return { ...LINKS_POR_DEFECTO }; }
    }

    /* ---------------- Fórmulas (iguales a Pumas) ---------------- */
    const clave = t => String(t || '').trim().toLowerCase();
    const idSesion = r => r.portal + ':' + r.sesion_id;   // los ids se repiten entre portales

    function agregarEquipos(filas) {
        const eq = {};
        filas.forEach(r => {
            const e = eq[clave(r.equipo)] = eq[clave(r.equipo)] || { name: r.equipo, ses: 0, b: 0, k: 0, pts: 0, salas: 0, porPortal: {} };
            e.ses++; e.b += r.booyahs || 0; e.k += r.kills || 0; e.pts += r.pts || 0; e.salas += r.salas || 0;
            e.porPortal[r.portal] = (e.porPortal[r.portal] || 0) + 1;
        });
        return Object.values(eq)
            .map(e => ({ ...e, pr: Math.round(e.pts / e.ses), kps: e.k / e.ses, entrenos: Object.keys(e.porPortal).length }))
            .sort((a, b) => b.pr - a.pr || b.b - a.b || b.pts - a.pts || a.name.localeCompare(b.name));
    }

    const MIN_SALAS = 3;   // mínimo de salas jugadas para entrar a los top killers
    const conSalas = x => x.s >= MIN_SALAS;
    const porKills = (a, b) => b.k - a.k || b.kda - a.kda;
    const porBooyah = (a, b) => b.b - a.b || b.pr - a.pr || b.pts - a.pts;

    function agregarKillers(filas) {
        const pl = {};
        filas.forEach(r => {
            const e = pl[clave(r.jugador)] = pl[clave(r.jugador)] || { name: r.jugador, equipo: r.equipo, k: 0, s: 0, porPortal: {} };
            e.k += r.kills || 0; e.s += r.salas || 0;
            e.porPortal[r.portal] = (e.porPortal[r.portal] || 0) + 1;
        });
        return Object.values(pl).filter(conSalas)
            .map(x => ({ ...x, kda: x.k / x.s }))
            .sort((a, b) => b.kda - a.kda || b.k - a.k);
    }

    /* ---------------- Semana: de LUNES a DOMINGO, hora Colombia (igual que Pumas) ---------------- */
    // Fechas date-only ('YYYY-MM-DD') se devuelven directas para evitar el desplazamiento UTC-5
    const diaLocal = iso => {
        const s = (iso instanceof Date) ? iso.toISOString() : String(iso);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return new Date(s).toLocaleDateString('en-CA', { timeZone: ZONA });
    };
    const inicioSemana = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() || 7) - 1));   // el lunes
    function semanaISO(d) {
        const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - n);
        const y = t.getUTCFullYear();
        return y + '-' + Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    }
    function rangoSemana(d) {
        const l = inicioSemana(d);
        const f = new Date(l.getFullYear(), l.getMonth(), l.getDate() + 6), o = { day: 'numeric', month: 'short' };
        return l.toLocaleDateString('es', o) + ' – ' + f.toLocaleDateString('es', o);
    }
    const hoyCol = () => new Date(diaLocal(new Date()) + 'T00:00:00');
    const semanaDe = fecha => semanaISO(new Date(diaLocal(fecha) + 'T00:00:00'));
    // Siempre la semana ACTUAL (lunes a domingo), aunque todavía no tenga entrenos
    function semanaObjetivo() {
        const hoy = hoyCol(), k = semanaISO(hoy);
        return { clave: k, num: k.split('-')[1], actual: true, rango: rangoSemana(hoy) };
    }

    /* ---------------- Participación: se ve al tocar la fila ---------------- */
    // Cada fila guarda sus sesiones por entreno en data-part; al tocarla se despliega el detalle.
    const dataPart = porPortal => `data-part='${esc(JSON.stringify(porPortal || {}))}'`;

    function detalleHTML(porPortal, nombre) {
        const total = Object.values(porPortal).reduce((a, b) => a + b, 0);
        if (!total) return '';
        const lista = PORTALES.filter(p => porPortal[p.id]).map(p => ({ p, n: porPortal[p.id], pct: porPortal[p.id] / total * 100 }));
        return `<div class="part-caja">
            <div class="part-titulo">${esc(nombre)} · ${total} ${total === 1 ? 'sesión' : 'sesiones'} en ${lista.length} entreno${lista.length === 1 ? '' : 's'}</div>
            <div class="part-barra">${lista.map(x => `<i style="width:${x.pct}%;background:${x.p.color}" title="${esc(x.p.nombre)} ${Math.round(x.pct)}%"></i>`).join('')}</div>
            <div class="part-lista">${lista.map(x => `<span><i style="background:${x.p.color}"></i>${esc(x.p.nombre)} <b>${Math.round(x.pct)}%</b> <small>(${x.n})</small></span>`).join('')}</div>
        </div>`;
    }

    // Un solo manejador para todas las filas tocables (tablas y listas)
    document.addEventListener('click', e => {
        const fila = e.target.closest('[data-part]');
        if (!fila || e.target.closest('a, button')) return;
        const sig = fila.nextElementSibling;
        if (sig && sig.classList.contains('part-det')) { sig.remove(); fila.classList.remove('abierta'); return; }
        const porPortal = JSON.parse(fila.dataset.part || '{}');
        const nombre = fila.dataset.nombre || '';
        let det;
        if (fila.tagName === 'TR') {
            det = document.createElement('tr');
            det.innerHTML = `<td colspan="${fila.children.length}">${detalleHTML(porPortal, nombre)}</td>`;
        } else {
            det = document.createElement('div');
            det.innerHTML = detalleHTML(porPortal, nombre);
        }
        det.className = 'part-det';
        fila.after(det);
        fila.classList.add('abierta');
    });
    // Accesible con teclado
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-part]')) { e.preventDefault(); e.target.click(); }
    });

    function leyendaHTML() {
        return `<div class="latam-leyenda">` + PORTALES.map(p =>
            `<span><i style="background:${p.color}"></i>${esc(p.nombre)}</span>`).join('') +
            `<small><i class="fa-solid fa-hand-pointer"></i> Toca un equipo o jugador para ver en qué entrenos jugó.</small></div>`;
    }

    const colPuesto = i => i === 0 ? '#D8C395' : i === 1 ? '#B9B2A4' : i === 2 ? '#cd7f32' : null;
    const imgLogo = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" onerror="this.onerror=null;this.src='${LOGO_PUMAS}'">`;
    const tocable = (x) => `${dataPart(x.porPortal)} data-nombre="${esc(x.name)}" tabindex="0" role="button" aria-label="${esc(x.name)}: ver participación por entreno"`;

    /* ---------------- Tarjetas de cada entreno (index principal) ---------------- */
    function tarjetasPortales(_links) {
        const grupos = [['entrenamientos'], ['rusheo'], ['row'], ['ascensosqfd'], ['dragonfest', 'dragonfestfem'], ['zmf', 'zmffem']]
            .concat(PORTALES.filter(p => p.modulo).map(p => [p.id]));
        const cards = grupos.map(ids => {
            const p = POR_ID[ids[0]];
            const doble = ids.length > 1;
            const fem = doble ? POR_ID[ids[1]] : null;
            const botones = doble
                ? `<a class="btn-access" href="${p.url}">Mixto</a>` +
                  `<a class="btn-access" href="${fem.url}" style="--c:${fem.color}">Femenino</a>`
                : `<a class="btn-access" href="${p.url}">Portal <i class="fa-solid fa-arrow-right"></i></a>`;
            return `<article class="card-box latam-card" style="--c:${p.color}">
                <div class="latam-logo">${imgLogo(p.logo, p.nombre)}</div>
                <span class="portal-ff-tag"><i class="fa-solid fa-fire-flame-curved"></i> Free Fire</span>
                <h3>${esc(p.id === 'entrenamientos' ? 'Pumas Gaming' : p.nombre)}</h3>
                <div class="latam-acciones">${botones}</div>
            </article>`;
        });
        const rem = cards.length % 3;
        if (rem !== 0) for (let i = 0; i < 3 - rem; i++) {
            cards.push(`<article class="card-box latam-card latam-pronto" style="--c:#444">
                <div class="latam-logo"><i class="fa-solid fa-circle-plus" style="font-size:2rem;color:#444"></i></div>
                <h3 style="color:#666!important">Próximamente</h3>
                <div class="latam-acciones"></div>
            </article>`);
        }
        return cards.join('');
    }

    /* ---------------- Resumen (calculado en la base) ---------------- */
    // La base (sql/12) devuelve los rankings ya calculados: pocos KB por visita.
    // Si esa función aún no existe, se calcula como antes en el navegador.
    const aEquipo = e => ({ name: e.equipo, ses: e.ses, b: e.b, k: e.k, pts: e.pts, pr: e.pr,
        entrenos: e.entrenos, kps: e.ses ? e.k / e.ses : 0, porPortal: e.part || {} });
    const aKiller = x => ({ name: x.jugador, equipo: x.equipo, k: x.k, s: x.s, kda: Number(x.kda) || 0, porPortal: x.part || {} });
    const faltaFuncion = err => /latam_resumen|latam_calendario|could not find|schema cache|PGRST202/i.test((err && (err.message + ' ' + err.code)) || '');

    let legado = null;   // datos completos, solo si la base aún no tiene sql/12
    async function datosLegado() { return legado || (legado = await cargarDatos()); }

    async function resumen(portal, completo) {
        const { data, error } = await P.db().rpc('latam_resumen', { p_portal: portal, p_completo: completo });
        if (!error && data) {
            const lunes = new Date(data.semana.lunes + 'T00:00:00');
            const out = {
                semana: { num: data.semana.num, actual: data.semana.actual, rango: rangoSemana(lunes), lunes: data.semana.lunes },
                semanaEquipos: (data.semana_equipos || []).map(aEquipo),
                semanaKillers: (data.semana_killers || []).map(aKiller).filter(conSalas),
                // sin sql/14 no llega la lista por kills: se arma con lo que hay
                semanaKillersKills: (data.semana_killers_kills || data.semana_killers || []).map(aKiller).filter(conSalas).sort(porKills)
            };
            if (!completo) return out;
            const ind = {};
            Object.entries(data.individuales || {}).forEach(([id, v]) => { ind[id] = { entrenos: v.entrenos, top: (v.top || []).map(aEquipo) }; });
            return Object.assign(out, {
                stats: data.stats,
                historico: (data.historico || []).map(aEquipo),
                killers: (data.killers || []).map(aKiller).filter(conSalas),
                killersKills: (data.killers_kills || data.jugadores || []).map(aKiller).filter(conSalas).sort(porKills),
                letales: (data.letales || []).map(aEquipo),
                activos: (data.activos || []).map(aEquipo),
                jugadores: (data.jugadores || []).map(aKiller).filter(conSalas),
                // sin sql/15 se arma con el histórico
                topBooyah: (data.top_booyah || [...(data.historico || [])].sort((a, b) => b.b - a.b || b.pr - a.pr)).map(aEquipo).filter(e => e.b > 0).slice(0, 5),
                individuales: ind,
                ultimos: data.ultimos || []
            });
        }
        if (error && !faltaFuncion(error)) throw error;
        return resumenLocal(await datosLegado(), portal, completo);
    }

    // Mismo resultado que latam_resumen, calculado en el navegador (compatibilidad)
    function resumenLocal(d, portal, completo) {
        const f = r => !portal || r.portal === portal;
        const ses = d.sesiones.filter(f), eqs = d.equipos.filter(f), kls = d.killers.filter(f);
        const sem = semanaObjetivo();
        const enSemana = r => semanaDe(r.fecha) === sem.clave;
        const out = {
            semana: sem,
            semanaEquipos: agregarEquipos(eqs.filter(enSemana)).slice(0, completo ? 50 : 10),
            semanaKillers: agregarKillers(kls.filter(enSemana)).slice(0, 10),
            semanaKillersKills: agregarKillers(kls.filter(enSemana)).sort(porKills).slice(0, 10)
        };
        if (!completo) return out;
        const todo = agregarEquipos(eqs), killers = agregarKillers(kls);
        const mapas = Object.values(eqs.reduce((m, r) => { m[idSesion(r)] = Math.max(m[idSesion(r)] || 0, r.salas); return m; }, {})).reduce((a, b) => a + b, 0);
        const ind = {};
        PORTALES.filter(p => !portal || p.id === portal).forEach(p => {
            ind[p.id] = { entrenos: d.sesiones.filter(s => s.portal === p.id).length, top: agregarEquipos(d.equipos.filter(r => r.portal === p.id)).slice(0, 10) };
        });
        return Object.assign(out, {
            stats: { entrenos: ses.length, equipos: todo.length, kills: kls.reduce((a, r) => a + (r.kills || 0), 0), mapas },
            historico: todo.slice(0, 100),
            killers: killers.slice(0, 10),
            killersKills: [...killers].sort(porKills).slice(0, 10),
            letales: [...todo].sort((a, b) => b.k - a.k || b.kps - a.kps).slice(0, 5),
            activos: [...todo].sort((a, b) => b.ses - a.ses || b.entrenos - a.entrenos || b.pr - a.pr).slice(0, 5),
            jugadores: [...killers].sort((a, b) => b.k - a.k || b.kda - a.kda).slice(0, 5),
            topBooyah: todo.filter(e => e.b > 0).sort(porBooyah).slice(0, 5),
            individuales: ind,
            ultimos: ses.slice(0, 8)
        });
    }

    // Histórico Top 100 ordenado por 'pr' (PG ÷ sesiones) o 'pg' (puntos totales)
    const ordenarPor = {
        pr: (a, b) => b.pr - a.pr || b.b - a.b || b.pts - a.pts || a.name.localeCompare(b.name),
        pg: (a, b) => b.pts - a.pts || b.pr - a.pr || b.b - a.b || a.name.localeCompare(b.name),
        kill: (a, b) => b.k - a.k || b.pr - a.pr || b.pts - a.pts || a.name.localeCompare(b.name)
    };
    async function historico(portal, orden) {
        const { data, error } = await P.db().rpc('latam_historico', { p_portal: portal, p_orden: orden, p_limite: 100 });
        if (!error) return (data || []).map(aEquipo).sort(ordenarPor[orden]);   // sin sql/16, 'kill' llega por PR: se reordena
        if (!/latam_historico|could not find|schema cache|PGRST202/i.test(error.message + ' ' + error.code)) throw error;
        const d = await datosLegado();
        return agregarEquipos(d.equipos.filter(r => !portal || r.portal === portal)).sort(ordenarPor[orden]).slice(0, 100);
    }

    // Ranking ordenado por 'pr', 'pg' o 'kill'. semana = r.semana (Top 50) o null (histórico).
    const masDias = (ymd, n) => { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
    async function ranking(portal, orden, semana, limite, respaldo) {
        if (!semana || semana.lunes) {
            const { data, error } = await P.db().rpc('latam_ranking', {
                p_portal: portal, p_orden: orden, p_limite: limite,
                p_desde: semana ? semana.lunes : null, p_hasta: semana ? masDias(semana.lunes, 6) : null
            });
            if (!error) return (data || []).map(aEquipo);
            if (!/latam_ranking|could not find|schema cache|PGRST202/i.test(error.message + ' ' + error.code)) throw error;
        }
        // sin sql/16: la semana se reordena con lo que ya llegó; el histórico usa latam_historico
        if (semana) return [...(respaldo || [])].sort(ordenarPor[orden]).slice(0, limite);
        return (await historico(portal, orden)).slice(0, limite);
    }

    // Entrenos de un mes (para el calendario)
    async function sesionesDelMes(portal, anio, mes) {
        const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
        const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(new Date(anio, mes + 1, 0).getDate()).padStart(2, '0')}`;
        const { data, error } = await P.db().rpc('latam_calendario', { p_portal: portal, p_desde: desde, p_hasta: hasta });
        if (!error) return data || [];
        if (!faltaFuncion(error)) throw error;
        const d = await datosLegado();
        return d.sesiones.filter(s => (!portal || s.portal === portal) && diaLocal(s.fecha) >= desde && diaLocal(s.fecha) <= hasta);
    }

    /* ---------------- Rankings (index principal) ---------------- */
    function filaRank(x, i, valor) {
        const c = colPuesto(i) || 'var(--gray)';
        return `<div class="rank-row latam-row" ${tocable(x)}>
            <span><b style="color:${c}">#${i + 1}</b> ${esc(x.name)}</span><em>${valor} <i class="fa-solid fa-chevron-down part-flecha"></i></em></div>`;
    }

    async function iniciarIndex() {
        await sumarModulos();
        const cont = document.getElementById('latamPortales');
        if (cont) cont.innerHTML = tarjetasPortales(LINKS_POR_DEFECTO);
        cargarLinks().then(links => { if (cont) cont.innerHTML = tarjetasPortales(links); });

        const eqEl = document.getElementById('latamTopEquipos'), klEl = document.getElementById('latamTopKillers');
        const ley = document.getElementById('latamLeyenda');
        if (ley) ley.innerHTML = leyendaHTML();
        if (!eqEl && !klEl) return;
        try {
            const r = await resumen(null, false);
            const sem = r.semana, nota = sem.actual ? '' : ' · última con datos';
            const t1 = document.getElementById('latamTituloEq'), t2 = document.getElementById('latamTituloKill');
            if (t1) t1.innerHTML = `Top 10 Equipos LATAM · Semana ${sem.num}<span class="wk-range">${sem.rango}${nota} · PR</span>`;
            if (t2) t2.innerHTML = `Top 10 Killers LATAM · Semana ${sem.num}<span class="wk-range">${sem.rango}${nota} · KDA</span>`;
            const eq = r.semanaEquipos.slice(0, 10), kl = r.semanaKillers.slice(0, 10);
            eqEl.innerHTML = eq.length ? eq.map((x, i) => filaRank(x, i, `${x.pr} PR`)).join('') : `<p>${SIN_SEMANA}</p>`;
            klEl.innerHTML = kl.length ? kl.map((x, i) => filaRank(x, i, `${x.kda.toFixed(2)} KDA`)).join('') : `<p>${SIN_SEMANA}</p>`;
        } catch (e) {
            console.warn('LATAM:', e);
            const msg = '<p>Los resultados LATAM estarán disponibles pronto.</p>';
            eqEl.innerHTML = msg; klEl.innerHTML = msg;
        }
    }

    // Fecha con día de la semana; la descarga de la imagen solo está en el portal de cada entreno
    const fechaSes = s => window.PumasDescargas ? PumasDescargas.fechaHTML(s.fecha) : `<small>${fmtDia(diaLocal(s.fecha))}</small>`;
    const descargaSes = s => window.PumasDescargas ? PumasDescargas.botones(s) : '';

    /* ---------------- Portal /entrenoslatam/ ---------------- */
    const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fmtDia = d => new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    const VACIO = '<tr class="vacio"><td colspan="7"><i class="fa-solid fa-database"></i>Sin registros todavía.</td></tr>';
    // La tabla de la semana vacía (la semana va de lunes a domingo y siempre es la actual)
    const SIN_SEMANA = 'No tenemos resultados de la semana. Puedes consultar en el calendario los entrenos anteriores o más abajo el histórico.';
    const VACIO_SEMANA = `<tr class="vacio"><td colspan="7"><i class="fa-regular fa-calendar"></i>${SIN_SEMANA}</td></tr>`;

    // data-l = etiqueta que se ve en el celular (la tabla se muestra como ficha)
    function filaTabla(e, i, conPart) {
        const c = colPuesto(i);
        const extra = conPart === false ? '' : `class="latam-row" ${tocable(e)}`;
        return `<tr ${extra}>
            <td class="c-pos" style="color:${c || 'inherit'}"><b>#${i + 1}</b></td>
            <td class="eq-nombre">${esc(e.name)}${conPart === false ? '' : ' <i class="fa-solid fa-chevron-down part-flecha"></i>'}</td>
            <td data-l="SES">${e.ses}</td><td class="c-b" data-l="BOO">${e.b}</td><td data-l="KILL">${e.k}</td><td class="c-pg" data-l="PG">${e.pts}</td>
            <td class="c-pr" data-l="PR" style="color:${c || 'var(--light)'}"><b>${e.pr}</b></td></tr>`;
    }
    function llenarDoble(idA, idB, lista, conPart) {
        const A = document.getElementById(idA), B = document.getElementById(idB);
        if (!A || !B) return;
        if (!lista.length) { A.innerHTML = /Semana/.test(idA) ? VACIO_SEMANA : VACIO; B.innerHTML = ''; B.closest('table').hidden = true; A.closest('table').caption.textContent = ''; return; }
        const m = Math.ceil(lista.length / 2);
        A.innerHTML = lista.slice(0, m).map((e, i) => filaTabla(e, i, conPart)).join('');
        B.innerHTML = lista.slice(m).map((e, i) => filaTabla(e, i + m, conPart)).join('');
        B.closest('table').hidden = lista.length <= m;
        A.closest('table').caption.textContent = `PUESTOS 1 – ${m}`;
        B.closest('table').caption.textContent = lista.length > m ? `PUESTOS ${m + 1} – ${lista.length}` : '';
        botonVerMas(A.closest('.tabla-doble'), lista.length);
    }

    const textoVerMas = (b, cont) => {
        b.innerHTML = cont.classList.contains('recortar') ? `<i class="fa-solid fa-chevron-down"></i> Ver los ${b.dataset.total}` : '<i class="fa-solid fa-chevron-up"></i> Ver menos';
    };
    // En el celular las tablas largas muestran solo los primeros 10, con botón para ver todos
    function botonVerMas(cont, total) {
        if (!cont) return;
        let b = cont.nextElementSibling && cont.nextElementSibling.classList.contains('ver-mas') ? cont.nextElementSibling : null;
        if (!b) {
            b = document.createElement('button');
            b.type = 'button'; b.className = 'ver-mas';
            cont.after(b);
            cont.classList.add('recortar');
            b.addEventListener('click', () => { cont.classList.toggle('recortar'); textoVerMas(b, cont); if (cont.classList.contains('recortar')) cont.scrollIntoView({ block: 'start' }); });
        }
        b.dataset.total = total;
        b.hidden = total <= 10;
        textoVerMas(b, cont);
    }

    function pintarKillers(contId, porKda, porK, conPart) {
        const g = document.getElementById(contId);
        if (!g) return;
        const lista = (arr, resaltar) => arr.length
            ? `<div class="killer-head"><span>#</span><span>JUGADOR</span><span>SALAS</span><span>KILLS</span><span>KDA</span></div>` +
              arr.slice(0, 10).map((k, i) => filaKiller(k, i, conPart, resaltar)).join('')
            : '<p class="res-vacio"><i class="fa-solid fa-skull"></i>Sin jugadores con 3 salas o más todavía.</p>';
        g.innerHTML = `<div class="killers-doble">
                <div><h4 class="killers-sub"><i class="fa-solid fa-chart-line"></i> Por KDA <small>kills ÷ salas</small></h4>${lista(porKda, 'kda')}</div>
                <div><h4 class="killers-sub"><i class="fa-solid fa-crosshairs"></i> Por kills totales <small>sin fórmula</small></h4>${lista(porK, 'kills')}</div>
            </div>
            <p class="muted killers-nota">Solo cuentan jugadores con ${MIN_SALAS} salas o más.</p>`;
    }

    function filaKiller(k, i, conPart, resaltar) {
        const c = colPuesto(i);
        const kd = resaltar === 'kills' ? '' : `style="color:${c || 'inherit'}"`;
        const kl = resaltar === 'kills' ? `style="color:${c || 'inherit'}"` : '';
        if (conPart === false) return `<div class="killer-card">
            <span style="color:${c || 'inherit'}"><b>#${i + 1}</b></span><span class="k-name">${esc(k.name)}</span>
            <span>${k.s}</span><span ${kl}><b>${k.k}</b></span><span ${kd}><b>${k.kda.toFixed(2)}</b></span></div>`;
        return `<div class="killer-card latam-row" ${tocable(k)}>
            <span style="color:${c || 'inherit'}"><b>#${i + 1}</b></span><span class="k-name">${esc(k.name)}</span>
            <span>${k.s}</span><span>${k.k}</span><span style="color:${c || 'inherit'}"><b>${k.kda.toFixed(2)}</b></span></div>`;
    }

    // Destacados: equipos más letales, que más participan y jugador más letal
    function destacados(letales, activos, jugadores, conPart, contId, booyah) {
        const cont = document.getElementById(contId || 'latamDestacados');
        if (!cont) return;
        const toc = x => conPart === false ? '' : `latam-row" ${tocable(x)} data-x="`;
        const fila = (x, i, valor, sub) => `<div class="dest-fila ${toc(x)}">
            <b style="color:${colPuesto(i) || 'var(--gray)'}">#${i + 1}</b>
            <span class="dest-nombre">${esc(x.name)}${sub ? `<small>${sub}</small>` : ''}</span>
            <em>${valor}</em></div>`;
        const vacio = '<p class="res-vacio">Sin datos todavía.</p>';
        const top = jugadores[0];
        cont.innerHTML = `
            <article class="card-box dest-card">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-fire"></i> Equipos más letales</h3>
                <p class="muted">Más kills en todos los entrenos.</p>
                ${letales.length ? letales.map((x, i) => fila(x, i, `${x.k} kills`, `${x.kps.toFixed(1)} kills por sesión`)).join('') : vacio}
            </article>
            <article class="card-box dest-card">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-people-group"></i> Equipos que más participan</h3>
                <p class="muted">Más sesiones jugadas.</p>
                ${activos.length ? activos.map((x, i) => fila(x, i, `${x.ses} ses.`, `en ${x.entrenos} entreno${x.entrenos === 1 ? '' : 's'}`)).join('') : vacio}
            </article>
            <article class="card-box dest-card">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-crown"></i> Top Booyah</h3>
                <p class="muted">Más salas ganadas (booyahs).</p>
                ${(booyah || []).length ? booyah.map((x, i) => fila(x, i, `${x.b} booyah${x.b === 1 ? '' : 's'}`, `${x.ses} ses. · PR ${x.pr}`)).join('') : vacio}
            </article>
            <article class="card-box dest-card dest-mvp">
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-crosshairs"></i> Jugador más letal</h3>
                ${top ? `<div class="mvp ${toc(top)}">
                        <i class="fa-solid fa-skull mvp-icono"></i>
                        <div><b class="mvp-nombre">${esc(top.name)}</b><small>${esc(top.equipo || '')}</small></div>
                        <div class="mvp-datos"><span><b>${top.k}</b>kills</span><span><b>${top.s}</b>salas</span><span><b>${top.kda.toFixed(2)}</b>KDA</span></div>
                    </div>
                    ${jugadores.slice(1).map((x, i) => fila(x, i + 1, `${x.k} kills`, `KDA ${x.kda.toFixed(2)}`)).join('')}` : vacio}
            </article>`;
    }

    // Tablas individuales: un Top 10 (por PR) de cada entreno
    function individuales(ind, filtro) {
        const cont = document.getElementById('latamIndividuales');
        if (!cont) return;
        const lista = PORTALES.filter(p => filtro === 'todos' || p.id === filtro);
        cont.innerHTML = lista.map(p => {
            const v = ind[p.id] || { entrenos: 0, top: [] };
            const eqs = v.top, nSes = v.entrenos;
            return `<article class="card-box ind-card" style="--c:${p.color}">
                <div class="ind-head">${imgLogo(p.logo, p.nombre)}<div><h3>${esc(p.nombre)}</h3><small>${nSes} entreno${nSes === 1 ? '' : 's'}</small></div>
                    <a class="btn-mini" href="${p.url}">Portal</a></div>
                <table class="pg-tabla lt-tabla ind-tabla">
                    <thead><tr><th>#</th><th>Equipo</th><th>SES</th><th>BOO</th><th>PG</th><th>PR</th></tr></thead>
                    <tbody>${eqs.length ? eqs.map((e, i) => `<tr><td class="c-pos" style="color:${colPuesto(i) || 'inherit'}"><b>#${i + 1}</b></td>
                        <td class="eq-nombre">${esc(e.name)}</td><td data-l="SES">${e.ses}</td><td class="c-b" data-l="BOO">${e.b}</td><td class="c-pg" data-l="PG">${e.pts}</td>
                        <td class="c-pr" data-l="PR" style="color:${colPuesto(i) || 'var(--light)'}"><b>${e.pr}</b></td></tr>`).join('')
                        : '<tr class="vacio"><td colspan="6">Sin entrenos todavía.</td></tr>'}</tbody>
                </table>
            </article>`;
        }).join('');
    }

    // Botones "Ordenar por PR | PG" del histórico
    function montarOrden(contId, alCambiar) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        cont.innerHTML = `<span>Ordenar por</span>
            <button type="button" class="orden-btn on" data-orden="pr" title="Puntos Reales = PG ÷ sesiones">PR</button>
            <button type="button" class="orden-btn" data-orden="pg" title="Puntos Generales = total de puntos">PG</button>
            <button type="button" class="orden-btn" data-orden="kill" title="Kills totales">KILLS</button>`;
        cont.onclick = e => {
            const b = e.target.closest('[data-orden]'); if (!b || b.classList.contains('on')) return;
            cont.querySelectorAll('.orden-btn').forEach(x => x.classList.toggle('on', x === b));
            alCambiar(b.dataset.orden);
        };
    }
    function ordenActual(contId) {
        const b = document.querySelector('#' + contId + ' .orden-btn.on');
        return b ? b.dataset.orden : 'pr';
    }
    const textoOrden = o => o === 'pg' ? 'Orden: PG (puntos totales) → PR' : o === 'kill' ? 'Orden: KILLS (totales) → PR' : 'Orden: PR (PG ÷ sesiones) → booyah';
    const tituloSemana = (sem, ordenId) => {
        const tit = document.getElementById('tituloTop50');
        if (tit) tit.innerHTML = `Top 50 Equipos · Semana ${sem.num}<span class="wk-range">${sem.rango}${sem.actual ? '' : ' · última semana con datos'} · ${textoOrden(ordenActual(ordenId))}</span>`;
    };

    let filtroPortal = null;   // null = todos
    const cacheResumen = {};

    async function iniciarPortal() {
        await sumarModulos();
        const ley = document.getElementById('latamLeyenda');
        if (ley) ley.innerHTML = leyendaHTML();
        const chips = document.getElementById('latamFiltro');
        if (chips) {
            chips.innerHTML = `<button class="chip on" data-p="todos">Todos</button>` + PORTALES.map(p =>
                `<button class="chip" data-p="${p.id}" style="--c:${p.color}">${esc(p.nombre)}</button>`).join('');
            chips.onclick = e => {
                const b = e.target.closest('[data-p]'); if (!b) return;
                filtroPortal = b.dataset.p === 'todos' ? null : b.dataset.p;
                chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
                pintar();
            };
        }
        const actual = async () => cacheResumen[filtroPortal || 'todos'] || await resumen(filtroPortal, true);
        montarOrden('ordenHistorico', async orden => {
            const n = document.getElementById('notaHistorico'); if (n) n.textContent = textoOrden(orden);
            try { const r = await actual(); llenarDoble('bodyTop100A', 'bodyTop100B', orden === 'pr' ? r.historico : await ranking(filtroPortal, orden, null, 100)); }
            catch (e) { console.warn('LATAM histórico:', e); }
        });
        montarOrden('ordenSemana', async orden => {
            try {
                const r = await actual(); tituloSemana(r.semana, 'ordenSemana');
                llenarDoble('bodySemanaA', 'bodySemanaB', orden === 'pr' ? r.semanaEquipos.slice(0, 50) : await ranking(filtroPortal, orden, r.semana, 50, r.semanaEquipos));
            } catch (e) { console.warn('LATAM semana:', e); }
        });
        await pintar(true);
    }

    async function pintar(primeraVez) {
        const clave = filtroPortal || 'todos';
        let r;
        try { r = cacheResumen[clave] || (cacheResumen[clave] = await resumen(filtroPortal, true)); }
        catch (e) {
            console.warn('LATAM:', e);
            document.querySelectorAll('[data-latam-vacio]').forEach(n => { n.innerHTML = '<tr class="vacio"><td colspan="7"><i class="fa-solid fa-database"></i>Los resultados LATAM estarán disponibles pronto.</td></tr>'; });
            return;
        }
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Number(v || 0).toLocaleString('es'); };
        set('statEquipos', r.stats.equipos); set('statKills', r.stats.kills);
        set('statMapas', r.stats.mapas); set('statEntrenos', r.stats.entrenos);

        // Al cambiar de entreno se respeta el orden elegido (PR, PG o KILLS)
        tituloSemana(r.semana, 'ordenSemana');
        const oS = ordenActual('ordenSemana'), oH = ordenActual('ordenHistorico');
        if (oS === 'pr') llenarDoble('bodySemanaA', 'bodySemanaB', r.semanaEquipos.slice(0, 50));
        else ranking(filtroPortal, oS, r.semana, 50, r.semanaEquipos).then(l => llenarDoble('bodySemanaA', 'bodySemanaB', l)).catch(e => console.warn(e));
        if (oH === 'pr') llenarDoble('bodyTop100A', 'bodyTop100B', r.historico.slice(0, 100));
        else ranking(filtroPortal, oH, null, 100).then(l => llenarDoble('bodyTop100A', 'bodyTop100B', l)).catch(e => console.warn(e));

        pintarKillers('gridKillers', r.killers, r.killersKills);

        destacados(r.letales, r.activos, r.jugadores, undefined, undefined, r.topBooyah);
        individuales(r.individuales, filtroPortal || 'todos');

        // El calendario abre en el mes del último entreno si este mes no tiene
        calUltimos = r.ultimos;
        if (primeraVez && r.ultimos.length) {
            const f = diaLocal(r.ultimos[0].fecha);
            calAnio = +f.slice(0, 4); calMes = +f.slice(5, 7) - 1;
        }
        calSel = null;
        if (primeraVez) calAutoHoy = true;
        cargarMes();
    }

    // Calendario igual al de Pumas: carga solo el mes visible, con un punto del color de cada entreno
    let calMes = new Date().getMonth(), calAnio = new Date().getFullYear(), calSel = null, calSes = [], calUltimos = [];
    let calAutoHoy = true;        // la primera vez se despliegan solos los entrenos de hoy
    let calConDescarga = false;   // en el portal de cada entreno: botón Descargar en vez de "Ver"
    const cacheMes = {};
    async function cargarMes() {
        const clave = `${filtroPortal || 'todos'}:${calAnio}-${calMes}`;
        try { calSes = cacheMes[clave] || (cacheMes[clave] = await sesionesDelMes(filtroPortal, calAnio, calMes)); }
        catch (e) { console.warn('LATAM calendario:', e); calSes = []; }
        if (calAutoHoy) {
            calAutoHoy = false;
            const hoy = diaLocal(new Date().toISOString());
            if (calSes.some(x => diaLocal(x.fecha) === hoy)) calSel = hoy;
        }
        pintarCalendario();
    }
    function pintarCalendario() {
        const cont = document.getElementById('latamCalendario');
        if (!cont) return;
        const porDia = {};
        calSes.forEach(s => { (porDia[diaLocal(s.fecha)] = porDia[diaLocal(s.fecha)] || []).push(s); });
        const first = new Date(calAnio, calMes, 1).getDay(), dias = new Date(calAnio, calMes + 1, 0).getDate();
        let g = '<div class="calendar-day empty"></div>'.repeat(first);
        for (let d = 1; d <= dias; d++) {
            const k = `${calAnio}-${String(calMes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const del = porDia[k] || [];
            const puntos = [...new Set(del.map(s => s.portal))].map(p => `<i style="background:${(POR_ID[p] || {}).color || '#999'}"></i>`).join('');
            g += `<div class="calendar-day${del.length ? ' has-session' : ''}${k === calSel ? ' selected-day' : ''}" data-d="${k}">${d}<span class="cal-puntos">${puntos}</span></div>`;
        }
        const lista = calSel && porDia[calSel] ? porDia[calSel] : calUltimos;
        cont.innerHTML = `
            <div class="calendar-container">
                <div class="calendar-header"><button class="btn-mini" data-nav="-1" aria-label="Mes anterior">&lt;</button><h4>${MES[calMes]} ${calAnio}</h4><button class="btn-mini" data-nav="1" aria-label="Mes siguiente">&gt;</button></div>
                <div class="calendar-weekdays"><div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div></div>
                <div class="calendar-grid">${g}</div>
            </div>
            <h4 class="ses-titulo">${calSel && porDia[calSel] ? (calSel === diaLocal(new Date().toISOString()) ? 'Entrenos de hoy · ' : 'Entrenos del ') + fmtDia(calSel) : 'Últimos entrenos'}${calSel ? ' <button class="btn-mini" data-all="1">Ver todos</button>' : ''}</h4>
            <div class="res-lista">${lista.length ? lista.map(s => {
                const p = POR_ID[s.portal] || { nombre: s.portal, color: '#999', url: '#' };
                const acc = calConDescarga ? descargaSes(s) : `<a class="btn-mini" href="${p.url}">Ver</a>`;
                const sub = calConDescarga ? esc(s.jornada || '') : esc(p.nombre) + (s.jornada ? ' · ' + esc(s.jornada) : '');
                return `<div class="res-row" style="border-left-color:${p.color}">
                    <div><b>${esc(s.titulo)}</b> ${fechaSes(s)}<small>${sub}</small></div>
                    <div class="pg-ses-acc">${acc}</div></div>`;
            }).join('') : '<p class="res-vacio"><i class="fa-solid fa-calendar-xmark"></i>Aún no hay entrenos LATAM registrados.</p>'}</div>`;
    }
    document.addEventListener('click', e => {
        const cont = document.getElementById('latamCalendario');
        if (!cont || !cont.contains(e.target)) return;
        const n = e.target.closest('[data-nav]'), dd = e.target.closest('[data-d]'), a = e.target.closest('[data-all]');
        if (n) {
            calMes += +n.dataset.nav; if (calMes > 11) { calMes = 0; calAnio++; } if (calMes < 0) { calMes = 11; calAnio--; }
            calSel = null; cargarMes(); return;
        }
        if (dd) calSel = dd.classList.contains('has-session') ? dd.dataset.d : null;
        else if (a) calSel = null;
        else return;
        pintarCalendario();
    });

    async function iniciarResultadosPortal(portal) {
        await sumarModulos();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Number(v || 0).toLocaleString('es'); };
        let r;
        try { r = await resumen(portal, true); }
        catch (e) {
            console.warn('Resultados:', e);
            document.querySelectorAll('[data-latam-vacio]').forEach(n => { n.innerHTML = '<tr class="vacio"><td colspan="7"><i class="fa-solid fa-database"></i>Los resultados estarán disponibles pronto.</td></tr>'; });
            return;
        }
        set('statEntrenos', r.stats.entrenos); set('statEquipos', r.stats.equipos);
        set('statMapas', r.stats.mapas); set('statKills', r.stats.kills);

        tituloSemana(r.semana, 'ordenSemana');
        llenarDoble('bodySemanaA', 'bodySemanaB', r.semanaEquipos.slice(0, 50), false);
        llenarDoble('bodyTop100A', 'bodyTop100B', r.historico.slice(0, 100), false);
        montarOrden('ordenSemana', async orden => {
            tituloSemana(r.semana, 'ordenSemana');
            try { llenarDoble('bodySemanaA', 'bodySemanaB', orden === 'pr' ? r.semanaEquipos.slice(0, 50) : await ranking(portal, orden, r.semana, 50, r.semanaEquipos), false); }
            catch (e) { console.warn('Semana:', e); }
        });
        montarOrden('ordenHistorico', async orden => {
            const n = document.getElementById('notaHistorico'); if (n) n.textContent = textoOrden(orden);
            try { llenarDoble('bodyTop100A', 'bodyTop100B', orden === 'pr' ? r.historico : await ranking(portal, orden, null, 100), false); }
            catch (e) { console.warn('Histórico:', e); }
        });

        pintarKillers('gridKillers', r.killers, r.killersKills, false);
        destacados(r.letales, r.activos, r.jugadores, false, undefined, r.topBooyah);

        // Calendario de entrenos de este portal (con Descargar y hoy desplegado)
        filtroPortal = portal; calConDescarga = true; calUltimos = r.ultimos;
        if (r.ultimos.length) { const f0 = diaLocal(r.ultimos[0].fecha); calAnio = +f0.slice(0, 4); calMes = +f0.slice(5, 7) - 1; }
        calSel = null; calAutoHoy = true;
        if (document.getElementById('latamCalendario')) cargarMes();

        // Estadísticas avanzadas (resultados completos): solo si el superadmin las habilitó para este evento y hay datos
        if (document.getElementById('destacados')) {
            P.cargarKit('completos.js').then(async () => {
                if (!window.PumasCompletos || !(await PumasCompletos.habilitado(portal)) || document.getElementById('avanzadas')) return;
                const sec = document.createElement('section');
                sec.id = 'avanzadas'; sec.hidden = true; sec.setAttribute('data-stats-avanzadas', '');
                sec.innerHTML = '<h2 class="section-title">Análisis de entrenos</h2><div class="card-box"><div id="ltAvanzadas"></div></div>';
                document.getElementById('destacados').after(sec);
                await PumasCompletos.montarPublico('ltAvanzadas', portal);
                // Con datos, se agrega "Análisis" al menú, junto a Destacados
                const enlace = document.querySelector('.main-nav a[href="#destacados"]');
                if (!sec.hidden && enlace && !document.querySelector('.main-nav a[href="#avanzadas"]')) {
                    const li = enlace.closest('li').cloneNode(true);
                    const a = li.querySelector('a');
                    a.href = '#avanzadas'; a.textContent = 'Análisis';
                    enlace.closest('li').after(li);
                }
            }).catch(() => { });
        }

        const ul = document.getElementById('listaSesiones');
        if (ul) ul.innerHTML = r.ultimos.length ? r.ultimos.map(s => `<div class="res-row">
                <div><b>${esc(s.titulo)}</b> ${fechaSes(s)}<small>${esc(s.jornada || '')}</small></div>
                <div class="pg-ses-acc">${descargaSes({ ...s, portal: s.portal || portal })}</div></div>`).join('')
            : '<p class="res-vacio"><i class="fa-solid fa-calendar-xmark"></i>Todavía no hay entrenos registrados.</p>';
    }

    window.Latam = { PORTALES, MIN_SALAS, pintarKillers, pintarDestacados: destacados, resumen, historico, cargarDatos, agregarEquipos, agregarKillers, iniciarIndex, iniciarPortal, iniciarResultadosPortal };
})();
