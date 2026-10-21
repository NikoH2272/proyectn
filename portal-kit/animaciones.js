// portal-kit/animaciones.js — scroll reveal + contadores animados
// Cargado por portal.js solo cuando prefers-reduced-motion: no-preference
(function () {
    'use strict';

    // ── 1. Scroll reveal (IntersectionObserver) ──────────────────────
    // Agrega .pg-reveal a secciones y cards; cuando entran en viewport
    // agrega .pg-visible para que la transición CSS las haga aparecer.
    function montarReveal() {
        if (!window.IntersectionObserver) return;

        const obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('pg-visible');
                obs.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -56px 0px', threshold: 0.06 });

        // Secciones (excepto el hero que ya tiene animación CSS propia)
        document.querySelectorAll('section:not(.portal-hero)').forEach(function (el) {
            el.classList.add('pg-reveal');
            obs.observe(el);
        });

        // Cards dentro de grids escalonadas
        document.querySelectorAll('.semana-grid > *, .res-grid > *, .dest-grid > *, .killers-doble > *').forEach(function (el, i) {
            el.classList.add('pg-reveal');
            if (i % 3 === 1) el.classList.add('pg-d1');
            if (i % 3 === 2) el.classList.add('pg-d2');
            obs.observe(el);
        });

        // section-title para el efecto de subrayado desktop
        document.querySelectorAll('.section-title').forEach(function (el) {
            obs.observe(el);
        });
    }

    // ── 2. Contador animado para .stat-row b ─────────────────────────
    // Observa cambios en el texto; cuando el valor pasa de 0 a N,
    // anima el número y dispara un pequeño "pop" visual.
    function montarContadores() {
        var els = document.querySelectorAll('.stat-row b');
        if (!els.length) return;

        var contando = new Set();

        var mo = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                var el = m.target;
                if (contando.has(el)) return;
                var fin = parseInt((el.textContent || '').replace(/\D/g, ''), 10);
                if (!fin) return;
                contando.add(el);
                var idx = Array.prototype.indexOf.call(els, el);
                setTimeout(function () { contarHasta(el, fin); }, idx * 130);
            });
        });

        els.forEach(function (el) {
            mo.observe(el, { childList: true, characterData: true, subtree: true });
        });
    }

    function contarHasta(el, fin) {
        var dur    = 1300;
        var inicio = performance.now();
        var fmt    = typeof Intl !== 'undefined' ? new Intl.NumberFormat('es') : null;

        function fmt_num(n) { return fmt ? fmt.format(n) : n.toLocaleString(); }

        function tick(ahora) {
            var t    = Math.min((ahora - inicio) / dur, 1);
            var ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
            el.textContent = fmt_num(Math.round(ease * fin));
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = fmt_num(fin);
                el.classList.remove('pg-stat-pop');
                // fuerza reflow para reiniciar la animación CSS
                void el.offsetWidth;
                el.classList.add('pg-stat-pop');
            }
        }
        requestAnimationFrame(tick);
    }

    // ── 3. Nav compacta al hacer scroll ──────────────────────────────
    // El header agrega .nav-scrolled cuando se baja 60px para añadir
    // sombra y un blur de fondo extra.
    function montarNavScroll() {
        var header = document.querySelector('.site-header');
        if (!header) return;
        var ticking = false;
        function actualizar() {
            header.classList.toggle('nav-scrolled', window.scrollY > 60);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { requestAnimationFrame(actualizar); ticking = true; }
        }, { passive: true });
        actualizar();
    }

    // Arrancar todo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        montarReveal();
        montarContadores();
        montarNavScroll();
    }
})();
