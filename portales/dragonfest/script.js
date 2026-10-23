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

function togglePerdon(nombre) {
    if (!window._equiposPerdonados) window._equiposPerdonados = new Set();
    if (window._equiposPerdonados.has(nombre)) {
        window._equiposPerdonados.delete(nombre);
    } else {
        window._equiposPerdonados.add(nombre);
    }
    renderizarResultados();
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

    const _ed = window.PGEditorImagen ? window.PGEditorImagen.cfg('dragonfest') : {};

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
                booyahsPorSala.push({ sala: idxSala + 1, equipo: nombreVisible, pts: eqData.totalScore, kills: eqData.killScore });
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
    if (_ed.maxEquipos > 0) listaConsolidada = listaConsolidada.slice(0, _ed.maxEquipos);

    // Ban por faltar última sala o 2+ salas
    if (!window._equiposPerdonados) window._equiposPerdonados = new Set();
    const cantSalas = salasProcesadas.length;
    const equiposSancionados = listaConsolidada.filter(item => {
        const faltaUltima = cantSalas > 0 && item.salas[cantSalas - 1] === null;
        const faltaDos = item.salas.filter(s => s === null).length >= 2;
        return faltaUltima || faltaDos;
    });

    // Renderizar panel de banes
    const banContainer = document.getElementById('imgBanPanel');
    if (banContainer) {
        if (equiposSancionados.length === 0) {
            banContainer.innerHTML = '';
        } else {
            banContainer.innerHTML = `
                <div class="ban-panel-box">
                    <h4><i class="fa-solid fa-ban"></i> Equipos en riesgo de ban</h4>
                    <p class="ban-panel-nota">Faltó a la última sala o a 2+ salas. Los no perdonados aparecen marcados en la imagen.</p>
                    <div class="ban-panel-lista">
                        ${equiposSancionados.map(item => {
                            const faltaUltima = item.salas[cantSalas - 1] === null;
                            const ausentes = item.salas.filter(s => s === null).length;
                            const razon = faltaUltima ? `faltó S${cantSalas}` : `faltó ${ausentes} salas`;
                            const perdonado = window._equiposPerdonados.has(item.name);
                            return `<div class="ban-item">
                                <span class="ban-equipo">${item.name}</span>
                                <span class="ban-razon">${razon}</span>
                                <button class="ban-btn ${perdonado ? 'perdonado' : ''}" onclick="togglePerdon('${item.name.replace(/'/g,"\\'")}')">
                                    ${perdonado ? '<i class="fa-solid fa-check"></i> Perdonado' : '<i class="fa-solid fa-ban"></i> Baneado'}
                                </button>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }
    }

    let topKillers = Array.from(mapaJugadoresKills.values())
        .filter(k => k.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, _ed.maxKillers || 9);

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

    let thead = `<tr><th class="col-top">TOP</th><th>EQUIPO</th>`;
    salasProcesadas.forEach((_, idx) => {
        thead += `<th class="col-sala">S${idx + 1}</th>`;
    });
    thead += `<th class="col-total">TOTAL</th></tr>`;

    const _colores = [_ed.color1||'#B6FF00', _ed.color2||'#FFD54A', _ed.color3||'#00C6FF'];
    let tbody = ``;
    listaConsolidada.forEach((item, index) => {
        const colorFila = index < 3 ? _colores[index] : '';
        const bgFila    = index === 0 ? 'rgba(255,255,255,0.08)' : index < 3 ? 'rgba(255,255,255,0.04)' : '';
        const rowStyle  = colorFila ? `style="--row-color:${colorFila}; --row-bg:${bgFila};"` : '';
        tbody += `<tr ${rowStyle}>
            <td class="col-fila"><strong>#${index + 1}</strong></td>
            <td class="col-fila" contenteditable="true"><strong>${item.name}</strong></td>`;

        item.salas.forEach(val => {
            if (val === null) {
                tbody += `<td class="sala-sin-registro"><i class="fa-solid fa-skull"></i></td>`;
            } else {
                tbody += `<td contenteditable="true">${val}</td>`;
            }
        });

        tbody += `<td class="col-fila" contenteditable="true"><strong>${item.total}</strong></td></tr>`;
    });

    let tituloModo = "TABLA GENERAL";
    if (modoCalculo === 'top') tituloModo = "TABLA SOLO TOP";
    if (modoCalculo === 'kill') tituloModo = "TABLA SOLO KILL";

    let htmlTablaGeneral = `
        <div class="column-table-general" style="flex: 0 0 100%; max-width: 100%;">
            <h3 style="font-size: calc(1rem * 1.10); color: var(--accent-yellow); margin-bottom: 8px;"><i class="fa-solid fa-list-ol"></i> ${tituloModo}</h3>
            <div class="table-general-box" style="background: #121520;">
                <div class="table-general-overlay" style="--tg-color-texto:${colorTextoTabla};">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <p style="color: var(--gray); font-size: calc(0.8rem * 1.10);">${htmlBloque}<strong>${horasZona.fecha}</strong> — ${horasZona.mex} | ${horasZona.col} | ${horasZona.arg}</p>
                    </div>
                    <table class="tg-tabla"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
                </div>
            </div>
        </div>`;

    contenedorSide.innerHTML = `<div class="side-by-side-wrapper">${htmlTablaGeneral}</div>`;

    let htmlTopKillers = ``;
    if (topKillers.length > 0) {
        const top15 = topKillers.slice(0, 15);
        htmlTopKillers = `<div class="img-killers-grid">`;
        top15.forEach((k, idx) => {
            htmlTopKillers += `<div class="img-killer-card">
                <span class="img-killer-rank">#${idx + 1}</span>
                <span class="img-killer-nombre">${k.name}</span>
                <span class="img-killer-kills">${k.kills}</span>
            </div>`;
        });
        htmlTopKillers += `</div>`;
    } else {
        htmlTopKillers = `<p class="img-sin-datos">Sin registro de kills</p>`;
    }

    let htmlBooyahs = ``;
    if (booyahsPorSala.length > 0) {
        htmlBooyahs = `<div class="img-booyah-row">`;
        booyahsPorSala.forEach(b => {
            htmlBooyahs += `<div class="img-booyah-card">
                <span class="img-booyah-sala">S${b.sala}</span>
                <span class="img-booyah-equipo">${b.equipo}</span>
                <i class="fa-solid fa-crown img-booyah-icon"></i>
                <span class="img-booyah-pts">${b.pts}pts</span>
                <span class="img-booyah-kills">${b.kills}k</span>
            </div>`;
        });
        htmlBooyahs += `</div>`;
    } else {
        htmlBooyahs = `<p class="img-sin-datos">Sin registro de Booyahs</p>`;
    }

    if (_ed.mostrarKillers === false) htmlTopKillers = '';
    if (_ed.mostrarBooyah  === false) htmlBooyahs    = '';

    let htmlAscensoPanel = ``;
    if (tienePuntosAscenso && _ed.mostrarAscenso !== false) {
        let rowsAscenso = ``;
        equiposAscenso.forEach((eq, idx) => {
            rowsAscenso += `<tr><td>#${idx + 1}</td><td><strong>${eq.name}</strong> <i class="fa-solid fa-arrow-up" style="color:#4ade80;"></i></td><td><strong>${eq.total}</strong></td></tr>`;
        });

        htmlAscensoPanel = `
            <div class="img-ascenso-wrapper">
                <h4 class="img-ascenso-titulo"><i class="fa-solid fa-angles-up"></i> ASCENSO DIRECTO</h4>
                <table class="img-subtabla img-subtabla-sm">
                    <thead><tr><th>#</th><th>EQUIPO</th><th>PUNTOS</th></tr></thead>
                    <tbody>${rowsAscenso}</tbody>
                </table>
            </div>
        `;
    }

    const _coloresTop = [_colores[0] || '#B6FF00', _colores[1] || '#FFD54A', _colores[2] || '#00C6FF'];
    const top6 = listaConsolidada.slice(0, 6);
    const htmlTop6 = top6.map((eq, idx) => {
        const pos = idx + 1;
        const col = pos <= 3 ? _coloresTop[pos - 1] : colorTextoTabla;
        const bg  = pos === 1 ? 'rgba(255,255,255,0.08)' : pos <= 3 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)';
        return `<div class="img-top6-card" style="--card-color:${col}; --card-bg:${bg}; --card-border:${col}55;">
            <div class="img-top6-pos">#${pos}</div>
            <div class="img-top6-nombre" contenteditable="true">${eq.name}</div>
            <div class="img-top6-pts" contenteditable="true">${eq.total} pts</div>
        </div>`;
    }).join('');

    let htmlTerceraTablaCompleta = `
        <div class="img-wrapper">
            <div id="tablaReducidaCaptura" class="tema-${temaVal}" style="--img-color-texto:${colorTextoTabla}; --img-fondo-base:${colorFondoBase}; --img-color-titulo:${colorTituloTema};">
                <div id="imgContenedorFlex">

                    <div id="imgSeccionTabla" class="img-panel">
                        <div style="text-align: center; margin-bottom: 8px;">
                            <h3 class="img-titulo-tabla">${tituloModo} - MODERADOR: <strong>${nombreModerador}</strong></h3>
                            <!-- position: relative evita que la descarga pinte el fondo encima del texto -->
                            <div class="img-horarios-box">
                                ${htmlBloque}
                                <span class="img-horarios-badge">★ HORARIOS</span>
                                <strong>${horasZona.fecha}</strong> — ${horasZona.mex} | ${horasZona.col} | ${horasZona.arg}
                            </div>
                        </div>
                        <table class="img-tabla">
                            <thead>
                                <tr>
                                    <th class="col-top">TOP</th>
                                    <th>EQUIPO</th>
                                    ${salasProcesadas.map((_, idx) => `<th class="col-sala">S${idx + 1}</th>`).join('')}
                                    <th class="col-sala">KILL</th>
                                    <th class="col-total">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${listaConsolidada.map((item, index) => {
                                    const cFila = index < 3 ? _coloresTop[index] : '';
                                    const esBaneado = equiposSancionados.some(s => s.name === item.name) && !window._equiposPerdonados.has(item.name);
                                    const banStyle = esBaneado ? 'opacity:0.5; text-decoration:line-through;' : '';
                                    const rStyle = cFila ? `style="--row-color:${cFila}; ${banStyle}"` : (banStyle ? `style="${banStyle}"` : '');
                                    return `<tr ${rStyle}>
                                        <td class="col-fila"><strong>#${index + 1}</strong></td>
                                        <td class="col-fila" contenteditable="true"><strong>${item.name}</strong>${esBaneado ? ' <i class="fa-solid fa-ban" style="color:#ff4444;font-size:0.8em;"></i>' : ''}</td>
                                        ${item.salas.map(val => val === null
                                            ? `<td class="sala-sin-registro"><i class="fa-solid fa-skull"></i></td>`
                                            : `<td contenteditable="true">${val}</td>`
                                        ).join('')}
                                        <td contenteditable="true">${item.killScoreAcumulado}</td>
                                        <td class="col-fila" contenteditable="true"><strong>${item.total}</strong></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div id="imgSeccionBooyah" class="img-panel">
                        <h3 class="img-titulo-seccion"><i class="fa-solid fa-trophy"></i> BOOYAH</h3>
                        ${htmlBooyahs}
                    </div>

                    <div id="imgSeccionPanelBajo">
                        <div id="imgPanelKillers">
                            ${htmlAscensoPanel}
                            <h3 class="img-titulo-seccion"><i class="fa-solid fa-crosshairs"></i> TOP KILLER</h3>
                            ${htmlTopKillers}
                        </div>
                    </div>

                    <div style="position:absolute; bottom:18px; right:22px; font-size:0.72rem; letter-spacing:0.06em; opacity:0.55; color:#fff; font-family:'Orbitron',sans-serif; pointer-events:none;">by proyectn</div>
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
        width: 1080,
        height: 1350,
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
            enlace.download = 'proyectn-dragonfest' + (bq && bq.value ? '-bloque-' + bq.value.toLowerCase() : '') + '.png';
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