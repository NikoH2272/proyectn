let salasProcesadas = []; 
let correccionesNombres = {};
let equiposEliminados = new Set();
let salasLogsOriginales = []; 
let salasManualesLista = [];

function procesarArchivos() {
    const fileInput = document.getElementById('inputFileUpload');
    const files = fileInput.files;
    
    correccionesNombres = {};
    equiposEliminados.clear();

    if (files.length === 0) {
        salasLogsOriginales = [];
        actualizarSalasTotales();
        return;
    }

    let promesas = [];
    for (let i = 0; i < files.length; i++) {
        promesas.push(leerArchivo(files[i]));
    }

    Promise.all(promesas).then(resultadosTextos => {
        salasLogsOriginales = resultadosTextos.map(txt => parsearLogSala(txt));
        actualizarSalasTotales();
    }).catch(error => {
        console.error("Error al leer los archivos:", error);
        alert("Ocurrió un error al procesar los archivos.");
    });
}

function agregarSalaManualMasiva() {
    const contenido = document.getElementById('textareaSalaManual').value.trim();
    if (!contenido) {
        alert("Por favor, ingresa al menos una línea con el equipo y su puntaje.");
        return;
    }

    let lineas = contenido.split('\n');
    let mapaManual = new Map();

    lineas.forEach((linea, index) => {
        let partes = linea.split(',');
        if (partes.length >= 2) {
            let nombreEquipo = partes[0].trim();
            let puntaje = parseInt(partes[1].trim());

            if (nombreEquipo && !isNaN(puntaje)) {
                mapaManual.set(nombreEquipo, {
                    name: nombreEquipo,
                    rank: index + 1,
                    killScore: puntaje,
                    rankScore: puntaje,
                    totalScore: puntaje,
                    isManual: true, 
                    players: []     
                });
            }
        }
    });

    if (mapaManual.size === 0) {
        alert("El formato no es válido. Asegúrate de usar: NombreEquipo, Puntuacion");
        return;
    }

    correccionesNombres = {};
    equiposEliminados.clear();

    salasManualesLista.push(mapaManual);
    document.getElementById('textareaSalaManual').value = ''; 

    actualizarSalasTotales();
    alert("¡Sala manual añadida correctamente a la suma total!");
}

function actualizarSalasTotales() {
    salasProcesadas = [...salasLogsOriginales, ...salasManualesLista];
    actualizarEditorEquipos();
    renderizarResultados();
}

function leerArchivo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });
}

function parsearLogSala(rawData) {
    const lineas = rawData.split('\n');
    let equiposMap = new Map();
    let equipoActual = null;

    lineas.forEach(linea => {
        const line = linea.trim();
        if (line.startsWith('TeamName:')) {
            if (equipoActual) equiposMap.set(equipoActual.name, equipoActual);

            const teamNameMatch = line.match(/TeamName:\s*(.*?)\s*Rank:/);
            const rankMatch = line.match(/Rank:\s*(\d+)/);
            const killScoreMatch = line.match(/KillScore:\s*(\d+)/);
            const rankScoreMatch = line.match(/RankScore:\s*(\d+)/);
            const totalScoreMatch = line.match(/TotalScore:\s*(\d+)/);

            equipoActual = {
                name: teamNameMatch ? teamNameMatch[1].trim() : "Unknown",
                rank: rankMatch ? parseInt(rankMatch[1]) : 0,
                killScore: killScoreMatch ? parseInt(killScoreMatch[1]) : 0,
                rankScore: rankScoreMatch ? parseInt(rankScoreMatch[1]) : 0,
                totalScore: totalScoreMatch ? parseInt(totalScoreMatch[1]) : 0,
                isManual: false,
                players: []
            };
        } else if (line.startsWith('NAME:') && equipoActual) {
            const nameMatch = line.match(/NAME:\s*(.*?)\s*ID:/);
            const killMatch = line.match(/KILL:\s*(\d+)/);

            if (nameMatch) {
                equipoActual.players.push({
                    name: nameMatch[1].trim(),
                    kills: killMatch ? parseInt(killMatch[1]) : 0
                });
            }
        }
    });

    if (equipoActual) equiposMap.set(equipoActual.name, equipoActual);
    return equiposMap;
}

function actualizarEditorEquipos() {
    const contenedor = document.getElementById('contenedorEdicionEquipos');
    const divTabla = document.getElementById('tablaEdicionEquipos');

    if (salasProcesadas.length === 0) {
        contenedor.style.display = 'none';
        divTabla.innerHTML = '';
        return;
    }

    let nombresSet = new Set();
    salasProcesadas.forEach(salaMap => {
        salaMap.forEach((_, name) => nombresSet.add(name));
    });

    let listaNombres = Array.from(nombresSet).sort();

    let html = `<table>
        <thead>
            <tr>
                <th>No</th>
                <th>Nombre Original en Data</th>
                <th>Nombre Visible (Editar)</th>
                <th>Acción</th>
            </tr>
        </thead>
        <tbody>`;

    listaNombres.forEach((nombre, idx) => {
        let esEliminado = equiposEliminados.has(nombre);
        let valorActual = correccionesNombres[nombre] !== undefined ? correccionesNombres[nombre] : nombre;

        html += `<tr id="row-edit-${idx}" style="${esEliminado ? 'opacity: 0.4; background: rgba(255,0,0,0.1);' : ''}">
            <td>${idx + 1}</td>
            <td style="color: var(--gray); font-weight: bold;">${nombre}</td>
            <td>
                <input type="text" class="input-edit-team" value="${valorActual.replace(/"/g, '&quot;')}" 
                       ${esEliminado ? 'disabled' : ''} 
                       oninput="cambiarNombreEquipo('${nombre.replace(/'/g, "\\'")}', this.value)">
            </td>
            <td>
                ${esEliminado ? 
                    `<button class="btn-tabla-restaurar" onclick="restaurarEquipo('${nombre.replace(/'/g, "\\'")}')"><i class="fa-solid fa-rotate-left"></i> Restaurar</button>` :
                    `<button class="btn-tabla-eliminar" onclick="eliminarEquipo('${nombre.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i> Borrar</button>`
                }
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    divTabla.innerHTML = html;
    contenedor.style.display = 'block';
}

function cambiarNombreEquipo(nombreOriginal, nuevoNombre) {
    if (nuevoNombre.trim() === '') {
        correccionesNombres[nombreOriginal] = nombreOriginal;
    } else {
        correccionesNombres[nombreOriginal] = nuevoNombre;
    }
    renderizarResultados();
}

function eliminarEquipo(nombreOriginal) {
    equiposEliminados.add(nombreOriginal);
    actualizarEditorEquipos();
    renderizarResultados();
}

function restaurarEquipo(nombreOriginal) {
    equiposEliminados.delete(nombreOriginal);
    actualizarEditorEquipos();
    renderizarResultados();
}

function formatearFechaHoraZonas(datetimeVal) {
    let fechaObj = datetimeVal ? new Date(datetimeVal) : new Date();
    if (isNaN(fechaObj.getTime())) { fechaObj = new Date(); }

    let opcionesFecha = { day: '2-digit', month: '2-digit', year: 'numeric' };
    let opcionesHora = { hour: 'numeric', minute: 'numeric', hour12: true };

    let fechaFormateada = fechaObj.toLocaleDateString('es-CO', opcionesFecha);
    let horaMex = fechaObj.toLocaleTimeString('es-MX', { ...opcionesHora, timeZone: 'America/Mexico_City' });
    let horaCol = fechaObj.toLocaleTimeString('es-CO', { ...opcionesHora, timeZone: 'America/Bogota' });
    let horaArg = fechaObj.toLocaleTimeString('es-AR', { ...opcionesHora, timeZone: 'America/Argentina/Buenos_Aires' });

    return {
        fecha: fechaFormateada,
        mex: `${horaMex} Mx`,
        col: `${horaCol} Col`,
        arg: `${horaArg} Arg`
    };
}

function obtenerTagBase(nombreEquipo) {
    let limpio = nombreEquipo.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '');
    return limpio.toUpperCase();
}

function renderizarResultados() {
    const contenedorSide = document.getElementById('outputTablasLadoALado');
    const contenedorReducida = document.getElementById('outputTablaReducida');

    if (salasProcesadas.length === 0) {
        contenedorSide.innerHTML = "";
        contenedorReducida.innerHTML = "";
        return;
    }

    const modoCalculo = document.getElementById('selectModoCalculo').value;
    const temaVal = document.getElementById('selectTemaVisual').value;
    const inputFechaHora = document.getElementById('inputFechaHora').value;
    
    const inputModerador = document.getElementById('inputModerador');
    let nombreModerador = inputModerador && inputModerador.value.trim() !== "" ? inputModerador.value.trim().toUpperCase() : "ERERRE";

    let horasZona = formatearFechaHoraZonas(inputFechaHora);
    // Bloque doble a la misma hora: BLOQUE A / BLOQUE B
    const selBloque = document.getElementById('selectBloque');
    const bloque = selBloque ? selBloque.value : '';
    const htmlBloque = bloque ? `<span style="position: relative; display: inline-block; background: #FFD54A; color: #111; padding: 1px 8px; border-radius: 3px; font-weight: 900; margin-right: 6px; font-size: calc(0.79rem * 1.10);">BLOQUE ${bloque}</span>` : '';

    let colorFondoBase = "rgba(20, 20, 30, 0.75)";
    let colorTituloTema = "#ffffff";
    let colorTextoTabla = "#ffffff";

    if (temaVal === 'fdquisqueya') {
        colorFondoBase = "rgba(10, 34, 64, 0.75)";
        colorTituloTema = "#81d4fa";
        colorTextoTabla = "#ffffff";
    } else if (temaVal === 'dragonfest') {
        colorFondoBase = "rgba(15, 23, 42, 0.75)";
        colorTituloTema = "#93c5fd";
        colorTextoTabla = "#ffffff";
    } else if (temaVal === 'dragonfestfem') {
        colorFondoBase = "rgba(35, 15, 45, 0.75)";
        colorTituloTema = "#f3e8ff";
        colorTextoTabla = "#ffffff";
    }

    let mapaConsolidado = new Map();
    let mapaJugadoresKills = new Map();
    let booyahsPorSala = [];

    salasProcesadas.forEach((salaMap, idxSala) => {
        salaMap.forEach((eqData, nombreOriginal) => {
            if (equiposEliminados.has(nombreOriginal)) return;

            let nombreVisible = correccionesNombres[nombreOriginal] || nombreOriginal;

            if (eqData.rank === 1 && !eqData.isManual) {
                booyahsPorSala.push({ sala: idxSala + 1, equipo: nombreVisible });
            }

            if (!mapaConsolidado.has(nombreVisible)) {
                mapaConsolidado.set(nombreVisible, {
                    name: nombreVisible,
                    salas: new Array(salasProcesadas.length).fill(null),
                    totalScoreAcumulado: 0,
                    rankScoreAcumulado: 0,
                    killScoreAcumulado: 0,
                    jugadoresValidosTag: 0,
                    totalJugadoresRegistrados: 0
                });
            }

            let itemConsolidado = mapaConsolidado.get(nombreVisible);
            
            itemConsolidado.totalScoreAcumulado += eqData.totalScore;
            itemConsolidado.rankScoreAcumulado += eqData.rankScore;
            itemConsolidado.killScoreAcumulado += eqData.killScore;

            let valorObtenido = 0;
            if (modoCalculo === 'normal') valorObtenido = eqData.totalScore;
            else if (modoCalculo === 'top') valorObtenido = eqData.rankScore;
            else if (modoCalculo === 'kill') valorObtenido = eqData.killScore;

            if (itemConsolidado.salas[idxSala] === null) {
                itemConsolidado.salas[idxSala] = valorObtenido;
            } else {
                itemConsolidado.salas[idxSala] += valorObtenido;
            }

            if (!eqData.isManual && eqData.players && eqData.players.length > 0) {
                let tagEquipo = obtenerTagBase(nombreVisible);

                eqData.players.forEach(p => {
                    if (tagEquipo && p.name.toUpperCase().includes(tagEquipo)) {
                        itemConsolidado.jugadoresValidosTag++;
                    }
                    itemConsolidado.totalJugadoresRegistrados++;

                    let key = `${p.name}___${nombreVisible}`;
                    if (!mapaJugadoresKills.has(key)) {
                        mapaJugadoresKills.set(key, { name: p.name, team: nombreVisible, kills: 0 });
                    }
                    mapaJugadoresKills.get(key).kills += p.kills;
                });
            }
        });
    });

    let listaConsolidada = Array.from(mapaConsolidado.values()).map(item => {
        let total = 0;
        if (modoCalculo === 'normal') total = item.totalScoreAcumulado;
        else if (modoCalculo === 'top') total = item.rankScoreAcumulado;
        else if (modoCalculo === 'kill') total = item.killScoreAcumulado;

        return { ...item, total: total };
    });

    listaConsolidada.sort((a, b) => b.total - a.total);

    let topKillers = Array.from(mapaJugadoresKills.values())
        .filter(k => k.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 9);

    let cantidadSalas = salasProcesadas.length;
    let tienePuntosAscenso = false;

    let equiposAscenso = listaConsolidada.filter(item => {
        let cumplePuntos = false;

        if (modoCalculo === 'normal') {
            if (cantidadSalas <= 4 && item.totalScoreAcumulado >= 90) cumplePuntos = true;
            else if (cantidadSalas === 5 && item.totalScoreAcumulado >= 110) cumplePuntos = true;
            else if (cantidadSalas >= 6 && item.totalScoreAcumulado >= 125) cumplePuntos = true;
        } else if (modoCalculo === 'top') {
            if (cantidadSalas <= 4 && item.rankScoreAcumulado >= 40) cumplePuntos = true;
            else if (cantidadSalas === 5 && item.rankScoreAcumulado >= 45) cumplePuntos = true;
            else if (cantidadSalas >= 6 && item.rankScoreAcumulado >= 50) cumplePuntos = true;
        }

        let ratioTag = item.totalJugadoresRegistrados > 0 
            ? (item.jugadoresValidosTag / item.totalJugadoresRegistrados) 
            : 1; 

        let cumpleTag = ratioTag >= 0.75;

        return cumplePuntos && cumpleTag;
    });

    if ((modoCalculo === 'normal' || modoCalculo === 'top') && equiposAscenso.length > 0) {
        tienePuntosAscenso = true;
    }

    let thead = `<tr><th style="color: ${colorTextoTabla} !important; font-size: calc(0.85rem * 1.10);">TOP</th><th style="color: ${colorTextoTabla} !important; font-size: calc(0.85rem * 1.10);">EQUIPO</th>`;
    salasProcesadas.forEach((_, idx) => {
        thead += `<th style="color: ${colorTextoTabla} !important; font-size: calc(0.85rem * 1.10);">S${idx + 1}</th>`;
    });
    thead += `<th style="color: ${colorTextoTabla} !important; font-size: calc(0.85rem * 1.10);">TOTAL</th></tr>`;

    let tbody = ``;
    listaConsolidada.forEach((item, index) => {
        tbody += `<tr>
            <td style="color: ${colorTextoTabla}; font-size: calc(0.85rem * 1.10);"><strong>#${index + 1}</strong></td>
            <td style="color: ${colorTextoTabla}; font-size: calc(0.85rem * 1.10);"><strong>${item.name}</strong></td>`;
        
        item.salas.forEach(val => {
            if (val === null) {
                tbody += `<td class="sala-sin-registro" style="color: ${colorTextoTabla}; font-size: calc(0.85rem * 1.10);"><i class="fa-solid fa-skull" style="color: #ff6b6b !important;"></i></td>`;
            } else {
                tbody += `<td style="color: ${colorTextoTabla}; font-size: calc(0.85rem * 1.10);">${val}</td>`;
            }
        });

        tbody += `<td style="color: ${colorTextoTabla}; font-size: calc(0.85rem * 1.10);"><strong>${item.total}</strong></td></tr>`;
    });

    let tituloModo = "TABLA GENERAL";
    if (modoCalculo === 'top') tituloModo = "TABLA SOLO TOP";
    if (modoCalculo === 'kill') tituloModo = "TABLA SOLO KILL";

    let htmlTablaGeneral = `
        <div class="column-table-general" style="flex: 0 0 100%; max-width: 100%;">
            <h3 style="font-size: calc(1rem * 1.10); color: var(--accent-yellow); margin-bottom: 8px;"><i class="fa-solid fa-list-ol"></i> ${tituloModo}</h3>
            <div class="table-general-box" style="background: #121520;">
                <div class="table-general-overlay">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <p style="color: var(--gray); font-size: calc(0.8rem * 1.10);">${htmlBloque}<strong>${horasZona.fecha}</strong> — ${horasZona.mex} | ${horasZona.col} | ${horasZona.arg}</p>
                    </div>
                    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
                </div>
            </div>
        </div>`;

    contenedorSide.innerHTML = `<div class="side-by-side-wrapper">${htmlTablaGeneral}</div>`;

    let htmlTopKillers = ``;
    if (topKillers.length > 0) {
        htmlTopKillers = `<table style="width:100%; border-collapse:collapse; background:transparent;"><thead><tr><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.99rem * 1.10);">#</th><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.99rem * 1.10);">JUGADOR</th><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.99rem * 1.10);">KILLS</th></tr></thead><tbody>`;
        topKillers.forEach((k, idx) => {
            htmlTopKillers += `<tr><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;">#${idx + 1}</td><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;"><strong>${k.name}</strong></td><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;"><strong>${k.kills}</strong></td></tr>`;
        });
        htmlTopKillers += `</tbody></table>`;
    } else {
        htmlTopKillers = `<p style="text-align:center; padding:5px; opacity:0.7; color:${colorTextoTabla}; font-size:calc(0.89rem * 1.10);">Sin registro de kills</p>`;
    }

    let htmlBooyahs = ``;
    if (booyahsPorSala.length > 0) {
        htmlBooyahs = `<table style="width:100%; border-collapse:collapse; background:transparent;"><thead><tr><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.99rem * 1.10);">SALA</th><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.99rem * 1.10);">BOOYAH</th></tr></thead><tbody>`;
        booyahsPorSala.forEach(b => {
            htmlBooyahs += `<tr><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;">Sala ${b.sala}</td><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;"><strong>${b.equipo} <i class="fa-solid fa-crown" style="color: #ffd700;"></i></strong></td></tr>`;
        });
        htmlBooyahs += `</tbody></table>`;
    } else {
        htmlBooyahs = `<p style="text-align:center; padding:5px; opacity:0.7; color:${colorTextoTabla}; font-size:calc(0.89rem * 1.10);">Sin registro de Booyahs</p>`;
    }

    let htmlAscensoPanel = ``;
    if (tienePuntosAscenso) {
        let rowsAscenso = ``;
        equiposAscenso.forEach((eq, idx) => {
            rowsAscenso += `<tr><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;">#${idx + 1}</td><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;"><strong>${eq.name}</strong> <i class="fa-solid fa-arrow-up" style="color: #4ade80;"></i></td><td style="padding:2px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); font-size:calc(0.89rem * 1.10); font-weight:bold; color:${colorTextoTabla}; background:transparent;"><strong>${eq.total}</strong></td></tr>`;
        });

        htmlAscensoPanel = `
            <div style="margin-bottom: 4px; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 2px;">
                <h4 style="font-family:'Orbitron'; font-size:calc(0.85rem * 1.10); color:${colorTituloTema}; text-align:center; margin-bottom:2px;"><i class="fa-solid fa-angles-up"></i> ASCENSO DIRECTO</h4>
                <table style="width:100%; border-collapse:collapse; background:transparent;">
                    <thead><tr><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:1px 3px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.8rem * 1.10);">#</th><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:1px 3px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.8rem * 1.10);">EQUIPO</th><th style="background:transparent !important; color:${colorTextoTabla} !important; padding:1px 3px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.2); font-family:'Orbitron'; font-size:calc(0.8rem * 1.10);">PUNTOS</th></tr></thead>
                    <tbody>${rowsAscenso}</tbody>
                </table>
            </div>
        `;
    }

    let htmlTerceraTablaCompleta = `
        <div style="width: 100%; overflow: hidden; display: flex; justify-content: center;">
            <div id="tablaReducidaCaptura" class="tema-${temaVal}" style="width: 1280px !important; height: 720px !important; min-width: 1280px !important; min-height: 720px !important; max-width: 1280px !important; max-height: 720px !important; padding: 143px 45px 72px 45px !important; border-radius: 12px; box-sizing: border-box; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; transform: scale(0.65); transform-origin: top center; margin-bottom: -250px; flex-shrink: 0; position: relative; overflow: hidden;">
                <div style="display: flex; flex-direction: row; gap: 15px; width: 100%; height: 100%; align-items: stretch; justify-content: flex-start; padding-right: 75%; MARGIN-TOP: 5%;">
                    
                    <div style="flex: 0 0 690px !important; width: 690px !important; height: 450px !important; max-width: 690px !important; max-height: 450px !important; overflow: hidden; border-radius: 6px; padding: 6px 10px; background: ${colorFondoBase}; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                        <div style="text-align: center; margin-bottom: 3px;">
                            <h3 style="font-size: calc(1.155rem * 1.10); font-family: 'Orbitron'; margin-bottom: 1px; color: ${colorTituloTema};">${tituloModo} - MODERADOR: <strong style="font-size:calc(1.155rem * 1.10); font-weight:900; color:${colorTituloTema};">${nombreModerador}</strong></h3>
                            <!-- position: relative evita que la descarga pinte el fondo encima del texto -->
                            <div style="position: relative; font-size: calc(0.89rem * 1.10) !important; font-weight: 700; line-height: 1.35; background: rgba(0, 0, 0, 0.6); display: inline-block; padding: 3px 10px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.25); margin-top: 2px; margin-bottom: 3px; color: #ffffff;">
                                ${htmlBloque}
                                <span style="position: relative; display: inline-block; background: #111; color: #fff; padding: 1px 6px; border-radius: 3px; font-weight: bold; margin-right: 4px; font-size: calc(0.79rem * 1.10);">★ HORARIOS</span>
                                <strong>${horasZona.fecha}</strong> — ${horasZona.mex} | ${horasZona.col} | ${horasZona.arg}
                            </div>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; background: transparent; color: ${colorTextoTabla};">
                            <thead>
                                <tr>
                                    <th style="background: transparent !important; color: ${colorTextoTabla} !important; padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); font-family: 'Orbitron'; font-size: calc(0.86rem * 1.10);">TOP</th>
                                    <th style="background: transparent !important; color: ${colorTextoTabla} !important; padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); font-family: 'Orbitron'; font-size: calc(0.86rem * 1.10);">EQUIPO</th>
                                    ${salasProcesadas.map((_, idx) => `<th style="background: transparent !important; color: ${colorTextoTabla} !important; padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); font-family: 'Orbitron'; font-size: calc(0.86rem * 1.10);">S${idx + 1}</th>`).join('')}
                                    <th style="background: transparent !important; color: ${colorTextoTabla} !important; padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); font-family: 'Orbitron'; font-size: calc(0.86rem * 1.10);">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${listaConsolidada.map((item, index) => `
                                    <tr>
                                        <td style="padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: calc(0.82rem * 1.10); font-weight: bold; color: ${colorTextoTabla}; background: transparent;"><strong>#${index + 1}</strong></td>
                                        <td style="padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: calc(0.82rem * 1.10); font-weight: bold; color: ${colorTextoTabla}; background: transparent;"><strong>${item.name}</strong></td>
                                        ${item.salas.map(val => val === null ? `<td style="padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: calc(0.82rem * 1.10); font-weight: bold; color: ${colorTextoTabla}; background: transparent;" class="sala-sin-registro"><i class="fa-solid fa-skull" style="color: #ff6b6b !important; font-size: calc(0.82rem * 1.10);"></i></td>` : `<td style="padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: calc(0.82rem * 1.10); font-weight: bold; color: ${colorTextoTabla}; background: transparent;">${val}</td>`).join('')}
                                        <td style="padding: 2px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: calc(0.82rem * 1.10); font-weight: bold; color: ${colorTextoTabla}; background: transparent;"><strong>${item.total}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0px; flex: 0 0 342px !important; width: 342px !important; height: 450px !important; max-width: 342px !important; max-height: 450px !important;">
                        
                        <div style="flex: 0 0 270px !important; width: 100% !important; height: 270px !important; max-width: 100% !important; max-height: 270px !important; overflow: hidden; padding: 6px 10px; background: ${colorFondoBase}; border: 1px solid rgba(255,255,255,0.15); box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                            ${htmlAscensoPanel}
                            <h3 style="font-family: 'Orbitron'; font-size: calc(0.95rem * 1.10); text-align: center; margin-bottom: 2px; color: ${colorTituloTema};"><i class="fa-solid fa-crosshairs"></i> TOP KILLER</h3>
                            ${htmlTopKillers}
                        </div>

                        <div style="flex: 0 0 175px !important; width: 100% !important; height: 175px !important; max-width: 100% !important; max-height: 175px !important; overflow: hidden; padding: 6px 10px; background: ${colorFondoBase}; border: 1px solid rgba(255,255,255,0.15); box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                            <h3 style="font-family: 'Orbitron'; font-size: calc(0.95rem * 1.10); text-align: center; margin-bottom: 2px; color: ${colorTituloTema};"><i class="fa-solid fa-trophy"></i> BOOYAH</h3>
                            ${htmlBooyahs}
                        </div>

                    </div>
                </div>
            </div>
        </div>`;

    contenedorReducida.innerHTML = htmlTerceraTablaCompleta;
}

function descargarTablaReducida() {
    const elemento = document.getElementById('tablaReducidaCaptura');

    if (!elemento) {
        alert("Primero sube archivos o ingresa salas manuales.");
        return;
    }

    const estiloOriginalTransform = elemento.style.transform;
    const estiloOriginalPosition = elemento.style.position;
    const estiloOriginalLeft = elemento.style.left;
    const elementos = elemento.querySelectorAll('*');
    const sombras = [];

    elementos.forEach((el, i) => {
        sombras[i] = el.style.boxShadow;
        el.style.boxShadow = 'none';
    });

    elemento.style.transform = 'none';
    elemento.style.position = 'fixed';
    elemento.style.left = '-9999px';

    const opciones = {
        scale: 2, 
        width: 1280,
        height: 720,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0a0b10',
        logging: false,
        onclone: function(documentoClonado) {
            const clon = documentoClonado.getElementById('tablaReducidaCaptura');
            if (clon) {
                clon.style.transform = 'none';
                clon.style.position = 'static';
                clon.style.boxShadow = 'none';
                clon.querySelectorAll('*').forEach(el => {
                    el.style.boxShadow = 'none';
                    el.style.textShadow = 'none';
                    if (el.style.filter) el.style.filter = 'none';
                });
            }
        }
    };

    html2canvas(elemento, opciones)
        .then(canvas => {
            const enlace = document.createElement('a');
            const bq = document.getElementById('selectBloque');
            enlace.download = 'resultados-pumas-gaming' + (bq && bq.value ? '-bloque-' + bq.value.toLowerCase() : '') + '.png';
            enlace.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
        })
        .catch(error => {
            console.error("Error al generar la imagen:", error);
            alert("Ocurrió un error al exportar la imagen.");
        })
        .finally(() => {
            elemento.style.transform = estiloOriginalTransform;
            elemento.style.position = estiloOriginalPosition;
            elemento.style.left = estiloOriginalLeft;

            elementos.forEach((el, i) => {
                el.style.boxShadow = sombras[i];
            });
        });
}

window.onload = function() {
    renderizarResultados();
};