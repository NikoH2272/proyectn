let _sP = [], _cN = {}, _eE = new Set(), _sLO = [], _sML = [], _lPB64 = null, _fPB64 = null, _gE = [], _gTK = [], _gNS = 0, _rFD = [];

async function prepararRenombradoEquipos() {
    let fI = document.getElementById('fileInput'), fs = fI ? Array.from(fI.files) : [];
    if (!fs.length) return;
    _rFD = []; let eU = new Set();
    for (let f of fs) {
        let t = await f.text();
        _rFD.push(t);
        t.split('\n').forEach(l => {
            let m = l.match(/TeamName:\s*(.+?)\s+Rank:/i);
            if (m) eU.add(m[1].trim());
        });
    }
    let c = document.getElementById('listaEquiposInputs');
    if (!c) return;
    c.innerHTML = '';
    Array.from(eU).forEach(eq => {
        c.innerHTML += `<div style="display:flex;gap:10px;align-items:center;background:rgba(255,255,255,0.03);padding:10px 15px;border-radius:6px;margin-bottom:8px;"><span style="color:var(--gray);font-size:0.85rem;width:140px;">Original: <strong>${eq}</strong></span><input type="text" class="input-nombre-editable" data-original="${eq}" value="${eq}" style="flex:2;padding:8px;background:#0a0a0c;border:1px solid rgba(255,112,166,0.25);color:#fff;border-radius:4px;"></div>`;
    });
    document.getElementById('seccionRenombrar').style.display = 'block';
}

function procesarConNombresPersonalizados() {
    let dR = {};
    document.querySelectorAll('.input-nombre-editable').forEach(i => {
        dR[i.getAttribute('data-original')] = i.value.trim() || i.getAttribute('data-original');
    });

    let moderador = document.getElementById('inputModerador') ? document.getElementById('inputModerador').value.trim().toUpperCase() : "ADMIN";
    let fechaInput = document.getElementById('inputFechaTorneo') ? document.getElementById('inputFechaTorneo').value : "";
    let horaInput = document.getElementById('inputHoraTorneo') ? document.getElementById('inputHoraTorneo').value : "";

    let fechaFinal = fechaInput ? new Date(fechaInput + 'T00:00:00').toLocaleDateString() : "";

    let horaFinal = "";
    if (horaInput) {
        let [hh, mm] = horaInput.split(':');
        let hNum = parseInt(hh);
        let ampm = hNum >= 12 ? 'PM' : 'AM';
        let h12 = hNum % 12 || 12;
        horaFinal = `${h12}:${mm} ${ampm}`;
    }

    _xL(_rFD, dR, moderador, fechaFinal, horaFinal);
}

async function procesarArchivosLog() {
    let fI = document.getElementById('fileInput');
    if (!fI || !fI.files.length) {
        alert("Por favor, selecciona archivos .log o .txt primero.");
        return;
    }
    let fs = Array.from(fI.files);
    _rFD = [];
    let ps = [];
    for (let i = 0; i < fs.length; i++) ps.push(_lF(fs[i]));
    
    try {
        let rT = await Promise.all(ps);
        _rFD = rT;
        let dR = {};
        document.querySelectorAll('.input-nombre-editable').forEach(i => {
            dR[i.getAttribute('data-original')] = i.value.trim() || i.getAttribute('data-original');
        });
        
        let moderador = document.getElementById('inputModerador') ? document.getElementById('inputModerador').value.trim().toUpperCase() : "ADMIN";
        let fechaInput = document.getElementById('inputFechaTorneo') ? document.getElementById('inputFechaTorneo').value : "";
        let horaInput = document.getElementById('inputHoraTorneo') ? document.getElementById('inputHoraTorneo').value : "";

        let fechaFinal = fechaInput ? new Date(fechaInput + 'T00:00:00').toLocaleDateString() : "";
        let horaFinal = "";
        if (horaInput) {
            let [hh, mm] = horaInput.split(':');
            let hNum = parseInt(hh);
            let ampm = hNum >= 12 ? 'PM' : 'AM';
            let h12 = hNum % 12 || 12;
            horaFinal = `${h12}:${mm} ${ampm}`;
        }

        _xL(_rFD, dR, moderador, fechaFinal, horaFinal);
        alert("¡Archivos procesados exitosamente en modo local!");
    } catch (e) {
        console.error(e);
        alert("Error al procesar los archivos de registro.");
    }
}

function _lF(f) {
    return new Promise((rs, rj) => {
        let r = new FileReader();
        r.onload = e => rs(e.target.result);
        r.onerror = e => rj(e);
        r.readAsText(f);
    });
}

function _xL(tA, rM, mod = "ADMIN", fec = "", hor = "") {
    let eM = {}, jM = {}, rW = [], nS = tA.length;
    tA.forEach((t, i) => {
        let ls = t.split('\n'), sWT = null, sWTS = 0, sWKS = 0;
        ls.forEach(l => {
            let tM = l.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (tM) {
                let rT = tM[1].trim(), nm = rM[rT] || rT;
                if (!eM[nm]) eM[nm] = { name: nm, totalScore: 0, killScore: 0, rankScore: 0, salasPuntos: {}, salasKills: {}, salasBooyah: {}, salasJugadas: 0, booyahsCount: 0 };
                let tS = parseInt(tM[5]), kS = parseInt(tM[3]), rS = parseInt(tM[4]), rk = parseInt(tM[2]);
                eM[nm].totalScore += tS; eM[nm].killScore += kS; eM[nm].rankScore += rS;
                eM[nm].salasPuntos[i] = tS; eM[nm].salasKills[i] = kS; eM[nm].salasJugadas += 1;
                
                if (rk === 1) {
                    eM[nm].salasBooyah[i] = true;
                    eM[nm].booyahsCount += 1;
                    sWT = nm; sWTS = tS; sWKS = kS;
                }
            }
            let pM = l.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
            if (pM) {
                let pN = pM[1].trim(), pK = parseInt(pM[2]);
                if (!jM[pN]) jM[pN] = { name: pN, kills: 0 };
                jM[pN].kills += pK;
            }
        });
        if (sWT) rW.push({ sala: i + 1, team: sWT, points: sWTS, kills: sWKS });
        else rW.push({ sala: i + 1, team: "N/D", points: 0, kills: 0 });
    });
    _gE = Object.values(eM);
    _gTK = Object.values(jM).sort((a, b) => b.kills - a.kills);
    _gNS = nS;
    window._rWGlobal = rW;
    renderizarResultados(_gE, _gTK, _gNS, mod, fec, hor);
}

function renderizarResultados(eqs, tKs, nS, moderador = "ADMIN", fecha = "", hora = "") {
    let tC = "",
        fU = "row.png";
    
    let eqO = [...eqs].sort((a, b) => b.totalScore - a.totalScore);
    let tKL = [...tKs].slice(0, 15);
    let rWData = window._rWGlobal || [];

    let h = `<div id="tablaCaptura" class="rusheo-captura-container" style="background-image: url('${fU}');">` +
    
    /* Encabezado con la caja estructurada en el orden solicitado */
    `<div class="rusheo-header">` +
        `<h1 class="rusheo-titulo">${tC}</h1>` +
        `<div class="rusheo-subtitulo-box">` +
            `<div class="rusheo-sub-line" style="font-size: 1rem; color: #ffffff;">RESULTADOS OFICIALES</div>` +
            (fecha ? `<div class="rusheo-sub-line">Fecha: ${fecha}</div>` : '') +
            (hora ? `<div class="rusheo-sub-line">Hora: ${hora}</div>` : '') +
            `<div class="rusheo-sub-line">Mod: ${moderador}</div>` +
        `</div>` +
    `</div>` +
    
    // TABLA PRINCIPAL GENERAL
    `<div class="rusheo-box rusheo-tabla-general">` +
    `<div class="rusheo-box-title">TABLA GENERAL (ESTÁNDAR)</div>` +
    `<table class="rusheo-table"><thead><tr><th style="text-align:left;">#</th><th style="text-align:left;">EQUIPO</th>` +
    `${Array.from({ length: Math.min(nS, 6) }).map((_, i) => `<th style="text-align:center;">S${i + 1}</th>`).join('')}<th style="text-align:center;">KILL</th><th style="text-align:center;">TOTAL</th></tr></thead><tbody>` +
    eqO.map((eq, i) => {
        let cFila = 'rusheo-txt-white';
        if (i === 0) cFila = 'rusheo-txt-primario';
        else if (i === 1) cFila = 'rusheo-txt-secundario';
        return `<tr><td class="rusheo-td-bold ${cFila}">#${i + 1}</td><td style="font-weight:bold;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="color:#ffffff;">${eq.name}</span></td>` +
        `${Array.from({ length: Math.min(nS, 6) }).map((_, s) => {
            let pS = eq.salasPuntos[s];
            if (pS === undefined) return `<td style="text-align:center;color:#64748b;">-</td>`;
            return `<td style="text-align:center;color:#ffffff;">${pS}</td>`;
        }).join('')}` +
        `<td style="text-align:center;color:#ff3366;font-weight:bold;">${eq.killScore}</td><td style="text-align:center;" class="rusheo-td-bold ${cFila}">${eq.totalScore}</td></tr>`;
    }).join('') + `</tbody></table></div>` +

    // ZONA INFERIOR 1: BOOYAH POR SALA
    `<div class="rusheo-box rusheo-booyah-section">` +
    `<div class="rusheo-box-title">BOOYAH POR SALA (VICTORIAS)</div>` +
    `<div class="rusheo-booyah-grid">` +
    (rWData.length ? rWData.map(rw => `
        <div class="rusheo-card-item">` +
            `<div class="rusheo-sala-title">SALA ${rw.sala}</div>` +
            `<div class="rusheo-equipo-name" title="${rw.team}">${rw.team}</div>` +
            `<div class="rusheo-card-info">Pts: <strong style="color:#ffffff;">${rw.points}</strong> | K: <strong style="color:#ff3366;">${rw.kills}</strong></div>` +
        `</div>
    `).join('') : `<div style="color:#64748b;font-size:0.75rem;text-align:center;padding:6px;">No hay datos de Booyah registrados.</div>`) +
    `</div></div>` +

    // ZONA INFERIOR 2: TOP 15 KILLERS
    `<div class="rusheo-box rusheo-killers-section">` +
    `<div class="rusheo-box-title">TOP 15 KILLERS MÁS LETALES</div>` +
    `<div class="rusheo-killers-grid">` +
    tKL.map((tk, i) => {
        let cP = '#ffffff';
        if (i === 0) cP = '#ff70a6';
        return `<div class="rusheo-killer-item">` +
            `<div><span style="color:${cP};font-weight:bold;margin-right:3px;">#${i + 1}</span><span style="color:#ffffff;font-weight:bold;max-width:58px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;">${tk.name}</span></div>` +
            `<span style="color:#ff3366;font-weight:bold;font-size:0.75rem;">${tk.kills}</span>` +
        `</div>`;
    }).join('') +
    `</div></div></div>`;
    
    let wrapperHtml = `
        <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 10px;">
            ${h}
        </div>
        <button onclick="descargar()" class="btn-generar" style="margin-top: 20px;">DESCARGAR IMAGEN 4:5</button>
    `;

    document.getElementById('outputTablasLadoALado').innerHTML = wrapperHtml;
}

function descargar() {
    let el = document.getElementById('tablaCaptura');
    if (!el) {
        alert("Primero genera los resultados cargando los archivos.");
        return;
    }
    
    html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#050814', logging: false }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'Rusheo_Resultados.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error("Error al generar la imagen:", err);
        alert("Hubo un error al generar la imagen para descargar.");
    });
}