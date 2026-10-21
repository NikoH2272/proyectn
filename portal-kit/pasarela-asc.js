/* pasarela-asc.js — sección de pasarela de ascensos en portales públicos
   Si el portal tiene asc_activo=true en la DB, inyecta automáticamente una
   sección CTA después del hero que enlaza al portal de ascensos configurado.
   Se carga desde los portales LATAM; si no hay config activa no hace nada. */
(function () {
    'use strict';
    const P = window.PumasPortal;
    if (!P || !P.portal || !P.db) return;

    async function montar() {
        try {
            const { data, error } = await P.db().rpc('portal_ascensos_config', { p_portal: P.portal });
            if (error || !data) return;
            const cfg = typeof data === 'string' ? JSON.parse(data) : data;
            if (!cfg || !cfg.activo) return;
            inyectar(cfg);
        } catch (e) { /* sin pasarela si falla la consulta */ }
    }

    function inyectar(cfg) {
        const ruta = (cfg.asc_ruta || '/ascensos/').replace(/\/?$/, '/');
        const esc = P.escaparHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
        const color = esc(cfg.asc_color || '#B6FF00');
        const nombre = esc(cfg.asc_nombre || 'Ascensos');
        const btn = esc(cfg.btn || 'Apartar cupo');

        const sec = document.createElement('section');
        sec.id = 'pasarela-asc';
        sec.className = 'pasarela-asc';
        sec.style.setProperty('--asc-c', color);
        sec.innerHTML = `
            <div class="card-box pasarela-asc-inner">
                <div class="pasarela-asc-icon" aria-hidden="true"><i class="fa-solid fa-crown"></i></div>
                <div class="pasarela-asc-copy">
                    <div class="eyebrow">Ascensos activos</div>
                    <h2>${nombre}</h2>
                    <p>Compite en los ascensos oficiales e inscríbete para la próxima jornada.</p>
                </div>
                <div class="pasarela-asc-cta">
                    <a class="btn-access" href="${ruta}cupos.html">
                        <i class="fa-solid fa-ticket"></i> ${btn}
                    </a>
                    <a class="btn-access btn-outline" href="${ruta}">
                        <i class="fa-solid fa-trophy"></i> Ver resultados
                    </a>
                </div>
            </div>`;

        // Insertar justo después del hero; si no hay hero, antes de la primera sección
        const hero = document.querySelector('.portal-hero');
        if (hero) {
            hero.after(sec);
        } else {
            const primera = document.querySelector('section');
            if (primera) primera.before(sec);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montar);
    } else {
        montar();
    }
})();
