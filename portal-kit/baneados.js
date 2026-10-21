/* =====================================================================
   PROYECTN · Lista de baneados por portal (sql/17)
   PumasBaneados.montarPublico(contId, portal)  → lista pública
   PumasBaneados.montarAdmin(contId, portal)    → agregar / quitar (usuarios del portal)
   PumasBaneados.cargar(portal) + .buscar(nombre, tag) → aviso en la herramienta
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hoy = () => new Date().toISOString().slice(0, 10);
    const vigente = b => !b.hasta || b.hasta >= hoy();
    const fecha = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Indefinido';

    let cache = { portal: null, filas: [] };
    async function cargar(portal) {
        try { cache = { portal, filas: await P.baneados.listar(portal) }; }
        catch (e) { cache = { portal, filas: [], error: e.message }; }
        return cache.filas;
    }
    // ¿El equipo (por nombre o tag) está baneado y vigente?
    function buscar(nombre, tag) {
        const n = norm(nombre), t = norm(tag);
        return cache.filas.find(b => vigente(b) && ((n && norm(b.equipo) === n) || (t && b.tag && norm(b.tag) === t))) || null;
    }

    function tabla(filas, conAcciones) {
        if (!filas.length) return `<p class="res-vacio"><i class="fa-solid fa-shield-halved"></i>No hay equipos baneados.</p>`;
        return `<div class="pg-tabla-wrap"><table class="pg-tabla ban-tabla"><thead><tr><th>#</th><th>Equipo</th><th>Tag</th><th>Motivo</th><th>Hasta</th>${conAcciones ? '<th></th>' : ''}</tr></thead>
            <tbody>${filas.map((b, i) => `<tr class="${vigente(b) ? '' : 'ban-vencido'}">
                <td>${i + 1}</td><td><b>${esc(b.equipo)}</b></td><td>${esc(b.tag || '—')}</td><td>${esc(b.motivo || '—')}</td>
                <td>${vigente(b) ? fecha(b.hasta) : 'Venció ' + fecha(b.hasta)}</td>
                ${conAcciones ? `<td><button class="btn-mini btn-borrar" data-quitar="${b.id}" title="Quitar de la lista"><i class="fa-solid fa-trash"></i></button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    }

    async function montarPublico(contId, portal) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        const filas = (await cargar(portal)).filter(vigente);
        cont.innerHTML = cache.error ? `<p class="res-vacio">${esc(cache.error)}</p>` : tabla(filas, false);
    }

    async function montarAdmin(contId, portal, alCambiar) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        const pintar = async () => {
            const filas = await cargar(portal);
            cont.innerHTML = `
                <form class="form-grid ban-form" id="banForm">
                    <div class="form-group"><label for="banEq">Equipo</label><input id="banEq" required maxlength="60" placeholder="Nombre del equipo"></div>
                    <div class="form-group"><label for="banTag">Tag</label><input id="banTag" maxlength="20" placeholder="Opcional"></div>
                    <div class="form-group"><label for="banMot">Motivo</label><input id="banMot" maxlength="200" placeholder="Ej: hack, no se presentó"></div>
                    <div class="form-group"><label for="banHasta">Hasta (vacío = indefinido)</label><input id="banHasta" type="date"></div>
                    <div class="form-group"><label>&nbsp;</label><button class="btn-access" type="submit" style="width:100%"><i class="fa-solid fa-ban"></i> Banear</button></div>
                </form>
                <p class="muted" id="banMsg" role="status">${cache.error ? esc(cache.error) : filas.length + ' equipos en la lista. Si un baneado aparece en la herramienta, se marca en rojo.'}</p>
                ${tabla(filas, true)}`;
            cont.querySelector('#banForm').addEventListener('submit', async e => {
                e.preventDefault();
                const msg = cont.querySelector('#banMsg');
                msg.textContent = 'Guardando...';
                try {
                    await P.baneados.guardar(portal, {
                        equipo: cont.querySelector('#banEq').value, tag: cont.querySelector('#banTag').value,
                        motivo: cont.querySelector('#banMot').value, hasta: cont.querySelector('#banHasta').value || null
                    });
                    await pintar();
                    if (alCambiar) alCambiar();
                } catch (err) { msg.textContent = err.message; }
            });
            cont.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', async () => {
                const f = filas.find(x => String(x.id) === b.dataset.quitar);
                const ok = await P.confirmar({ titulo: '¿Quitar de baneados?', si: 'Sí, quitar', html: `<p><b>${esc(f.equipo)}</b> vuelve a poder jugar.</p>` });
                if (!ok) return;
                try { await P.baneados.borrar(portal, f.id); await pintar(); if (alCambiar) alCambiar(); }
                catch (err) { cont.querySelector('#banMsg').textContent = err.message; }
            }));
        };
        await pintar();
    }

    window.PumasBaneados = { cargar, buscar, montarPublico, montarAdmin };
})();
