/* Carrusel de logos de los eventos (portal de ascensos), debajo del título.
   Usa los eventos de categorias.js: para agregar uno, súbelo a ascensos/imagenes/ y añádelo allá. */
(function () {
    function montar() {
        const cont = document.getElementById('ascCarrusel');
        if (!cont || !window.ASC_CATEGORIAS) return;
        const eventos = window.ASC_CATEGORIAS.filter(c => c.tipo === 'evento');
        const fila = eventos.map(c => `<li title="${c.nombre}" style="--cat:${c.color}"><img src="${c.logo}" alt="${c.nombre}" loading="lazy" onerror="this.closest('li').remove()"></li>`).join('');
        // la lista va dos veces para que el giro sea continuo; la copia no la leen los lectores de pantalla
        cont.innerHTML = `<ul class="carrusel-pista">${fila}</ul><ul class="carrusel-pista" aria-hidden="true">${fila}</ul>`;
        cont.style.setProperty('--dur', Math.max(20, eventos.length * 3) + 's');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
