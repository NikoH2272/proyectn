/* editor-imagen.js — Editor de imagen de resultados (multi-portal, persiste en localStorage).
   Uso en la página de configuración:
     PGEditorImagen.montar('contenedorId', { portal: 'dragonfest', onCambio: fn })
   Uso en script.js del portal (solo lectura):
     const _ed = PGEditorImagen ? PGEditorImagen.cfg('dragonfest') : {}; */
(function () {
    var _inst = {};

    function _def() {
        return {
            mostrarKillers: true, mostrarBooyah: true, mostrarAscenso: true,
            maxEquipos: 0, maxKillers: 9, fondoCustom: null,
            estilo: 1,          // 1=Clásico  2=Podio  3=Moderno
            orientacion: 'h',   // 'h'=16:9  'v'=4:5  's'=9:16  'c'=1:1
            color1: '#B6FF00',  // 1er lugar / títulos
            color2: '#FFD54A',  // 2do lugar
            color3: '#00C6FF',  // 3er lugar
            textoFecha: '',
            textoMod: 'ADMIN',
            padding: 16,        // relleno interior del canvas (px)
            escalaFuente: 1,    // multiplicador de tamaño de fuente
            ordenSecciones: ['killers', 'booyah', 'ascenso']
        };
    }

    function _lsKey(p) { return 'pg_ed_' + p; }
    function _leerLS(p) {
        try { var r = localStorage.getItem(_lsKey(p)); return r ? JSON.parse(r) : null; }
        catch (e) { return null; }
    }
    function _guardarLS(p, cfg) {
        try { localStorage.setItem(_lsKey(p), JSON.stringify(cfg)); }
        catch (e) {
            try { localStorage.setItem(_lsKey(p), JSON.stringify(Object.assign({}, cfg, { fondoCustom: null }))); }
            catch (e2) {}
        }
    }
    function _esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

    window.PGEditorImagen = {

        montar: function (contenedorId, opts) {
            var portal = (opts && opts.portal) || contenedorId;
            var cb     = (opts && opts.onCambio) || null;
            var saved  = _leerLS(portal) || {};
            var _cfg   = Object.assign(_def(), saved);
            _inst[portal] = { _cfg: _cfg, _cb: cb, _fondoDefault: (opts && opts.fondoDefault) || null, _fondoDefaultFem: (opts && opts.fondoDefaultFem) || null };

            var caja = document.getElementById(contenedorId);
            if (!caja) return;

            var px = 'pgEd_' + portal + '_';
            function _fire() { _guardarLS(portal, _cfg); if (typeof cb === 'function') cb(); }

            caja.innerHTML = [
                // ── Fondo ──────────────────────────────────────────────────
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-image"></i> Fondo</h3>',
                '<div class="form-grid">',
                  '<div class="form-group">',
                    '<label>Imagen de fondo (PNG / JPG / WebP)</label>',
                    '<input type="file" id="' + px + 'fondo" class="file-input-custom" accept="image/png,image/jpeg,image/webp">',
                    '<p class="muted" id="' + px + 'fondoMsg" style="margin-top:4px;font-size:.8rem">' +
                      (_cfg.fondoCustom ? '<span style="color:#6ee7a8">✔ Fondo activo (sesión anterior)</span>' : 'Deja vacío para el fondo del tema.') +
                    '</p>',
                    '<button type="button" id="' + px + 'fondoQ" class="btn-access btn-outline" style="margin-top:8px;' + (_cfg.fondoCustom ? '' : 'display:none') + '">',
                      '<i class="fa-solid fa-xmark"></i> Quitar fondo',
                    '</button>',
                  '</div>',
                '</div>',

                // ── Texto ───────────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-font"></i> Texto en imagen</h3>',
                '<div class="form-grid">',
                  '<div class="form-group">',
                    '<label>Fecha (ej: 22/10/2026)</label>',
                    '<input type="text" id="' + px + 'fecha" value="' + _esc(_cfg.textoFecha) + '" placeholder="22/10/2026" style="max-width:200px">',
                  '</div>',
                  '<div class="form-group">',
                    '<label>Moderador / nombre</label>',
                    '<input type="text" id="' + px + 'mod" value="' + _esc(_cfg.textoMod) + '" placeholder="ADMIN" style="max-width:200px">',
                  '</div>',
                '</div>',

                // ── Secciones ───────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-eye"></i> Secciones visibles</h3>',
                '<div style="display:flex;flex-direction:column;gap:12px">',
                  '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">',
                    '<input type="checkbox" id="' + px + 'killers"' + (_cfg.mostrarKillers ? ' checked' : '') + '>',
                    '<span><b>Top Killers</b></span>',
                  '</label>',
                  '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">',
                    '<input type="checkbox" id="' + px + 'booyah"' + (_cfg.mostrarBooyah ? ' checked' : '') + '>',
                    '<span><b>Booyah por sala</b></span>',
                  '</label>',
                  '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">',
                    '<input type="checkbox" id="' + px + 'ascenso"' + (_cfg.mostrarAscenso ? ' checked' : '') + '>',
                    '<span><b>Ascenso directo</b></span>',
                  '</label>',
                '</div>',
                '<div class="form-grid" style="margin-top:14px">',
                  '<div class="form-group">',
                    '<label>Máx. equipos <small class="muted">(0 = todos)</small></label>',
                    '<input type="number" id="' + px + 'maxEq" value="' + _cfg.maxEquipos + '" min="0" max="50" style="max-width:110px">',
                  '</div>',
                  '<div class="form-group">',
                    '<label>Máx. killers</label>',
                    '<input type="number" id="' + px + 'maxKills" value="' + _cfg.maxKillers + '" min="1" max="20" style="max-width:110px">',
                  '</div>',
                '</div>',

                // ── Orientación ─────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-arrows-left-right"></i> Orientación</h3>',
                '<div style="display:flex;gap:10px;flex-wrap:wrap">',
                  '<label style="display:flex;align-items:center;gap:8px;padding:10px 18px;border:1px solid rgba(255,255,255,.2);border-radius:4px;cursor:pointer;' + (_cfg.orientacion === 'h' ? 'border-color:var(--primary,#B6FF00);background:rgba(182,255,0,.06)' : '') + '" id="' + px + 'oriLH">',
                    '<input type="radio" name="' + px + 'ori" value="h"' + (_cfg.orientacion === 'h' ? ' checked' : '') + ' style="display:none">',
                    '<i class="fa-solid fa-display"></i><span><b>16:9</b> · Horizontal</span>',
                  '</label>',
                  '<label style="display:flex;align-items:center;gap:8px;padding:10px 18px;border:1px solid rgba(255,255,255,.2);border-radius:4px;cursor:pointer;' + (_cfg.orientacion === 'v' ? 'border-color:var(--primary,#B6FF00);background:rgba(182,255,0,.06)' : '') + '" id="' + px + 'oriLV">',
                    '<input type="radio" name="' + px + 'ori" value="v"' + (_cfg.orientacion === 'v' ? ' checked' : '') + ' style="display:none">',
                    '<i class="fa-solid fa-mobile-screen"></i><span><b>4:5</b> · Vertical</span>',
                  '</label>',
                  '<label style="display:flex;align-items:center;gap:8px;padding:10px 18px;border:1px solid rgba(255,255,255,.2);border-radius:4px;cursor:pointer;' + (_cfg.orientacion === 's' ? 'border-color:var(--primary,#B6FF00);background:rgba(182,255,0,.06)' : '') + '" id="' + px + 'oriLS">',
                    '<input type="radio" name="' + px + 'ori" value="s"' + (_cfg.orientacion === 's' ? ' checked' : '') + ' style="display:none">',
                    '<i class="fa-solid fa-mobile-screen-button"></i><span><b>9:16</b> · Historia IG</span>',
                  '</label>',
                  '<label style="display:flex;align-items:center;gap:8px;padding:10px 18px;border:1px solid rgba(255,255,255,.2);border-radius:4px;cursor:pointer;' + (_cfg.orientacion === 'c' ? 'border-color:var(--primary,#B6FF00);background:rgba(182,255,0,.06)' : '') + '" id="' + px + 'oriLC">',
                    '<input type="radio" name="' + px + 'ori" value="c"' + (_cfg.orientacion === 'c' ? ' checked' : '') + ' style="display:none">',
                    '<i class="fa-regular fa-square"></i><span><b>1:1</b> · Cuadrada</span>',
                  '</label>',
                '</div>',

                // ── Estilo ──────────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-palette"></i> Estilo</h3>',
                '<div style="display:flex;gap:10px;flex-wrap:wrap" id="' + px + 'estilosWrap">',
                  '<button type="button" id="' + px + 'e1" data-e="1" style="' + (_cfg.estilo===1?'background:var(--primary,#B6FF00);color:#000;border-color:transparent':'') + '"><i class="fa-solid fa-table-list"></i> Clásico</button>',
                  '<button type="button" id="' + px + 'e2" data-e="2" style="' + (_cfg.estilo===2?'background:var(--primary,#B6FF00);color:#000;border-color:transparent':'') + '"><i class="fa-solid fa-trophy"></i> Podio</button>',
                  '<button type="button" id="' + px + 'e3" data-e="3" style="' + (_cfg.estilo===3?'background:var(--primary,#B6FF00);color:#000;border-color:transparent':'') + '"><i class="fa-solid fa-star"></i> Moderno</button>',
                '</div>',

                // ── Colores ─────────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-droplet"></i> Colores</h3>',
                '<div class="form-grid">',
                  '<div class="form-group"><label>1er lugar / Títulos</label><input type="color" id="' + px + 'c1" value="' + _cfg.color1 + '"></div>',
                  '<div class="form-group"><label>2do lugar</label><input type="color" id="' + px + 'c2" value="' + _cfg.color2 + '"></div>',
                  '<div class="form-group"><label>3er lugar</label><input type="color" id="' + px + 'c3" value="' + _cfg.color3 + '"></div>',
                '</div>',

                // ── Márgenes ─────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-border-all"></i> Márgenes internos</h3>',
                '<div class="form-group">',
                  '<label>Relleno interior — <span id="' + px + 'padVal">' + (_cfg.padding||16) + '</span> px</label>',
                  '<input type="range" id="' + px + 'pad" min="0" max="80" step="4" value="' + (_cfg.padding||16) + '" style="width:100%;max-width:300px">',
                '</div>',

                // ── Fuente ────────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-text-height"></i> Tamaño de fuente</h3>',
                '<div class="form-group">',
                  '<label>Escala — <span id="' + px + 'fntVal">' + (_cfg.escalaFuente||1) + '</span>×</label>',
                  '<input type="range" id="' + px + 'fnt" min="0.6" max="1.5" step="0.05" value="' + (_cfg.escalaFuente||1) + '" style="width:100%;max-width:300px">',
                '</div>',

                // ── Orden de secciones ────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:20px 0">',
                '<h3 class="subtitulo-bloque"><i class="fa-solid fa-sort"></i> Orden de secciones laterales</h3>',
                '<p class="muted" style="font-size:.8rem;margin-bottom:8px">Usa ↑↓ para reordenar el panel lateral.</p>',
                '<div id="' + px + 'ordenWrap" style="display:flex;flex-direction:column;gap:6px;max-width:320px"></div>',

                // ── Guardar ───────────────────────────────────────────────
                '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:24px 0">',
                '<div style="display:flex;align-items:center;gap:14px">',
                  '<button type="button" id="' + px + 'guardar" class="btn-access"><i class="fa-solid fa-floppy-disk"></i> Guardar configuración</button>',
                  '<span id="' + px + 'guardadoMsg" style="font-size:.85rem;color:#6ee7a8;opacity:0;transition:opacity .3s">✔ Guardado</span>',
                '</div>'
            ].join('');

            // ── Eventos ──────────────────────────────────────────────────────
            var elFondo = document.getElementById(px + 'fondo');
            var elFondoQ = document.getElementById(px + 'fondoQ');
            var elFondoMsg = document.getElementById(px + 'fondoMsg');

            elFondo.addEventListener('change', function () {
                var file = this.files[0];
                if (!file) { _cfg.fondoCustom = null; elFondoQ.style.display = 'none'; elFondoMsg.innerHTML = 'Deja vacío para el fondo del tema.'; _fire(); return; }
                var r = new FileReader();
                r.onload = function (e) {
                    _cfg.fondoCustom = e.target.result;
                    elFondoQ.style.display = '';
                    elFondoMsg.innerHTML = '<span style="color:#6ee7a8">✔ Fondo cargado</span>';
                    _fire();
                };
                r.readAsDataURL(file);
            });
            elFondoQ.addEventListener('click', function () {
                _cfg.fondoCustom = null; elFondo.value = '';
                elFondoQ.style.display = 'none';
                elFondoMsg.innerHTML = 'Deja vacío para el fondo del tema.';
                _fire();
            });

            document.getElementById(px + 'fecha').addEventListener('input',    function () { _cfg.textoFecha = this.value; _fire(); });
            document.getElementById(px + 'mod').addEventListener('input',      function () { _cfg.textoMod = this.value; _fire(); });
            document.getElementById(px + 'killers').addEventListener('change', function () { _cfg.mostrarKillers = this.checked; _fire(); });
            document.getElementById(px + 'booyah').addEventListener('change',  function () { _cfg.mostrarBooyah  = this.checked; _fire(); });
            document.getElementById(px + 'ascenso').addEventListener('change', function () { _cfg.mostrarAscenso = this.checked; _fire(); });
            document.getElementById(px + 'maxEq').addEventListener('input',    function () { _cfg.maxEquipos = Math.max(0, parseInt(this.value) || 0); _fire(); });
            document.getElementById(px + 'maxKills').addEventListener('input', function () { _cfg.maxKillers = Math.max(1, parseInt(this.value) || 9); _fire(); });

            // orientación
            var _oriLabels = ['H','V','S','C'].map(function(x){ return document.getElementById(px + 'oriL' + x); });
            caja.querySelectorAll('[name="' + px + 'ori"]').forEach(function (r) {
                r.addEventListener('change', function () {
                    _cfg.orientacion = this.value;
                    _oriLabels.forEach(function(l){ if(l){ l.style.borderColor=''; l.style.background=''; } });
                    var map = { h: _oriLabels[0], v: _oriLabels[1], s: _oriLabels[2], c: _oriLabels[3] };
                    var activo = map[this.value];
                    if (activo) { activo.style.borderColor = 'var(--primary,#B6FF00)'; activo.style.background = 'rgba(182,255,0,.06)'; }
                    _fire();
                });
            });

            // estilos
            var wrap = document.getElementById(px + 'estilosWrap');
            [1, 2, 3].forEach(function (n) {
                document.getElementById(px + 'e' + n).addEventListener('click', function () {
                    _cfg.estilo = n;
                    wrap.querySelectorAll('button').forEach(function (b) {
                        var isAct = parseInt(b.dataset.e) === n;
                        b.style.background    = isAct ? 'var(--primary,#B6FF00)' : '';
                        b.style.color         = isAct ? '#000' : '';
                        b.style.borderColor   = isAct ? 'transparent' : '';
                    });
                    _fire();
                });
            });

            // colores
            ['c1', 'c2', 'c3'].forEach(function (c, i) {
                document.getElementById(px + c).addEventListener('input', function () {
                    _cfg['color' + (i + 1)] = this.value; _fire();
                });
            });

            // padding
            var elPad = document.getElementById(px + 'pad');
            var elPadVal = document.getElementById(px + 'padVal');
            elPad.addEventListener('input', function () {
                _cfg.padding = parseInt(this.value) || 0;
                elPadVal.textContent = _cfg.padding;
                _fire();
            });

            // escala fuente
            var elFnt = document.getElementById(px + 'fnt');
            var elFntVal = document.getElementById(px + 'fntVal');
            elFnt.addEventListener('input', function () {
                _cfg.escalaFuente = parseFloat(this.value) || 1;
                elFntVal.textContent = _cfg.escalaFuente.toFixed(2);
                _fire();
            });

            // orden de secciones
            var _SECS = [
                { id: 'killers', label: 'Top Killers' },
                { id: 'booyah',  label: 'Booyah por sala' },
                { id: 'ascenso', label: 'Ascenso directo' }
            ];
            if (!Array.isArray(_cfg.ordenSecciones)) _cfg.ordenSecciones = _SECS.map(function(s){ return s.id; });
            var ordenWrap = document.getElementById(px + 'ordenWrap');
            function _renderOrden() {
                ordenWrap.innerHTML = '';
                _cfg.ordenSecciones.forEach(function (sid, idx) {
                    var sec = _SECS.find(function(s){ return s.id === sid; }) || { id: sid, label: sid };
                    var row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border-radius:4px;padding:6px 10px;';
                    row.innerHTML = '<span style="flex:1;font-size:.9rem">' + sec.label + '</span>' +
                        (idx > 0 ? '<button type="button" data-dir="up" data-idx="' + idx + '" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:3px;cursor:pointer">↑</button>' : '<span style="width:28px;height:28px;display:inline-block"></span>') +
                        (idx < _cfg.ordenSecciones.length-1 ? '<button type="button" data-dir="dn" data-idx="' + idx + '" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:3px;cursor:pointer">↓</button>' : '<span style="width:28px;height:28px;display:inline-block"></span>');
                    ordenWrap.appendChild(row);
                });
                ordenWrap.querySelectorAll('button[data-dir]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var i = parseInt(this.dataset.idx);
                        var arr = _cfg.ordenSecciones.slice();
                        if (this.dataset.dir === 'up') { var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; }
                        else                           { var t = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t; }
                        _cfg.ordenSecciones = arr;
                        _renderOrden();
                        _fire();
                    });
                });
            }
            _renderOrden();

            // guardar
            var elGuardar = document.getElementById(px + 'guardar');
            var elGuardadoMsg = document.getElementById(px + 'guardadoMsg');
            elGuardar.addEventListener('click', function () {
                _guardarLS(portal, _cfg);
                elGuardadoMsg.style.opacity = '1';
                setTimeout(function () { elGuardadoMsg.style.opacity = '0'; }, 2200);
            });

            _inst[portal] = { _cfg: _cfg, _cb: cb };
        },

        cfg: function (portal) {
            if (_inst[portal]) {
                var c = Object.assign({}, _inst[portal]._cfg);
                c.fondoDefault    = _inst[portal]._fondoDefault    || null;
                c.fondoDefaultFem = _inst[portal]._fondoDefaultFem || null;
                return c;
            }
            return Object.assign(_def(), _leerLS(portal) || {});
        }
    };
})();
