/* config-portal.js — Toggles de configuración pública por portal.
   Requiere portal.js cargado antes. Monta el panel en un div con id="configPortalPanel".
   Necesita sql/50_portal_features.sql en Supabase. */
(function () {
    const P = window.PumasPortal;
    if (!P) return;

    const PORTAL_ID = (function () {
        const el = document.querySelector('[data-portal]');
        return el ? el.dataset.portal : P.portal || '';
    })();

    let montado = false;

    window.AscConfigPortal = {
        montar: async function (contenedorId) {
            const caja = document.getElementById(contenedorId || 'configPortalPanel');
            if (!caja) return;
            if (montado) return;

            caja.innerHTML = '<p class="muted" style="text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>';

            let cfg = { pub_completos: false, pub_caidas: false };
            try {
                const res = await P.db().rpc('portal_features', { p_portal: PORTAL_ID });
                if (res.data) cfg = Object.assign(cfg, res.data);
            } catch (_) { }

            const esc = P.escaparHtml || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));

            caja.innerHTML = `
                <h3 class="subtitulo-bloque"><i class="fa-solid fa-sliders"></i> Configuración pública del portal · <code>${esc(PORTAL_ID)}</code></h3>
                <p class="tool-desc">Activa o desactiva secciones que verá el público en el portal de este torneo.</p>
                <div class="card-box" style="max-width:560px;margin:0 auto">
                    <div class="form-group">
                        <label class="chk" style="font-size:.95rem;gap:12px;align-items:flex-start">
                            <input type="checkbox" id="cfgCompletos" ${cfg.pub_completos ? 'checked' : ''}>
                            <span><b>Resultados completos</b><br><small class="muted">Muestra la tabla general de todas las jornadas al público del portal.</small></span>
                        </label>
                    </div>
                    <div class="form-group" style="margin-top:16px">
                        <label class="chk" style="font-size:.95rem;gap:12px;align-items:flex-start">
                            <input type="checkbox" id="cfgCaidas" ${cfg.pub_caidas ? 'checked' : ''}>
                            <span><b>Caídas / Eliminados</b><br><small class="muted">Muestra la sección de equipos relegados o eliminados en el portal público.</small></span>
                        </label>
                    </div>
                    <div class="asc-acciones" style="margin-top:20px">
                        <button class="btn-access" id="btnGuardarCfgPortal"><i class="fa-solid fa-floppy-disk"></i> Guardar configuración</button>
                    </div>
                    <p class="asc-estado" id="cfgPortalEstado" role="status" style="margin-top:8px"></p>
                </div>`;

            document.getElementById('btnGuardarCfgPortal').addEventListener('click', async () => {
                const btn = document.getElementById('btnGuardarCfgPortal');
                const msg = document.getElementById('cfgPortalEstado');
                btn.disabled = true;
                msg.textContent = 'Guardando...';
                try {
                    const ses = P.sesion();
                    const { error } = await P.db().rpc('admin_portal_features', {
                        p_token: ses ? ses.token : null,
                        p_portal: PORTAL_ID,
                        p_completos: document.getElementById('cfgCompletos').checked,
                        p_caidas: document.getElementById('cfgCaidas').checked
                    });
                    if (error) throw new Error(error.message);
                    msg.textContent = '✓ Configuración guardada.';
                    montado = false; // permite recargar
                } catch (e) {
                    msg.textContent = 'Error: ' + e.message;
                } finally { btn.disabled = false; }
            });

            montado = true;
        }
    };
})();
