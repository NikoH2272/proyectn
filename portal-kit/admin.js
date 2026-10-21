/* Personalización: efecto GLOBAL que sale en todas las páginas del sitio.
   Solo roles con permiso "personalizar". Necesita <main id="adminPortal">
   y portal.js cargado antes. */
(function () {
    const raiz = document.getElementById('adminPortal');
    const loginUrl = raiz.dataset.login || 'login.html';
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    document.documentElement.classList.add('pg-verificando');

    let efecto = null;
    let pendiente = false;

    // Emojis para el efecto "Iconos cayendo": un toque agrega el emoji, los combos reemplazan todo
    const EMOJIS = {
        'Free Fire y gaming': '🔥 🎮 🕹️ 🎯 💥 🔫 🪂 🏹 🗡️ ⚔️ 🛡️ 💣 🧨 🚁 🏍️ 🚙 💀 ☠️ 👾 🤖',
        'Premios y victoria': '🏆 🥇 🥈 🥉 🏅 🎖️ 👑 💎 💰 💸 🪙 ⭐ 🌟 ✨ 💫 ⚡ 🚀 📈 ✅ 💯',
        'Fiesta': '🎉 🎊 🥳 🎈 🎁 🎂 🍾 🥂 🪅 🎆 🎇 🪩 🎶 🎵 📣',
        'Amor y amistad': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💘 💝 💕 🌹 🤝 🫶',
        'Animales': '🐆 🐯 🦁 🐺 🦅 🐉 🐲 🦈 🐍 🦂 🐝 🦋 🐾 🦊 🐻',
        'Naturaleza y clima': '❄️ ☃️ 🌨️ 💧 🌧️ ⛈️ 🌈 ☀️ 🌙 🍂 🍁 🌸 🌺 🌻 🍀',
        'Fechas especiales': '🎃 👻 🦇 🕸️ 🕷️ 🎄 🎅 🤶 🦌 🔔 🕯️ 🐣 🐰 🥚 🇲🇽 🇨🇴 🇦🇷 🇵🇪 🇨🇱 🇪🇨',
        'Deportes': '⚽ 🏀 🏈 ⚾ 🎾 🏐 🥊 🏁 🚩 🎳'
    };
    const COMBOS = [
        ['🔥 Fuego', '🔥 💥 ⚡'], ['🏆 Campeones', '🏆 👑 🥇 ⭐'], ['🎉 Fiesta', '🎉 🎊 🥳 🎈'], ['💸 Premios', '💰 💸 💎 🪙'],
        ['❤️ Amor', '❤️ 💖 💕 🌹'], ['🎄 Navidad', '🎄 🎅 🎁 ❄️ 🔔'], ['🎃 Halloween', '🎃 👻 🦇 🕸️'], ['🐆 Pumas', '🐆 🐾 👑 🔥'],
        ['🎮 Gaming', '🎮 🕹️ 🎯 👾'], ['🌸 Primavera', '🌸 🌺 🌻 🦋'], ['🍂 Otoño', '🍂 🍁 🍄'], ['🇲🇽 México', '🇲🇽 🌮 🎉'], ['🇨🇴 Colombia', '🇨🇴 ☕ ⚽']
    ];

    async function arrancar() {
        const sesion = await P.guard('principal', loginUrl, 'personalizar');
        if (!sesion) return;

        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = sesion.nombre || sesion.usuario; });
        document.querySelectorAll('[data-pg-salir]').forEach(n => n.addEventListener('click', e => { e.preventDefault(); P.logout(loginUrl); }));

        efecto = await P.cargarEfecto();
        pintar();
        P.aplicarEfecto(efecto);
    }

    function pintar() {
        const opciones = Object.entries(P.EFECTOS).map(([k, e]) => `
            <label><input type="radio" name="efecto" value="${k}" ${efecto.efecto === k ? 'checked' : ''}>
                <span>${k === 'ninguno' ? '✕' : k === 'iconos' ? '✨' : e.icono}</span>${esc(e.nombre)}</label>`).join('');

        raiz.innerHTML = `
        <article class="card-box" style="max-width:760px">
            <h3 class="subtitulo-bloque"><i class="fa-solid fa-wand-magic-sparkles"></i> Efecto en todas las páginas</h3>
            <p class="muted">Lo que elijas aquí sale en el inicio, entrenamientos y todos los portales.</p>
            <div class="efecto-opciones">${opciones}</div>
            <div class="form-group" id="grupoIcono">
                <label for="efIcono">Icono(s) que caen</label>
                <input id="efIcono" type="text" value="${esc(efecto.efecto_icono || '🔥')}" placeholder="🔥 ⭐ 🏆  o  fa-crown fa-skull">
                <p class="muted">Emojis o iconos de Font Awesome separados por espacio. Se elige uno al azar por partícula.</p>
                <label style="margin-top:14px">Combos rápidos</label>
                <div class="emoji-presets">${COMBOS.map(([n, e]) => `<button type="button" data-combo="${esc(e)}">${esc(n)}</button>`).join('')}
                    <button type="button" data-combo="">✕ Vaciar</button></div>
                <label>Toca para agregar</label>
                <div class="emoji-grupos">${Object.entries(EMOJIS).map(([g, l]) => `<div class="emoji-grupo"><b>${esc(g)}</b>
                    <div class="emoji-fila">${l.split(' ').map(x => `<button type="button" data-emoji="${esc(x)}" title="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`).join('')}</div>
            </div>
            <div class="form-group">
                <label for="efCantidad">Cantidad: <b id="efCantidadTxt">${efecto.efecto_cantidad}</b></label>
                <input id="efCantidad" type="range" min="5" max="120" step="5" value="${efecto.efecto_cantidad}">
            </div>
            <div class="barra-guardar" style="margin-top:8px">
                <span id="estadoGuardar" class="muted" role="status">La vista previa se ve en esta misma página.</span>
                <button class="btn-access" id="btnGuardar"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
            </div>
        </article>`;

        actualizarVisibilidadIcono();
        raiz.querySelectorAll('input[name="efecto"]').forEach(r => r.addEventListener('change', () => {
            efecto.efecto = r.value; actualizarVisibilidadIcono(); vistaPrevia();
        }));
        const icono = raiz.querySelector('#efIcono');
        icono.addEventListener('input', () => { efecto.efecto_icono = icono.value.trim() || '🔥'; vistaPrevia(); });
        // Paleta: agrega emojis (máx. 60 caracteres, lo que guarda la base) o pone un combo completo
        const ponerIconos = texto => {
            let t = texto.trim();
            while (t.length > 60) t = t.split(' ').slice(0, -1).join(' ');
            icono.value = t;
            efecto.efecto_icono = t || '🔥';
            vistaPrevia();
        };
        raiz.querySelectorAll('[data-emoji]').forEach(b => b.addEventListener('click', () => {
            const actuales = icono.value.split(/\s+/).filter(Boolean);
            if (!actuales.includes(b.dataset.emoji)) ponerIconos(actuales.concat(b.dataset.emoji).join(' '));
        }));
        raiz.querySelectorAll('[data-combo]').forEach(b => b.addEventListener('click', () => ponerIconos(b.dataset.combo)));
        const cant = raiz.querySelector('#efCantidad');
        cant.addEventListener('input', () => {
            efecto.efecto_cantidad = Number(cant.value);
            raiz.querySelector('#efCantidadTxt').textContent = cant.value;
            vistaPrevia();
        });
        raiz.querySelector('#btnGuardar').addEventListener('click', guardar);
    }

    let tPrevia = null;
    function vistaPrevia() {
        clearTimeout(tPrevia);
        tPrevia = setTimeout(() => P.aplicarEfecto(efecto), 250);
        pendiente = true;
        avisar('Cambios sin guardar');
    }
    function avisar(t) { raiz.querySelector('#estadoGuardar').textContent = t; }
    function actualizarVisibilidadIcono() { raiz.querySelector('#grupoIcono').hidden = efecto.efecto !== 'iconos'; }

    async function guardar() {
        if (!pendiente) { avisar('No hay cambios por guardar.'); return; }
        const btn = raiz.querySelector('#btnGuardar');
        btn.disabled = true;
        avisar('Guardando...');
        try {
            await P.guardarEfecto(efecto);
            pendiente = false;
            avisar('✔ Guardado. Ya se ve en todo el sitio.');
        } catch (err) {
            avisar('Error: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
})();
