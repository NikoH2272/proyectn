/* =====================================================================
   Módulos creados desde el panel (/modulo/?p=<id>)
   Pinta la página con el nombre, título, colores y logo guardados en la
   base (tabla portales). Los enlaces internos llevan siempre ?p=<id>.
   window.moduloListo → Promise con los datos del módulo (o null).
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;
    const params = new URLSearchParams(location.search);
    // En el login el módulo puede venir dentro de ?next=/modulo/admin.html?p=<id>
    let id = P.portal;
    if (!id && params.get('next')) {
        const m = /[?&]p=([a-z0-9_]+)/.exec(params.get('next'));
        if (m) id = m[1];
    }
    const LOGO_PUMAS = '/imagenes/proyectn.png';

    window.moduloListo = (async () => {
        const m = id ? await P.datosPortal(id) : null;
        document.querySelectorAll('[data-mod-href]').forEach(a => { a.href = a.dataset.modHref + (id ? '?p=' + encodeURIComponent(id) : ''); });
        if (!m || m.tipo !== 'modulo' || m.activo === false) {
            const main = document.querySelector('[data-mod-cuerpo]') || document.body;
            main.innerHTML = `<section><h2 class="section-title">Módulo no encontrado</h2>
                <p class="tool-desc">Este módulo no existe o está desactivado. <a href="/">Volver a PROYECTN</a></p></section>`;
            document.documentElement.classList.remove('pg-verificando');
            return null;
        }
        const titulo = m.titulo || m.nombre;
        const palabras = titulo.trim().split(/\s+/);
        const a = palabras.length > 1 ? palabras.slice(0, -1).join(' ') : titulo, b = palabras.length > 1 ? palabras[palabras.length - 1] : '';
        P.aplicarColores(document.body, m.color_tema || m.color, m.color2);
        document.querySelectorAll('[data-mod-logo]').forEach(img => {
            img.onerror = () => { img.onerror = null; img.src = LOGO_PUMAS; };
            img.src = m.logo || LOGO_PUMAS;
        });
        const ico = document.querySelector('link[rel~="icon"]');
        if (ico) ico.href = m.logo || LOGO_PUMAS;
        document.querySelectorAll('[data-mod-titulo]').forEach(n => {
            n.innerHTML = `<span class="t-a">${esc(a)}</span>${b ? ' <span class="t-b">' + esc(b) + '</span>' : ''}`;
        });
        document.querySelectorAll('[data-mod-nombre]').forEach(n => { n.textContent = m.nombre; });
        document.querySelectorAll('[data-mod-subtitulo]').forEach(n => { if (m.subtitulo) n.textContent = m.subtitulo; });
        document.querySelectorAll('.portal-hero').forEach(h => { h.dataset.marca = titulo.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase(); });
        document.querySelectorAll('[data-mod-link]').forEach(n => {
            if (m.link) { n.href = m.link; n.hidden = false; } else n.hidden = true;
        });
        document.title = document.title.replace('{MODULO}', titulo);
        return m;
    })();
})();
