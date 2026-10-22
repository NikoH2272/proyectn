/* Login compartido: usuario (sin @) + contraseña.
   El formulario lleva data-portal (opcional) y data-destino (a dónde ir después).
   Seguridad: rate limiting progresivo por portal en localStorage. */
(function () {
    const form = document.getElementById('formLogin');
    const msg = document.getElementById('authMsg');
    const params = new URLSearchParams(location.search);
    const portal = form.dataset.portal || 'default';

    // ── Rate limiting ──────────────────────────────────────────
    const CLAVE_RATE = 'pg_login_rate_' + portal;
    const LIMITES = [
        { intentos: 5,  bloqueoMs: 60_000 },   // 5 fallos  → 1 min
        { intentos: 8,  bloqueoMs: 300_000 },  // 8 fallos  → 5 min
        { intentos: 12, bloqueoMs: 900_000 },  // 12 fallos → 15 min
    ];

    function leerRate() {
        try { return JSON.parse(localStorage.getItem(CLAVE_RATE)) || { fallos: 0, bloqueadoHasta: 0 }; }
        catch { return { fallos: 0, bloqueadoHasta: 0 }; }
    }
    function guardarRate(r) { try { localStorage.setItem(CLAVE_RATE, JSON.stringify(r)); } catch {} }
    function resetRate()    { try { localStorage.removeItem(CLAVE_RATE); } catch {} }

    function bloqueoActual(fallos) {
        let ms = 0;
        for (const l of LIMITES) { if (fallos >= l.intentos) ms = l.bloqueoMs; }
        return ms;
    }

    let timerId = null;
    function verificarBloqueo() {
        const r = leerRate();
        const ahora = Date.now();
        if (r.bloqueadoHasta > ahora) {
            const resto = Math.ceil((r.bloqueadoHasta - ahora) / 1000);
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            msg.textContent = `Demasiados intentos fallidos. Espera ${resto}s antes de intentar de nuevo.`;
            clearTimeout(timerId);
            timerId = setTimeout(verificarBloqueo, 1000);
        } else if (r.bloqueadoHasta > 0) {
            // Bloqueo expiró
            guardarRate({ fallos: r.fallos, bloqueadoHasta: 0 });
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = false;
            msg.textContent = 'Ya puedes intentar de nuevo.';
            clearTimeout(timerId);
        }
    }

    function registrarFallo() {
        const r = leerRate();
        r.fallos = (r.fallos || 0) + 1;
        const ms = bloqueoActual(r.fallos);
        if (ms > 0) r.bloqueadoHasta = Date.now() + ms;
        guardarRate(r);
        verificarBloqueo();
    }

    // Chequea si está bloqueado al cargar
    verificarBloqueo();

    // ── Destino seguro ─────────────────────────────────────────
    function destinoSeguro() {
        const next = params.get('next');
        if (next && next.startsWith('/') && !next.startsWith('//')) return next;
        return form.dataset.destino || '/admin/';
    }

    const destino = destinoSeguro();
    const ruta = destino.split('?')[0];
    const permiso = /\/admin\/(config|inicio)(\.html)?$/.test(ruta) ? 'personalizar'
                  : /\/admin\/(usuarios|modulos|entrenos|ia|exportar)(\.html)?$/.test(ruta) ? 'gestionar' : null;
    const textoPermiso = { personalizar: 'personalizar el sitio', gestionar: 'gestionar usuarios y roles' }[permiso];

    if (params.get('denegado')) {
        msg.textContent = permiso
            ? 'Tu rol no puede ' + textoPermiso + '. Entra con otro usuario.'
            : 'Tu usuario no tiene acceso a este portal. Entra con otro usuario.';
    }

    // ── Submit ─────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = leerRate();
        if (r.bloqueadoHasta > Date.now()) { verificarBloqueo(); return; }

        const usuario = form.usuario.value.trim().toLowerCase();
        const clave = form.clave.value;
        const btn = form.querySelector('button[type="submit"]');
        msg.classList.remove('ok');

        if (usuario.includes('@')) {
            msg.textContent = 'Escribe solo tu usuario (ej. adminpumas), sin @ ni correo.';
            return;
        }
        if (!usuario || !clave) { msg.textContent = 'Completa usuario y contraseña.'; return; }

        btn.disabled = true;
        msg.textContent = 'Verificando...';
        try {
            const s = await PumasPortal.login(usuario, clave);
            if (!s) {
                registrarFallo();
                const rf = leerRate();
                const restantes = Math.max(0, LIMITES[0].intentos - rf.fallos);
                msg.textContent = rf.bloqueadoHasta > Date.now()
                    ? msg.textContent  // ya lo puso verificarBloqueo
                    : `Usuario o contraseña incorrectos.${restantes > 0 ? ' (' + restantes + ' intento(s) restante(s))' : ''}`;
                return;
            }
            if (permiso && !PumasPortal.tiene(s, permiso)) {
                msg.textContent = 'Tu rol no puede ' + textoPermiso + '.';
                return;
            }
            if (portal !== 'default' && !PumasPortal.puede(s, portal)) {
                msg.textContent = 'Tu usuario no tiene acceso a este portal.';
                return;
            }
            // Login exitoso: limpiar intentos fallidos
            resetRate();
            msg.classList.add('ok');
            msg.textContent = 'Bienvenido, ' + (s.nombre || s.usuario) + '.';
            const pidioPagina = params.get('next') || form.dataset.destino !== '/admin/';
            if (!pidioPagina) await PumasPortal.cargarModulos();
            window.location.href = pidioPagina ? destino : PumasPortal.inicioDe(s);
        } catch (err) {
            msg.textContent = 'No se pudo iniciar sesión: ' + err.message;
        } finally {
            if (!leerRate().bloqueadoHasta || leerRate().bloqueadoHasta < Date.now()) btn.disabled = false;
        }
    });
})();
