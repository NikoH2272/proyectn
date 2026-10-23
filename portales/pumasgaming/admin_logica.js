const TITULO_ENTRENO = 'ENTRENOS PROYECTN';
const SUPABASE_URL = "https://bqemjroiegybdzksddkn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZW1qcm9pZWd5YmR6a3NkZGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzgwNDIsImV4cCI6MjEwMzE1NDA0Mn0.49gC204FPWSNxWYa6eZFBgWJgr7ZvFax5mqOM9lyGPo";
let supabaseClient = null;
if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let rawFilesData = [];
let processedFilesTexts = [];
let fondoPersonalizadoBase64 = null;
let globalEquipos = [];
let globalTopKillers = [];
let globalNumSalas = 0;

async function prepararRenombradoEquipos() {
    const fileInput = document.getElementById('fileInput');
    let files = Array.from(fileInput.files);
    if (files.length === 0) return;

    rawFilesData = [];
    let equiposEnLogs = new Set();

    for (let file of files) {
        let text = await file.text();
        rawFilesData.push(text);
        let lines = text.split('\n');
        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:/i);
            if (teamMatch) equiposEnLogs.add(teamMatch[1].trim());
        });
    }

    let equiposOficialesMap = {};
    try {
        if (supabaseClient) {
            const { data: dbEquipos } = await supabaseClient.from('equipos_registrados').select('*');
            if (dbEquipos) {
                dbEquipos.forEach(eq => {
                    equiposOficialesMap[eq.nombre.toUpperCase()] = {
                        nombreOficial: eq.nombre
                    };
                });
            }
        }
    } catch (e) {
        console.warn("No se pudo cargar el listado oficial de Supabase.", e);
    }

    const contenedor = document.getElementById('listaEquiposInputs');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    Array.from(equiposEnLogs).forEach((eqOriginal) => {
        let matchOficial = equiposOficialesMap[eqOriginal.toUpperCase()];
        let sugerenciaNombre = matchOficial ? matchOficial.nombreOficial : eqOriginal;
        
        let badgeEstado = '';
        if (matchOficial) {
            badgeEstado = `<span style="background: rgba(0, 255, 128, 0.15); color: #00ff80; border: 1px solid rgba(0, 255, 128, 0.4); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-family: 'Michroma'; font-weight: bold; white-space: nowrap;"><i class="fa-solid fa-check"></i> OFICIAL</span>`;
        } else {
            badgeEstado = `<span style="background: rgba(255, 51, 51, 0.15); color: #ff5555; border: 1px solid rgba(255, 51, 51, 0.4); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-family: 'Michroma'; font-weight: bold; white-space: nowrap;"><i class="fa-solid fa-xmark"></i> NUEVO</span>`;
        }

        contenedor.innerHTML += `
            <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${matchOficial ? '#00ff80' : '#ff5555'};">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 5px;">
                    <span style="color: var(--gray); font-size: 0.8rem;">Orig: <strong>${eqOriginal}</strong></span>
                    ${badgeEstado}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" class="input-nombre-editable" data-original="${eqOriginal}" value="${sugerenciaNombre}" style="flex: 2; padding: 7px; background: #0a0b10; border: 1px solid rgba(216,195,149,0.3); color: #fff; border-radius: 4px; font-family:'Trebuchet MS'; font-weight:bold; font-size: 0.9rem;">
                    <button onclick="this.closest('div').parentElement.remove()" style="background:#ff3333; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('seccionRenombrar').style.display = 'block';
}

async function procesarConNombresPersonalizados() {
    let diccionarioRenombres = {};

    document.querySelectorAll('.input-nombre-editable').forEach(input => {
        let original = input.getAttribute('data-original');
        let nuevoNombre = input.value.trim() || original;
        diccionarioRenombres[original] = nuevoNombre;
    });

    processedFilesTexts = rawFilesData.map(text => {
        let updatedText = text;
        for (let original in diccionarioRenombres) {
            let nuevo = diccionarioRenombres[original];
            if (original !== nuevo) {
                let regex = new RegExp(`TeamName:\\s*${escapeRegExp(original)}\\s+Rank:`, 'gi');
                updatedText = updatedText.replace(regex, `TeamName: ${nuevo} Rank:`);
            }
        }
        return updatedText;
    });

    procesarLogs(processedFilesTexts, {});
    
    let btnGuardar = document.getElementById('contenedorBotonGuardarFinal');
    if(btnGuardar) btnGuardar.style.display = 'block';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function procesarArchivosLog() {
    if (rawFilesData.length === 0) {
        alert("Por favor, selecciona primero los archivos de registro (.log o .txt).");
        return;
    }
    await guardarEntrenamientoEnSupabase();
}

function procesarLogs(textsArray, renombresMap) {
    let equiposMap = {};
    let jugadoresMap = {};
    let roomWinners = [];
    let numSalas = textsArray.length;

    textsArray.forEach((text, i) => {
        let lines = text.split('\n');
        let salaBooyahEquipo = null;
        let salaBooyahPts = 0;
        let salaBooyahKills = 0;

        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (teamMatch) {
                let name = teamMatch[1].trim();
                if (!equiposMap[name]) {
                    equiposMap[name] = { 
                        name, 
                        totalScore: 0, 
                        killScore: 0, 
                        rankScore: 0, 
                        salasPuntos: {}, 
                        salasKills: {}, 
                        salasRank: {}, 
                        salasJugadas: 0, 
                        booyahsCount: 0 
                    };
                }
                let totalScore = parseInt(teamMatch[5]);
                let killScore = parseInt(teamMatch[3]);
                let rankScore = parseInt(teamMatch[4]);
                let rank = parseInt(teamMatch[2]);

                equiposMap[name].totalScore += totalScore;
                equiposMap[name].killScore += killScore;
                equiposMap[name].rankScore += rankScore;
                
                equiposMap[name].salasPuntos[i] = totalScore;
                equiposMap[name].salasKills[i] = killScore;
                equiposMap[name].salasRank[i] = rankScore;
                equiposMap[name].salasJugadas += 1;

                if (rank === 1) {
                    equiposMap[name].booyahsCount += 1;
                    salaBooyahEquipo = name;
                    salaBooyahPts = totalScore;
                    salaBooyahKills = killScore;
                }
            }

            const playerMatch = line.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
            if (playerMatch) {
                let pName = playerMatch[1].trim();
                let pKills = parseInt(playerMatch[2]);
                
                if (!jugadoresMap[pName]) {
                    jugadoresMap[pName] = { name: pName, kills: 0 };
                }
                jugadoresMap[pName].kills += pKills;
            }
        });

        if (salaBooyahEquipo) {
            roomWinners.push({ sala: i + 1, team: salaBooyahEquipo, points: salaBooyahPts, kills: salaBooyahKills });
        } else {
            roomWinners.push({ sala: i + 1, team: "N/D", points: 0, kills: 0 });
        }
    });

    let equiposArray = Object.values(equiposMap);
    equiposArray.sort((a, b) => b.totalScore - a.totalScore);
    
    let topKillersArray = Object.values(jugadoresMap).sort((a, b) => b.kills - a.kills);
    
    globalEquipos = equiposArray;
    globalTopKillers = topKillersArray;
    globalNumSalas = numSalas;
    window._rWGlobal = roomWinners;

    renderizarResultados(equiposArray, topKillersArray, numSalas);
    generarTextoParaEntrenamientoActual(equiposArray, topKillersArray);
}

function renderizarResultados(eqs, tKs, nS) {
    let tC = "",
        tTipo = document.getElementById('selectTipoPartida') ? document.getElementById('selectTipoPartida').value : "NORMAL",
        fInputVal = document.getElementById('inputFechaHoraEntreno') ? document.getElementById('inputFechaHoraEntreno').value : "",
        fC = fInputVal ? fInputVal.replace('T', ' ') : "",
        cF = "#ffffff",
        sM = document.getElementById('selectModoCalculo'), mC = sM ? sM.value : '1',
        iM = document.getElementById('inputModerador'), nM = iM && iM.value.trim() !== "" ? iM.value.trim().toUpperCase() : "PROYECTN ZEE",
        fU = fondoPersonalizadoBase64 || "imagenes/FONDOS.png";
    
    let fV = `background-image: url('${fU}'); background-size: cover; background-position: center;`;

    let eqO = [...eqs].map(eq => {
        let tV = eq.totalScore;
        if (mC === '2') tV = eq.rankScore;
        else if (mC === '3') tV = eq.killScore;
        return { ...eq, totalCalculado: tV };
    });
    
    if (mC === '1') eqO.sort((a, b) => b.totalScore - a.totalScore);
    else if (mC === '2') eqO.sort((a, b) => b.rankScore - a.rankScore);
    else if (mC === '3') eqO.sort((a, b) => b.killScore - a.killScore);

    let tKL = [...tKs].slice(0, 15), 
        tM = "TABLA GENERAL (ESTÁNDAR)";
    if (mC === '2') tM = "TABLA SOLO POSICIÓN (SCORE RANK)";
    if (mC === '3') tM = "TABLA SOLO KILLS (SCORE KILL)";
    
    let rWData = window._rWGlobal || [];
    let totalEquiposParticipantes = eqs.length;
    let totalKillsGenerales = tKs.reduce((acc, curr) => acc + curr.kills, 0);

    let html = `
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
            <div id="tablaCaptura" style="${fV}">

                <div class="captura-header">
                    <h1 class="captura-titulo">${tC}</h1>
                    <div class="captura-subtitulo" style="color: ${cF};">TIPO: [${tTipo}] | FECHA: ${fC} | MOD: ${nM}</div>
                </div>
                
                <div class="captura-card card-tabla-general">
                    <div class="card-titulo">${tM}</div>
                    <table class="tabla-general-interna" style="color: ${cF};">
                        <thead>
                            <tr>
                                <th style="text-align:left;">#</th>
                                <th style="text-align:left;">EQUIPO</th>
                                ${Array.from({length: Math.min(nS, 5)}).map((_, i) => `<th style="text-align:center;">S${i+1}</th>`).join('')}
                                <th style="text-align:center;">KILL</th>
                                <th style="text-align:center;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eqO.slice(0, 15).map((eq, i) => {
                                let cFila = cF;
                                if (i === 0) cFila = '#D8C395';
                                else if (i === 1) cFila = '#B9B2A4';
                                return `
                                <tr>
                                    <td style="font-weight: bold; color:${cFila};">#${i+1}</td>
                                    <td style="font-weight: bold; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="color:${cF};">${eq.name}</span></td>${Array.from({length: Math.min(nS, 5)}).map((_, s) => {
                                        let pS = eq.salasPuntos[s];
                                        if (mC === '2') pS = eq.salasRank[s];
                                        else if (mC === '3') pS = eq.salasKills[s];

                                        if (pS === undefined) return `<td style="text-align:center; color:var(--gray);">-</td>`;
                                        return `<td style="text-align:center; color:${cF};">${pS}</td>`;
                                    }).join('')}
                                    <td style="text-align:center; color:#D8C395; font-weight:bold;">${eq.killScore}</td>
                                    <td style="text-align:center; color:${cFila}; font-weight:bold;">${eq.totalCalculado}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="captura-card card-equipos-destacados">
                    <div class="card-titulo">RESUMEN DE EQUIPOS DESTACADOS (TOP 6)</div>
                    <div class="grid-equipos-destacados">
                        ${eqO.slice(0, 6).map((eq, i) => {
                            let cP = cF;
                            if (i === 0) cP = '#D8C395';
                            let sumK = eq.killScore || 0;
                            return `
                            <div class="item-equipo-destacado">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1px;">
                                    <span style="color:${cP}; font-weight:bold; max-width: 110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">#${i+1}${eq.name}</span>
                                    <span style="color:#D8C395; font-weight:bold;">👑 ${eq.booyahsCount || 0}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; color:var(--gray); font-size:0.62rem;">
                                    <span>Pts: <strong style="color:${cF};">${eq.totalCalculado}</strong></span>
                                    <span>Kills: <strong style="color:#D8C395;">${sumK}</strong></span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <div class="captura-card card-booyah-sala">
                    <div class="card-titulo">BOOYAH POR SALA (VICTORIAS)</div>
                    <div class="grid-booyah-salas" style="grid-template-columns: repeat(${Math.min(Math.max(rWData.length, 1), 5)}, 1fr);">
                        ${rWData.length ? rWData.map(rw => `
                            <div class="item-booyah-sala">
                                <div style="color: #D8C395; font-family: 'Michroma'; font-weight: bold; margin-bottom: 1px;">SALA ${rw.sala} 👑</div>
                                <div style="color: ${cF}; font-weight: bold; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0 auto;" title="${rw.team}">${rw.team}</div>
                                <div style="color: var(--gray); font-size: 0.6rem; margin-top: 1px;">Pts: <strong style="color: #D8C395;">${rw.points}</strong> | K: <strong style="color: #D8C395;">${rw.kills}</strong></div>
                            </div>
                        `).join('') : `<div style="color: var(--gray); font-size: 0.72rem; text-align: center; padding: 4px;">No hay datos de Booyah registrados.</div>`}
                    </div>
                </div>

                <div class="captura-card card-top-killers">
                    <div class="card-titulo">TOP 15 KILLERS MÁS LETALES</div>
                    <div class="grid-top-killers">
                        ${tKL.map((tk, i) => {
                            let cP = cF;
                            if (i === 0) cP = '#D8C395';
                            return `
                            <div class="item-top-killer">
                                <div style="overflow: hidden;">
                                    <span style="color: ${cP}; font-weight: bold; margin-right: 2px;">#${i+1}</span>
                                    <span style="color: ${cF}; font-weight: bold; max-width: 75px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;">${tk.name}</span>
                                </div>
                                <span style="color: #D8C395; font-weight: bold; font-size: 0.7rem;">${tk.kills}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <div class="captura-card card-resumen-general">
                    <div class="card-titulo">RESUMEN GENERAL DE LA PARTIDA</div>
                    <div class="grid-resumen-nums">
                        <div class="item-resumen-caja">
                            <div style="color: var(--gray); font-size: 0.62rem;">SALAS JUGADAS</div>
                            <div style="color: #D8C395; font-family: 'Michroma'; font-weight: bold; font-size: 0.9rem;">${nS}</div>
                        </div>
                        <div class="item-resumen-caja">
                            <div style="color: var(--gray); font-size: 0.62rem;">EQUIPOS QUE JUGARON</div>
                            <div style="color: #D8C395; font-family: 'Michroma'; font-weight: bold; font-size: 0.9rem;">${totalEquiposParticipantes}</div>
                        </div>
                        <div class="item-resumen-caja">
                            <div style="color: var(--gray); font-size: 0.62rem;">KILL GENERALES</div>
                            <div style="color: #D8C395; font-family: 'Michroma'; font-weight: bold; font-size: 0.9rem;">${totalKillsGenerales}</div>
                        </div>
                    </div>
                </div>

            </div>
            
            <div style="margin-top: 25px; margin-bottom: 25px; width: 100%; display: flex; justify-content: center;">
                <button onclick="descargar()" class="btn-generar" style="max-width: 350px; padding: 12px 25px; font-size: 1rem;">DESCARGAR IMAGEN 4:5</button>
            </div>
        </div>
    `;
    
    document.getElementById('outputTablasLadoALado').innerHTML = html;
}

function generarTextoParaEntrenamientoActual(eqsArray, tkArray) {
    const contenedorCopiable = document.getElementById('contenedorTextoCargadoCopiable');
    const textarea = document.getElementById('inputTextoCargadoCopiable');
    
    if (!contenedorCopiable || !textarea) return;

    let tituloTorneo = TITULO_ENTRENO;

    let fechaInput = document.getElementById('inputFechaHoraEntreno');
    let fechaObj = fechaInput && fechaInput.value ? new Date(fechaInput.value) : new Date();

    let fechaFormateada = fechaObj.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
    let horaCOL = fechaObj.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });

    let top3Texto = eqsArray.slice(0, 3).map((eq, i) => `${i === 0 ? '🏆 1º' : (i === 1 ? '🥈 2º' : '🥉 3º')} ${eq.name} - ${eq.totalScore} PTS`).join('\n');
    let mvp = tkArray.length > 0 ? tkArray[0] : null;
    let mvpTexto = mvp ? `🔥 MVP: ${mvp.name} (${mvp.kills} Kills)` : '🔥 MVP: N/D';

    let textoFinal = `🐺 ${tituloTorneo}
📅 Fecha: ${fechaFormateada}
⏰ Hora: ${horaCOL} COL
🌐 Región: EEUU

🏆 TOP 3 EQUIPOS:
${top3Texto || 'Sin datos'}

${mvpTexto}`;

    textarea.value = textoFinal;
    contenedorCopiable.style.display = 'block';
}

function copiarTextoCargado() {
    const textarea = document.getElementById('inputTextoCargadoCopiable');
    if (!textarea || !textarea.value) return;
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert("¡Texto copiado al portapapeles con éxito!");
    });
}

function descargar() {
    const elemento = document.getElementById('tablaCaptura');
    if (!elemento) return;

    html2canvas(elemento, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'proyectn-pumasgaming.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

async function guardarEntrenamientoEnSupabase() {
    if (!supabaseClient) return;

    try {
        let titulo = TITULO_ENTRENO;
        let jornada = document.getElementById('selectTipoPartida') ? document.getElementById('selectTipoPartida').value : "NORMAL";
        let fechaInput = document.getElementById('inputFechaHoraEntreno') ? document.getElementById('inputFechaHoraEntreno').value : "";
        let fecha = fechaInput ? new Date(fechaInput) : new Date();
        let moderador = document.getElementById('inputModerador') ? document.getElementById('inputModerador').value : "";

        const fileInput = document.getElementById('fileInput');
        let files = Array.from(fileInput.files);
        let folderName = `entreno_${fecha.toLocaleDateString('en-CA',{timeZone:'America/Bogota'})}_${titulo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`;

        if (files.length > 0 && processedFilesTexts.length === files.length) {
            try {
                for (let i = 0; i < files.length; i++) {
                    let nombreLimpio = files[i].name.replace(/[^a-zA-Z0-9_.-]/g, '_');
                    let filePath = `${folderName}/${nombreLimpio}`;
                    let blobModificado = new Blob([processedFilesTexts[i]], { type: 'text/plain' });
                    await supabaseClient.storage.from('entrenamientos_logs').upload(filePath, blobModificado);
                }
            } catch (storageErr) {
                console.warn("Aviso: No se pudieron subir los archivos al Storage.", storageErr);
            }
        }

        const { data: sesionData, error: sesionError } = await supabaseClient
            .from('entrenamientos_sesiones')
            .insert([{ titulo, jornada, fecha: fecha.toISOString(), moderador, archivo_url: folderName }])
            .select()
            .single();

        if (sesionError) throw sesionError;
        const sesionId = sesionData.id;

        let salasRows = [];
        globalEquipos.forEach(eq => {
            Object.keys(eq.salasPuntos).forEach(indexSala => {
                let numSala = parseInt(indexSala) + 1;
                let puntosSala = eq.salasPuntos[indexSala];
                let killsSala = eq.salasKills ? (eq.salasKills[indexSala] || 0) : 0;
                let rankSala = eq.salasRank ? (eq.salasRank[indexSala] || 0) : 0;

                salasRows.push({
                    sesion_id: sesionId,
                    numero_sala: numSala,
                    equipo_nombre: eq.name,
                    rank: rankSala,
                    kill_score: killsSala,
                    rank_score: rankSala,
                    total_score: puntosSala,
                    es_booyah: (rankSala === 1)
                });
            });
        });

        if (salasRows.length > 0) {
            await supabaseClient.from('salas_resultados').insert(salasRows);
        }

        let killersRows = [];
        processedFilesTexts.forEach(text => {
            let lines = text.split('\n');
            let currentTeam = "PROYECTN Squad";
            
            lines.forEach(line => {
                const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:/i);
                if (teamMatch) currentTeam = teamMatch[1].trim();

                const playerMatch = line.match(/NAME:\s*(.+?)\s+ID:\s*(\d+).*?KILL:\s*(\d+)/i);
                if (playerMatch) {
                    killersRows.push({
                        sesion_id: sesionId,
                        jugador_nombre: playerMatch[1].trim(),
                        equipo_nombre: currentTeam,
                        kills: parseInt(playerMatch[3])
                    });
                }
            });
        });

        if (killersRows.length > 0) {
            await supabaseClient.from('top_killers').insert(killersRows);
        }

        // Resultados completos (.csv): se guardan con el id de este entreno (completos_admin.js)
        if (typeof window.alGuardarEntreno === 'function') {
            try { await window.alGuardarEntreno(sesionId); } catch (e) { console.warn('Estadísticas avanzadas:', e); }
        }

        alert("¡Resultados procesados y guardados exitosamente!");
        // Revisión de equipos que no cumplieron las salas (GENERAR BANEO, admin.html)
        if (typeof window.alTerminarEntreno === 'function') window.alTerminarEntreno();
    } catch (error) {
        console.error("Error crítico:", error);
        alert("Ocurrió un error al guardar en la base de datos.");
    }
}

async function limpiarBaseDeDatosCompletamente() {
    if (!confirm("⚠️ ADVERTENCIA: ¿Estás seguro de vaciar absolutamente toda la base de datos?")) return;
    if (!supabaseClient) return;

    try {
        await supabaseClient.from('top_killers').delete().neq('id', 0);
        await supabaseClient.from('salas_resultados').delete().neq('id', 0);
        await supabaseClient.from('entrenamientos_sesiones').delete().neq('id', 0);
        alert("¡Base de datos limpiada correctamente!");
        window.location.reload();
    } catch (error) {
        alert("Error al limpiar la base de datos.");
    }
}

async function cargarResultadosEquiposOficiales() {
    const contenedor = document.getElementById('tablaFiltroEquiposOficiales');
    if (!contenedor) return;

    contenedor.innerHTML = `<div style="text-align: center; color: var(--primary); padding: 20px; grid-column: span 2;">Cargando equipos oficiales...</div>`;

    try {
        if (!supabaseClient) return;
        const { data: dbOficiales } = await supabaseClient.from('equipos_registrados').select('*');
        let acumuladoOficial = {};
        if (dbOficiales) {
            dbOficiales.forEach(eq => {
                let nombreKey = eq.nombre.trim().toUpperCase();
                acumuladoOficial[nombreKey] = { 
                    nombre: eq.nombre.trim(), 
                    logo_url: eq.logo_url,
                    totalScore: 0, 
                    booyahs: 0, 
                    participaciones: 0 
                };
            });
        }

        const { data: dbSalas } = await supabaseClient.from('salas_resultados').select('*');
        if (dbSalas) {
            dbSalas.forEach(fila => {
                let nombreLimpio = fila.equipo_nombre.trim().toUpperCase();
                if (acumuladoOficial[nombreLimpio]) {
                    acumuladoOficial[nombreLimpio].totalScore += Number(fila.total_score || 0);
                    acumuladoOficial[nombreLimpio].participaciones += 1;
                    if (fila.es_booyah === true || fila.rank === 1) {
                        acumuladoOficial[nombreLimpio].booyahs += 1;
                    }
                }
            });
        }

        let listaFiltrada = Object.values(acumuladoOficial).sort((a, b) => b.totalScore - a.totalScore);
        contenedor.innerHTML = '';
        
        if (listaFiltrada.length === 0) {
            contenedor.innerHTML = `<div style="text-align: center; color: var(--gray); padding: 20px; grid-column: span 2;">Sin equipos oficiales registrados.</div>`;
            return;
        }

        listaFiltrada.forEach((eq, idx) => {
            let colorPos = idx === 0 && eq.totalScore > 0 ? '#D8C395' : (idx === 1 && eq.totalScore > 0 ? '#B9B2A4' : (idx === 2 && eq.totalScore > 0 ? '#cd7f32' : '#fff'));
            let logoImgHtml = eq.logo_url ? `<img src="${eq.logo_url}" style="width: 28px; height: 28px; object-fit: contain; border-radius: 4px; background: #000;">` : `<i class="fa-solid fa-shield" style="color: var(--primary); font-size: 1.2rem;"></i>`;

            contenedor.innerHTML += `
                <div style="background: rgba(18, 19, 23, 0.95); border: 1px solid rgba(216,195,149, 0.2); border-left: 3px solid ${colorPos}; border-radius: 6px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; max-width: 70%;">
                        ${logoImgHtml}
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-family: 'Michroma'; font-weight: bold; color: ${colorPos}; font-size: 0.85rem;">#${idx+1}</span>
                            <span style="font-weight: bold; color: #fff; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${eq.nombre}">${eq.nombre}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center; text-align: right;">
                        <div>
                            <div style="color: var(--gray); font-size: 0.6rem; font-family: 'Michroma';">BOOYAH</div>
                            <div style="color: #D8C395; font-weight: bold; font-family: 'Michroma'; font-size: 0.9rem;">${eq.booyahs} 🏆</div>
                        </div>
                        <div>
                            <div style="color: var(--gray); font-size: 0.6rem; font-family: 'Michroma';">PTS</div>
                            <div style="color: ${colorPos}; font-weight: bold; font-family: 'Michroma'; font-size: 1rem;">${eq.totalScore}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Error:", err);
    }
}

// ==========================================
// REGISTRO INDIVIDUAL, MASIVO Y EDICIÓN VIP (SIN TAG)
// ==========================================

async function registrarNuevoEquipoVip() {
    const nombreInput = document.getElementById('inputNombreVip');
    const logoInput = document.getElementById('inputLogoVip');
    const nombre = nombreInput ? nombreInput.value.trim() : "";

    if (!nombre) {
        alert("Por favor, ingresa el nombre del equipo.");
        return;
    }

    if (!supabaseClient) return;

    try {
        const { data: insertedData, error: insertError } = await supabaseClient
            .from('equipos_registrados')
            .insert([{ nombre }])
            .select()
            .single();

        if (insertError) throw insertError;
        let equipoId = insertedData.id;

        if (logoInput && logoInput.files.length > 0) {
            let file = logoInput.files[0];
            let fileName = `logo_${equipoId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

            const { error: storageError } = await supabaseClient.storage
                .from('logos_equipos')
                .upload(fileName, file);

            if (!storageError) {
                const { data: publicUrlData } = supabaseClient.storage
                    .from('logos_equipos')
                    .getPublicUrl(fileName);

                await supabaseClient
                    .from('equipos_registrados')
                    .update({ logo_url: publicUrlData.publicUrl })
                    .eq('id', equipoId);
            }
        }

        alert("¡Equipo VIP registrado con éxito!");
        if (nombreInput) nombreInput.value = "";
        if (logoInput) logoInput.value = "";
        cargarListaEquiposVipAdmin();
    } catch (err) {
        console.error("Error al registrar equipo VIP:", err);
        alert("Error al registrar el equipo (es posible que ya exista).");
    }
}

async function registrarEquiposMasivos() {
    const textarea = document.getElementById('inputListaMasivaVip');
    if (!textarea || !textarea.value.trim()) {
        alert("Por favor, ingresa una lista de equipos en el cuadro de texto.");
        return;
    }

    let lineas = textarea.value.split('\n');
    let nuevosEquipos = [];

    lineas.forEach(linea => {
        let nombre = linea.trim();
        if (nombre) {
            // Generamos un tag automático de respaldo para evitar el error de Supabase
            let tagGenerado = nombre.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || "VIP";
            
            nuevosEquipos.push({ 
                nombre: nombre, 
                tag: tagGenerado // Envía un tag automático por compatibilidad con la BD
            });
        }
    });

    if (nuevosEquipos.length === 0) {
        alert("No se encontraron nombres válidos.");
        return;
    }

    if (!supabaseClient) return;

    try {
        const { error } = await supabaseClient.from('equipos_registrados').insert(nuevosEquipos);
        if (error) {
            console.error("Error en Supabase:", error);
            alert("Error al registrar: " + error.message);
            return;
        }

        alert(`¡Se registraron ${nuevosEquipos.length} equipos masivamente con éxito!`);
        textarea.value = '';
        cargarListaEquiposVipAdmin();
    } catch (err) {
        console.error("Error crítico:", err);
        alert("Ocurrió un error inesperado al procesar la lista.");
    }
}

async function cargarListaEquiposVipAdmin() {
    const tbody = document.getElementById('tablaListaVipAdmin');
    if (!tbody || !supabaseClient) return;

    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--primary); padding: 20px;">Cargando equipos VIP...</td></tr>`;

    try {
        const { data, error } = await supabaseClient.from('equipos_registrados').select('*').order('nombre', { ascending: true });
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--gray); padding: 20px;">No hay equipos VIP registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        data.forEach(eq => {
            let logoHtml = eq.logo_url 
                ? `<img src="${eq.logo_url}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; background: #000;">` 
                : `<span style="color: var(--gray); font-size: 0.75rem;">Sin logo</span>`;

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="text-align: center; padding: 10px;">${logoHtml}</td>
                    <td style="padding: 10px; font-weight: bold; color: #fff;">${eq.nombre}</td>
                    <td style="text-align: center; padding: 10px; display: flex; gap: 8px; justify-content: center;">
                        <button onclick="editarEquipoVipPrompt('${eq.id}', '${eq.nombre.replace(/'/g, "\\'")}')" style="background: var(--primary); color: #000; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;" title="Editar Nombre">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <label style="background: #D8C395; color: #000; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem;" title="Subir / Cambiar Logo">
                            <i class="fa-solid fa-image"></i>
                            <input type="file" id="fileLogo_${eq.id}" accept="image/*" style="display: none;" onchange="subirLogoEquipoVip('${eq.id}')">
                        </label>
                        <button onclick="eliminarEquipoVip('${eq.id}', '${eq.nombre.replace(/'/g, "\\'")}')" style="background: #ff3333; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Error cargando tabla VIP:", err);
    }
}

async function editarEquipoVipPrompt(idEquipo, nombreActual) {
    let nuevoNombre = prompt("Modificar nombre del equipo:", nombreActual);
    if (nuevoNombre === null) return;
    nuevoNombre = nuevoNombre.trim();
    if (!nuevoNombre) {
        alert("El nombre no puede estar vacío.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('equipos_registrados')
            .update({ nombre: nuevoNombre })
            .eq('id', idEquipo);

        if (error) throw error;
        alert("¡Equipo actualizado correctamente!");
        cargarListaEquiposVipAdmin();
    } catch (err) {
        console.error("Error al actualizar equipo:", err);
        alert("No se pudo actualizar el equipo.");
    }
}

async function subirLogoEquipoVip(idEquipo) {
    const fileInput = document.getElementById(`fileLogo_${idEquipo}`);
    if (!fileInput || fileInput.files.length === 0) return;

    let file = fileInput.files[0];
    let fileName = `logo_${idEquipo}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

    try {
        const { error: storageError } = await supabaseClient.storage
            .from('logos_equipos')
            .upload(fileName, file);

        if (storageError) throw storageError;

        const { data: publicUrlData } = supabaseClient.storage
            .from('logos_equipos')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabaseClient
            .from('equipos_registrados')
            .update({ logo_url: publicUrlData.publicUrl })
            .eq('id', idEquipo);

        if (dbError) throw dbError;

        alert("¡Logo actualizado con éxito!");
        cargarListaEquiposVipAdmin();
    } catch (err) {
        console.error("Error subiendo el logo:", err);
        alert("Hubo un error al subir el logo.");
    }
}

async function eliminarEquipoVip(idEquipo, nombreEquipo) {
    if (!confirm(`⚠️ ¿Estás seguro de eliminar al equipo VIP "${nombreEquipo}"?`)) return;

    try {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.from('equipos_registrados').delete().eq('id', idEquipo);
        if (error) throw error;

        alert("¡Equipo VIP eliminado correctamente!");
        cargarListaEquiposVipAdmin();
    } catch (err) {
        console.error("Error eliminando equipo VIP:", err);
    }
}

async function generarVistaPreviaMetricas() {
    const contenedorPreview = document.getElementById('outputMetricasPreview');
    const contenedorCopiable = document.getElementById('contenedorTextoMetricasCopiable');
    
    if (!contenedorPreview) return;
    contenedorPreview.innerHTML = `<div style="color: var(--primary); text-align: center; padding: 40px; font-family: 'Michroma';">Analizando base de datos y calculando métricas globales...</div>`;
    if (contenedorCopiable) contenedorCopiable.style.display = 'none';

    try {
        if (!supabaseClient) return;

        const { data: sesiones } = await supabaseClient.from('entrenamientos_sesiones').select('*');
        const { data: salas } = await supabaseClient.from('salas_resultados').select('*');
        const { data: killers } = await supabaseClient.from('top_killers').select('*');

        const totalEntrenos = sesiones ? sesiones.length : 0;
        let totalSalas = salas ? new Set(salas.map(s => `${s.sesion_id}_${s.numero_sala}`)).size : 0;
        if (totalSalas === 0 && salas) totalSalas = salas.length;

        let totalKillsGen = 0;
        let equiposMap = {};
        let jugadoresMap = {};

        if (salas && Array.isArray(salas)) {
            salas.forEach(s => {
                let eq = s.equipo_nombre ? s.equipo_nombre.trim() : "Desconocido";
                let nombreKey = eq.toUpperCase();
                
                if (!equiposMap[nombreKey]) {
                    equiposMap[nombreKey] = { nombre: eq, totalPts: 0, rankPts: 0, kills: 0, booyahs: 0, sesionesSet: new Set() };
                }
                equiposMap[nombreKey].totalPts += Number(s.total_score || 0);
                equiposMap[nombreKey].rankPts += Number(s.rank_score || 0);
                equiposMap[nombreKey].kills += Number(s.kill_score || 0);
                
                if (s.es_booyah === true || s.rank === 1 || Number(s.rank) === 1) {
                    equiposMap[nombreKey].booyahs += 1;
                }
                if (s.sesion_id) equiposMap[nombreKey].sesionesSet.add(s.sesion_id);
            });
        }

        if (killers && Array.isArray(killers)) {
            killers.forEach(k => {
                let jug = k.jugador_nombre ? k.jugador_nombre.trim() : "Desconocido";
                let jugKey = jug.toUpperCase();
                let eqJugador = k.equipo_nombre ? k.equipo_nombre.trim() : "PROYECTN Squad";
                
                if (!jugadoresMap[jugKey]) {
                    jugadoresMap[jugKey] = { nombre: jug, kills: 0, equipo: eqJugador };
                }
                let kCount = Number(k.kills || 0);
                jugadoresMap[jugKey].kills += kCount;
                totalKillsGen += kCount;
            });
        }

        let arrEquipos = Object.values(equiposMap);
        let arrJugadores = Object.values(jugadoresMap);

        let recPos = arrEquipos.length ? [...arrEquipos].sort((a,b) => b.rankPts - a.rankPts)[0] : null;
        let recBoo = arrEquipos.length ? [...arrEquipos].sort((a,b) => b.booyahs - a.booyahs)[0] : null;
        let recKil = arrEquipos.length ? [...arrEquipos].sort((a,b) => b.kills - a.kills)[0] : null;
        let recAct = arrEquipos.length ? [...arrEquipos].sort((a,b) => b.sesionesSet.size - a.sesionesSet.size)[0] : null;

        arrEquipos.sort((a,b) => b.totalPts - a.totalPts);
        let top5Eq = arrEquipos.slice(0, 5);
        arrJugadores.sort((a,b) => b.kills - a.kills);
        let top5Jug = arrJugadores.slice(0, 5);

        let fechaActual = new Date();
        let fechaFormateada = fechaActual.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
        let horaCOL = fechaActual.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });

        let top3Texto = top5Eq.slice(0, 3).map((eq, i) => `${i === 0 ? '🏆 1º' : (i === 1 ? '🥈 2º' : '🥉 3º')} ${eq.nombre} - ${eq.totalPts} PTS`).join('\n');
        let mvp = top5Jug.length > 0 ? top5Jug[0] : null;
        let mvpTexto = mvp ? `🔥 MVP: ${mvp.nombre} (${mvp.kills} Kills) - ${mvp.equipo}` : '🔥 MVP: N/D';

        let textoCopiableFinal = `🐺 ENTRENOS PROYECTN
📅 Fecha: ${fechaFormateada}
⏰ Hora: ${horaCOL} COL
🌐 Región: EEUU

🏆 TOP 3 EQUIPOS:
${top3Texto}

${mvpTexto}`;

        const textareaCopiable = document.getElementById('inputTextoMetricasCopiable');
        if (textareaCopiable) textareaCopiable.value = textoCopiableFinal;
        if (contenedorCopiable) contenedorCopiable.style.display = 'block';

        let fU = fondoPersonalizadoBase64 || "imagenes/FONDOS.png";
        let fV = `background-image: url('${fU}'); background-size: cover; background-position: center;`;

        let html = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <div id="metricasCaptura" style="width: 800px; height: 1000px; position: relative; font-family: 'Trebuchet MS', sans-serif; padding: 25px; box-sizing: border-box; border: 2px solid rgba(216,195,149, 0.3); border-radius: 12px; overflow: hidden; ${fV} color: #ffffff;">

                    <div style="text-align: center; margin-bottom: 18px;">
                        <h1 style="font-family: 'Michroma', sans-serif; font-size: 2.2rem; color: #D8C395; margin: 0; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">PROYECTN</h1>
                        <div style="font-family: 'Michroma', sans-serif; font-size: 0.9rem; margin-top: 5px; font-weight: bold; letter-spacing: 2px; color: #fff;">ESTADÍSTICAS Y MÉTRICAS GLOBALES</div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                        <div style="background: rgba(18, 19, 23, 0.95); padding: 10px; border-radius: 6px; border: 1px solid rgba(216,195,149,0.3); text-align: center;">
                            <div style="color: var(--gray); font-size: 0.7rem; font-family: 'Michroma';">TOTAL ENTRENOS</div>
                            <div style="color: #D8C395; font-size: 1.3rem; font-weight: bold; font-family: 'Michroma';">${totalEntrenos}</div>
                        </div>
                        <div style="background: rgba(18, 19, 23, 0.95); padding: 10px; border-radius: 6px; border: 1px solid rgba(216,195,149,0.3); text-align: center;">
                            <div style="color: var(--gray); font-size: 0.7rem; font-family: 'Michroma';">SALAS CREADAS</div>
                            <div style="color: #D8C395; font-size: 1.3rem; font-weight: bold; font-family: 'Michroma';">${totalSalas}</div>
                        </div>
                        <div style="background: rgba(18, 19, 23, 0.95); padding: 10px; border-radius: 6px; border: 1px solid rgba(216,195,149,0.3); text-align: center;">
                            <div style="color: var(--gray); font-size: 0.7rem; font-family: 'Michroma';">KILLS TOTALES</div>
                            <div style="color: #D8C395; font-size: 1.3rem; font-weight: bold; font-family: 'Michroma';">${totalKillsGen}</div>
                        </div>
                    </div>

                    <div style="background: rgba(18, 19, 23, 0.95); padding: 12px; border-radius: 8px; border: 1px solid rgba(216,195,149,0.3); margin-bottom: 15px;">
                        <div style="font-family: 'Michroma', sans-serif; color: #D8C395; font-size: 0.85rem; font-weight: bold; margin-bottom: 8px;">RÉCORDS DESTACADOS</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.75rem;">
                            <div style="background: rgba(0,0,0,0.5); padding: 6px; border-radius: 4px;">
                                <span style="color: var(--gray);">Más Pts Posición:</span><br>
                                <strong style="color: #fff;">${recPos ? `${recPos.nombre} (${recPos.rankPts} pts)` : 'N/A'}</strong>
                            </div>
                            <div style="background: rgba(0,0,0,0.5); padding: 6px; border-radius: 4px;">
                                <span style="color: var(--gray);">Más Booyahs:</span><br>
                                <strong style="color: #fff;">${recBoo ? `${recBoo.nombre} (${recBoo.booyahs} 👑)` : 'N/A'}</strong>
                            </div>
                            <div style="background: rgba(0,0,0,0.5); padding: 6px; border-radius: 4px;">
                                <span style="color: var(--gray);">Más Kills:</span><br>
                                <strong style="color: #fff;">${recKil ? `${recKil.nombre} (${recKil.kills} kills)` : 'N/A'}</strong>
                            </div>
                            <div style="background: rgba(0,0,0,0.5); padding: 6px; border-radius: 4px;">
                                <span style="color: var(--gray);">Equipo más Activo:</span><br>
                                <strong style="color: #fff;">${recAct ? `${recAct.nombre} (${recAct.sesionesSet.size} entrenos)` : 'N/A'}</strong>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="background: rgba(18, 19, 23, 0.95); padding: 10px; border-radius: 8px; border: 1px solid rgba(216,195,149,0.3);">
                            <div style="font-family: 'Michroma', sans-serif; color: #D8C395; font-size: 0.78rem; font-weight: bold; margin-bottom: 6px;">TOP 5 EQUIPOS</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
                                <thead>
                                    <tr style="color: #D8C395; border-bottom: 1px solid rgba(216,195,149,0.3);">
                                        <th style="text-align: left; padding: 2px;">#</th>
                                        <th style="text-align: left; padding: 2px;">Equipo</th>
                                        <th style="text-align: center; padding: 2px;">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${top5Eq.map((eq, i) => `
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <td style="padding: 3px; color: #D8C395; font-weight: bold;">#${i+1}</td>
                                            <td style="padding: 3px; font-weight: bold; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${eq.nombre}</td>
                                            <td style="padding: 3px; text-align: center; color: #D8C395; font-family: 'Michroma';">${eq.totalPts}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="background: rgba(18, 19, 23, 0.95); padding: 10px; border-radius: 8px; border: 1px solid rgba(216,195,149,0.3);">
                            <div style="font-family: 'Michroma', sans-serif; color: #D8C395; font-size: 0.78rem; font-weight: bold; margin-bottom: 6px;">TOP 5 JUGADORES</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
                                <thead>
                                    <tr style="color: #D8C395; border-bottom: 1px solid rgba(216,195,149,0.3);">
                                        <th style="text-align: left; padding: 2px;">#</th>
                                        <th style="text-align: left; padding: 2px;">Jugador</th>
                                        <th style="text-align: center; padding: 2px;">Kills</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${top5Jug.map((jg, i) => `
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <td style="padding: 3px; color: #D8C395; font-weight: bold;">#${i+1}</td>
                                            <td style="padding: 3px; font-weight: bold; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${jg.nombre}</td>
                                            <td style="padding: 3px; text-align: center; color: #D8C395; font-family: 'Michroma';">${jg.kills}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                <div style="margin-top: 25px; margin-bottom: 25px; width: 100%; display: flex; justify-content: center;">
                    <button onclick="descargarMetricas()" class="btn-generar" style="max-width: 350px; padding: 12px 25px; font-size: 1rem;">DESCARGAR MÉTRICAS 4:5</button>
                </div>
            </div>
        `;
        contenedorPreview.innerHTML = html;
    } catch (err) {
        console.error("Error al generar las métricas globales:", err);
    }
}

function descargarMetricas() {
    const elemento = document.getElementById('metricasCaptura');
    if (!elemento) return;

    html2canvas(elemento, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'proyectn-pumasgaming.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function copiarTextoMetricas() {
    const textarea = document.getElementById('inputTextoMetricasCopiable');
    if (!textarea || !textarea.value) return;
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        alert("¡Texto copiado al portapapeles con éxito!");
    });
}
// ==========================================
// PROGRAMAR ENTRENAMIENTOS (CUPOS Y STAFF)
// ==========================================
async function guardarProgramacion() {
    if (!supabaseClient) return;

    let titulo = document.getElementById('progTitulo').value.trim();
    let fecha = document.getElementById('progFecha').value;
    let staff = document.getElementById('progStaff').value;
    let cupos = document.getElementById('progTotalEquipos').value;
    let link = document.getElementById('progLink').value.trim();
    let equiposStaffTexto = document.getElementById('progStaffEquipos').value.trim();
    const requierePub = document.getElementById('progRequierePub').value === 'SI';
    const pubVal = document.getElementById('progPublicarEn').value;
    if (requierePub && !pubVal) { alert('Indica la hora en que se publicará el entrenamiento.'); return; }
    const extra = requierePub ? { publicar_en: new Date(pubVal).toISOString() } : {};
    const tipoCupo = document.getElementById('progTipo') ? document.getElementById('progTipo').value : 'PUBLICO';
    if (tipoCupo === 'VIP') extra.tipo = 'VIP';   // sin la columna (sql/25) solo se pueden crear públicos

    if (!titulo || !fecha || !link) {
        alert("Por favor, completa el título, la fecha y el link del grupo.");
        return;
    }

    try {
        // 1. Crear el entrenamiento en la base de datos
        const { data: entData, error: entError } = await supabaseClient
            .from('entrenamientos_programados')
            .insert([{ 
                titulo: titulo, 
                fecha: new Date(fecha).toISOString(), 
                hay_staff: staff, 
                cupos_totales: parseInt(cupos), 
                link_grupo: link,
                ...extra
            }])
            .select()
            .single();

        if (entError) throw entError;
        
        // 2. Si se requiere staff, registrar esos equipos inmediatamente para restar cupos
        if (staff === 'SI' && equiposStaffTexto) {
            let lineas = equiposStaffTexto.split('\n');
            let insertsStaff = [];
            const vistosStaff = new Set();
            
            lineas.forEach(linea => {
                let nombreEq = linea.trim();
                if (nombreEq && !vistosStaff.has(nombreEq.toLowerCase().replace(/\s+/g, ' '))) {
                    vistosStaff.add(nombreEq.toLowerCase().replace(/\s+/g, ' '));
                    insertsStaff.push({
                        entrenamiento_id: entData.id,
                        nombre_jugador: nombreEq,
                        telefono: 'REGISTRO STAFF' // Marca especial para identificarlos
                    });
                }
            });

            if (insertsStaff.length > 0) {
                const { error: staffError } = await supabaseClient.from('registro_cupos').insert(insertsStaff);
                if (staffError) console.error("Error guardando equipos de staff:", staffError);
            }
        }
        
        if (document.getElementById('progTipo')) document.getElementById('progTipo').value = 'PUBLICO';
        alert((tipoCupo === 'VIP' ? 'Cupo VIP: solo entran los equipos de la lista VIP con su nombre y número. ' : '') + (requierePub ? "¡Entrenamiento guardado! Quedará pendiente y se abrirá solo a la hora indicada." : "¡Entrenamiento publicado exitosamente! Ya está disponible en la página de cupos."));
        
        // Limpiar formulario
        document.getElementById('progTitulo').value = '';
        document.getElementById('progRequierePub').value = 'NO';
        document.getElementById('progPublicarEn').value = '';
        document.getElementById('contenedorPublicarEn').style.display = 'none';
        document.getElementById('progLink').value = '';
        document.getElementById('progStaffEquipos').value = '';
        document.getElementById('progStaff').value = 'NO';
        document.getElementById('contenedorStaffEquipos').style.display = 'none';
    } catch (err) {
        console.error("Error al programar entrenamiento:", err);
        alert(/tipo/i.test((err && err.message) || '') ? "Para crear cupos VIP falta correr sql/25_cupos_vip_y_baneos.sql en Supabase." : "Ocurrió un error al guardar la programación.");
    }
}

// ==========================================
// GESTIÓN EN VIVO DE CUPOS (ADMIN)
// ==========================================

// Historial en dos lugares: Programar (cupos PÚBLICOS) y Programar → VIP (cupos VIP)
let _cuposData = [], _vistaCupos = 'PUBLICO';
const _filtroCupos = { PUBLICO: 'todos', VIP: 'todos' };
const _CAJAS_CUPOS = { PUBLICO: ['listaProgramadosAdmin', 'tabsCupos'], VIP: ['listaVipAdmin', 'tabsCuposVip'] };
const _CUPO_LBL = { activo: 'ACTIVO', lleno: 'LLENO / CERRADO', pendiente: 'PENDIENTE A ABRIR' };
const _escC = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _fmtC = iso => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

function estadoCupo(ent, ins) {
    if (ent.publicar_en && new Date(ent.publicar_en) > new Date()) return 'pendiente';
    if (ent.estado === 'CERRADO' || ins >= ent.cupos_totales) return 'lleno';
    return 'activo';
}

async function cargarEntrenamientosProgramadosAdmin(vista) {
    if (vista) _vistaCupos = vista;
    const cont = document.getElementById(_CAJAS_CUPOS[_vistaCupos][0]);
    if (!cont || !supabaseClient) return;
    cont.innerHTML = '<div class="cupos-empty">Consultando base de datos...</div>';
    try {
        const { data: ents, error: e1 } = await supabaseClient.from('entrenamientos_programados').select('*').order('fecha', { ascending: false });
        if (e1) throw e1;
        const { data: regs, error: e2 } = await supabaseClient.from('registro_cupos').select('*');
        if (e2) throw e2;
        const porEnt = {};
        (regs || []).forEach(r => (porEnt[r.entrenamiento_id] = porEnt[r.entrenamiento_id] || []).push(r));
        _cuposData = (ents || []).map(ent => {
            const listaEquipos = porEnt[ent.id] || [], inscritos = listaEquipos.length;
            const o = { ...ent, listaEquipos, inscritos, cuposRestantes: ent.cupos_totales - inscritos, est: estadoCupo(ent, inscritos) };
            window[`entrenamiento_${ent.id}`] = o;
            return o;
        });
        pintarCupos();
    } catch (err) {
        console.error('Error al cargar entrenamientos admin:', err);
        cont.innerHTML = '<div class="cupos-empty" style="color:#e0897c;">Error al cargar la información.</div>';
    }
}

function cambiarFiltroCupos(f) { _filtroCupos[_vistaCupos] = f; pintarCupos(); }

function pintarCupos() {
    const [idLista, idTabs] = _CAJAS_CUPOS[_vistaCupos];
    const cont = document.getElementById(idLista), tabs = document.getElementById(idTabs);
    if (!cont || !tabs) return;
    const filtro = _filtroCupos[_vistaCupos];
    const datos = _cuposData.filter(e => (e.tipo === 'VIP') === (_vistaCupos === 'VIP'));
    const n = k => datos.filter(e => e.est === k).length;
    const T = [['todos', 'Todos', datos.length], ['activo', 'Activos', n('activo')], ['lleno', 'Llenos', n('lleno')], ['pendiente', 'Pendientes a abrir', n('pendiente')]];
    tabs.innerHTML = T.map(([k, l, c]) => `<button class="cupos-tab ${filtro === k ? 'on' : ''}" onclick="cambiarFiltroCupos('${k}')">${l} <b>${c}</b></button>`).join('');
    const lista = datos.filter(e => filtro === 'todos' || e.est === filtro);
    if (!lista.length) { cont.innerHTML = `<div class="cupos-empty">${_vistaCupos === 'VIP' ? 'No hay cupos VIP en esta categoría.' : 'No hay entrenamientos en esta categoría.'}</div>`; return; }
    cont.innerHTML = lista.map(e => {
        const pct = Math.min(100, e.inscritos / e.cupos_totales * 100);
        const acciones = [
            `<button class="btn-mini" onclick="copiarListaWhatsApp('${e.id}')"><i class="fa-brands fa-whatsapp"></i> Copiar lista</button>`,
            e.est === 'pendiente' ? `<button class="btn-mini" onclick="publicarAhora('${e.id}')"><i class="fa-solid fa-bolt"></i> Publicar ahora</button>` : '',
            e.estado === 'CERRADO' ? `<button class="btn-mini" onclick="cambiarEstadoInscripcion('${e.id}','ABIERTO')"><i class="fa-solid fa-lock-open"></i> Reabrir</button>`
                : (e.est !== 'pendiente' ? `<button class="btn-mini" onclick="cambiarEstadoInscripcion('${e.id}','CERRADO')"><i class="fa-solid fa-lock"></i> Cerrar</button>` : ''),
            `<button class="btn-mini peligro" onclick="borrarEntrenamiento('${e.id}')"><i class="fa-solid fa-trash"></i> Borrar</button>`
        ].join('');
        const equipos = e.listaEquipos.length ? e.listaEquipos.map((q, i) => `<div class="cupo-eq"><span><b>${i + 1}.</b> ${_escC(q.nombre_jugador)}</span><small>${q.telefono === 'REGISTRO STAFF' ? '<i class="fa-solid fa-shield-halved"></i> STAFF' : _escC(q.telefono)}</small></div>`).join('') : '<div class="cupos-empty">No hay equipos inscritos aún.</div>';
        return `<div class="cupo-row ${e.est}">
            <div class="cupo-main" onclick="document.getElementById('eq_${e.id}').classList.toggle('open')">
                <span class="cupo-badge ${e.est}">${_CUPO_LBL[e.est]}</span>
                <div class="cupo-info"><b>${e.tipo === 'VIP' && _vistaCupos !== 'VIP' ? '<span style="display:inline-block;padding:1px 6px;margin-right:6px;border-radius:3px;background:#FFD54A;color:#1a1400;font-size:.65rem;vertical-align:middle">VIP</span>' : ''}${_escC(e.titulo)}</b><small><i class="fa-regular fa-clock"></i> ${_fmtC(e.fecha)}${e.est === 'pendiente' ? ' · <i class="fa-solid fa-bolt"></i> Se publica: ' + _fmtC(e.publicar_en) : ''}${e.cierra_en ? ' · <i class="fa-solid fa-hourglass-end"></i> Inscripciones hasta: ' + _fmtC(e.cierra_en) : ''}</small></div>
                <div class="cupo-meter"><b>${e.inscritos}/${e.cupos_totales}</b><div class="bar"><i style="width:${pct}%"></i></div></div>
                <i class="fa-solid fa-chevron-down cupo-chev"></i>
            </div>
            <div class="cupo-actions">${acciones}</div>
            <div class="cupo-equipos" id="eq_${e.id}">${equipos}</div>
        </div>`;
    }).join('');
}

async function publicarAhora(id) {
    if (!confirm('¿Publicar este entrenamiento ahora mismo?')) return;
    try {
        const { error } = await supabaseClient.from('entrenamientos_programados').update({ publicar_en: null, estado: 'ABIERTO' }).eq('id', id);
        if (error) throw error;
        cargarEntrenamientosProgramadosAdmin();
    } catch (err) { alert('No se pudo publicar.'); }
}

async function borrarEntrenamiento(id) {
    const e = window[`entrenamiento_${id}`];
    if (!confirm(`¿Borrar "${e ? e.titulo : 'este entrenamiento'}" y sus ${e ? e.inscritos : 0} inscripciones? No se puede deshacer.`)) return;
    try {
        await supabaseClient.from('registro_cupos').delete().eq('entrenamiento_id', id);
        const { data, error } = await supabaseClient.from('entrenamientos_programados').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || !data.length) throw new Error('Sin permiso para borrar (RLS).');
        cargarEntrenamientosProgramadosAdmin();
    } catch (err) {
        console.error(err);
        alert('No se pudo borrar. Revisa que Supabase permita DELETE en entrenamientos_programados y registro_cupos.');
    }
}

async function cambiarEstadoInscripcion(id, nuevoEstado) {
    let mensaje = nuevoEstado === 'CERRADO' ? "¿Estás seguro de CERRAR las inscripciones?" : "¿Deseas REABRIR las inscripciones?";
    if (!confirm(mensaje)) return;
    
    try {
        const { error } = await supabaseClient.from('entrenamientos_programados').update({ estado: nuevoEstado }).eq('id', id);
        if (error) throw error;
        cargarEntrenamientosProgramadosAdmin();
    } catch(err) {
        alert("Error al cambiar el estado.");
    }
}

function copiarListaWhatsApp(id) {
    let ent = window[`entrenamiento_${id}`];
    if (!ent) return;

    let fechaActual = new Date(ent.fecha);
    let fechaFormateada = fechaActual.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
    let horaCOL = fechaActual.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });

    let listaTexto = ent.listaEquipos.map((eq, i) => `${i+1}. ${eq.nombre_jugador}`).join('\n');
    if (ent.listaEquipos.length === 0) listaTexto = "Sin inscripciones todavía.";

    let texto = `🐺 *${ent.titulo.toUpperCase()}* 🐺\n` +
                `📅 Fecha: ${fechaFormateada}\n` +
                `⏰ Hora: ${horaCOL} COL\n\n` +
                `📋 *EQUIPOS CONFIRMADOS (${ent.inscritos}/${ent.cupos_totales}):*\n` +
                `${listaTexto}\n\n` +
                `⚠️ Faltan ${ent.cuposRestantes} equipos para llenar cupos.`;

    navigator.clipboard.writeText(texto).then(() => {
        alert("¡Lista copiada al portapapeles! Ya puedes pegarla en WhatsApp.");
    }).catch(err => {
        alert("Error al copiar. Selecciona el texto manualmente.");
    });
}