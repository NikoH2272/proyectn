let rawFilesData = [];

async function prepararRenombradoEquipos() {
    const fileInput = document.getElementById('fileInput');
    let files = Array.from(fileInput.files);
    if (files.length === 0) return;

    rawFilesData = [];
    let equiposUnicos = new Set();

    for (let file of files) {
        let text = await file.text();
        rawFilesData.push(text);
        let lines = text.split('\n');
        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:/i);
            if (teamMatch) equiposUnicos.add(teamMatch[1].trim());
        });
    }

    const contenedor = document.getElementById('listaEquiposInputs');
    contenedor.innerHTML = '';
    Array.from(equiposUnicos).forEach((eq) => {
        contenedor.innerHTML += `
            <div style="display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 6px;">
                <span style="color: var(--gray); font-size: 0.85rem; width: 140px;">Original: <strong>${eq}</strong></span>
                <input type="text" class="input-nombre-editable" data-original="${eq}" value="${eq}" style="flex: 2; padding: 8px; background: #0a0b10; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px;">
            </div>
        `;
    });
    document.getElementById('seccionRenombrar').style.display = 'block';
}

function procesarConNombresPersonalizados() {
    let diccionarioRenombres = {};
    document.querySelectorAll('.input-nombre-editable').forEach(input => {
        diccionarioRenombres[input.getAttribute('data-original')] = input.value.trim() || input.getAttribute('data-original');
    });
    procesarLogs(rawFilesData, diccionarioRenombres);
}

function procesarLogs(textsArray, renombresMap) {
    let equiposMap = {};
    let jugadoresMap = {};
    let roomWinners = [];
    let numSalas = textsArray.length;

    textsArray.forEach((text, i) => {
        let lines = text.split('\n');
        let salaWinnerTeam = null;
        let salaWinnerTotalScore = 0;
        let salaWinnerKillScore = 0;

        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (teamMatch) {
                let rawTeam = teamMatch[1].trim();
                let name = renombresMap[rawTeam] || rawTeam;
                if (!equiposMap[name]) {
                    equiposMap[name] = { name, totalScore: 0, killScore: 0, salasPuntos: {} };
                }
                let totalScore = parseInt(teamMatch[5]);
                let killScore = parseInt(teamMatch[3]);

                equiposMap[name].totalScore += totalScore;
                equiposMap[name].killScore += killScore;
                equiposMap[name].salasPuntos[i] = totalScore;

                if (parseInt(teamMatch[2]) === 1) {
                    salaWinnerTeam = name;
                    salaWinnerTotalScore = totalScore;
                    salaWinnerKillScore = killScore;
                }
            }
            const playerMatch = line.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
            if (playerMatch) {
                let pName = playerMatch[1].trim();
                if (!jugadoresMap[pName]) {
                    jugadoresMap[pName] = { name: pName, kills: 0 };
                }
                jugadoresMap[pName].kills += parseInt(playerMatch[2]);
            }
        });

        if (salaWinnerTeam) {
            roomWinners.push({ sala: i + 1, team: salaWinnerTeam, points: salaWinnerTotalScore, kills: salaWinnerKillScore });
        }
    });

    let equiposArray = Object.values(equiposMap).sort((a, b) => b.totalScore - a.totalScore);
    let topKillersArray = Object.values(jugadoresMap).sort((a, b) => b.kills - a.kills).slice(0, 9);
    renderizarResultados(equiposArray, topKillersArray, roomWinners, numSalas);
}

function renderizarResultados(equipos, topKillers, roomWinners, numSalas) {
    let usarDosColumnas = equipos.length > 12;
    let eIz = usarDosColumnas ? equipos.slice(0, 12) : equipos;
    let eDe = usarDosColumnas ? equipos.slice(12) : [];

    let html = `
        <div id="tablaCaptura" style="width: 1200px; height: 580px; background-image: url('rusheotablageneral.png'); background-size: cover; position: relative; font-family: 'Rajdhani', sans-serif; color: #fff; padding: 15px;">
            
            <div style="position: absolute; top: 149px; left: ${usarDosColumnas ? '67px' : '150px'}; width: 520px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead>
                        <tr style="text-shadow: none; color: #ffcc00; font-family: 'Orbitron'; border-bottom: 2px solid rgba(255,255,255,0.3); font-size: 0.94rem;">
                            <th style="text-align:left; padding: 4px;">EQUIPO</th>
                            ${Array.from({length: Math.min(numSalas, 6)}).map((_,i) => `<th style="padding: 4px; text-align:center;">S${i+1}</th>`).join('')}
                            <th style="padding: 4px; text-align:center;">KILL</th>
                            <th style="padding: 4px; text-align:center;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eIz.map((eq, i) => {
                            let colorFila = '#fff';
                            if (i === 0) colorFila = '#ffd700';
                            else if (i === 1) colorFila = '#c0c0c0';
                            else if (i === 2) colorFila = '#cd7f32';
                            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: ${colorFila};">
                                <td style="padding: 3px; font-weight: bold; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${eq.name}</td>
                                ${Array.from({length: Math.min(numSalas, 6)}).map((_,s) => `<td style="text-align:center; padding: 3px;">${eq.salasPuntos[s] !== undefined ? eq.salasPuntos[s] : '-'}</td>`).join('')}
                                <td style="text-align:center; padding: 3px; color:#ff3333; font-weight:bold;">${eq.killScore}</td>
                                <td style="text-align:center; padding: 3px; color:${colorFila === '#fff' ? '#ffd700' : colorFila}; font-weight:bold;">${eq.totalScore}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            ${usarDosColumnas ? `
            <div style="position: absolute; top: 149px; left: 592px; width: 520px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                    <thead>
                        <tr style="text-shadow: none; color: #ffcc00; font-family: 'Orbitron'; border-bottom: 2px solid rgba(255,255,255,0.3); font-size: 0.94rem;">
                            <th style="text-align:left; padding: 4px;">EQUIPO</th>
                            ${Array.from({length: Math.min(numSalas, 6)}).map((_,i) => `<th style="padding: 4px; text-align:center;">S${i+1}</th>`).join('')}
                            <th style="padding: 4px; text-align:center;">KILL</th>
                            <th style="padding: 4px; text-align:center;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eDe.map((eq, idx) => {
                            let i = 12 + idx;
                            let colorFila = '#fff';
                            if (i === 0) colorFila = '#ffd700';
                            else if (i === 1) colorFila = '#c0c0c0';
                            else if (i === 2) colorFila = '#cd7f32';
                            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: ${colorFila};">
                                <td style="padding: 3px; font-weight: bold; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${eq.name}</td>
                                ${Array.from({length: Math.min(numSalas, 6)}).map((_,s) => `<td style="text-align:center; padding: 3px;">${eq.salasPuntos[s] !== undefined ? eq.salasPuntos[s] : '-'}</td>`).join('')}
                                <td style="text-align:center; padding: 3px; color:#ff3333; font-weight:bold;">${eq.killScore}</td>
                                <td style="text-align:center; padding: 3px; color:${colorFila === '#fff' ? '#ffd700' : colorFila}; font-weight:bold;">${eq.totalScore}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div style="position: absolute; top: ${usarDosColumnas ? '330px' : '400px'}; left: 592px; width: 520px;">
                <div style="font-family: 'Orbitron'; color: #ffcc00; margin-bottom: 6px; font-size: 0.85rem; font-weight: bold;">TOP KILLER</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                    ${topKillers.map((tk, i) => {
                        let colorPos = '#fff';
                        if (i === 0) colorPos = '#ffd700';
                        else if (i === 1) colorPos = '#c0c0c0';
                        else if (i === 2) colorPos = '#cd7f32';
                        return `
                        <div style="font-size: 0.73rem; background: rgba(0,0,0,0.6); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span style="color: ${colorPos}; font-weight: bold;">#${i+1}</span> <span style="color: ${colorPos};">${tk.name}</span> (<span style="color: #ff3333; font-weight: bold;">${tk.kills}</span>)
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div style="position: absolute; bottom: 20px; left: 50px; width: 1050px; display: flex; justify-content: space-around; gap: 8px;">
                ${roomWinners.map(rw => `
                    <div style="background: rgba(0,0,0,0.75); border: 1px solid #ffd700; padding: 6px 12px; border-radius: 6px; text-align: center; font-size: 0.75rem; min-width: 140px;">
                        <div style="color: #ffd700; font-weight: bold; font-family: 'Orbitron'; font-size: 0.7rem;">SALA ${rw.sala} (BOOYAH)</div>
                        <div style="color: #fff; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; margin: 2px 0;">${rw.team}</div>
                        <div style="font-size: 0.68rem; color: #ddd;">Pts: <span style="color:#ffd700; font-weight:bold;">${rw.points}</span> | Kills: <span style="color:#ff3333; font-weight:bold;">${rw.kills}</span></div>
                    </div>
                `).join('')}
            </div>

        </div>
        <button onclick="descargar()" class="btn-generar" style="margin-top: 20px;">DESCARGAR IMAGEN</button>
    `;
    document.getElementById('outputTablasLadoALado').innerHTML = html;
}

function descargar() {
    html2canvas(document.getElementById('tablaCaptura'), { scale: 2, useCORS: true }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'Tabla_Resultados.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

// --- SECCIÓN: TORNEO MASIVO / TABLA GENERAL (60 EQUIPOS) ---
async function prepararRenombradoEquiposGeneral() {
    const fileInput = document.getElementById('fileInputGeneral');
    let files = Array.from(fileInput.files);
    if (files.length === 0) return;

    let rawFilesData = [];
    let equiposUnicos = new Set();

    for (let file of files) {
        let text = await file.text();
        rawFilesData.push(text);
        let lines = text.split('\n');
        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:/i);
            if (teamMatch) equiposUnicos.add(teamMatch[1].trim());
        });
    }

    const contenedor = document.getElementById('listaEquiposInputsGeneral');
    contenedor.innerHTML = '';
    Array.from(equiposUnicos).forEach((eq) => {
        contenedor.innerHTML += `
            <div style="display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 6px;">
                <span style="color: var(--gray); font-size: 0.85rem; width: 140px;">Original: <strong>${eq}</strong></span>
                <input type="text" class="input-nombre-editable-gen" data-original="${eq}" value="${eq}" style="flex: 2; padding: 8px; background: #0a0b10; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px;">
            </div>
        `;
    });
    document.getElementById('seccionRenombrarGeneral').style.display = 'block';
    window.rawFilesDataGeneral = rawFilesData;
}

function procesarGeneralConNombresPersonalizados() {
    let diccionarioRenombres = {};
    document.querySelectorAll('.input-nombre-editable-gen').forEach(input => {
        diccionarioRenombres[input.getAttribute('data-original')] = input.value.trim() || input.getAttribute('data-original');
    });
    procesarLogsGeneral(window.rawFilesDataGeneral, diccionarioRenombres);
}

function procesarLogsGeneral(textsArray, renombresMap) {
    let equiposMap = {};
    let conteoArchivosEquipos = {};

    textsArray.forEach((text) => {
        let equiposEnEsteArchivo = new Set();
        let lines = text.split('\n');
        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (teamMatch) {
                let rawTeam = teamMatch[1].trim();
                let name = renombresMap[rawTeam] || rawTeam;
                
                if (!equiposMap[name]) {
                    equiposMap[name] = { name, totalScore: 0 };
                }
                equiposMap[name].totalScore += parseInt(teamMatch[5]);

                equiposEnEsteArchivo.add(name);
            }
        });

        equiposEnEsteArchivo.forEach(name => {
            conteoArchivosEquipos[name] = (conteoArchivosEquipos[name] || 0) + 1;
        });
    });

    let equiposOrdenados = Object.values(equiposMap).sort((a, b) => b.totalScore - a.totalScore);
    
    let bloques = [];
    for (let i = 0; i < 4; i++) {
        bloques.push(equiposOrdenados.slice(i * 15, (i + 1) * 15));
    }

    let html = `
        <div style="margin-bottom: 20px; text-align: center;">
            <h3 style="color: var(--accent-yellow); font-family: 'Orbitron'; margin-bottom: 15px;">TABLA GENERAL (TOP 1 - 60)</h3>
            <div id="tablaCaptura1" style="width: 1200px; height: 580px; background-image: url('rusheotablageneral.png'); background-size: cover; position: relative; font-family: 'Rajdhani', sans-serif; color: #fff; margin: 0 auto; text-align: left;">
                <div style="position: absolute; bottom: 30px; left: 2.5%; width: 95%;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.77rem; color: #fff; table-layout: fixed;">
                        <thead>
                            <tr style="text-shadow: 1px 1px 2px rgba(255,255,255,0.5); font-family: 'Orbitron'; font-weight: bold; font-size: 0.85rem;">
                                ${Array.from({length: 4}).map((_, bIdx) => {
                                    return `
                                        <th style="padding: 4px 2px; text-align: center; width: 45px; border-bottom: 2px solid #fff; ${bIdx > 0 ? 'border-left: 10px solid transparent;' : ''}">TOP</th>
                                        <th style="padding: 4px 4px; text-align: left; width: 175px; border-bottom: 2px solid #fff;">NOMBRE</th>
                                        <th style="padding: 4px 2px; text-align: center; width: 55px; border-bottom: 2px solid #fff; ${bIdx < 3 ? 'border-right: 10px solid transparent;' : ''}">PTS</th>
                                    `;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: 15}).map((_, i) => `
                                <tr>
                                    ${bloques.map((bloque, bIdx) => {
                                        let rank = (bIdx * 15) + i + 1;
                                        let equipo = bloque[i];
                                        let esTop25 = (rank <= 25);
                                        let tieneCorona = esTop25 ? '👑 ' : '';
                                        
                                        let estiloTexto = esTop25 
                                            ? 'color: #ffd700; text-shadow: 0px 0px 4px rgba(255,255,255,0.8);' 
                                            : 'color: #fff;';
                                        
                                        let estiloAlerta = (equipo && conteoArchivosEquipos[equipo.name] > 3) ? 'background: rgba(255, 70, 70, 0.4);' : '';
                                        let bordeIzq = bIdx > 0 ? 'border-left: 10px solid transparent;' : '';
                                        let bordeDer = bIdx < 3 ? 'border-right: 10px solid transparent;' : '';
                                        
                                        let estiloCelda = `padding: 4px 2px; border-bottom: 1px solid rgba(255,255,255,0.1); ${estiloAlerta} ${estiloTexto}`;
                                        
                                        if (!equipo) return `<td style="${estiloCelda}"></td><td style="${estiloCelda}"></td><td style="${estiloCelda}"></td>`;
                                        
                                        let etiquetaAlerta = (equipo && conteoArchivosEquipos[equipo.name] > 3) ? ' ⚠️' : '';

                                        return `
                                            <td style="${estiloCelda} ${bordeIzq} font-weight: bold; text-align: center;">${rank}</td>
                                            <td style="${estiloCelda} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${equipo.name}">${tieneCorona}${equipo.name}${etiquetaAlerta}</td>
                                            <td style="${estiloCelda} ${bordeDer} font-weight: bold; text-align: center;">${equipo.totalScore}</td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <button onclick="descargarTabla('tablaCaptura1', 'Tabla_General_60.png')" class="btn-generar" style="margin-top: 20px; max-width: 300px;">DESCARGAR IMAGEN GENERAL</button>
        </div>
    `;
    document.getElementById('outputGeneral').innerHTML = html;
}

// --- SECCIÓN: RESULTADOS DETALLADOS POR SALA ---
async function prepararResultadosSala() {
    const fileInput = document.getElementById('fileInputSala');
    let files = Array.from(fileInput.files);
    if (files.length === 0) return;

    let rawFilesDataSala = [];
    for (let file of files) {
        let text = await file.text();
        rawFilesDataSala.push(text);
    }
    window.rawFilesDataSala = rawFilesDataSala;
    procesarLogsSala(rawFilesDataSala);
}

function procesarLogsSala(textsArray) {
    let equiposMap = {};

    textsArray.forEach((text) => {
        let lines = text.split('\n');
        lines.forEach(line => {
            const teamMatch = line.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (teamMatch) {
                let name = teamMatch[1].trim();
                if (!equiposMap[name]) {
                    equiposMap[name] = { name, kills: 0, totalScore: 0 };
                }
                equiposMap[name].kills += parseInt(teamMatch[3]);
                equiposMap[name].totalScore += parseInt(teamMatch[5]);
            }
        });
    });

    let equiposArray = Object.values(equiposMap).sort((a, b) => b.totalScore - a.totalScore).slice(0, 15);

    let html = `
        <div style="text-align: center;">
            <h3 style="color: var(--secondary); font-family: 'Orbitron'; margin-bottom: 15px;">RESULTADOS DETALLADOS POR SALA</h3>
            
            <div id="tablaCapturaSala" style="width: 1080px; height: 1350px; background-image: url('rusheosala.png'); background-size: cover; position: relative; font-family: 'Rajdhani', sans-serif; color: #fff; margin: 0 auto; text-align: left;">
                <div style="position: absolute; top: calc(((1350px - 920px) / 2) + 67.5px); left: 5%; width: 90%; height: 920px; display: flex; align-items: center; justify-content: center;">
                    <table style="width: 100%; height: 100%; border-collapse: collapse; font-size: 1.55rem; color: #fff; table-layout: fixed;">
                        <thead>
                            <tr style="text-shadow: none; font-family: 'Orbitron'; font-weight: bold; font-size: 1.6rem; color: #ffcc00;">
                                <th style="background: transparent; padding: 12px; text-align: center; width: 15%; border-bottom: 3px solid rgba(255,255,255,0.3); color: #ffcc00;">TOP</th>
                                <th style="background: transparent; padding: 12px 20px; text-align: left; width: 55%; border-bottom: 3px solid rgba(255,255,255,0.3); color: #ffcc00;">NOMBRE</th>
                                <th style="background: transparent; padding: 12px; text-align: center; width: 15%; border-bottom: 3px solid rgba(255,255,255,0.3); color: #ffcc00;">KILL</th>
                                <th style="background: transparent; padding: 12px; text-align: center; width: 15%; border-bottom: 3px solid rgba(255,255,255,0.3); color: #ffcc00;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: 15}).map((_, i) => {
                                let rank = i + 1;
                                let equipo = equiposArray[i];
                                let estiloCelda = `background: transparent; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.15); color: #fff;`;
                                
                                if (!equipo) return `
                                    <tr>
                                        <td style="${estiloCelda}"></td>
                                        <td style="${estiloCelda}"></td>
                                        <td style="${estiloCelda}"></td>
                                        <td style="${estiloCelda}"></td>
                                    </tr>
                                `;
                                
                                return `
                                    <tr>
                                        <td style="${estiloCelda} font-weight: bold; text-align: center;">${rank}</td>
                                        <td style="${estiloCelda} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${equipo.name}</td>
                                        <td style="${estiloCelda} text-align: center; color: #ff3333; font-weight: bold;">${equipo.kills}</td>
                                        <td style="${estiloCelda} font-weight: bold; text-align: center;">${equipo.totalScore}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <button onclick="descargarTabla('tablaCapturaSala', 'Resultados_Sala.png')" class="btn-generar" style="margin-top: 20px; max-width: 300px; background: linear-gradient(45deg, var(--secondary), #ff5500);">DESCARGAR IMAGEN DE SALA</button>
        </div>
    `;
    document.getElementById('outputSala').innerHTML = html;
}

function descargarTabla(idElemento, nombreArchivo) {
    html2canvas(document.getElementById(idElemento), { scale: 2, useCORS: true }).then(canvas => {
        let link = document.createElement('a');
        link.download = nombreArchivo;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}