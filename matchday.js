let logoPrincipalBase64 = null;
let fondoMatchBase64 = null;

function actualizarInputsMatchDay() {
    const formato = document.getElementById('matchDayFormat').value;
    const totalSlots = formato === '3x4' ? 12 : 15;
    const container = document.getElementById('matchDaySlotsContainer');
    
    if (!container) return;
    
    let valoresActuales = {};
    document.querySelectorAll('.input-equipo-nombre').forEach(inp => {
        valoresActuales[inp.dataset.id] = inp.value;
    });

    container.innerHTML = '';

    for (let i = 1; i <= totalSlots; i++) {
        let nombrePrevio = valoresActuales[`md_team_${i}`] || `EQUIPO ${i}`;
        container.innerHTML += `
            <div style="display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(0, 255, 204, 0.15); padding: 10px; border-radius: 6px;">
                <div style="font-family: 'Orbitron'; color: var(--primary); font-size: 0.8rem; width: 30px; font-weight: bold;">#${i}</div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                    <input type="text" class="input-equipo-nombre" data-id="md_team_${i}" id="md_team_${i}" value="${nombrePrevio}" placeholder="Nombre Equipo ${i}" oninput="renderizarMatchDayLive()" style="width: 100%; padding: 6px 10px; background: #0a0b10; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px; font-size: 0.9rem;">
                    <input type="file" id="md_logo_${i}" accept="image/*" onchange="renderizarMatchDayLive()" style="font-size: 0.75rem; color: var(--gray);">
                </div>
            </div>
        `;
    }
    renderizarMatchDayLive();
}

function cargarLogoPrincipal(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        logoPrincipalBase64 = e.target.result;
        renderizarMatchDayLive();
    };
    reader.readAsDataURL(file);
}

function cargarFondoMatch(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        fondoMatchBase64 = e.target.result;
        renderizarMatchDayLive();
    };
    reader.readAsDataURL(file);
}

function leerArchivoComoBase64(fileInput) {
    return new Promise((resolve) => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    });
}

async function renderizarMatchDayLive() {
    const formato = document.getElementById('matchDayFormat').value;
    const totalSlots = formato === '3x4' ? 12 : 15;
    const tituloMatch = document.getElementById('matchDayTitle') ? document.getElementById('matchDayTitle').value : "GRUPOS OFICIALES - JORNADA 1";
    
    let gridStyle = formato === '3x4' 
        ? 'display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(4, 1fr); gap: 12px;' 
        : 'display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(5, 1fr); gap: 8px;';
    
    // Logos considerablemente más grandes y destacados
    let logoSize = formato === '3x4' ? '105px' : '88px';
    let fontSize = formato === '3x4' ? '0.95rem' : '0.85rem';
    let paddingBox = formato === '3x4' ? '10px 6px' : '6px 4px';

    let equiposData = [];

    for (let i = 1; i <= totalSlots; i++) {
        let inputNombre = document.getElementById(`md_team_${i}`);
        let nombre = inputNombre ? inputNombre.value.trim() || `Equipo ${i}` : `Equipo ${i}`;
        let fileInput = document.getElementById(`md_logo_${i}`);
        let logoBase64 = await leerArchivoComoBase64(fileInput);
        
        if (!logoBase64) {
            logoBase64 = logoPrincipalBase64 ? logoPrincipalBase64 : "imagenes/proyectn.png";
        }
        
        equiposData.push({ nombre, logo: logoBase64 });
    }

    let fondoUrl = fondoMatchBase64 ? fondoMatchBase64 : "fondo.png";
    let logoHeaderUrl = logoPrincipalBase64 ? logoPrincipalBase64 : "imagenes/proyectn.png";

    let html = `
        <div id="matchDayCaptura" style="width: 800px; height: 1000px; background: #0a0b10; background-image: url('${fondoUrl}'); background-size: cover; background-position: center; position: relative; font-family: 'Rajdhani', sans-serif; color: #fff; padding: 35px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
            
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 11, 16, 0.92); z-index: 1;"></div>

            <!-- Header limpio (Sin indicador de formato) -->
            <div style="position: relative; z-index: 2; display: flex; align-items: center; gap: 18px; border-bottom: 2px solid var(--primary); padding-bottom: 15px;">
                <img src="${logoHeaderUrl}" style="width: 65px; height: 65px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(0,255,204,0.5);" onerror="this.src='imagenes/proyectn.png'">
                <div>
                    <div style="font-family: 'Orbitron'; font-size: 1.7rem; font-weight: 900; color: #fff; letter-spacing: 2px; line-height: 1.1;">PROYECTN</div>
                    <div style="font-size: 1rem; color: var(--primary); font-family: 'Orbitron'; font-weight: bold; margin-top: 3px;">${tituloMatch}</div>
                </div>
            </div>

            <!-- Grilla central con logos extra grandes -->
            <div style="position: relative; z-index: 2; ${gridStyle} flex: 1; margin: 15px 0;">
                ${equiposData.map((eq, index) => `
                    <div style="background: linear-gradient(135deg, rgba(18, 21, 32, 0.95), rgba(10, 11, 16, 0.95)); border: 2px solid rgba(0, 255, 204, 0.3); border-radius: 8px; padding: ${paddingBox}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-shadow: 0 6px 15px rgba(0,0,0,0.6);">
                        <img src="${eq.logo}" style="width: ${logoSize}; height: ${logoSize}; object-fit: contain; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(0,0,0,0.8);">
                        <div style="font-family: 'Orbitron'; font-weight: bold; font-size: ${fontSize}; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${eq.nombre}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Footer -->
            <div style="position: relative; z-index: 2; text-align: center; font-size: 0.8rem; color: var(--gray); font-family: 'Orbitron'; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                PROYECTN &bull; GESTIÓN OFICIAL DE COMPETENCIAS 2026
            </div>
        </div>

        <button onclick="descargarMatchDay()" class="btn-generar" style="margin-top: 20px; background: linear-gradient(45deg, var(--accent-yellow), #ff9900); color: #000;">
            <i class="fa-solid fa-download"></i> DESCARGAR IMAGEN MATCH DAY (4:5)
        </button>
    `;

    document.getElementById('outputMatchDay').innerHTML = html;
}

function descargarMatchDay() {
    let elemento = document.getElementById('matchDayCaptura');
    let opciones = {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
    };

    html2canvas(elemento, opciones).then(canvas => {
        let enlace = document.createElement('a');
        enlace.download = 'MatchDay_PROYECTN.png';
        enlace.href = canvas.toDataURL('image/png');
        enlace.click();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarInputsMatchDay();
});