/* Login compartido: usuario (sin @) + contraseña.
   El formulario lleva data-portal (opcional) y data-destino (a dónde ir después). */
(function () {
    const form = document.getElementById('formLogin');
    const msg = document.getElementById('authMsg');
    const params = new URLSearchParams(location.search);
    const portal = form.dataset.portal || null;

    // Solo se permite volver a rutas internas del sitio
    function destinoSeguro() {
        const next = params.get('next');
        if (next && next.startsWith('/') && !next.startsWith('//')) return next;
        return form.dataset.destino || '/admin/';
    }

    const destino = destinoSeguro();
    // Páginas que piden un permiso especial del rol
    const ruta = destino.split('?')[0];
    const permiso = /\/admin\/(config|inicio)(\.html)?$/.test(ruta) ? 'personalizar'
                  : /\/admin\/(usuarios|modulos|entrenos|ia|exportar)(\.html)?$/.test(ruta) ? 'gestionar' : null;
    const textoPermiso = { personalizar: 'personalizar el sitio', gestionar: 'gestionar usuarios y roles' }[permiso];

    if (params.get('denegado')) {
        msg.textContent = permiso
            ? 'Tu rol no puede ' + textoPermiso + '. Entra con otro usuario.'
            : 'Tu usuario no tiene acceso a este portal. Entra con otro usuario.';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
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
            if (!s) { msg.textContent = 'Usuario o contraseña incorrectos.'; return; }
            if (permiso && !PumasPortal.tiene(s, permiso)) {
                msg.textContent = 'Tu rol no puede ' + textoPermiso + '.';
                return;
            }
            if (portal && !PumasPortal.puede(s, portal)) {
                msg.textContent = 'Tu usuario no tiene acceso a este portal.';
                return;
            }
            msg.classList.add('ok');
            msg.textContent = 'Bienvenido, ' + (s.nombre || s.usuario) + '.';
            // Sin página pedida (?next=) el panel general manda a cada uno a su inicio según su rol
            const pidioPagina = params.get('next') || form.dataset.destino !== '/admin/';
            if (!pidioPagina) await PumasPortal.cargarModulos();   // los módulos del panel también tienen su herramienta
            window.location.href = pidioPagina ? destino : PumasPortal.inicioDe(s);
        } catch (err) {
            msg.textContent = 'No se pudo iniciar sesión: ' + err.message;
        } finally {
            btn.disabled = false;
        }
    });
})();
