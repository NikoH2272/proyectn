/* =====================================================================
   PROYECTN · Dinámicas por portal (sql/33)
   - montarRegistro(portal, destino?): formulario de registro de equipos
   - montarEncuesta(portal, destino?): encuesta con temporizador
   - montarJuego(portal, destino?):    leaderboard público del juego
   - montar(portal, destino?):         detecta y monta la dinámica activa

   portal.js lo carga cuando hay <div id="pgDinamica"> en la página.
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    /* ── Google reCAPTCHA v2 ─────────────────────────────────────────── */
    const RECAPTCHA_SITEKEY = '6LeoIPMtAAAAAM0JAjDB06LOwAntrFH-ckrOuLyz';
    let _rcWidgetId = null;          // widget del componente legado (montarEncuesta)
    const _rcWidgets = {};           // mapa containerId → widgetId (montarEncuestas multi)

    function _cargarScriptRecaptcha() {
        if (document.getElementById('pg-rc-script')) return;
        window.pgdRcOnload = function () {
            // legado — contenedor fijo
            const leg = document.getElementById('pgdRecaptcha');
            if (leg && !leg.dataset.rcR) {
                _rcWidgetId = grecaptcha.render(leg, { sitekey: RECAPTCHA_SITEKEY, theme: 'dark' });
                leg.dataset.rcR = '1';
            }
            // multi-enc — cualquier contenedor con data-rc-pending
            document.querySelectorAll('[data-rc-pending]').forEach(e => {
                _rcWidgets[e.id] = grecaptcha.render(e, { sitekey: RECAPTCHA_SITEKEY, theme: 'dark' });
                delete e.dataset.rcPending;
            });
        };
        const s = document.createElement('script');
        s.id = 'pg-rc-script';
        s.src = 'https://www.google.com/recaptcha/api.js?onload=pgdRcOnload&render=explicit';
        s.async = true;
        document.head.appendChild(s);
    }

    function cargarRecaptcha() {
        if (!RECAPTCHA_SITEKEY) return;
        const el = document.getElementById('pgdRecaptcha');
        if (!el) return;
        _rcWidgetId = null;
        if (window.grecaptcha && grecaptcha.render) {
            _rcWidgetId = grecaptcha.render(el, { sitekey: RECAPTCHA_SITEKEY, theme: 'dark' });
        } else { _cargarScriptRecaptcha(); }
    }

    function cargarRecaptchaPara(containerId) {
        if (!RECAPTCHA_SITEKEY) return;
        const el = document.getElementById(containerId);
        if (!el) return;
        if (window.grecaptcha && grecaptcha.render) {
            _rcWidgets[containerId] = grecaptcha.render(el, { sitekey: RECAPTCHA_SITEKEY, theme: 'dark' });
        } else { el.dataset.rcPending = '1'; _cargarScriptRecaptcha(); }
    }

    function getRcToken() {
        if (!window.grecaptcha) return null;
        return _rcWidgetId !== null ? grecaptcha.getResponse(_rcWidgetId) : grecaptcha.getResponse();
    }
    function getRcTokenDe(containerId) {
        if (!window.grecaptcha) return null;
        const w = _rcWidgets[containerId];
        return w !== undefined ? grecaptcha.getResponse(w) : null;
    }

    function resetRc() {
        if (!window.grecaptcha) return;
        try { _rcWidgetId !== null ? grecaptcha.reset(_rcWidgetId) : grecaptcha.reset(); } catch(e) {}
    }
    function resetRcDe(containerId) {
        if (!window.grecaptcha) return;
        const w = _rcWidgets[containerId];
        if (w !== undefined) try { grecaptcha.reset(w); } catch(e) {}
    }

    /* ── Voter token — fingerprint por navegador ──────────────────────
       UUID aleatorio guardado en localStorage. Cada ronda el servidor
       rechaza un segundo voto con el mismo token.
    ────────────────────────────────────────────────────────────────── */
    function getVoterToken(portal) {
        const key = 'pg_voter_' + portal;
        try {
            let t = localStorage.getItem(key);
            if (!t) {
                t = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
                localStorage.setItem(key, t);
            }
            return t;
        } catch (e) { return null; }
    }

    function estilos() {
        if (document.getElementById('pgDinamicaCss')) return;
        const st = document.createElement('style');
        st.id = 'pgDinamicaCss';
        st.textContent = `
.pgd{width:min(100%,1180px);margin:0 auto;padding:clamp(40px,5vw,64px) clamp(18px,4vw,40px)}
.pgd-caja{padding:clamp(18px,3vw,30px);border:1px solid rgba(var(--primary-rgb,216,195,149),.35);
  border-top:3px solid var(--primary,#D8C395);border-radius:3px;
  background:linear-gradient(145deg,rgba(var(--primary-rgb,216,195,149),.07),transparent 45%),#121212;
  color:var(--light,#F4EEDC)}
.pgd h2{margin:0 0 6px;color:var(--primary,#D8C395);font:900 clamp(1.2rem,2.6vw,1.8rem)/1.15 var(--font-display,'Michroma',sans-serif);text-transform:uppercase}
.pgd p.pgd-sub{margin:0 0 18px;color:var(--gray,#B9B2A4);line-height:1.6}
.pgd form{display:grid;gap:12px;max-width:460px}
.pgd label{display:block;margin-bottom:5px;color:var(--primary,#D8C395);font:800 .66rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;text-transform:uppercase}
.pgd input,.pgd select{width:100%;min-height:46px;padding:10px 12px;border:1px solid rgba(var(--primary-rgb,216,195,149),.3);border-radius:2px;color:var(--light,#F4EEDC);background:#0c0c0c;font-size:16px;box-sizing:border-box}
.pgd-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pgd button{min-height:48px;border:1px solid var(--primary,#D8C395);border-radius:2px;color:var(--on-primary,#0A0A0A);background:var(--primary,#D8C395);font:900 .8rem var(--font-display,'Michroma',sans-serif);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:opacity .15s}
.pgd button:disabled{opacity:.5;cursor:not-allowed}
.pgd-msg{min-height:1.2em;color:#ff8a8d;font-size:.9rem;margin:4px 0 0}
.pgd-ok{padding:20px;border:2px dashed var(--primary,#D8C395);text-align:center;margin-top:10px}
.pgd-ok b{display:block;font:900 1.3rem var(--font-display,'Michroma',sans-serif);color:var(--primary,#D8C395);margin:6px 0}
.pgd-ok small{display:block;color:var(--gray,#B9B2A4);font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}
.pgd-cerrado{padding:14px;border:1px solid rgba(229,72,77,.5);color:#ff8a8d;text-align:center;border-radius:2px}
.pgd-lista{margin-top:18px}
.pgd-lista h3{font:700 .75rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 10px;opacity:.8}
.pgd-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:200px;overflow:auto}
.pgd-chips span{padding:5px 9px;border:1px solid rgba(var(--primary-rgb,216,195,149),.22);background:rgba(255,255,255,.03);font-size:.82rem;color:var(--light,#F4EEDC)}
.pgd-chips span em{margin-left:6px;color:var(--primary,#D8C395);font:normal .62rem var(--font-display,'Michroma',sans-serif)}
.pgd-reloj{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 18px}
.pgd-reloj div{padding:10px 4px;border:1px solid rgba(var(--primary-rgb,216,195,149),.25);background:#0c0c0c;text-align:center}
.pgd-reloj b{display:block;color:var(--primary,#D8C395);font:900 1.4rem var(--font-display,'Michroma',sans-serif)}
.pgd-reloj small{color:var(--gray,#B9B2A4);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase}
.pgd-reloj.urgente b{color:#ff4d4d;animation:pgd-parpadeo .6s infinite alternate}
@keyframes pgd-parpadeo{to{opacity:.35}}
.pgd-poll-opt{margin:10px 0}
.pgd-poll-label{display:flex;justify-content:space-between;font-size:.85rem;color:var(--light,#F4EEDC);margin-bottom:4px}
.pgd-poll-track{height:10px;border-radius:5px;background:rgba(255,255,255,.1)}
.pgd-poll-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--primary,#D8C395),#FFD54A);transition:width .6s}
.pgd-poll-btn{padding:8px 14px;border:1px solid rgba(var(--primary-rgb,216,195,149),.4);border-radius:2px;background:rgba(var(--primary-rgb,216,195,149),.07);color:var(--light,#F4EEDC);cursor:pointer;font-size:.85rem;width:100%;text-align:left;transition:background .15s}
.pgd-poll-btn:hover{background:rgba(var(--primary-rgb,216,195,149),.18)}
.pgd-poll-btn.votado{border-color:var(--primary,#D8C395);background:rgba(var(--primary-rgb,216,195,149),.15);font-weight:700}
.pgd-lb{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:10px}
.pgd-lb th{color:var(--primary,#D8C395);font:700 .7rem var(--font-display,'Michroma',sans-serif);letter-spacing:.08em;padding:8px;border-bottom:1px solid rgba(var(--primary-rgb,216,195,149),.25);text-align:left}
.pgd-lb td{padding:8px;border-bottom:1px solid rgba(255,255,255,.06);color:var(--light,#F4EEDC)}
.pgd-lb .pos{font:700 .8rem var(--font-display,'Michroma',sans-serif);color:var(--primary,#D8C395)}
.pgd-total{font-size:.82rem;color:var(--gray,#B9B2A4);margin-top:10px}
.pgd-ganador{text-align:center;padding:22px 16px;border:1px solid rgba(var(--primary-rgb,216,195,149),.35);border-radius:10px;background:rgba(var(--primary-rgb,216,195,149),.06);margin-bottom:6px}
.pgd-ganador .pgd-gan-ico{font-size:2.2rem;margin-bottom:6px}
.pgd-ganador .pgd-gan-lbl{font:700 .68rem var(--font-display,'Michroma',sans-serif);letter-spacing:.14em;text-transform:uppercase;color:var(--primary,#D8C395);opacity:.7;margin-bottom:8px}
.pgd-ganador .pgd-gan-nombre{font:700 1.25rem var(--font-display,'Michroma',sans-serif);color:var(--primary,#D8C395);margin-bottom:4px;word-break:break-word}
.pgd-ganador .pgd-gan-votos{font-size:.82rem;color:var(--gray,#B9B2A4)}
.pgd-gan-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;background:rgba(var(--primary-rgb,216,195,149),.08);margin:4px 0;font-size:.95rem;color:var(--primary,#D8C395)}
.pgd-gan-item b{flex:1;text-align:left;font:700 1rem var(--font-display,'Michroma',sans-serif)}
.pgd-gan-item small{color:var(--gray,#B9B2A4);font-size:.8rem}
@media(max-width:600px){.pgd-row{grid-template-columns:1fr}.pgd-reloj{grid-template-columns:repeat(2,1fr)}}`;
        document.head.appendChild(st);
    }

    /* ── Reloj regresivo ── */
    function relojHTML(id) {
        return `<div class="pgd-reloj" id="${id}">
            <div><b id="${id}d">--</b><small>Días</small></div>
            <div><b id="${id}h">--</b><small>Horas</small></div>
            <div><b id="${id}m">--</b><small>Min</small></div>
            <div><b id="${id}s">--</b><small>Seg</small></div>
        </div>`;
    }

    function iniciarReloj(id, deadline, onExpira) {
        function tick() {
            const rem = Math.max(0, Math.floor((new Date(deadline) - Date.now()) / 1000));
            const d = Math.floor(rem / 86400), h = Math.floor((rem % 86400) / 3600),
                  m = Math.floor((rem % 3600) / 60), s = rem % 60;
            const el = document.getElementById(id);
            if (!el) { clearInterval(iv); return; }
            el.querySelector('#' + id + 'd').textContent = String(d).padStart(2, '0');
            el.querySelector('#' + id + 'h').textContent = String(h).padStart(2, '0');
            el.querySelector('#' + id + 'm').textContent = String(m).padStart(2, '0');
            el.querySelector('#' + id + 's').textContent = String(s).padStart(2, '0');
            el.className = 'pgd-reloj' + (rem < 300 ? ' urgente' : '');
            if (rem === 0) { clearInterval(iv); if (onExpira) onExpira(); }
        }
        tick();
        const iv = setInterval(tick, 1000);
        return iv;
    }

    /* ── Seleccionar o crear contenedor ── */
    function contenedor(destino) {
        let cont = destino ? document.getElementById(destino) : document.getElementById('pgDinamica');
        if (!cont) {
            cont = document.createElement('section');
            cont.id = 'pgDinamica';
            const pie = document.querySelector('footer');
            if (pie) pie.before(cont); else document.body.appendChild(cont);
        }
        cont.classList.add('pgd');
        cont.hidden = false;
        return cont;
    }

    /* ══════════════════════════════════════
       REGISTRO DE EQUIPOS
    ══════════════════════════════════════ */
    async function montarRegistro(portal, destino) {
        let cfg;
        try { cfg = await P.dinamica.publico(portal, 'registro'); } catch (e) { return; }
        if (!cfg || !cfg.activo) return;
        estilos();
        const cont = contenedor(destino);
        const clave = 'pg_din_reg_' + portal;
        let mio = null;
        try { mio = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (e) {}

        const titulo = esc(cfg.titulo || 'Registro de equipos');
        const cerrado = cfg.cerrado;
        const abierto = cfg.abierto !== false; // undefined = abierto (backwards compat)
        const relojId = 'pgdRelojReg';
        const relojInicioId = 'pgdRelojRegInicio';

        // Antes de la hora de inicio — mostrar cuenta regresiva
        if (!abierto && cfg.inicio) {
            cont.innerHTML = `<div class="pgd-caja">
                <h2>📋 ${titulo}</h2>
                <p class="pgd-sub">El registro abrirá pronto.</p>
                ${relojHTML(relojInicioId)}
            </div>`;
            iniciarReloj(relojInicioId, cfg.inicio, () => location.reload());
            return;
        }

        let formulario;
        if (cerrado) {
            formulario = `<div class="pgd-cerrado">⛔ El registro ya cerró.</div>`;
        } else if (mio) {
            formulario = `<div class="pgd-ok">
                <small>¡Ya estás registrado!</small>
                <b>${esc(mio.nombre)}</b>
                <small>${mio.rep ? 'Rep: ' + esc(mio.rep) : ''}</small>
            </div>`;
        } else {
            formulario = `<form id="pgdFormReg">
                <div><label for="pgdNombre">Nombre del equipo *</label><input id="pgdNombre" required maxlength="80" placeholder="Ej: PROYECTN Squad" autocomplete="off"></div>
                <div><label for="pgdRep">Nombre del representante *</label><input id="pgdRep" required maxlength="80" placeholder="Tu nombre" autocomplete="off"></div>
                <div class="pgd-row">
                    <div><label for="pgdIg">IG del equipo</label><input id="pgdIg" maxlength="60" placeholder="@equipopumas" autocapitalize="none"></div>
                    <div><label for="pgdNumero">WhatsApp (con código de país) *</label><input id="pgdNumero" required maxlength="20" placeholder="521234567890" inputmode="tel"></div>
                </div>
                <button type="submit" id="pgdBtnReg">🎟️ Registrarme</button>
                <p class="pgd-msg" id="pgdMsgReg" role="alert"></p>
            </form>`;
        }

        const lista = (cfg.entradas || []).length
            ? `<div class="pgd-lista"><h3>Equipos registrados (${cfg.total})</h3>
               <div class="pgd-chips">${(cfg.entradas || []).map(e =>
                   `<span>${esc(e.nombre)}</span>`).join('')}</div></div>`
            : `<p class="pgd-total">Registrados: <b>${cfg.total || 0}</b></p>`;

        cont.innerHTML = `<div class="pgd-caja">
            <h2>📋 ${titulo}</h2>
            <p class="pgd-sub">Anota tu equipo antes de que cierre el registro.</p>
            ${cfg.deadline && !cerrado ? relojHTML(relojId) : ''}
            ${formulario}
            ${!cerrado && !mio ? '' : lista}
        </div>`;

        if (cfg.deadline && !cerrado) iniciarReloj(relojId, cfg.deadline, () => location.reload());

        const form = document.getElementById('pgdFormReg');
        if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const btn = document.getElementById('pgdBtnReg');
            const msg = document.getElementById('pgdMsgReg');
            const nombre       = document.getElementById('pgdNombre').value.trim();
            const representante= document.getElementById('pgdRep').value.trim();
            const ig           = document.getElementById('pgdIg').value.trim();
            const numero       = document.getElementById('pgdNumero').value.trim().replace(/\D/g, '');
            const msgEl        = document.getElementById('pgdMsgReg');
            const malas = /\b(puta|puto|culero|pendejo|chingad|mierda|cono|verga|cabron|mamada|pinche|carajo|joder|cojones|ojete|perra|marica|maricon|joto|hdp|imbecil)\b/i;
            if (malas.test(nombre) || malas.test(representante)) { msgEl.textContent = 'Ese nombre no está permitido.'; btn.disabled = false; btn.textContent = '🎟️ Registrarme'; return; }
            btn.disabled = true; btn.textContent = 'Registrando...';
            msg.textContent = '';
            try {
                await P.dinamica.registrar(portal, 'registro', { nombre, numero, ig, metadata: { representante } });
                const registro = { nombre: nombre.toUpperCase(), ig, rep: representante };
                try { localStorage.setItem(clave, JSON.stringify(registro)); } catch(e) {}
                await montarRegistro(portal, destino || (cont.id !== 'pgDinamica' ? cont.id : undefined));
            } catch (err) {
                msg.textContent = err.message || 'Error al registrarse.';
                btn.disabled = false; btn.textContent = '🎟️ Registrarme';
            }
        });
    }

    /* ══════════════════════════════════════
       ENCUESTA
    ══════════════════════════════════════ */
    async function montarEncuesta(portal, destino) {
        let cfg;
        try { cfg = await P.dinamica.publico(portal, 'encuesta'); } catch (e) { return; }
        if (!cfg || !cfg.activo) return;
        estilos();
        const cont = contenedor(destino);
        const ronda = (cfg.config && cfg.config.ronda) || 0;
        const clave = 'pg_din_enc_' + portal + '_r' + ronda;
        let miVoto = null;
        try { miVoto = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (e) {}

        const titulo = esc(cfg.titulo || 'Encuesta');
        const config = cfg.config || {};
        const pregunta = esc(config.pregunta || '');
        const opciones = config.opciones || [];
        const cerrado = cfg.cerrado;
        const abierto = cfg.abierto !== false;
        const relojId = 'pgdRelojEnc';
        const relojInicioEncId = 'pgdRelojEncInicio';

        if (!abierto && cfg.inicio) {
            cont.innerHTML = `<div class="pgd-caja">
                <h2>📊 ${titulo}</h2>
                <p class="pgd-sub">La encuesta abrirá pronto.</p>
                ${relojHTML(relojInicioEncId)}
            </div>`;
            iniciarReloj(relojInicioEncId, cfg.inicio, () => location.reload());
            return;
        }

        // Calcular votos
        const votos = {}; let totalVotos = 0;
        (cfg.entradas || []).forEach(v => {
            const idx = v.opcion_idx;
            votos[idx] = (votos[idx] || 0) + (v.total || 1);
            totalVotos += (v.total || 1);
        });

        // Calcular ganador
        let ganadorIdx = -1, ganadorVotos = -1;
        opciones.forEach((_, i) => { if ((votos[i] || 0) > ganadorVotos) { ganadorVotos = votos[i] || 0; ganadorIdx = i; } });
        const ganadorNombre = ganadorIdx >= 0 ? opciones[ganadorIdx] : null;

        // Timer inline: se incluye dentro del cuerpo para garantizar visibilidad
        const timerInline = cfg.deadline && !cerrado
            ? `<div style="margin-bottom:14px">${relojHTML(relojId)}</div>`
            : '';

        let cuerpo;
        if (cerrado) {
            cuerpo = ganadorNombre
                ? `<div class="pgd-ganador">
                       <div class="pgd-gan-ico">🏆</div>
                       <div class="pgd-gan-lbl">Ganador</div>
                       <div class="pgd-gan-nombre">${esc(ganadorNombre)}</div>
                       <div class="pgd-gan-votos">${ganadorVotos} voto${ganadorVotos !== 1 ? 's' : ''} de ${totalVotos}</div>
                   </div>`
                : `<div class="pgd-cerrado">⛔ La encuesta cerró.</div>`;
        } else if (miVoto !== null) {
            const nombreVotado = miVoto && miVoto.nombre ? `<br><small style="color:#999">como ${esc(miVoto.nombre)}</small>` : '';
            cuerpo = `${timerInline}<div class="pgd-ok"><small>Ya votaste</small><b>${esc(opciones[miVoto.idx ?? miVoto] || '')}</b>${nombreVotado}</div>`;
        } else {
            const rcWidget = RECAPTCHA_SITEKEY
                ? `<div id="pgdRecaptcha" style="margin:12px 0 4px"></div>`
                : '';
            cuerpo = `${timerInline}
                <div style="margin-bottom:12px">
                    <input id="pgdNombreEnc" type="text" placeholder="Tu nombre o apodo" maxlength="80"
                        style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#F4EEDC;font-size:.95rem">
                </div>
                ${rcWidget}
                <div id="pgdOpcs" style="margin-top:10px">${opciones.map((op, i) =>
                    `<div class="pgd-poll-opt"><button class="pgd-poll-btn" data-idx="${i}">${esc(op)}</button></div>`
                ).join('')}</div>
                <p class="pgd-msg" id="pgdMsgEnc" role="alert"></p>`;
        }

        const resultados = totalVotos > 0 ? `<div style="margin-top:18px">${opciones.map((op, i) => {
            const v = votos[i] || 0, pct = Math.round((v / totalVotos) * 100);
            const esGanador = cerrado && i === ganadorIdx;
            return `<div class="pgd-poll-opt">
                <div class="pgd-poll-label"><span>${esc(op)}${esGanador ? ' 🏆' : ''}</span><span>${v} voto${v !== 1 ? 's' : ''} · ${pct}%</span></div>
                <div class="pgd-poll-track"><div class="pgd-poll-fill" style="width:${pct}%${esGanador ? ';background:linear-gradient(90deg,#FFD54A,#ffa000)' : ''}"></div></div>
            </div>`;
        }).join('')}<p class="pgd-total">Total votos: <b>${totalVotos}</b></p></div>` : '';

        const imagenEnc = config.imagen ? `<img src="${esc(config.imagen)}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px;display:block" onerror="this.style.display='none'">` : '';

        cont.innerHTML = `<div class="pgd-caja">
            <h2>📊 ${titulo}</h2>
            ${imagenEnc}
            ${pregunta ? `<p class="pgd-sub" style="font-size:1rem;font-weight:700;color:#F4EEDC">${pregunta}</p>` : ''}
            ${cuerpo}
            ${(miVoto !== null || cerrado) ? resultados : ''}
        </div>`;

        if (cfg.deadline && !cerrado) iniciarReloj(relojId, cfg.deadline, () => montarEncuesta(portal, destino));
        if (miVoto !== null && !cerrado) setTimeout(() => montarEncuesta(portal, destino), 15000);

        // reCAPTCHA debe montarse DESPUÉS de que el HTML ya esté en el DOM
        if (miVoto === null && !cerrado) cargarRecaptcha();

        const opcs = document.getElementById('pgdOpcs');
        if (!opcs) return;
        opcs.addEventListener('click', async e => {
            const btn = e.target.closest('.pgd-poll-btn');
            if (!btn) return;
            const idx = parseInt(btn.dataset.idx);
            const msg = document.getElementById('pgdMsgEnc');
            const nombreInput = document.getElementById('pgdNombreEnc');
            const nombre = nombreInput ? nombreInput.value.trim() : '';

            if (!nombre) {
                msg.textContent = 'Escribe tu nombre antes de votar.';
                if (nombreInput) nombreInput.focus();
                return;
            }
            if (RECAPTCHA_SITEKEY && !getRcToken()) {
                msg.textContent = 'Completa el reCAPTCHA primero.';
                return;
            }

            opcs.querySelectorAll('.pgd-poll-btn').forEach(b => b.disabled = true);
            if (nombreInput) nombreInput.disabled = true;
            msg.textContent = '';
            try {
                await P.dinamica.registrar(portal, 'encuesta', {
                    nombre,
                    metadata: { opcion_idx: idx },
                    voterToken: getVoterToken(portal),
                    recaptchaToken: getRcToken(),
                });
                try { localStorage.setItem(clave, JSON.stringify({ idx, nombre })); } catch(e) {}
                await montarEncuesta(portal, destino || (cont.id !== 'pgDinamica' ? cont.id : undefined));
            } catch (err) {
                msg.textContent = err.message || 'Error al votar.';
                opcs.querySelectorAll('.pgd-poll-btn').forEach(b => b.disabled = false);
                if (nombreInput) nombreInput.disabled = false;
                resetRc();
            }
        });
    }

    /* ══════════════════════════════════════
       MULTI-ENCUESTA (sql/41)
    ══════════════════════════════════════ */
    async function montarEncuestas(portal, destino) {
        let lista;
        try { lista = await P.enc.publico(portal); } catch(e) { return; }
        if (!lista || !lista.length) return;
        estilos();
        const cont = contenedor(destino);

        // Barra de navegación superior (solo si hay más de una encuesta)
        const navHtml = lista.length > 1 ? `
            <div id="pgdEncNav" style="display:flex;gap:8px;overflow-x:auto;padding:0 0 10px;margin-bottom:6px;scrollbar-width:thin;flex-wrap:nowrap">
                ${lista.map((enc, i) => {
                    const label = enc.titulo || ('Enc. ' + (i + 1));
                    let miVoto = null;
                    try { miVoto = JSON.parse(localStorage.getItem('pg_enc_' + enc.id + '_r' + (enc.ronda || 0)) || 'null'); } catch(e) {}
                    const votado = miVoto !== null;
                    const cerrado = enc.cerrado;
                    const col = votado ? 'rgba(77,255,145,.25)' : cerrado ? 'rgba(255,138,141,.2)' : 'rgba(216,195,149,.15)';
                    const bor = votado ? 'rgba(77,255,145,.5)'  : cerrado ? 'rgba(255,138,141,.4)' : 'rgba(216,195,149,.35)';
                    const ico = votado ? '✔ ' : cerrado ? '⛔ ' : '';
                    return `<button onclick="document.getElementById('pgdEnc_${enc.id}').scrollIntoView({behavior:'smooth',block:'start'})"
                        style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid ${bor};background:${col};color:#F4EEDC;font-size:.82rem;cursor:pointer;font-family:inherit;white-space:nowrap">
                        ${ico}${esc(label)}
                    </button>`;
                }).join('')}
            </div>` : '';

        cont.innerHTML = navHtml + lista.map(enc => {
            const opciones = enc.opciones || [];
            const ronda = enc.ronda || 0;
            const clave = 'pg_enc_' + enc.id + '_r' + ronda;
            let miVoto = null;
            try { miVoto = JSON.parse(localStorage.getItem(clave) || 'null'); } catch(e) {}

            const cerrado = enc.cerrado;
            const titulo = esc(enc.titulo || 'Encuesta');
            const preguntaTxt = enc.pregunta ? `<p class="pgd-sub" style="font-size:1rem;font-weight:700;color:#F4EEDC">${esc(enc.pregunta)}</p>` : '';
            const imagenHtml = enc.imagen ? `<img src="${esc(enc.imagen)}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px;display:block" onerror="this.style.display='none'">` : '';

            // Votos y ganadores
            const votos = enc.votos || {};
            const nGanadores = Math.max(1, parseInt(enc.n_ganadores || 1));
            let totalVotos = 0;
            const vArr = opciones.map((_, i) => { const v = parseInt(votos[i] || 0); totalVotos += v; return v; });
            // Índices ordenados por votos desc para determinar Top N
            const ordenIdx = [...vArr.keys()].sort((a, b) => vArr[b] - vArr[a]);
            const ganSet   = new Set(ordenIdx.slice(0, nGanadores).filter(i => vArr[i] > 0));
            const medallas = ['🥇','🥈','🥉'];

            const relojId = 'pgdReloj_' + enc.id;
            const timerHtml = enc.deadline && !cerrado ? `<div style="margin-bottom:14px">${relojHTML(relojId)}</div>` : '';

            let cuerpo;
            if (cerrado) {
                if (totalVotos === 0) {
                    cuerpo = `<div class="pgd-cerrado">⛔ La encuesta cerró sin votos.</div>`;
                } else if (nGanadores === 1) {
                    const gi = ordenIdx[0];
                    cuerpo = `<div class="pgd-ganador"><div class="pgd-gan-ico">🏆</div><div class="pgd-gan-lbl">Ganador</div><div class="pgd-gan-nombre">${esc(opciones[gi])}</div><div class="pgd-gan-votos">${vArr[gi]} voto${vArr[gi] !== 1 ? 's' : ''} de ${totalVotos}</div></div>`;
                } else {
                    const ganadoresHtml = ordenIdx.slice(0, nGanadores).filter(i => vArr[i] > 0).map((gi, pos) =>
                        `<div class="pgd-gan-item">${medallas[pos] || '🏅'} <b>${esc(opciones[gi])}</b> <small>${vArr[gi]}v</small></div>`
                    ).join('');
                    cuerpo = `<div class="pgd-ganador"><div class="pgd-gan-lbl">Top ${nGanadores} ganadores</div>${ganadoresHtml}</div>`;
                }
            } else if (miVoto !== null) {
                const vIdx = miVoto && miVoto.idx !== undefined ? miVoto.idx : miVoto;
                const vNom = miVoto && miVoto.nombre ? `<br><small style="color:#999">como ${esc(miVoto.nombre)}</small>` : '';
                cuerpo = `${timerHtml}<div class="pgd-ok"><small>Ya votaste</small><b>${esc(opciones[vIdx] || '')}</b>${vNom}</div>`;
            } else {
                const rcId = 'pgdRc_' + enc.id;
                const rcHtml = RECAPTCHA_SITEKEY ? `<div id="${rcId}" style="margin:12px 0 4px"></div>` : '';
                cuerpo = `${timerHtml}
                    <div style="margin-bottom:12px">
                        <input id="pgdNom_${enc.id}" type="text" placeholder="Tu nombre o apodo" maxlength="80"
                            style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#F4EEDC;font-size:.95rem">
                    </div>
                    ${rcHtml}
                    <div id="pgdOpc_${enc.id}" style="margin-top:10px">${opciones.map((op, i) =>
                        `<div class="pgd-poll-opt"><button class="pgd-poll-btn" data-idx="${i}">${esc(op)}</button></div>`
                    ).join('')}</div>
                    <p class="pgd-msg" id="pgdMsg_${enc.id}" role="alert"></p>`;
            }

            const resultados = totalVotos > 0 ? `<div style="margin-top:18px">${opciones.map((op, i) => {
                const v = vArr[i], pct = Math.round((v / totalVotos) * 100);
                const posGan = ganSet.has(i) ? ordenIdx.indexOf(i) : -1;
                const esGan  = posGan >= 0;
                const medal  = (cerrado || miVoto !== null) && esGan ? (medallas[posGan] || '🏅') + ' ' : '';
                return `<div class="pgd-poll-opt">
                    <div class="pgd-poll-label" style="${esGan && (cerrado || miVoto !== null) ? 'color:#FFD54A;font-weight:700' : ''}"><span>${medal}${esc(op)}</span><span>${v} voto${v !== 1 ? 's' : ''} · ${pct}%</span></div>
                    <div class="pgd-poll-track"><div class="pgd-poll-fill" style="width:${pct}%${esGan && (cerrado || miVoto !== null) ? ';background:linear-gradient(90deg,#FFD54A,#ffa000)' : ''}"></div></div>
                </div>`;
            }).join('')}<p class="pgd-total">Total votos: <b>${totalVotos}</b></p></div>` : '';

            return `<div id="pgdEnc_${enc.id}" class="pgd-caja" style="margin-bottom:18px;scroll-margin-top:12px">
                <h2>📊 ${titulo}</h2>
                ${imagenHtml}${preguntaTxt}${cuerpo}
                ${miVoto !== null || cerrado ? resultados : ''}
            </div>`;
        }).join('');

        // Timers, reCAPTCHA y handlers por encuesta
        lista.forEach(enc => {
            const opciones = enc.opciones || [];
            const ronda = enc.ronda || 0;
            const clave = 'pg_enc_' + enc.id + '_r' + ronda;
            let miVoto = null;
            try { miVoto = JSON.parse(localStorage.getItem(clave) || 'null'); } catch(e) {}

            if (enc.deadline && !enc.cerrado) {
                iniciarReloj('pgdReloj_' + enc.id, enc.deadline, () => montarEncuestas(portal, destino));
            }
            if (miVoto === null && !enc.cerrado) {
                if (RECAPTCHA_SITEKEY) cargarRecaptchaPara('pgdRc_' + enc.id);
            }
            if (miVoto !== null && !enc.cerrado) {
                setTimeout(() => montarEncuestas(portal, destino), 15000);
            }

            const opcsEl = document.getElementById('pgdOpc_' + enc.id);
            if (!opcsEl) return;
            opcsEl.addEventListener('click', async e => {
                const btn = e.target.closest('.pgd-poll-btn');
                if (!btn) return;
                const idx = parseInt(btn.dataset.idx);
                const msg = document.getElementById('pgdMsg_' + enc.id);
                const nomEl = document.getElementById('pgdNom_' + enc.id);
                const nombre = nomEl ? nomEl.value.trim() : '';

                if (!nombre) { msg.textContent = 'Escribe tu nombre antes de votar.'; if (nomEl) nomEl.focus(); return; }
                const rcId = 'pgdRc_' + enc.id;
                if (RECAPTCHA_SITEKEY && !getRcTokenDe(rcId)) {
                    msg.textContent = 'Completa el reCAPTCHA primero.'; return;
                }

                opcsEl.querySelectorAll('.pgd-poll-btn').forEach(b => b.disabled = true);
                if (nomEl) nomEl.disabled = true;
                msg.textContent = '';
                try {
                    await P.enc.votar(enc.id, {
                        nombre,
                        opcion_idx: idx,
                        voterToken: getVoterToken(portal),
                        recaptchaToken: getRcTokenDe(rcId),
                    });
                    try { localStorage.setItem(clave, JSON.stringify({ idx, nombre })); } catch(e) {}
                    await montarEncuestas(portal, destino || (cont.id !== 'pgDinamica' ? cont.id : undefined));
                } catch (err) {
                    msg.textContent = err.message || 'Error al votar.';
                    opcsEl.querySelectorAll('.pgd-poll-btn').forEach(b => b.disabled = false);
                    if (nomEl) nomEl.disabled = false;
                    resetRcDe(rcId);
                }
            });
        });
    }

    /* ══════════════════════════════════════
       LEADERBOARD DEL JUEGO
    ══════════════════════════════════════ */
    async function montarJuego(portal, destino) {
        let cfg;
        try { cfg = await P.dinamica.publico(portal, 'juego'); } catch (e) { return; }
        if (!cfg || !cfg.activo) return;
        estilos();
        const cont = contenedor(destino);
        const titulo = esc(cfg.titulo || 'Tabla de líderes');
        const entradas = cfg.entradas || [];

        const filas = entradas.slice(0, 20).map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `<tr>
                <td class="pos">${medal}</td>
                <td>${esc(r.nombre)}</td>
                <td>${r.numero ? esc(r.numero) : '—'}</td>
                <td style="color:#FFD54A;font-weight:700">${r.puntos}</td>
            </tr>`;
        }).join('');

        cont.innerHTML = `<div class="pgd-caja">
            <h2>🎮 ${titulo}</h2>
            <p class="pgd-sub">Juego activo — ¡entra desde el panel de dinámicas para jugar!</p>
            ${entradas.length ? `<table class="pgd-lb">
                <thead><tr><th>#</th><th>Jugador</th><th>Nº</th><th>Puntos</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
            <p class="pgd-total">Participantes: <b>${cfg.total}</b></p>`
            : `<p style="color:#666;font-style:italic">Aún no hay puntuaciones registradas.</p>`}
        </div>`;
    }

    /* ── Auto-detectar y montar ── */
    async function montar(portal, destino) {
        estilos();
        const cont = contenedor(destino);
        // Spinner mientras carga
        cont.innerHTML = `<div class="pgd-caja" style="text-align:center;padding:40px;color:var(--gray,#B9B2A4)">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.6rem;color:var(--primary,#D8C395);display:block;margin-bottom:14px"></i>
            Cargando dinámica…
        </div>`;
        let encontrado = false;

        // 1. Registro
        try {
            const cfg = await P.dinamica.publico(portal, 'registro');
            if (cfg && cfg.activo) { encontrado = true; await montarRegistro(portal, destino); return; }
        } catch(e) {
            cont.innerHTML = `<div class="pgd-caja pgd-cerrado" style="max-width:520px;margin:0 auto">
                <b style="display:block;margin-bottom:8px;color:var(--primary,#D8C395)">⚠️ No se pudo cargar la dinámica</b>
                <small style="color:#888">${P.escaparHtml(e.message || 'Error desconocido')}</small>
            </div>`;
            return;
        }

        // 2. Multi-encuesta (sql/41) — sistema nuevo
        try {
            const lista = await P.enc.publico(portal);
            if (lista && lista.length) { encontrado = true; await montarEncuestas(portal, destino); return; }
        } catch(e) { /* silencioso si sql/41 no está corrido */ }

        // 3. Encuesta legada (sql/33) — fallback
        try {
            const cfg = await P.dinamica.publico(portal, 'encuesta');
            if (cfg && cfg.activo) { encontrado = true; await montarEncuesta(portal, destino); return; }
        } catch(e) { /* silencioso */ }

        if (!encontrado) cont.innerHTML = '';
    }

    /* ── Auto-mount: se activa cuando se incluye el script en una página de portal ── */
    function autoMontar() {
        // Si el DOM aún no está listo, esperar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoMontar);
            return;
        }
        // No correr en el admin ni en páginas que montan manualmente
        if (location.pathname.includes('/admin/')) return;
        const self = document.querySelector('script[src*="dinamicas.js"]');
        if (self && self.dataset.sinDinamica !== undefined) return;
        // PumasPortal debe estar cargado
        if (!window.PumasPortal || !window.PumasPortal.PORTALES) return;
        // Detectar portal: primer segmento del path, o data-portal en el script tag
        const seg = location.pathname.split('/').filter(Boolean)[0];
        const scriptPortal = document.querySelector('script[data-portal]');
        const portal = (seg && window.PumasPortal.PORTALES[seg]) ? seg
                     : (scriptPortal && scriptPortal.dataset.portal) || null;
        if (!portal || !window.PumasPortal.PORTALES[portal]) return;
        // Opcionalmente forzar un tipo con ?din=registro|encuesta|juego
        const tipo = new URLSearchParams(location.search).get('din');
        if (tipo === 'registro') { montarRegistro(portal); return; }
        if (tipo === 'encuesta') { montarEncuesta(portal); return; }
        montar(portal);
    }
    autoMontar();

    window.PumasPortal = window.PumasPortal || {};
    window.PumasPortal.dinamicas = { montar, montarRegistro, montarEncuesta, montarEncuestas, montarJuego };
})();
