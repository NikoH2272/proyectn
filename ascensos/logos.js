/* Carrusel de logos de los equipos activos (portal de ascensos).
   Espera el evento 'asc:activos' de publico.js con los IDs activos del DB.
   Si el evento tarda más de 3s o no llega, muestra todos los eventos como fallback. */
(function () {
    const CAT = () => window.ASC_CATEGORIA;

    function montar(activos) {
        const cont = document.getElementById('ascCarrusel');
        if (!cont || !window.ASC_CATEGORIAS || !window.ASC_CATEGORIA) return;
        const getCAT = window.ASC_CATEGORIA;
        let items;
        if (activos && activos.length) {
            items = activos.map(id => getCAT(id)).filter(c => c && c.logo);
        } else {
            items = window.ASC_CATEGORIAS.filter(c => c.tipo === 'evento' && c.logo);
        }
        if (!items.length) return;
        const li = c => `<li title="${c.nombre}" style="--cat:${c.color}"><img src="${c.logo}" alt="${c.nombre}" loading="lazy" onerror="this.closest('li').remove()"></li>`;
        const fila = items.map(li).join('');
        cont.innerHTML = `<ul class="carrusel-pista">${fila}</ul><ul class="carrusel-pista" aria-hidden="true">${fila}</ul>`;
        cont.style.setProperty('--dur', Math.max(20, items.length * 3) + 's');
    }

    let montado = false;
    function montarUnaVez(activos) {
        if (montado) return;
        montado = true;
        montar(activos);
    }

    // Escuchar el evento de publico.js
    document.addEventListener('asc:activos', e => {
        montarUnaVez(e.detail.activos);
    }, { once: true });

    // Fallback: si el evento no llega en 3s, mostrar todos
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => montarUnaVez(null), 3000));
    } else {
        setTimeout(() => montarUnaVez(null), 3000);
    }
})();
