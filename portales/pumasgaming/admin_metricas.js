async function generarVistaPreviaMetricas() {
    const contenedorPreview = document.getElementById('outputMetricasPreview');
    const contenedorCopiable = document.getElementById('contenedorTextoMetricasCopiable');
    
    if (!contenedorPreview) return;

    contenedorPreview.innerHTML = `<div style="color: var(--primary); text-align: center; padding: 40px; font-family: 'Michroma';">Analizando base de datos y calculando métricas globales...</div>`;
    if (contenedorCopiable) contenedorCopiable.style.display = 'none';

    try {
        if (!supabaseClient) return;

        // 1. Obtener los registros consolidados directamente de Supabase
        const { data: sesiones } = await supabaseClient.from('entrenamientos_sesiones').select('*');
        const { data: salas } = await supabaseClient.from('salas_resultados').select('*');
        const { data: killers } = await supabaseClient.from('top_killers').select('*');

        const totalEntrenos = sesiones ? sesiones.length : 0;
        let totalSalas = salas ? new Set(salas.map(s => `${s.sesion_id}_${s.numero_sala}`)).size : 0;
        if (totalSalas === 0 && salas) totalSalas = salas.length;

        let totalKillsGen = 0;
        let equiposMap = {};
        let jugadoresMap = {};

        // 2. Procesar todas las salas de todos los equipos sin restricciones
        if (salas && Array.isArray(salas)) {
            salas.forEach(s => {
                let eq = s.equipo_nombre ? s.equipo_nombre.trim() : "Desconocido";
                let nombreKey = eq.toUpperCase();
                
                if (!equiposMap[nombreKey]) {
                    equiposMap[nombreKey] = { 
                        nombre: eq, 
                        totalPts: 0, 
                        rankPts: 0, 
                        kills: 0, 
                        booyahs: 0, 
                        sesionesSet: new Set() 
                    };
                }
                
                equiposMap[nombreKey].totalPts += Number(s.total_score || 0);
                equiposMap[nombreKey].rankPts += Number(s.rank_score || 0);
                equiposMap[nombreKey].kills += Number(s.kill_score || 0);
                
                // Conteo estricto de victorias (Booyahs)
                if (s.es_booyah === true || s.rank === 1 || Number(s.rank) === 1) {
                    equiposMap[nombreKey].booyahs += 1;
                }
                
                if (s.sesion_id) {
                    equiposMap[nombreKey].sesionesSet.add(s.sesion_id);
                }
            });
        }

        // 3. Procesar las bajas de los jugadores
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

        // 4. Calcular récords destacados
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
        let horaMX = fechaActual.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true });
        let horaARG = fechaActual.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: true });

        let top3Texto = top5Eq.slice(0, 3).map((eq, i) => `${i === 0 ? '🏆 1º' : (i === 1 ? '🥈 2º' : '🥉 3º')} ${eq.nombre} - ${eq.totalPts} PTS`).join('\n');
        let mvp = top5Jug.length > 0 ? top5Jug[0] : null;
        let mvpTexto = mvp ? `🔥 MVP: ${mvp.nombre} (${mvp.kills} Kills) - ${mvp.equipo}` : '🔥 MVP: N/D';

        let textoCopiableFinal = `🐺 ENTRENOS PROYECTN
📅 Fecha: ${fechaFormateada}
⏰ Hora: ${horaCOL} COL / ${horaMX} MX / ${horaARG} ARG
🌐 Región: EEUU

🏆 TOP 3 EQUIPOS:
${top3Texto}

${mvpTexto}`;

        const textareaCopiable = document.getElementById('inputTextoMetricasCopiable');
        if (textareaCopiable) textareaCopiable.value = textoCopiableFinal;
        if (contenedorCopiable) contenedorCopiable.style.display = 'block';

        let fU = (typeof fondoPersonalizadoBase64 !== 'undefined' && fondoPersonalizadoBase64) ? fondoPersonalizadoBase64 : "imagenes/FONDOS.png";
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