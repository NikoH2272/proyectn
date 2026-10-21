const SUPABASE_URL = "https://bqemjroiegybdzksddkn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZW1qcm9pZWd5YmR6a3NkZGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzgwNDIsImV4cCI6MjEwMzE1NDA0Mn0.49gC204FPWSNxWYa6eZFBgWJgr7ZvFax5mqOM9lyGPo";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const normEquipo = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

window.addEventListener('DOMContentLoaded', cargarEntrenamientosActivos);

// Contador hasta que se abren las inscripciones ("2d 03:14:22")
function tiempoRestante(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    const z = n => String(n).padStart(2, '0');
    return (d ? d + 'd ' : '') + z(h) + ':' + z(m) + ':' + z(s);
}
let relojCupos = null;
function arrancarRelojCupos() {
    clearInterval(relojCupos);
    const tic = () => {
        let abrio = false;
        document.querySelectorAll('[data-abre]').forEach(el => {
            const falta = Number(el.dataset.abre) - Date.now();
            if (falta <= 0) abrio = true; else el.textContent = tiempoRestante(falta);
        });
        if (abrio) { clearInterval(relojCupos); cargarEntrenamientosActivos(); }
    };
    if (document.querySelector('[data-abre]')) { tic(); relojCupos = setInterval(tic, 1000); }
}

async function cargarEntrenamientosActivos() {
    const contenedor = document.getElementById('contenedorEntrenamientos');
    
    try {
        let { data: entrenamientos, error } = await supabaseClient
            .from('entrenamientos_programados')
            .select('*')
            
            .eq('estado', 'ABIERTO')
            // También los programados (se abren dentro de 7 días) para mostrar su contador
            .or('publicar_en.is.null,publicar_en.lte.' + new Date(Date.now() + 7 * 86400000).toISOString())
            .order('fecha', { ascending: true });

        if (error) throw error;

        // cupos.html muestra solo los PÚBLICOS; cupos-vip.html (oculta, con link) solo los VIP
        const soloVip = window.CUPOS_TIPO === 'VIP';
        entrenamientos = (entrenamientos || []).filter(e => (e.tipo === 'VIP') === soloVip && (!e.cierra_en || new Date(e.cierra_en) > new Date()));

        if (!entrenamientos || entrenamientos.length === 0) {
            contenedor.innerHTML = `<div style="text-align:center; color:var(--gray); padding:40px; background: var(--dark-card); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">${window.CUPOS_TIPO === 'VIP' ? 'No hay cupos VIP abiertos en este momento.' : 'No hay entrenamientos programados en este momento. Vuelve pronto.'}</div>`;
            return;
        }

        // Consultar TODOS los equipos inscritos (públicos y de staff)
        const { data: registros } = await supabaseClient.from('registro_cupos').select('*');
        
        let equiposPorEntrenamiento = {};
        if (registros) {
            registros.forEach(reg => {
                if (!equiposPorEntrenamiento[reg.entrenamiento_id]) {
                    equiposPorEntrenamiento[reg.entrenamiento_id] = [];
                }
                equiposPorEntrenamiento[reg.entrenamiento_id].push(reg);
            });
        }

        contenedor.innerHTML = '';
        entrenamientos.forEach(ent => {
            let listaEquipos = equiposPorEntrenamiento[ent.id] || [];
            let inscritos = listaEquipos.length; // Resta automáticamente los cupos del staff y los públicos
            let cuposRestantes = ent.cupos_totales - inscritos;
            let fechaStr = new Date(ent.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
            
            // Generar el bloque visual de los equipos confirmados
            let listaHTML = '';
            if (listaEquipos.length > 0) {
                listaHTML = `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <h4 style="color: var(--primary); font-family: 'Michroma'; font-size: 0.9rem; margin-bottom: 10px;">📋 EQUIPOS CONFIRMADOS (${inscritos}/${ent.cupos_totales}):</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">`;
                
                listaEquipos.forEach(eq => {
                    let esStaff = eq.telefono === 'REGISTRO STAFF';
                    let badge = esStaff ? `<i class="fa-solid fa-shield-halved" style="color: var(--primary); margin-left: 5px;" title="Asegurado por Staff"></i>` : '';
                    let colorFondo = esStaff ? 'rgba(216,195,149, 0.15)' : 'rgba(255,255,255,0.05)';
                    let borde = esStaff ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)';
                    
                    listaHTML += `<span style="background: ${colorFondo}; border: ${borde}; padding: 5px 10px; border-radius: 4px; font-size: 0.85rem; color: #fff;">${eq.nombre_jugador} ${badge}</span>`;
                });
                
                listaHTML += `</div></div>`;
            }

            const abre = ent.publicar_en ? new Date(ent.publicar_en).getTime() : 0;
            const pendiente = abre > Date.now();
            const contador = pendiente ? `
                <div style="margin-top: 15px; padding: 14px; text-align: center; border: 1px dashed rgba(255,213,74,0.55); background: rgba(255,213,74,0.07); border-radius: 8px;">
                    <div style="color: var(--gray); font-size: 0.8rem;"><i class="fa-solid fa-hourglass-half" style="color:#FFD54A"></i> LAS INSCRIPCIONES SE ABREN EN</div>
                    <div data-abre="${abre}" style="color: #FFE38A; font-family: 'Michroma'; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: bold; margin: 6px 0; font-variant-numeric: tabular-nums;">${tiempoRestante(abre - Date.now())}</div>
                    <div style="color: var(--gray); font-size: 0.8rem;">${new Date(abre).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</div>
                </div>` : '';

            let btnInscribir = pendiente
                ? `<button disabled style="background: rgba(255,213,74,0.15); color: #FFE38A; padding: 10px 20px; border-radius: 6px; font-family: 'Michroma'; font-weight: bold; border: 1px solid rgba(255,213,74,0.5);"><i class="fa-solid fa-lock"></i> AÚN NO ABRE</button>`
                : cuposRestantes > 0 
                ? `<button onclick="abrirModalInscripcion('${ent.id}', '${ent.titulo.replace(/'/g, "\\'")}', '${ent.link_grupo}', '${ent.tipo === 'VIP' ? 'VIP' : 'PUBLICO'}')" class="btn-access" style="padding: 10px 20px; border:none; cursor:pointer;">INSCRIBIR EQUIPO</button>`
                : `<button disabled style="background: var(--secondary); color: var(--dark); padding: 10px 20px; border-radius: 6px; font-family: 'Michroma'; font-weight: bold; border:none;">CUPOS AGOTADOS</button>`;

            contenedor.innerHTML += `
                <div style="background: var(--dark-card); border: 1px solid rgba(216,195,149, 0.2); border-left: 4px solid ${pendiente ? '#FFD54A' : 'var(--primary)'}; border-radius: 10px; padding: 25px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
                        <div>
                            <h2 style="color: var(--light); font-family: 'Michroma'; font-size: 1.4rem; margin:0 0 10px 0;">${ent.tipo === 'VIP' ? '<span style="display:inline-block;padding:3px 8px;margin-right:8px;border-radius:4px;background:#FFD54A;color:#1a1400;font-size:.7rem;vertical-align:middle"><i class="fa-solid fa-crown"></i> SOLO VIP</span>' : ''}${ent.titulo}</h2>
                            <div style="color: var(--gray); font-size: 0.95rem; margin-bottom: 5px;"><i class="fa-regular fa-clock" style="color: var(--primary);"></i> ${fechaStr}</div>
                            ${ent.cierra_en ? `<div style="color: #FFE38A; font-size: 0.9rem; margin-bottom: 5px;"><i class="fa-solid fa-hourglass-end"></i> Inscripciones hasta las ${new Date(ent.cierra_en).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })} (hora Colombia)</div>` : ''}
                            <div style="color: var(--gray); font-size: 0.95rem;"><i class="fa-solid fa-users" style="color: var(--primary);"></i> Cupos disponibles: <strong style="color: #D8C395; font-family:'Michroma'; font-size:1.1rem;">${cuposRestantes} / ${ent.cupos_totales}</strong></div>
                        </div>
                        <div>${btnInscribir}</div>
                    </div>
                    ${contador}
                    ${listaHTML}
                </div>
            `;
        });
        arrancarRelojCupos();

    } catch (err) {
        console.error("Error al cargar cupos:", err);
        contenedor.innerHTML = `<div style="text-align:center; color:#ff3333; padding:40px;">Error al cargar la información de la base de datos.</div>`;
    }
}

function abrirModalInscripcion(id, titulo, link, tipo) {
    document.getElementById('entrenamientoId').value = id;
    // Cupo VIP: avisar que deben usar el mismo nombre y número con que se registraron como VIP
    let nota = document.getElementById('notaVip');
    if (!nota) {
        nota = document.createElement('div');
        nota.id = 'notaVip';
        nota.style.cssText = 'margin-bottom:14px;padding:10px 12px;border:1px solid rgba(255,213,74,.55);background:rgba(255,213,74,.08);border-radius:6px;color:#FFE38A;font-size:.9rem';
        nota.innerHTML = '<i class="fa-solid fa-crown"></i> <b>Cupo solo para VIP:</b> escribe el <b>mismo nombre de equipo</b> y el <b>mismo número</b> con que te registraste como VIP. Si no coinciden, no te da el cupo.';
        document.getElementById('modalTitulo').after(nota);
    }
    nota.style.display = tipo === 'VIP' ? 'block' : 'none';
    document.getElementById('linkGrupoSecreto').value = link;
    document.getElementById('modalTitulo').textContent = `Inscripción: ${titulo}`;
    document.getElementById('modalRegistro').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('regNombre').value = '';
    document.getElementById('regTelefono').value = '';
}

async function procesarInscripcion() {
    let idEntreno = document.getElementById('entrenamientoId').value;
    let linkGrupo = document.getElementById('linkGrupoSecreto').value;
    let nombre = document.getElementById('regNombre').value.trim();
    let pais = document.getElementById('regPais').value;
    let telefonoNum = document.getElementById('regTelefono').value.trim();

    if (!nombre || !telefonoNum) {
        alert("Por favor completa tu nombre y número de teléfono.");
        return;
    }

    let telefonoCompleto = `${pais} ${telefonoNum}`;

    try {
        // 1. VERIFICACIÓN ANTI-SOBRECUPO (Por si 2 personas se registran al mismo tiempo)
        const { data: checkRegs } = await supabaseClient.from('registro_cupos').select('id, nombre_jugador').eq('entrenamiento_id', idEntreno);
        const { data: checkEnt } = await supabaseClient.from('entrenamientos_programados').select('cupos_totales, estado, publicar_en').eq('id', idEntreno).single();
        
        if (checkEnt.estado === 'CERRADO' || (checkEnt.publicar_en && new Date(checkEnt.publicar_en) > new Date()) || (checkRegs && checkRegs.length >= checkEnt.cupos_totales)) {
            alert("Lo sentimos, los cupos para este entrenamiento se acaban de agotar.");
            cerrarModal();
            cargarEntrenamientosActivos();
            return;
        }

        // 1.5 EVITAR EQUIPOS REPETIDOS (ignora mayúsculas, tildes, espacios y símbolos)
        if ((checkRegs || []).some(r => normEquipo(r.nombre_jugador) === normEquipo(nombre))) {
            alert("Ese equipo ya está inscrito en este entrenamiento.");
            return;
        }

        // 2. REGISTRAR AL EQUIPO EN LA BASE DE DATOS
        const { error: insertError } = await supabaseClient
            .from('registro_cupos')
            .insert([{
                entrenamiento_id: idEntreno,
                nombre_jugador: nombre,
                telefono: telefonoCompleto
            }]);

        if (insertError) throw insertError;

        // 3. AUTO-CIERRE SI SE LLENARON LOS CUPOS CON ESTE ÚLTIMO REGISTRO
        let totalInscritos = (checkRegs ? checkRegs.length : 0) + 1;
        if (totalInscritos >= checkEnt.cupos_totales) {
            await supabaseClient
                .from('entrenamientos_programados')
                .update({ estado: 'CERRADO' })
                .eq('id', idEntreno);
        }

        cerrarModal();
        cargarEntrenamientosActivos();
        // Antes de unirse al grupo: recordar que escriban el nombre del equipo
        mostrarIngresoGrupo(nombre, linkGrupo);

    } catch (err) {
        console.error("Error al registrar:", err);
        const m = (err && err.message) || '';
        alert(err && err.code === "23505" ? "Ese equipo ya está inscrito en este entrenamiento."
            : /baneado|VIP/i.test(m) ? m   // la base no lo dejó: equipo o número baneado, o no es VIP
            : "Ocurrió un error. Es posible que los cupos se hayan agotado.");
    }
}

// Ventana después de inscribirse: aviso del nombre del equipo y botón "ABRIR" para unirse al grupo
function mostrarIngresoGrupo(equipo, link) {
    const esc = t => String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const valido = /^https:\/\//.test(String(link || ''));
    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.85);backdrop-filter:blur(5px)';
    fondo.innerHTML = `
        <div role="dialog" aria-modal="true" style="width:100%;max-width:440px;padding:26px;background:var(--dark-card);border:1px solid rgba(216,195,149,.35);border-radius:12px;text-align:center">
            <div style="font-size:2.2rem;color:#6ee7a8"><i class="fa-solid fa-circle-check"></i></div>
            <h3 style="color:var(--primary);font-family:'Michroma';font-size:1.1rem;margin:8px 0 6px">¡INSCRIPCIÓN EXITOSA!</h3>
            <p style="color:var(--light);margin:0 0 14px"><b>${esc(equipo)}</b> quedó inscrito.</p>
            ${valido ? `
            <div style="display:flex;gap:10px;align-items:flex-start;text-align:left;padding:12px;border:1px solid rgba(255,213,74,.55);background:rgba(255,213,74,.08);border-radius:8px;color:#FFE38A;margin-bottom:14px">
                <i class="fa-solid fa-circle-exclamation" style="margin-top:3px"></i>
                <div><b>Antes de unirte:</b> al entrar al grupo escribe el <b>nombre de tu equipo</b> (<b>${esc(equipo)}</b>) para que el staff te identifique y te pase la sala.</div>
            </div>
            <p style="color:var(--gray);font-size:.9rem;margin:0 0 16px">Para unirte al grupo toca <b>ABRIR</b>.</p>
            <a href="${esc(link)}" target="_blank" rel="noopener" data-abrir class="btn-access" style="display:block;padding:12px 20px;text-decoration:none"><i class="fa-brands fa-whatsapp"></i> ABRIR</a>` : ''}
            <button type="button" data-cerrar style="margin-top:10px;width:100%;padding:10px;background:transparent;color:var(--gray);border:1px solid rgba(255,255,255,.15);border-radius:6px;cursor:pointer">Cerrar</button>
        </div>`;
    const cerrar = () => fondo.remove();
    fondo.querySelector('[data-cerrar]').onclick = cerrar;
    const abrir = fondo.querySelector('[data-abrir]');
    if (abrir) abrir.addEventListener('click', () => setTimeout(cerrar, 300));
    document.body.appendChild(fondo);
}
