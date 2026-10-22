/* =====================================================================
   PROYECTN · Kit compartido de portales
   - Sesión de admin (login por usuario, sin @)
   - Protección de páginas por portal
   - Efecto global (iconos, fantasmas, calabazas, nieve)
   - Gestión de usuarios y roles

   Uso en cualquier página (después de supabase-js):
     <script src="../portal-kit/portal.js" data-portal="row" data-modo="protegido"></script>
   Los permisos vienen del ROL del usuario (tabla roles en Supabase).
   El efecto es GLOBAL: lo elige un rol con "personalizar" y sale en todas
   las páginas que cargan este script.
   Modos:
     publico    → solo aplica el efecto
     protegido  → exige sesión con permiso al portal + efecto
     admin      → exige sesión con permiso al portal + efecto (la página hace el resto)
     login      → solo aplica el efecto
   ===================================================================== */
(function () {
    const SUPABASE_URL = "https://bqemjroiegybdzksddkn.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZW1qcm9pZWd5YmR6a3NkZGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzgwNDIsImV4cCI6MjEwMzE1NDA0Mn0.49gC204FPWSNxWYa6eZFBgWJgr7ZvFax5mqOM9lyGPo";
    const CLAVE_SESION = 'pumas_admin';

    const PORTALES = {
        principal:      { nombre: 'Portal Principal', url: '/' },
        entrenamientos: { nombre: 'Entrenamientos',   url: '/portales/pumasgaming/',  admin: '/portales/pumasgaming/admin.html' },
        ascensosqfd:    { nombre: 'Ascensos QFD',     url: '/portales/quisqueya/',       admin: '/portales/quisqueya/admin.html' },
        row:            { nombre: 'ROW x Maya',       url: '/portales/row/',             admin: '/portales/row/admin.html' },
        rusheo:         { nombre: 'Rusheo',           url: '/portales/rusheo/',          admin: '/portales/rusheo/admin.html' },
        zmf:            { nombre: 'ZMF',              url: '/portales/zmf/',             admin: '/portales/zmf/admin.html' },
        zmffem:         { nombre: 'ZMF Femenino',     url: '/portales/zmf/femenino.html', admin: '/portales/zmf/admin.html' },
        // Dragon Fest: dos portales públicos (mixto y femenino) con UNA herramienta compartida
        dragonfest:     { nombre: 'Dragon Fest',          url: '/portales/dragonfest/',    admin: '/portales/dragonfest/admin.html' },
        dragonfestfem:  { nombre: 'Dragon Fest Femenino', url: '/portales/dragonfest/femenino.html', admin: '/portales/dragonfest/admin.html' },
        // Ascensos (base aparte, sql/17): AZA y el módulo de pruebas usan la misma herramienta
        ascensosaza:    { nombre: 'Ascensos LATAM',     url: '/ascensos/',        admin: '/ascensos/admin.html' },
        pruebas:        { nombre: 'Pruebas',          url: '/pruebas/',         admin: '/pruebas/admin.html' },
        torneos:        { nombre: 'Torneos',          url: '/torneos/',         admin: '/admin/torneos.html' }
        // + los módulos creados desde el panel (cargarModulos): /modulo/?p=<id>
    };

    const EFECTOS = {
        ninguno:   { nombre: 'Ninguno' },
        iconos:    { nombre: 'Iconos cayendo (personalizado)' },
        fantasmas: { nombre: 'Fantasmas', icono: '👻' },
        calabazas: { nombre: 'Calabazas', icono: '🎃' },
        nieve:     { nombre: 'Copos de nieve', icono: '❄' }
    };

    /* ---------------- Dirección limpia en la barra del navegador ---------------- */
    // · nunca se muestra "index.html" (la carpeta abre su index)
    // · en producción (GitHub Pages) tampoco ".html": /row/admin.html → /row/admin
    // · los enlaces del menú (#semana, #historico...) bajan a la sección sin ensuciar la dirección
    (function () {
        const prod = /(^|\.)pumasgaming\.com$|github\.io$/i.test(location.hostname);
        let ruta = location.pathname.replace(/\/index\.html$/i, '/');
        if (prod) ruta = ruta.replace(/\.html$/i, '');
        const hash = location.hash;
        if (ruta !== location.pathname || hash) {
            try { history.replaceState(history.state, '', ruta + location.search); } catch (e) { }
        }
        // si se llegó con #sección (ej. desde otra página), se baja a ella y se quita de la dirección
        if (hash && hash.length > 1) {
            // las tablas cargan después y empujan la sección: se re-alinea unos segundos, salvo que el usuario ya haya movido la página
            let quieto = true;
            const parar = () => { quieto = false; };
            ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, parar, { once: true, passive: true }));
            const ir = () => { if (!quieto) return; const el = document.getElementById(decodeURIComponent(hash.slice(1))); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' }); };
            const arrancar = () => [60, 500, 1200, 2200, 3500].forEach(t => setTimeout(ir, t));
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
            else arrancar();
        }
        document.addEventListener('click', e => {
            const a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a || a.getAttribute('href') === '#' || e.defaultPrevented) return;
            const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    })();

    const script = document.currentScript;
    // data-portal="@p" → el portal viene en la dirección (?p=<id>), para los módulos creados desde el panel
    const PORTAL = !script ? null
        : script.dataset.portal === '@p' ? ((new URLSearchParams(location.search).get('p') || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || null)
        : script.dataset.portal || null;
    const KIT = script && script.src ? script.src.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '/portal-kit/';
    const VERSION_KIT = script && script.src && /[?&]v=([^&]+)/.test(script.src) ? RegExp.$1 : '';
    const MODO = script ? (script.dataset.modo || 'publico') : 'publico';

    let cliente = null;
    function db() {
        if (!cliente && window.supabase && window.supabase.createClient) {
            cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, storageKey: 'pumas-portal-kit' }
            });
        }
        return cliente;
    }

    /* ---------------- Sesión ---------------- */
    function leerSesion() {
        try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
    }
    function guardarSesion(s) {
        try {
            localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
            // Compatibilidad con el panel de entrenamientos existente
            if (puede(s, 'entrenamientos')) localStorage.setItem('pumas_user', JSON.stringify({ nombre: s.nombre, usuario: s.usuario }));
        } catch (e) { /* almacenamiento bloqueado */ }
    }
    function borrarSesion() {
        try { localStorage.removeItem(CLAVE_SESION); localStorage.removeItem('pumas_user'); } catch (e) { }
    }
    function puede(s, portal) {
        if (!s || !Array.isArray(s.portales)) return false;
        return s.portales.includes('*') || s.portales.includes(portal);
    }
    // Permisos especiales del rol: 'personalizar' (efecto global) y 'gestionar' (usuarios y roles)
    function tiene(s, permiso) {
        return !!(s && s[permiso] === true);
    }

    async function login(usuario, password) {
        const c = db();
        if (!c) throw new Error('No se pudo conectar con la base de datos.');
        const { data, error } = await c.rpc('login_admin', { p_usuario: usuario, p_password: password });
        if (error) throw new Error(error.message);
        if (!data) return null;
        guardarSesion(data);
        return data;
    }

    async function validar() {
        const s = leerSesion();
        if (!s || !s.token) return null;
        const c = db();
        if (!c) return null;
        const { data, error } = await c.rpc('validar_sesion', { p_token: s.token });
        if (error || !data) { borrarSesion(); return null; }
        guardarSesion(data);
        return data;
    }

    async function logout(destino) {
        const s = leerSesion();
        borrarSesion();
        try { if (s && s.token && db()) await db().rpc('cerrar_sesion', { p_token: s.token }); } catch (e) { }
        window.location.href = destino || 'login.html';
    }

    // A dónde entra cada usuario después del login:
    //  - si todos sus portales usan la MISMA herramienta (ej. row, o dragonfest + dragonfestfem)
    //    → directo a esa herramienta (admin.html)
    //  - superadmin, Pumas, quien personaliza/gestiona o maneja varias herramientas → panel /admin/
    function herramientaUnica(s) {
        const p = (s && s.portales) || [];
        if (!p.length || p.includes('*') || p.includes('principal') || tiene(s, 'personalizar') || tiene(s, 'gestionar')) return null;
        const admins = new Set(p.map(id => PORTALES[id] && PORTALES[id].admin).filter(Boolean));
        return admins.size === 1 ? [...admins][0] : null;
    }
    function inicioDe(s) {
        return herramientaUnica(s) || '/admin/';
    }

    // permiso: undefined → acceso al portal; 'personalizar' o 'gestionar' → ese permiso del rol
    async function guard(portal, loginUrl, permiso) {
        const s = await validar();
        if (!s || !(permiso ? tiene(s, permiso) : puede(s, portal))) {
            const next = encodeURIComponent(location.pathname + location.search);
            window.location.replace((loginUrl || 'login.html') + '?next=' + next + (s ? '&denegado=1' : ''));
            return null;
        }
        document.documentElement.classList.remove('pg-verificando');
        return s;
    }

    /* ---------------- Personalización ---------------- */
    const EFECTO_VACIO = { efecto: 'ninguno', efecto_icono: '🔥', efecto_cantidad: 30 };

    async function leerFila(portal) {
        const c = db();
        if (!c) return null;
        const { data, error } = await c.from('portal_config').select('*').eq('portal', portal).maybeSingle();
        return error ? null : data;
    }

    // Efecto global (fila 'global'), igual para todo el sitio
    async function cargarEfecto() {
        const f = await leerFila('global');
        return f ? { efecto: f.efecto, efecto_icono: f.efecto_icono, efecto_cantidad: f.efecto_cantidad } : { ...EFECTO_VACIO };
    }

    function token() {
        const s = leerSesion();
        if (!s) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
        return s.token;
    }

    async function guardarEfecto(cfg) {
        const { error } = await db().rpc('guardar_efecto_global', {
            p_token: token(),
            p_efecto: cfg.efecto,
            p_icono: cfg.efecto_icono,
            p_cantidad: cfg.efecto_cantidad
        });
        if (error) throw new Error(error.message);
    }

    /* ---------------- Usuarios y roles (rol con "gestionar") ---------------- */
    async function rpcAdmin(nombre, params) {
        const { data, error } = await db().rpc(nombre, Object.assign({ p_token: token() }, params || {}));
        if (error) throw new Error(error.message);
        return data;
    }
    const usuarios = {
        listar: () => rpcAdmin('admin_listar'),
        guardarUsuario: u => rpcAdmin('admin_guardar_usuario', {
            p_usuario: u.usuario, p_nombre: u.nombre || null, p_rol: u.rol,
            p_activo: u.activo !== false, p_clave: u.clave || null
        }),
        guardarRol: r => rpcAdmin('admin_guardar_rol', {
            p_id: r.id, p_nombre: r.nombre, p_portales: r.portales || [],
            p_personalizar: !!r.personalizar, p_gestionar: !!r.gestionar
        }),
        eliminarRol: id => rpcAdmin('admin_eliminar_rol', { p_id: id }),
        padreRol: (id, padre) => rpcAdmin('admin_rol_padre', { p_id: id, p_padre: padre || null })
    };

    /* ---------------- Entrenos: guardar (herramientas) y corregir (superadmin) ---------------- */
    const entrenos = {
        // d: { portal, titulo, jornada, fecha (Date), moderador, salas: [...], killers: [...] }
        guardar: d => rpcAdmin('guardar_entreno', {
            p_portal: d.portal, p_titulo: d.titulo, p_jornada: d.jornada || null,
            p_fecha: (d.fecha || new Date()).toISOString(), p_moderador: d.moderador || null,
            p_salas: d.salas, p_killers: d.killers
        }),
        listar: portal => rpcAdmin('admin_entrenos', { p_portal: portal }),
        equipos: portal => rpcAdmin('admin_equipos_portal', { p_portal: portal }),
        borrar: (portal, id) => rpcAdmin('admin_borrar_entreno', { p_portal: portal, p_sesion: String(id) }),
        // corregir fecha/hora y (opcional) jornada de un entreno guardado (sql/21)
        editar: (portal, id, fecha, jornada) => rpcAdmin('admin_editar_entreno', {
            p_portal: portal, p_sesion: String(id), p_fecha: fecha.toISOString(), p_jornada: jornada ?? null
        }),
        renombrar: (portal, viejo, nuevo, sesion) => rpcAdmin('admin_renombrar_equipo', {
            p_portal: portal, p_viejo: viejo, p_nuevo: nuevo, p_sesion: sesion ? String(sesion) : null
        })
    };

    // Respaldo completo de la base en JSON (superadmin). No incluye contraseñas.
    const respaldo = () => rpcAdmin('admin_respaldo');

    // La función o tabla todavía no existe en la base (no se ha corrido el SQL)
    function faltaSql(error) {
        const m = String((error && (error.message || error.code)) || error || '');
        return /PGRST202|PGRST205|42883|42P01|Could not find the (function|table)|does not exist|schema cache/i.test(m);
    }
    const AVISO_SQL = 'Falta correr el SQL nuevo en Supabase (sql/17 a sql/32).';
    async function rpcPublico(nombre, params) {
        const c = db();
        if (!c) throw new Error('No se pudo conectar con la base de datos.');
        const { data, error } = await c.rpc(nombre, params || {});
        if (error) throw new Error(faltaSql(error) ? AVISO_SQL : error.message);
        return data;
    }

    /* ---------------- Módulos (portales creados o editados desde el panel) ---------------- */
    let modulosCache = null;
    async function cargarModulos(forzar) {
        if (modulosCache && !forzar) return modulosCache;
        let filas = null;
        try {
            const guardado = !forzar && JSON.parse(sessionStorage.getItem('pg_portales') || 'null');
            if (guardado && Date.now() - guardado.t < 5 * 60 * 1000) filas = guardado.f;
        } catch (e) { }
        if (!filas && db()) {
            let r = await db().from('portales').select('id,nombre,color,color2,color_tema,logo,titulo,subtitulo,ruta,tipo,activo,latam,link,orden');
            if (r.error) r = await db().from('portales').select('*');   // sin sql/17: columnas viejas
            filas = r.error ? [] : (r.data || []);
            try { sessionStorage.setItem('pg_portales', JSON.stringify({ t: Date.now(), f: filas })); } catch (e) { }
        }
        filas = filas || [];
        filas.filter(p => p.tipo === 'modulo' && p.activo !== false).forEach(p => {
            PORTALES[p.id] = { nombre: p.nombre, url: '/modulo/?p=' + p.id, admin: '/modulo/admin.html?p=' + p.id, modulo: true };
        });
        modulosCache = filas;
        return filas;
    }
    function olvidarModulos() { modulosCache = null; try { sessionStorage.removeItem('pg_portales'); } catch (e) { } }
    async function datosPortal(id) {
        return (await cargarModulos()).find(p => p.id === id) || null;
    }
    const modulos = {
        guardar: m => rpcAdmin('admin_modulo_guardar', {
            p_id: m.id, p_crear: !!m.crear, p_nombre: m.nombre ?? null, p_titulo: m.titulo ?? null, p_subtitulo: m.subtitulo ?? null,
            p_color: m.color ?? null, p_color2: m.color2 ?? null, p_logo: m.logo ?? null, p_link: m.link ?? null,
            p_latam: m.latam ?? null, p_activo: m.activo ?? null
        }).finally(olvidarModulos),
        borrar: id => rpcAdmin('admin_modulo_borrar', { p_id: id }).finally(olvidarModulos)
    };

    // "#E53935" → "229, 57, 53"
    function rgbDe(hex) {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
        return m ? [1, 2, 3].map(i => parseInt(m[i], 16)).join(', ') : null;
    }
    // Texto que se lee encima del color (negro o blanco)
    function textoSobre(hex) {
        const c = rgbDe(hex);
        if (!c) return '#0A0A0A';
        const [r, g, b] = c.split(', ').map(Number);
        return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0A0A0A' : '#FFFFFF';
    }
    function aplicarColores(nodo, principal, secundario) {
        if (rgbDe(principal)) {
            nodo.style.setProperty('--primary', principal);
            nodo.style.setProperty('--primary-rgb', rgbDe(principal));
            nodo.style.setProperty('--on-primary', textoSobre(principal));
        }
        if (rgbDe(secundario)) {
            nodo.style.setProperty('--accent', secundario);
            nodo.style.setProperty('--accent-rgb', rgbDe(secundario));
        }
    }
    // Lo que el superadmin cambió en el panel (color, logo, título) se aplica sobre la página del portal
    function aplicarPersonalizacion(p) {
        if (!p || p.tipo === 'modulo') return;   // los módulos se pintan solos (modulo/modulo.js)
        aplicarColores(document.body, p.color_tema, p.color2);
        if (p.logo) {
            document.querySelectorAll('.site-header .logo-img, .hero-mark img, .auth-card .logo-img').forEach(img => {
                img.onerror = null; img.src = p.logo;
            });
            const ico = document.querySelector('link[rel~="icon"]');
            if (ico) ico.href = p.logo;
        }
        if (p.titulo) {
            const t = escaparHtml(p.titulo);
            document.querySelectorAll('.site-header .logo').forEach(n => { n.innerHTML = `<span class="t-a">${t}</span><small>by PROYECTN</small>`; });
            // (si el título tiene piezas que usa la herramienta, ej. #heroCategoria de Dragon Fest, se cambia solo el texto principal)
            document.querySelectorAll('.portal-hero h1').forEach(n => {
                if (n.querySelector('[id]')) {
                    n.querySelectorAll('.t-x, .t-b').forEach(x => x.remove());
                    const a = n.querySelector('.t-a'); if (a) a.textContent = p.titulo;
                } else n.innerHTML = `<span class="t-a">${t}</span><small>by <b>PUMAS</b></small>`;
            });
            document.querySelectorAll('.auth-card h1').forEach(n => { n.innerHTML = `<span class="t-a">${t}</span>`; });
            document.title = document.title.replace(/^[^|·]+/, p.titulo + ' ');
        }
        if (p.subtitulo) {
            const par = document.querySelector('.portal-hero .hero-copy > p');
            if (par) par.textContent = p.subtitulo;
        }
    }

    /* ---------------- Inicio: torneos aliados ---------------- */
    const sitio = {
        guardar: (clave, valor) => rpcAdmin('admin_sitio_guardar', { p_clave: clave, p_valor: valor }),
        guardarAliado: a => rpcAdmin('admin_aliado_guardar', {
            p_id: a.id || null, p_nombre: a.nombre, p_descripcion: a.descripcion || null, p_logo: a.logo || null,
            p_link: a.link || null, p_fecha_texto: a.fecha_texto || null, p_orden: a.orden != null && a.orden !== '' ? Number(a.orden) : null,
            p_activo: a.activo !== false
        }),
        borrarAliado: id => rpcAdmin('admin_aliado_borrar', { p_id: id })
    };

    /* ---------------- Sorteos por portal ---------------- */
    const sorteo = {
        publico: portal => rpcPublico('sorteo_publico', { p_portal: portal }),
        inscribir: (portal, d) => rpcPublico('sorteo_inscribir', {
            p_portal: portal, p_equipo: d.equipo, p_representante: d.representante, p_instagram: d.instagram || null, p_contacto: d.contacto
        }),
        estado: () => rpcAdmin('sorteo_admin_estado'),
        listar: portal => rpcAdmin('sorteo_admin_listar', { p_portal: portal }),
        config: (portal, c) => rpcAdmin('sorteo_admin_config', {
            p_portal: portal, p_activo: c.activo ?? null, p_titulo: c.titulo ?? null, p_prefijo: c.prefijo ?? null,
            p_fecha_limite: c.fecha_limite ?? null, p_quitar_fecha: !!c.quitar_fecha, p_mostrar_lista: c.mostrar_lista ?? null
        }),
        borrar: (portal, id) => rpcAdmin('sorteo_admin_borrar', { p_portal: portal, p_id: id }),
        vaciar: portal => rpcAdmin('sorteo_admin_vaciar', { p_portal: portal }),
        ganador: (portal, id) => rpcAdmin('sorteo_admin_ganador', { p_portal: portal, p_id: id })
    };

    /* ---------------- Cupos (como los de Pumas) ---------------- */
    const cupos = {
        publicos: portal => rpcPublico('cupos_publicos', { p_portal: portal }),
        // Con el portal (sql/24) la base revisa que el cupo sea de ese portal; sin sql/24 usa la función anterior
        inscribir: async (id, equipo, telefono, portal) => {
            if (portal) {
                try { return await rpcPublico('cupo_inscribir_portal', { p_portal: portal, p_programado: id, p_equipo: equipo, p_telefono: telefono }); }
                catch (e) { if (e.message !== AVISO_SQL) throw e; }
            }
            return rpcPublico('cupo_inscribir', { p_programado: id, p_equipo: equipo, p_telefono: telefono });
        },
        listar: portal => rpcAdmin('admin_cupos_listar', { p_portal: portal }),
        guardar: (portal, d) => rpcAdmin('admin_cupo_guardar', {
            p_portal: portal, p_titulo: d.titulo, p_fecha: d.fecha.toISOString(), p_cupos: d.cupos, p_link: d.link || null,
            p_publicar_en: d.publicar_en ? d.publicar_en.toISOString() : null, p_staff: d.staff || []
        }),
        estado: (portal, id, estado) => rpcAdmin('admin_cupo_estado', { p_portal: portal, p_id: id, p_estado: estado }),
        borrar: (portal, id) => rpcAdmin('admin_cupo_borrar', { p_portal: portal, p_id: id }),
        quitar: (portal, cupo) => rpcAdmin('admin_cupo_quitar', { p_portal: portal, p_cupo: cupo }),
        tipo: (portal, id, tipo) => rpcAdmin('admin_cupo_tipo', { p_portal: portal, p_id: id, p_tipo: tipo }),
        vip: (portal, id, cierraEn) => rpcAdmin('admin_cupo_vip', { p_portal: portal, p_id: id, p_cierra_en: cierraEn ? new Date(cierraEn).toISOString() : null })
    };

    /* ---------------- Usuarios propios de cada portal (sql/31) ---------------- */
    const usuariosPortal = {
        listar: portal => rpcAdmin('portal_usuarios', { p_portal: portal }),
        guardar: (portal, u) => rpcAdmin('portal_usuario_guardar', { p_portal: portal, p_usuario: u.usuario, p_nombre: u.nombre || null,
            p_clave: u.clave || null, p_activo: u.activo !== false, p_tipo: u.tipo || 'staff' }),
        borrar: (portal, usuario) => rpcAdmin('portal_usuario_borrar', { p_portal: portal, p_usuario: usuario }),
        // Secciones del panel por usuario (sql/32)
        misSecciones: portal => rpcAdmin('portal_mis_secciones', { p_portal: portal }),
        secciones: (portal, usuario, lista) => rpcAdmin('portal_usuario_secciones', { p_portal: portal, p_usuario: usuario, p_secciones: lista })
    };

    /* ---------------- Entrenos PROYECTN como portal aparte (sql/28) ---------------- */
    const pumas = {
        misPermisos: () => rpcAdmin('pumas_mis_permisos'),
        portal: async () => {
            const { data, error } = await db().from('sitio_config').select('valor').eq('clave', 'portal_entrenamientos').maybeSingle();
            if (error) throw new Error(error.message);
            return (data && data.valor) || { ocultos: [] };
        },
        guardarPortal: ocultos => rpcAdmin('pumas_portal_guardar', { p_ocultos: ocultos }),
        usuarios: {
            listar: () => rpcAdmin('pumas_usr_listar'),
            guardar: u => rpcAdmin('pumas_usr_guardar', { p_usuario: u.usuario, p_nombre: u.nombre || null, p_clave: u.clave || null,
                p_activo: u.activo !== false, p_modulos: u.modulos || [] }),
            borrar: usuario => rpcAdmin('pumas_usr_borrar', { p_usuario: usuario })
        }
    };

    /* ---------------- Cupos VIP y baneo por equipo / número (sql/25) ---------------- */
    const control = {
        vipLista: portal => rpcAdmin('admin_vip_lista', { p_portal: portal }),
        vipGuardar: (portal, equipo, telefono) => rpcAdmin('admin_vip_guardar', { p_portal: portal, p_equipo: equipo, p_telefono: telefono }),
        vipBorrar: (portal, id) => rpcAdmin('admin_vip_borrar', { p_portal: portal, p_id: id }),
        baneos: portal => rpcAdmin('admin_baneos_lista', { p_portal: portal }),
        banear: (portal, b) => rpcAdmin('admin_baneo_guardar', { p_portal: portal, p_equipo: b.equipo || null, p_telefono: b.telefono || null, p_motivo: b.motivo || null, p_hasta: b.hasta || null }),
        desbanear: (portal, tipo, id) => rpcAdmin('admin_baneo_borrar', { p_portal: portal, p_tipo: tipo, p_id: id }),
        banearResultados: (portal, equipo, motivo, hasta) => rpcAdmin('admin_baneo_resultados', { p_portal: portal, p_equipo: equipo, p_motivo: motivo || null, p_hasta: hasta || null })
    };

    /* ---------------- Motores de IA (función ascensos-ia + sql/18) ---------------- */
    async function invocarIA(cuerpo) {
        const { data, error } = await db().functions.invoke('ascensos-ia', { body: cuerpo });
        if (error) {
            let msg = error.message;
            const res = error.context;
            if (res && typeof res.text === 'function') {
                // La función responde {error}; si no (corte por tiempo o memoria de Supabase), se muestra el código y el texto
                const estado = res.status;
                let texto = '';
                try { texto = await res.text(); } catch (e) { }
                let j = null;
                try { j = JSON.parse(texto); } catch (e) { }
                if (j && (j.error || j.message)) msg = j.error || j.message;
                else if (estado === 546 || /WORKER_LIMIT|memory/i.test(texto)) msg = 'La función se quedó sin memoria con tantas capturas. Prueba con menos (ej. 1 de slots y 4 de resultados).';
                else if (estado === 504 || estado === 408 || /timeout|timed out/i.test(texto)) msg = 'La IA tardó demasiado y Supabase cortó la lectura. Prueba con menos capturas.';
                else msg = `La función respondió ${estado}${texto ? ': ' + texto.slice(0, 200) : ''}`;
                if (estado === 404 && /NOT_FOUND|not found/i.test(texto)) msg = 'La función "ascensos-ia" no está publicada en Supabase (ver docs/IA_ASCENSOS.md).';
            } else if (/Failed to send/i.test(msg)) {
                msg = 'No se pudo conectar con la función "ascensos-ia" (¿está publicada?). Revisa tu conexión e intenta de nuevo.';
            }
            throw new Error(msg);
        }
        return data;
    }
    const ia = {
        motores: () => invocarIA({ accion: 'motores' }),
        leer: cuerpo => invocarIA(cuerpo),
        // superadmin: cuáles están activos y cuál va por defecto
        guardarMotores: (activos, defecto) => rpcAdmin('admin_ia_motores', { p_activos: activos, p_defecto: defecto || null })
    };

    /* ---------------- Ascensos (base aparte) y baneados ---------------- */
    async function leerTabla(consulta) {
        const { data, error } = await consulta;
        if (error) throw new Error(faltaSql(error) ? AVISO_SQL : error.message);
        return data || [];
    }
    const ascensos = {
        jornadas: (portal, limite) => leerTabla(db().from('asc_jornadas').select('*').eq('portal', portal)
            .order('fecha', { ascending: false }).limit(limite || 60)),
        guardar: (portal, datos) => rpcAdmin('asc_guardar_jornada', { p_portal: portal, p_datos: datos }),
        actualizarImagen: (portal, id, imagen) => rpcAdmin('asc_actualizar_imagen', { p_portal: portal, p_id: id, p_imagen: imagen }),
        borrar: (portal, id) => rpcAdmin('asc_borrar_jornada', { p_portal: portal, p_id: id }),
        // qué puede hacer el usuario: { jefe, moderador, ia, eventos (null = todos) } (sql/19)
        permisos: portal => rpcAdmin('asc_mis_permisos', { p_portal: portal }),
        moderadores: {
            listar: () => rpcAdmin('asc_mod_listar'),
            guardar: m => rpcAdmin('asc_mod_guardar', {
                p_usuario: m.usuario, p_nombre: m.nombre || null, p_clave: m.clave || null,
                p_activo: m.activo !== false, p_ia: !!m.ia, p_eventos: m.eventos === undefined ? null : m.eventos
            }),
            borrar: usuario => rpcAdmin('asc_mod_borrar', { p_usuario: usuario })
        }
    };
    /* ---------------- Resultados completos (exportado de la sala, sql/23) ---------------- */
    const stats = {
        guardar: (portal, sesion, filas) => rpcAdmin('guardar_stats', { p_portal: portal, p_sesion: String(sesion), p_filas: filas }),
        // superadmin: eventos donde está habilitado
        borrar: (portal, sesion) => rpcAdmin('borrar_stats', { p_portal: portal, p_sesion: String(sesion) }),
        configurar: portales => rpcAdmin('admin_export_completo', { p_portales: portales })
    };
    /* ---------------- Registro VIP de Pumas (sql/19) ---------------- */
    const vip = {
        validar: codigo => rpcPublico('vip_validar_codigo', { p_codigo: codigo }),
        registrar: d => rpcPublico('vip_registrar', { p_codigo: d.codigo, p_nombre: d.nombre, p_tag: d.tag, p_telefono: d.telefono, p_horarios: d.horarios }),
        codigos: {
            crear: (usos, dias, nota) => rpcAdmin('admin_vip_codigo_crear', { p_usos: usos, p_dias: dias, p_nota: nota || null }),
            listar: () => rpcAdmin('admin_vip_codigos'),
            desactivar: codigo => rpcAdmin('admin_vip_codigo_desactivar', { p_codigo: codigo })
        },
        listar: () => rpcAdmin('admin_vip_registros'),
        estado: (id, estado) => rpcAdmin('admin_vip_estado', { p_id: id, p_estado: estado }),
        borrar: id => rpcAdmin('admin_vip_borrar', { p_id: id })
    };
    const baneados = {
        listar: portal => leerTabla(db().from('asc_baneados').select('*').eq('portal', portal).order('equipo')),
        guardar: (portal, b) => rpcAdmin('asc_baneado_guardar', {
            p_portal: portal, p_equipo: b.equipo, p_tag: b.tag || null, p_motivo: b.motivo || null, p_hasta: b.hasta || null
        }),
        borrar: (portal, id) => rpcAdmin('asc_baneado_borrar', { p_portal: portal, p_id: id })
    };

    // Carga un script del kit una sola vez (misma versión que portal.js)
    const cargados = {};
    function cargarKit(archivo) {
        return cargados[archivo] || (cargados[archivo] = new Promise((ok, mal) => {
            const sc = document.createElement('script');
            sc.src = KIT + archivo + (VERSION_KIT ? '?v=' + VERSION_KIT : '');
            sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar ' + archivo));
            document.head.appendChild(sc);
        }));
    }


    /* ---------------- Ventana de confirmación ---------------- */
    // confirmar({ titulo, html, si, no, peligro }) → Promise<boolean>
    // Si html trae campos con [data-campo], resuelve { ok, campos: {nombre: valor} }
    function confirmar(op) {
        return new Promise(resolve => {
            const capa = document.createElement('div');
            capa.className = 'pg-modal';
            capa.innerHTML = `<div class="pg-modal-caja${op.peligro ? ' peligro' : ''}" role="dialog" aria-modal="true" aria-labelledby="pgModalTitulo">
                <h3 id="pgModalTitulo">${escaparHtml(op.titulo || '¿Confirmas?')}</h3>
                <div class="pg-modal-cuerpo">${op.html || ''}</div>
                <div class="pg-modal-botones">
                    <button type="button" class="btn-access btn-outline" data-r="no">${escaparHtml(op.no || 'No, cancelar')}</button>
                    <button type="button" class="btn-access${op.peligro ? ' btn-peligro' : ''}" data-r="si">${escaparHtml(op.si || 'Sí, confirmar')}</button>
                </div></div>`;
            const antes = document.activeElement;
            const cerrar = ok => {
                const campos = {};
                capa.querySelectorAll('[data-campo]').forEach(i => { campos[i.dataset.campo] = i.value; });
                capa.remove();
                document.removeEventListener('keydown', tecla);
                if (antes && antes.focus) antes.focus();
                resolve(capa.querySelector('[data-campo]') ? { ok, campos } : ok);
            };
            const tecla = e => { if (e.key === 'Escape') cerrar(false); };
            capa.addEventListener('click', e => {
                const b = e.target.closest('[data-r]');
                if (b) cerrar(b.dataset.r === 'si');
                else if (e.target === capa) cerrar(false);
            });
            document.addEventListener('keydown', tecla);
            document.body.appendChild(capa);
            (capa.querySelector('[data-campo]') || capa.querySelector('[data-r="no"]')).focus();
        });
    }

    /* ---------------- Efectos ---------------- */
    function inyectarEstilosBase() {
        if (document.getElementById('pg-kit-estilos')) return;
        const st = document.createElement('style');
        st.id = 'pg-kit-estilos';
        st.textContent = `
html.pg-verificando body{visibility:hidden}
.pg-efectos{position:fixed;inset:0;z-index:900;overflow:hidden;pointer-events:none}
.pg-particula{position:absolute;top:-10vh;display:block;line-height:1;user-select:none;will-change:transform;
  animation:pg-caer var(--dur) linear var(--delay) infinite}
.pg-particula>span{display:block;animation:pg-vaiven var(--sway) ease-in-out infinite alternate}
.pg-particula.sube{top:auto;bottom:-10vh;animation-name:pg-subir}
.pg-particula.gira>span{animation:pg-girar var(--sway) linear infinite}
@keyframes pg-caer{to{transform:translateY(120vh)}}
@keyframes pg-subir{0%{transform:translateY(0);opacity:0}10%{opacity:var(--op)}90%{opacity:var(--op)}100%{transform:translateY(-120vh);opacity:0}}
@keyframes pg-vaiven{from{transform:translateX(calc(var(--amp) * -1))}to{transform:translateX(var(--amp))}}
@keyframes pg-girar{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.pg-efectos{display:none}}`;
        document.head.appendChild(st);
    }

    function escaparHtml(t) {
        return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    // "🔥 ⭐ fa-solid fa-crown" → ['🔥','⭐','fa-solid fa-crown']
    function separarIconos(texto) {
        const partes = String(texto || '🔥').split(/[,\s]+/).filter(Boolean);
        const iconos = [];
        for (let i = 0; i < partes.length; i++) {
            if (/^fa-(solid|regular|brands)$/.test(partes[i]) && partes[i + 1] && partes[i + 1].startsWith('fa-')) {
                iconos.push(partes[i] + ' ' + partes[i + 1]); i++;
            } else if (partes[i].startsWith('fa-')) {
                iconos.push('fa-solid ' + partes[i]);
            } else {
                iconos.push(partes[i]);
            }
        }
        return iconos.length ? iconos : ['🔥'];
    }

    function aplicarEfecto(cfg) {
        inyectarEstilosBase();
        document.querySelectorAll('.pg-efectos').forEach(n => n.remove());
        if (!cfg || !cfg.efecto || cfg.efecto === 'ninguno' || !EFECTOS[cfg.efecto]) return;

        const iconos = cfg.efecto === 'iconos' ? separarIconos(cfg.efecto_icono) : [EFECTOS[cfg.efecto].icono];
        const cantidad = Math.max(5, Math.min(120, Number(cfg.efecto_cantidad) || 30));
        const capa = document.createElement('div');
        capa.className = 'pg-efectos';
        capa.setAttribute('aria-hidden', 'true');
        capa.setAttribute('data-html2canvas-ignore', 'true');

        const r = (a, b) => a + Math.random() * (b - a);
        for (let i = 0; i < cantidad; i++) {
            const p = document.createElement('i');
            p.className = 'pg-particula';
            if (cfg.efecto === 'fantasmas') p.classList.add('sube');
            if (cfg.efecto === 'calabazas') p.classList.add('gira');
            const icono = iconos[Math.floor(Math.random() * iconos.length)];
            const esFa = icono.includes('fa-');
            const tam = cfg.efecto === 'nieve' ? r(10, 26) : r(16, 38);
            const op = cfg.efecto === 'fantasmas' ? r(.35, .75) : r(.55, .95);
            p.style.cssText = `left:${r(0, 100)}vw;font-size:${tam}px;opacity:${op};--op:${op};` +
                `--dur:${r(cfg.efecto === 'nieve' ? 9 : 7, cfg.efecto === 'nieve' ? 18 : 15)}s;--delay:${r(-15, 0)}s;` +
                `--sway:${r(2, 4.5)}s;--amp:${r(10, 40)}px;color:var(--primary,#D8C395)`;
            p.innerHTML = esFa ? `<span><i class="${escaparHtml(icono)}"></i></span>` : `<span>${escaparHtml(icono)}</span>`;
            capa.appendChild(p);
        }
        document.body.appendChild(capa);
    }

    /* ---------------- Cabecera con sesión ---------------- */
    function pintarSesionEnCabecera(s) {
        document.querySelectorAll('[data-pg-usuario]').forEach(n => { n.textContent = s.nombre || s.usuario; });
        // Elementos que solo ve quien tiene ese permiso: data-pg-permiso="personalizar|gestionar"
        document.querySelectorAll('[data-pg-permiso]').forEach(n => { n.hidden = !tiene(s, n.dataset.pgPermiso); });
        // Enlace al panel /admin/: solo si el usuario maneja más de un portal
        document.querySelectorAll('[data-pg-hub]').forEach(n => { n.hidden = !!herramientaUnica(s); });
        document.querySelectorAll('[data-pg-salir]').forEach(n => {
            n.addEventListener('click', e => { e.preventDefault(); logout(n.getAttribute('href') && n.getAttribute('href') !== '#' ? n.getAttribute('href') : 'login.html'); });
        });
    }

    /* ---------------- Arranque automático ---------------- */
    if (PORTAL && (MODO === 'protegido' || MODO === 'admin')) {
        document.documentElement.classList.add('pg-verificando');
        inyectarEstilosBase();
    }

    async function iniciar() {
        if (PORTAL) {
            // color/logo/título que el superadmin cambió en el panel (no frena el resto)
            datosPortal(PORTAL).then(aplicarPersonalizacion).catch(() => { });
        }
        if (PORTAL && (MODO === 'protegido' || MODO === 'admin')) {
            const sesion = await guard(PORTAL, script.dataset.login);
            if (!sesion) return;
            pintarSesionEnCabecera(sesion);
            window.dispatchEvent(new CustomEvent('pg:sesion', { detail: sesion }));
        }
        if (PORTAL && MODO === 'publico' && script.dataset.sinSorteo === undefined) montarSorteoSiActivo();
        if (script && script.dataset.sinEfecto === undefined) aplicarEfecto(await cargarEfecto());
    }

    // Si el superadmin activó el sorteo de este portal, sale el formulario para anotarse
    async function montarSorteoSiActivo() {
        try {
            const c = db();
            if (!c) return;
            const { data, error } = await c.from('sorteos').select('activo').eq('portal', PORTAL).maybeSingle();
            if (error || !data || !data.activo) return;
            await cargarKit('sorteo.js');
            if (window.PumasSorteo) window.PumasSorteo.montarPublico(PORTAL);
        } catch (e) { /* sin sql/17 no hay sorteos */ }
    }

    /* ---------------- Botón "Compartir página" (vista móvil, solo páginas públicas) ---------------- */
    // Aparece al lado del botón del menú (☰) cuando este se ve. En páginas sin ☰ va al final del header en móvil.
    function montarCompartir() {
        if (MODO !== 'publico' || /^\/admin\//.test(location.pathname)) return;
        const header = document.querySelector('header');
        if (!header || header.querySelector('.pg-compartir')) return;
        if (!document.getElementById('pgCompartirCss')) {
            const st = document.createElement('style');
            st.id = 'pgCompartirCss';
            st.textContent = `
.pg-compartir{display:none;flex:0 0 auto;align-items:center;gap:5px;height:40px;margin-left:auto;padding:0 8px;
  border:1px solid var(--line,#333);background:#171717;color:var(--primary,#D8C395);cursor:pointer;
  font:700 .48rem/1.25 var(--font-display,'Michroma',sans-serif);letter-spacing:0;text-align:left;text-transform:uppercase;white-space:nowrap;
  -webkit-tap-highlight-color:transparent}
.pg-compartir.visible{display:inline-flex}
.pg-compartir i{font-size:.85rem}
.pg-compartir + .menu-toggle{margin-left:8px;flex:0 0 auto}
.pg-midiendo > *{flex-shrink:0 !important}
.site-header.pg-apretado,header.pg-apretado{gap:6px !important}
.pg-compartir-aviso{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3000;
  padding:10px 16px;border:1px solid var(--line,#333);background:#111;color:#f4eedc;font:600 .85rem system-ui,sans-serif;
  box-shadow:0 10px 24px rgba(0,0,0,.5);pointer-events:none}
/* si no cabe el texto junto al logo, queda solo el ícono */
.pg-compartir.compacto span{display:none}.pg-compartir.compacto{width:42px;justify-content:center;padding:0}`;
            document.head.appendChild(st);
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pg-compartir';
        btn.setAttribute('aria-label', 'Compartir página');
        btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i><span>Compartir<br>página</span>';
        const toggle = header.querySelector('.menu-toggle');
        // sin ☰: justo después del logo, para que se vea aunque el menú de la página sea ancho
        if (toggle) toggle.before(btn); else if (header.firstElementChild) header.firstElementChild.after(btn); else header.appendChild(btn);
        // visible solo cuando el ☰ se muestra (o en pantallas de móvil si la página no tiene ☰)
        const actualizar = () => {
            btn.classList.toggle('visible',
                toggle ? getComputedStyle(toggle).display !== 'none' : matchMedia('(max-width: 760px)').matches);
            btn.classList.remove('compacto');
            header.classList.remove('pg-apretado');
            if (!btn.classList.contains('visible')) return;
            // se mide con nada encogido: si el header se desborda, el texto no cabe
            const desborda = () => {
                header.classList.add('pg-midiendo');
                const ult = toggle || btn;
                const limite = header.getBoundingClientRect().right - parseFloat(getComputedStyle(header).paddingRight || 0);
                const d = header.scrollWidth > header.clientWidth + 1 || ult.getBoundingClientRect().right > limite + 1;
                header.classList.remove('pg-midiendo');
                return d;
            };
            if (desborda()) btn.classList.add('compacto');
            // logos muy anchos (ej. LATAM): aun solo con el ícono, se junta un poco el espacio entre logo y botones
            if (btn.classList.contains('compacto') && desborda()) header.classList.add('pg-apretado');
        };
        actualizar();
        addEventListener('resize', actualizar);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(actualizar);
        btn.addEventListener('click', async () => {
            const url = location.href.split('#')[0];
            const titulo = document.title;
            if (navigator.share) {
                try { await navigator.share({ title: titulo, url }); } catch (e) { }
                return;
            }
            let ok = false;
            try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { }
            const aviso = document.createElement('div');
            aviso.className = 'pg-compartir-aviso';
            aviso.textContent = ok ? '✔ Enlace copiado' : url;
            document.body.appendChild(aviso);
            setTimeout(() => aviso.remove(), 2200);
        });
    }

    /* ---------------- Dinámicas por portal (sql/33) ---------------- */
    const dinamica = {
        publico:  (portal, tipo)                               => rpcPublico('din_publico',       { p_portal: portal, p_tipo: tipo }),
        registrar:(portal, tipo, d)                            => rpcPublico('din_registrar',     { p_portal: portal, p_tipo: tipo, p_nombre: d.nombre, p_numero: d.numero || null, p_ig: d.ig || null, p_metadata: d.metadata || {}, p_voter_token: d.voterToken || null, p_recaptcha_token: d.recaptchaToken || null }),
        config:   (portal, tipo, c)                            => rpcAdmin  ('din_admin_config',  { p_portal: portal, p_tipo: tipo, p_activo: c.activo ?? null, p_titulo: c.titulo ?? null, p_config: c.config ?? null, p_deadline: c.deadline ?? null, p_quitar_deadline: !!c.quitarDeadline, p_inicio: c.inicio ?? null, p_quitar_inicio: !!c.quitarInicio }),
        listar:   (portal, tipo)                               => rpcAdmin  ('din_admin_listar',  { p_portal: portal, p_tipo: tipo }),
        borrar:   (portal, id)                                 => rpcAdmin  ('din_admin_borrar',  { p_portal: portal, p_id: id }),
        vaciar:   (portal, tipo)                               => rpcAdmin  ('din_admin_vaciar',  { p_portal: portal, p_tipo: tipo }),
        archivar: (portal, tipo)                               => rpcAdmin  ('din_admin_archivar', { p_portal: portal, p_tipo: tipo }),
        historial:(portal, tipo)                               => rpcAdmin  ('din_admin_historial',{ p_portal: portal, p_tipo: tipo ?? null })
    };

    /* ---------------- Multi-encuesta (sql/41) ---------------- */
    const enc = {
        publico:     (portal)      => rpcPublico('din_enc_publico',         { p_portal: portal }),
        votar:       (id, d)       => rpcPublico('din_enc_votar',           { p_encuesta_id: id, p_nombre: d.nombre, p_opcion_idx: d.opcion_idx, p_voter_token: d.voterToken || null, p_recaptcha_token: d.recaptchaToken || null }),
        listar:      (portal)      => rpcAdmin  ('din_enc_admin_listar',    { p_portal: portal }),
        crear:       (portal, d)   => rpcAdmin  ('din_enc_admin_crear',     { p_portal: portal, p_titulo: d.titulo || null, p_pregunta: d.pregunta || null, p_opciones: d.opciones, p_imagen: d.imagen || null, p_deadline: d.deadline || null, p_activo: d.activo ?? false, p_n_ganadores: d.nGanadores ?? 1 }),
        editar:      (id, d)       => rpcAdmin  ('din_enc_admin_editar',    { p_id: id, p_titulo: d.titulo ?? null, p_pregunta: d.pregunta ?? null, p_opciones: d.opciones ?? null, p_imagen: d.imagen ?? null, p_deadline: d.deadline ?? null, p_activo: d.activo ?? null, p_quitar_deadline: !!d.quitarDeadline, p_n_ganadores: d.nGanadores ?? null }),
        restablecer: (id)          => rpcAdmin  ('din_enc_admin_restablecer',{ p_id: id }),
        borrar:      (id)          => rpcAdmin  ('din_enc_admin_borrar',    { p_id: id }),
    };

    /* ---------------- Torneos aliados (sql/35) ---------------- */
    const torneos = {
        // Público
        publico:             (portal)                         => rpcPublico('torneos_publico',              { p_portal: portal }),
        tabla:               (id)                             => rpcPublico('torneos_tabla',                { p_torneo_id: id }),
        // Admin — torneos
        adminListar:         (portal)                         => rpcAdmin  ('torneos_admin_listar',         { p_portal: portal }),
        adminGuardar:        (portal, d)                      => rpcAdmin  ('torneos_admin_guardar',        { p_portal: portal, p_id: d.id ?? null, p_nombre: d.nombre ?? null, p_juego: d.juego ?? 'free_fire', p_descripcion: d.descripcion ?? null, p_fecha_inicio: d.fechaInicio ?? null, p_fecha_fin: d.fechaFin ?? null, p_estado: d.estado ?? 'borrador', p_config: d.config ?? {}, p_colores: d.colores ?? {}, p_logo_url: d.logoUrl ?? null, p_banner_url: d.bannerUrl ?? null, p_publico: d.publico ?? false }),
        adminBorrar:         (portal, id)                     => rpcAdmin  ('torneos_admin_borrar',         { p_portal: portal, p_id: id }),
        adminResultado:      (portal, torneoId, partidaId, r) => rpcAdmin  ('torneos_admin_resultado',      { p_portal: portal, p_torneo_id: torneoId, p_partida_id: partidaId, p_resultados: r }),
        adminLog:            (portal, torneoId, d)            => rpcAdmin  ('torneos_admin_log',            { p_portal: portal, p_torneo_id: torneoId, p_partida_id: d.partidaId ?? null, p_nombre: d.nombre ?? null, p_contenido: d.contenido ?? null }),
        // Admin — equipos (sql/36)
        adminEquipos:        (portal, torneoId)               => rpcAdmin  ('torneos_admin_equipos',        { p_portal: portal, p_torneo_id: torneoId }),
        adminEquipoGuardar:  (portal, torneoId, d)            => rpcAdmin  ('torneos_admin_equipo_guardar', { p_portal: portal, p_torneo_id: torneoId, p_id: d.id ?? null, p_nombre: d.nombre ?? null, p_contacto: d.contacto ?? null, p_ig: d.ig ?? null, p_seed: d.seed ?? null, p_grupo: d.grupo ?? null, p_eliminado: d.eliminado ?? false, p_metadata: d.metadata ?? {} }),
        adminEquipoBorrar:   (portal, id)                     => rpcAdmin  ('torneos_admin_equipo_borrar',  { p_portal: portal, p_id: id }),
        // Admin — partidas (sql/36)
        adminPartidas:       (portal, torneoId)               => rpcAdmin  ('torneos_admin_partidas',       { p_portal: portal, p_torneo_id: torneoId }),
        adminPartidaGuardar: (portal, torneoId, d)            => rpcAdmin  ('torneos_admin_partida_guardar',{ p_portal: portal, p_torneo_id: torneoId, p_id: d.id ?? null, p_fase: d.fase ?? 'grupos', p_ronda: d.ronda ?? 1, p_sala: d.sala ?? null, p_estado: d.estado ?? 'pendiente', p_notas: d.notas ?? null }),
        adminPartidaBorrar:  (portal, id)                     => rpcAdmin  ('torneos_admin_partida_borrar', { p_portal: portal, p_id: id }),
        // Admin — logs (sql/36)
        adminLogs:           (portal, torneoId)               => rpcAdmin  ('torneos_admin_logs',           { p_portal: portal, p_torneo_id: torneoId })
    };

    window.PumasPortal = {
        PORTALES, EFECTOS, portal: PORTAL,
        login, logout, validar, guard, puede, tiene, inicioDe, db, sesion: leerSesion,
        cargarEfecto, guardarEfecto, aplicarEfecto, usuarios, entrenos, respaldo, confirmar, escaparHtml,
        cargarModulos, olvidarModulos, datosPortal, modulos, aplicarColores, aplicarPersonalizacion, rgbDe, textoSobre,
        sitio, sorteo, cupos, control, pumas, usuariosPortal, ascensos, baneados, ia, vip, stats, dinamica, enc, torneos, cargarKit, faltaSql, segmentar
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarCompartir);
    else montarCompartir();

    // Menú: si los enlaces no caben en la barra (a cualquier ancho), pasa a menú de hamburguesa
    function ajustarNav() {
        const h = document.querySelector('.site-header');
        const nav = h && h.querySelector('.main-nav'), btn = h && h.querySelector('.menu-toggle'), ul = nav && nav.querySelector('ul');
        if (!ul || !btn) return;
        if (window.innerWidth <= 760) { h.classList.remove('nav-compacta'); return; }   // el celular ya usa hamburguesa
        const estaba = h.classList.contains('nav-compacta');
        h.classList.remove('nav-compacta');
        const logo = h.querySelector('.logo-container');
        const cs = getComputedStyle(h);
        const disponible = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (logo ? logo.offsetWidth : 0) - 32
            - [...h.children].filter(c => c !== nav && c !== logo && c !== btn && c.offsetParent).reduce((a, c) => a + c.offsetWidth, 0);
        const compacta = ul.scrollWidth > disponible;
        h.classList.toggle('nav-compacta', compacta);
        if (!compacta || !estaba) nav.classList.remove('is-active');
    }
    function montarNav() {
        const h = document.querySelector('.site-header'), nav = h && h.querySelector('.main-nav');
        if (!nav) return;
        let t = null;
        const ajustar = () => { clearTimeout(t); t = setTimeout(ajustarNav, 60); };
        ajustar();
        window.addEventListener('resize', ajustar);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
        new MutationObserver(ajustar).observe(nav, { childList: true, subtree: true });   // usuario y enlaces que se agregan después
        // En el menú compacto, tocar un enlace lo cierra
        nav.addEventListener('click', e => { if (e.target.closest('a') && h.classList.contains('nav-compacta')) nav.classList.remove('is-active'); });
    }

    // <select data-segmentado> → pestañas (el select sigue mandando: mismos valores y mismo evento change)
    function segmentar(raiz) {
        (raiz || document).querySelectorAll('select[data-segmentado]:not([data-seg-listo])').forEach(sel => {
            sel.dataset.segListo = '1';
            const grupo = document.createElement('div');
            grupo.className = 'segmentos';
            grupo.setAttribute('role', 'tablist');
            const etiqueta = sel.id && document.querySelector(`label[for="${sel.id}"]`);
            if (etiqueta) grupo.setAttribute('aria-label', etiqueta.textContent.trim());
            const marcar = () => grupo.querySelectorAll('button').forEach(b => {
                const on = b.dataset.valor === sel.value;
                b.classList.toggle('on', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            [...sel.options].forEach(o => {
                const b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('role', 'tab');
                b.dataset.valor = o.value;
                b.textContent = o.textContent;
                b.addEventListener('click', () => { if (sel.value === o.value) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); marcar(); });
                grupo.appendChild(b);
            });
            sel.addEventListener('change', marcar);
            marcar();
            sel.classList.add('seg-oculto');
            sel.after(grupo);
        });
    }

    // Paneles de los portales: cada enlace del menú (#seccion) muestra SOLO su sección, como pestañas,
    // en vez de un scroll largo. La portada solo sale en la primera. Sirve para cualquier panel con
    // enlaces #id a <section>; las herramientas que ya tienen pestañas propias no se tocan.
    function montarSeccionesAdmin() {
        if (!(MODO === 'protegido' || MODO === 'admin')) return;
        if (document.getElementById('navAdmin') || document.querySelector('.asc-tabs')) return;
        const nav = document.getElementById('mainNav');
        if (!nav) return;
        const enlaces = [...nav.querySelectorAll('a[href^="#"]')].filter(a => {
            const t = document.getElementById(a.getAttribute('href').slice(1));
            return t && t.tagName === 'SECTION';
        });
        if (enlaces.length < 2) return;
        const secciones = [...new Set(enlaces.map(a => document.getElementById(a.getAttribute('href').slice(1))))];
        const hero = document.querySelector('.portal-hero');
        const visibles = () => secciones.filter(s => !s.hidden);
        function mostrar(id, subir) {
            const lista = visibles();
            if (!lista.some(s => s.id === id)) id = lista.length ? lista[0].id : secciones[0].id;
            secciones.forEach(s => s.classList.toggle('seccion-oculta', s.id !== id));
            enlaces.forEach(a => { const on = a.getAttribute('href') === '#' + id; a.classList.toggle('activo', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
            if (hero) hero.classList.toggle('seccion-oculta', id !== (lista[0] || secciones[0]).id);
            try { history.replaceState(null, '', '#' + id); } catch (e) { /* sin historial */ }
            if (subir) window.scrollTo({ top: 0, behavior: 'smooth' });
            window.dispatchEvent(new CustomEvent('pg:seccion', { detail: { id } }));
        }
        enlaces.forEach(a => a.addEventListener('click', e => { e.preventDefault(); mostrar(a.getAttribute('href').slice(1), true); }));
        mostrar(location.hash.slice(1), false);
        window.PumasSecciones = { mostrar, secciones };
        // Si a un usuario se le ocultan secciones (permisos) después de cargar, se vuelve a acomodar
        new MutationObserver(() => { const act = secciones.find(s => !s.classList.contains('seccion-oculta')); if (!act || act.hidden) mostrar('', false); })
            .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    }

    // Animaciones: scroll reveal + contadores, solo si el sistema no pide reducir movimiento
    function montarAnimaciones() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        cargarKit('animaciones.js').catch(() => { /* sin animaciones */ });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { montarNav(); segmentar(); montarSeccionesAdmin(); montarAnimaciones(); });
    else { montarNav(); segmentar(); montarSeccionesAdmin(); montarAnimaciones(); }

    // Créditos del creador en el pie de página (todas las páginas; las que no tienen pie, menos el login, reciben uno)
    const CREADOR = { usuario: '@coach.nikoh', url: 'https://www.instagram.com/coach.nikoh/' };
    function montarCreditos() {
        if (document.querySelector('.pg-creditos')) return;
        let pie = document.querySelector('footer');
        if (!pie) {
            if (document.getElementById('formLogin')) return;
            pie = document.createElement('footer');
            document.body.appendChild(pie);
        }
        if (!document.getElementById('pgCreditosCss')) {
            const st = document.createElement('style');
            st.id = 'pgCreditosCss';
            st.textContent = `.pg-creditos{margin:8px 0 0;font-size:.82rem;opacity:.85;text-align:center}
.pg-creditos a{display:inline-flex;align-items:center;gap:5px;color:var(--primary,#D8C395);font-weight:bold;text-decoration:none}
.pg-creditos a:hover{text-decoration:underline}`;
            document.head.appendChild(st);
        }
        const p = document.createElement('p');
        p.className = 'pg-creditos';
        p.innerHTML = `Página creada por <a href="${CREADOR.url}" target="_blank" rel="noopener" aria-label="Instagram de ${CREADOR.usuario}"><i class="fa-brands fa-instagram"></i> ${CREADOR.usuario}</a>`;
        pie.appendChild(p);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarCreditos);
    else montarCreditos();
})();
