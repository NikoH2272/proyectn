/* =====================================================================
   ASCENSOS · Portal público (AZA y Pruebas)
   - Calendario: qué ascensos se hicieron cada día (toca un día para verlos)
   - Jornadas compactas (top 5 + ascendidos; la tabla completa se despliega)
   - Equipos y eventos: en qué eventos jugó cada equipo, ascensos y total
   - Baneados y cupos
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const PORTAL = P.portal;
    const CAT = window.ASC_CATEGORIA;
    const $ = id => document.getElementById(id);
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ZONA = 'America/Mexico_City';   // los horarios de los ascensos son hora México
    const diaDe = iso => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(iso));   // "2026-10-09"
    const fechaCorta = iso => new Date(iso).toLocaleDateString('es', { timeZone: ZONA, weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const logoChip = c => c.logo ? `<img src="${c.logo}" alt="">` : '';
    const chip = id => { const c = CAT(id); return `<span class="cat-chip${c.logo ? ' con-logo' : ''}" style="--cat:${c.color}">${logoChip(c)}${esc(c.nombre)}</span>`; };

    const MOVIL = matchMedia('(max-width: 640px)').matches;   // en el celular se muestra menos de entrada (menos scroll)
    const POR_PAGINA_JORNADAS = MOVIL ? 3 : 4, POR_PAGINA_EQUIPOS = MOVIL ? 10 : 15;
    let jornadas = [];
    let filtro = 'todas';      // evento
    let dia = null;            // día elegido en el calendario ("2026-10-09")
    let cuantasJornadas = POR_PAGINA_JORNADAS;
    let cuantosEquipos = POR_PAGINA_EQUIPOS;
    let busqueda = '';
    let mes = null;            // { anio, mes } que muestra el calendario

    /* ---------------- Filtro por evento ---------------- */
    function pintarFiltro() {
        const usadas = [...new Set(jornadas.map(j => j.categoria))];
        const cats = window.ASC_CATEGORIAS.filter(c => usadas.includes(c.id)).concat(usadas.filter(u => !window.ASC_CATEGORIAS.some(c => c.id === u)).map(CAT));
        $('ascFiltro').innerHTML = `<button class="${filtro === 'todas' ? 'on' : ''}" data-c="todas">Todos</button>` +
            cats.map(c => `<button class="${filtro === c.id ? 'on' : ''}" data-c="${esc(c.id)}" style="--c:${c.color}">${logoChip(c)}${esc(c.nombre)}</button>`).join('');
    }
    const delEvento = () => filtro === 'todas' ? jornadas : jornadas.filter(j => j.categoria === filtro);
    const visibles = () => dia ? delEvento().filter(j => diaDe(j.fecha) === dia) : delEvento();

    function pintarStats() {
        const lista = delEvento();
        const eqs = new Set();
        lista.forEach(j => (j.equipos || []).forEach(e => eqs.add(norm(e.n))));
        $('statJornadas').textContent = lista.length;
        $('statEquipos').textContent = eqs.size;
        $('statAscensos').textContent = lista.reduce((a, j) => a + (j.clasificados || []).length, 0);
        $('statCategorias').textContent = new Set(lista.map(j => j.categoria)).size;
    }

    /* ---------------- Calendario ---------------- */
    function pintarCalendario() {
        const cont = $('ascCalendario');
        if (!cont) return;
        const porDia = {};
        delEvento().forEach(j => { (porDia[diaDe(j.fecha)] = porDia[diaDe(j.fecha)] || []).push(j); });
        const { anio, mes: m } = mes;
        const primero = new Date(anio, m, 1), dias = new Date(anio, m + 1, 0).getDate();
        const blancos = (primero.getDay() + 6) % 7;   // la semana empieza el lunes
        const hoy = diaDe(new Date().toISOString());
        const delMes = Object.keys(porDia).filter(d => d.startsWith(`${anio}-${String(m + 1).padStart(2, '0')}`));
        let celdas = '';
        for (let i = 0; i < blancos; i++) celdas += '<span class="cal-v"></span>';
        for (let d = 1; d <= dias; d++) {
            const clave = `${anio}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const js = porDia[clave] || [];
            const puntos = [...new Set(js.map(j => j.categoria))].slice(0, 3).map(c => `<i style="background:${CAT(c).color}"></i>`).join('');
            celdas += js.length
                ? `<button class="cal-d con${clave === dia ? ' sel' : ''}${clave === hoy ? ' hoy' : ''}" data-dia="${clave}" title="${js.length} ascenso(s)"><b>${d}</b><span class="cal-p">${puntos}</span>${js.length > 1 ? `<em>${js.length}</em>` : ''}</button>`
                : `<span class="cal-d${clave === hoy ? ' hoy' : ''}"><b>${d}</b></span>`;
        }
        const total = delMes.reduce((a, d) => a + porDia[d].length, 0);
        cont.innerHTML = `
            <div class="cal-nav"><button data-mes="-1" aria-label="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>
                <b>${MESES[m]} ${anio}</b><button data-mes="1" aria-label="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button></div>
            <div class="cal-sem"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div class="cal-grid">${celdas}</div>
            <p class="cal-pie">${total ? `<b>${total}</b> ascenso(s) en ${delMes.length} día(s) este mes. Toca un día para verlos.` : 'Sin ascensos este mes.'}</p>`;
    }

    /* ---------------- Jornadas ---------------- */
    function tarjetaJornada(j) {
        const c = CAT(j.categoria);
        const sube = new Set((j.clasificados || []).map(x => norm(x.n)));
        const filas = (j.equipos || []).slice().sort((a, b) => b.total - a.total);
        const fila = (e, i) => `<tr class="${sube.has(norm(e.n)) ? 'sube' : ''}"><td>${i + 1}</td><td title="${esc(e.n)}">${sube.has(norm(e.n)) ? '👑 ' : ''}${esc(e.n)}</td><td>${esc(e.t || '')}</td><td><b>${e.total}</b></td></tr>`;
        const cab = `<thead><tr><th>#</th><th>EQUIPO</th><th>TAG</th><th>TOTAL</th></tr></thead>`;
        return `<article class="card-box jornada-card" style="--cat:${c.color}">
            <div class="jornada-head">
                ${c.logo ? `<img class="jornada-logo" src="${c.logo}" alt="">` : ''}
                <div><b class="jornada-ev" style="color:${c.color}">${esc(c.nombre)}</b><h3>${esc(j.titulo)}</h3>
                    <small>${fechaCorta(j.fecha)}${j.horario ? ' · ' + esc(j.horario) : ''}${j.moderador ? ' · Mod: ' + esc(j.moderador) : ''}</small></div>
            </div>
            <table>${cab}<tbody>${filas.slice(0, 5).map(fila).join('')}</tbody></table>
            ${filas.length > 5 ? `<details><summary>Ver tabla completa (${filas.length} equipos)</summary><table><tbody>${filas.slice(5).map((e, i) => fila(e, i + 5)).join('')}</tbody></table></details>` : ''}
            <div class="clasif">${(j.clasificados || []).length ? j.clasificados.map(x => `<span>👑 ${esc(x.n)} · ${x.pts}</span>`).join('') : '<small class="muted">Sin ascenso directo</small>'}</div>
        </article>`;
    }

    function pintarJornadas() {
        const lista = visibles();
        const cont = $('ascJornadas'), mas = $('ascVerMas'), aviso = $('ascDia');
        if (dia) {
            aviso.hidden = false;
            aviso.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${new Date(dia + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                · ${lista.length} ascenso(s) <button class="btn-mini" data-quitar-dia>Ver todos</button>`;
        } else aviso.hidden = true;
        if (!lista.length) { cont.innerHTML = `<p class="res-vacio"><i class="fa-regular fa-calendar"></i>Todavía no hay jornadas publicadas.</p>`; mas.hidden = true; return; }
        cont.innerHTML = lista.slice(0, cuantasJornadas).map(tarjetaJornada).join('');
        mas.hidden = lista.length <= cuantasJornadas;
        mas.textContent = `Ver más jornadas (${lista.length - cuantasJornadas} más)`;
    }

    /* ---------------- Equipos y eventos ---------------- */
    function equiposAgrupados() {
        const mapa = new Map();
        delEvento().forEach(j => {
            const sube = new Set((j.clasificados || []).map(x => norm(x.n)));
            (j.equipos || []).forEach(e => {
                const key = norm(e.n);
                if (!key) return;
                const r = mapa.get(key) || { n: e.n, t: e.t, jornadas: 0, ascensos: 0, total: 0, cats: {} };
                r.jornadas++; r.total += e.total || 0;
                if (sube.has(key)) r.ascensos++;
                r.cats[j.categoria] = (r.cats[j.categoria] || 0) + 1;
                if (e.t) r.t = e.t;
                mapa.set(key, r);
            });
        });
        return [...mapa.values()].sort((a, b) => b.ascensos - a.ascensos || b.total - a.total);
    }

    function pintarEquipos() {
        const todos = equiposAgrupados();
        todos.forEach((r, i) => { r.pos = i + 1; });
        const q = norm(busqueda);
        const lista = q ? todos.filter(r => norm(r.n).includes(q) || norm(r.t).includes(q)) : todos;
        const cont = $('ascEquipos'), mas = $('ascVerEquipos');
        if (!lista.length) { cont.innerHTML = `<p class="res-vacio">${todos.length ? 'Ningún equipo coincide con la búsqueda.' : 'Sin equipos todavía.'}</p>`; mas.hidden = true; return; }
        const eventos = r => Object.entries(r.cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => {
            const x = CAT(c);
            return `<span class="ev-ico" style="--cat:${x.color}" title="${esc(x.nombre)}: ${n} jornada(s)">${x.logo ? `<img src="${x.logo}" alt="${esc(x.nombre)}">` : `<i></i>`}${n > 1 ? `<em>${n}</em>` : ''}</span>`;
        }).join('');
        cont.innerHTML = `<div class="asc-eq-cab"><span>#</span><span>Equipo</span><span>Jorn.</span><span>👑</span><span>Total</span><span>Eventos</span></div>` +
            lista.slice(0, cuantosEquipos).map(r => `
            <div class="asc-eq-fila${r.pos <= 3 ? ' top' + r.pos : ''}">
                <span class="e-pos">${r.pos}</span>
                <span class="e-nom"><b>${esc(r.n)}</b>${r.t ? `<small>${esc(r.t)}</small>` : ''}</span>
                <span class="e-num" data-l="Jornadas">${r.jornadas}</span>
                <span class="e-num e-asc" data-l="Ascensos">${r.ascensos || '—'}</span>
                <span class="e-num e-tot" data-l="Total">${r.total}</span>
                <span class="e-evs">${eventos(r)}</span>
            </div>`).join('');
        mas.hidden = lista.length <= cuantosEquipos;
        mas.textContent = `Ver más equipos (${lista.length - cuantosEquipos} más)`;
    }

    function pintarTodo() { pintarFiltro(); pintarStats(); pintarCalendario(); pintarJornadas(); pintarEquipos(); }

    async function cupos() {
        const n = $('ascCuposInfo');
        if (!n) return;
        try {
            const l = await P.cupos.publicos(PORTAL);
            n.textContent = l.length ? `Hay ${l.length} jornada(s) con cupos abiertos.` : 'Por ahora no hay cupos abiertos. Vuelve pronto.';
        } catch (e) { n.textContent = 'Revisa los cupos disponibles para las próximas jornadas.'; }
    }

    function enlazar() {
        $('ascFiltro').addEventListener('click', e => {
            const b = e.target.closest('[data-c]');
            if (!b) return;
            filtro = b.dataset.c; dia = null; cuantasJornadas = POR_PAGINA_JORNADAS; cuantosEquipos = POR_PAGINA_EQUIPOS;
            pintarTodo();
        });
        $('ascCalendario').addEventListener('click', e => {
            const nav = e.target.closest('[data-mes]');
            if (nav) {
                const d = new Date(mes.anio, mes.mes + Number(nav.dataset.mes), 1);
                mes = { anio: d.getFullYear(), mes: d.getMonth() };
                pintarCalendario();
                return;
            }
            const b = e.target.closest('[data-dia]');
            if (!b) return;
            dia = dia === b.dataset.dia ? null : b.dataset.dia;
            cuantasJornadas = POR_PAGINA_JORNADAS;
            pintarCalendario(); pintarJornadas();
            if (dia && matchMedia('(max-width: 900px)').matches) $('ascDia').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        $('ascDia').addEventListener('click', e => {
            if (!e.target.closest('[data-quitar-dia]')) return;
            dia = null; pintarCalendario(); pintarJornadas();
        });
        $('ascVerMas').addEventListener('click', () => { cuantasJornadas += POR_PAGINA_JORNADAS * 2; pintarJornadas(); });
        $('ascVerEquipos').addEventListener('click', () => { cuantosEquipos += POR_PAGINA_EQUIPOS * 2; pintarEquipos(); });
        let t = null;
        $('ascBuscar').addEventListener('input', e => {
            clearTimeout(t);
            t = setTimeout(() => { busqueda = e.target.value; cuantosEquipos = POR_PAGINA_EQUIPOS; pintarEquipos(); }, 200);
        });
    }

    async function iniciar() {
        enlazar();
        try { jornadas = await P.ascensos.jornadas(PORTAL, 300); }
        catch (e) { $('ascJornadas').innerHTML = `<p class="res-vacio">${esc(e.message)}</p>`; jornadas = []; }
        // El calendario abre en el mes del último ascenso (o el actual)
        const ref = jornadas[0] ? new Date(diaDe(jornadas[0].fecha) + 'T12:00:00') : new Date();
        mes = { anio: ref.getFullYear(), mes: ref.getMonth() };
        pintarTodo();
        if (window.PumasBaneados) PumasBaneados.montarPublico('ascBaneados', PORTAL);
        cupos();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
