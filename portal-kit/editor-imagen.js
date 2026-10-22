/* editor-imagen.js — Editor de imagen de resultados para portales de sala (1280×720).
   Uso: PGEditorImagen.montar('contenedorId', { onCambio: fn })
        PGEditorImagen.cfg()  → configuración actual
   Incluir DESPUÉS de portal.js y ANTES de script.js en el admin.html del portal. */
(function () {
    var _cfg = {
        mostrarKillers: true,
        mostrarBooyah:  true,
        mostrarAscenso: true,
        maxEquipos:  0,
        maxKillers:  9,
        fondoCustom: null
    };
    var _cb = null;

    function _fire() { if (typeof _cb === 'function') _cb(); }

    window.PGEditorImagen = {
        montar: function (contenedorId, opts) {
            _cb = opts && opts.onCambio ? opts.onCambio : null;
            var caja = document.getElementById(contenedorId);
            if (!caja) return;

            caja.innerHTML = [
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-paint-brush"></i> Editor de imagen</h3>',
                '<p class="tool-desc">Personaliza la imagen antes de descargarla. Los cambios se aplican en la vista previa al instante.</p>',
                '<div class="form-grid">',
                  '<div class="form-group">',
                    '<label for="pgEdFondo">Fondo personalizado (PNG / JPG / WebP)</label>',
                    '<input type="file" id="pgEdFondo" class="file-input-custom" accept="image/png,image/jpeg,image/webp">',
                    '<p class="muted" style="margin-top:4px;font-size:.8rem">Deja vacío para usar el fondo del tema actual.</p>',
                    '<button type="button" id="pgEdFondoQuitar" class="btn-access btn-outline" style="margin-top:8px;display:none">',
                      '<i class="fa-solid fa-xmark"></i> Quitar fondo personalizado',
                    '</button>',
                  '</div>',
                  '<div class="form-group" style="display:flex;flex-direction:column;gap:12px;justify-content:center">',
                    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.95rem">',
                      '<input type="checkbox" id="pgEdKillers" checked>',
                      '<span><b>Mostrar Top Killer</b></span>',
                    '</label>',
                    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.95rem">',
                      '<input type="checkbox" id="pgEdBooyah" checked>',
                      '<span><b>Mostrar Booyah</b></span>',
                    '</label>',
                    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.95rem">',
                      '<input type="checkbox" id="pgEdAscenso" checked>',
                      '<span><b>Mostrar Ascenso Directo</b></span>',
                    '</label>',
                  '</div>',
                '</div>',
                '<div class="form-grid">',
                  '<div class="form-group">',
                    '<label for="pgEdMaxEq">Máx. equipos en imagen <small class="muted">(0 = todos)</small></label>',
                    '<input type="number" id="pgEdMaxEq" value="0" min="0" max="50" style="max-width:130px">',
                  '</div>',
                  '<div class="form-group">',
                    '<label for="pgEdMaxKills">Máx. kills mostrados</label>',
                    '<input type="number" id="pgEdMaxKills" value="9" min="1" max="20" style="max-width:130px">',
                  '</div>',
                '</div>'
            ].join('');

            var elFondo  = caja.querySelector('#pgEdFondo');
            var elQuitar = caja.querySelector('#pgEdFondoQuitar');

            elFondo.addEventListener('change', function () {
                var file = this.files[0];
                if (!file) { _cfg.fondoCustom = null; elQuitar.style.display = 'none'; _fire(); return; }
                var r = new FileReader();
                r.onload = function (e) {
                    _cfg.fondoCustom = e.target.result;
                    elQuitar.style.display = 'inline-flex';
                    _fire();
                };
                r.readAsDataURL(file);
            });

            elQuitar.addEventListener('click', function () {
                _cfg.fondoCustom = null;
                elFondo.value = '';
                elQuitar.style.display = 'none';
                _fire();
            });

            caja.querySelector('#pgEdKillers').addEventListener('change', function () { _cfg.mostrarKillers = this.checked; _fire(); });
            caja.querySelector('#pgEdBooyah').addEventListener('change',  function () { _cfg.mostrarBooyah  = this.checked; _fire(); });
            caja.querySelector('#pgEdAscenso').addEventListener('change', function () { _cfg.mostrarAscenso = this.checked; _fire(); });

            caja.querySelector('#pgEdMaxEq').addEventListener('input',    function () { _cfg.maxEquipos = Math.max(0, parseInt(this.value) || 0); _fire(); });
            caja.querySelector('#pgEdMaxKills').addEventListener('input',  function () { _cfg.maxKillers = Math.max(1, parseInt(this.value) || 9); _fire(); });
        },

        cfg: function () { return Object.assign({}, _cfg); }
    };
})();
