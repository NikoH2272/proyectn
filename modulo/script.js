/* Herramienta de los módulos creados desde el panel (misma lógica que ROW x Maya):
   carga logs .log/.txt, corrige nombres y genera la imagen 4:5 con el nombre,
   colores y logo del módulo. El guardado en la base lo hace guardado.js. */
let _rFD = [], _gE = [], _gTK = [], _gNS = 0, _rW = [];

async function prepararRenombradoEquipos() {
    const fs = Array.from(document.getElementById('fileInput').files || []);
    if (!fs.length) return;
    _rFD = [];
    const eU = new Set();
    for (const f of fs) {
        const t = await f.text();
        _rFD.push(t);
        t.split('\n').forEach(l => { const m = l.match(/TeamName:\s*(.+?)\s+Rank:/i); if (m) eU.add(m[1].trim()); });
    }
    const c = document.getElementById('listaEquiposInputs');
    const esc = PumasPortal.escaparHtml;
    c.innerHTML = Array.from(eU).map(eq => `<div style="display:flex;gap:10px;align-items:center;background:rgba(255,255,255,0.03);padding:10px 15px;border-radius:6px;">
        <span style="color:var(--gray);font-size:0.85rem;width:140px;">Original: <strong>${esc(eq)}</strong></span>
        <input type="text" class="input-nombre-editable" data-original="${esc(eq)}" value="${esc(eq)}" style="flex:2;padding:8px;background:#0a0a0c;border:1px solid rgba(var(--primary-rgb),0.3);color:#fff;border-radius:4px;"></div>`).join('');
    document.getElementById('seccionRenombrar').style.display = 'block';
}

function procesarConNombresPersonalizados() {
    const dR = {};
    document.querySelectorAll('.input-nombre-editable').forEach(i => { dR[i.dataset.original] = i.value.trim() || i.dataset.original; });
    const mod = (document.getElementById('inputModerador').value.trim() || 'ADMIN').toUpperCase();
    const f = document.getElementById('inputFechaTorneo').value, h = document.getElementById('inputHoraTorneo').value;
    const fecha = f ? new Date(f + 'T00:00:00').toLocaleDateString() : '';
    let hora = '';
    if (h) { const [hh, mm] = h.split(':'); const n = parseInt(hh, 10); hora = `${n % 12 || 12}:${mm} ${n >= 12 ? 'PM' : 'AM'}`; }
    procesar(_rFD, dR, mod, fecha, hora);
}

function procesar(textos, renombres, mod, fecha, hora) {
    const eM = {}, jM = {};
    _rW = [];
    textos.forEach((t, i) => {
        let ganador = null;
        t.split('\n').forEach(l => {
            const tM = l.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
            if (tM) {
                const nm = renombres[tM[1].trim()] || tM[1].trim();
                const e = eM[nm] || (eM[nm] = { name: nm, totalScore: 0, killScore: 0, salasPuntos: {}, booyahs: 0 });
                const tS = +tM[5], kS = +tM[3], rk = +tM[2];
                e.totalScore += tS; e.killScore += kS; e.salasPuntos[i] = tS;
                if (rk === 1) { e.booyahs++; ganador = { sala: i + 1, team: nm, points: tS, kills: kS }; }
            }
            const pM = l.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
            if (pM) { const n = pM[1].trim(); (jM[n] = jM[n] || { name: n, kills: 0 }).kills += +pM[2]; }
        });
        _rW.push(ganador || { sala: i + 1, team: 'N/D', points: 0, kills: 0 });
    });
    _gE = Object.values(eM);
    _gTK = Object.values(jM).sort((a, b) => b.kills - a.kills);
    _gNS = textos.length;
    renderizarResultados(mod, fecha, hora);
}

function renderizarResultados(moderador, fecha, hora) {
    const esc = PumasPortal.escaparHtml;
    const m = window.MODULO || {};
    const titulo = (m.titulo || m.nombre || 'Entrenos').toUpperCase();
    const logo = m.logo || '/imagenes/proyectn.png';
    const eqO = [..._gE].sort((a, b) => b.totalScore - a.totalScore);
    const nS = Math.min(_gNS, 6);
    const info = [fecha, hora].filter(Boolean).join(' | ');
    const h = `<div id="tablaCaptura" class="mod-captura">
        <img class="mod-marca" src="${esc(logo)}" alt="" crossorigin="anonymous">
        <img class="mod-logo-cap" src="${esc(logo)}" alt="" crossorigin="anonymous">
        <div class="mod-cap-header"><h1 class="mod-cap-titulo">${esc(titulo)}</h1>
            <div class="mod-cap-sub">RESULTADOS OFICIALES${info ? ' — ' + esc(info) : ''} | MODERADOR: ${esc(moderador)}</div></div>
        <div class="mod-box mod-tabla-general"><div class="mod-box-title">TABLA GENERAL</div>
            <table class="mod-table"><thead><tr><th style="text-align:left">#</th><th style="text-align:left">EQUIPO</th>
            ${Array.from({ length: nS }, (_, i) => `<th>S${i + 1}</th>`).join('')}<th>KILL</th><th>TOTAL</th></tr></thead><tbody>
            ${eqO.map((e, i) => { const c = i === 0 ? 'mod-p1' : i === 1 ? 'mod-p2' : ''; return `<tr><td class="${c}">#${i + 1}</td>
                <td style="font-weight:bold;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</td>
                ${Array.from({ length: nS }, (_, s) => `<td style="text-align:center;${e.salasPuntos[s] === undefined ? 'color:#64748b' : ''}">${e.salasPuntos[s] ?? '-'}</td>`).join('')}
                <td style="text-align:center" class="mod-kill">${e.killScore}</td><td style="text-align:center" class="${c || 'mod-p1'}">${e.totalScore}</td></tr>`; }).join('')}
            </tbody></table></div>
        <div class="mod-box mod-booyah-section"><div class="mod-box-title">BOOYAH POR SALA</div><div class="mod-booyah-grid">
            ${_rW.map(r => `<div class="mod-card-item"><div class="mod-sala-title">SALA ${r.sala}</div><div class="mod-equipo-name" title="${esc(r.team)}">${esc(r.team)}</div>
                <div class="mod-card-info">Pts: <b style="color:#fff">${r.points}</b> | K: <b class="mod-kill">${r.kills}</b></div></div>`).join('')}</div></div>
        <div class="mod-box mod-killers-section"><div class="mod-box-title">TOP 15 KILLERS</div><div class="mod-killers-grid">
            ${_gTK.slice(0, 15).map((k, i) => `<div class="mod-killer-item"><div><b class="${i === 0 ? 'mod-p1' : ''}" style="margin-right:3px">#${i + 1}</b>
                <span style="font-weight:bold;max-width:58px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">${esc(k.name)}</span></div>
                <span class="mod-kill">${k.kills}</span></div>`).join('')}</div></div>
    </div>`;
    document.getElementById('outputTablasLadoALado').innerHTML = `<div style="width:100%;overflow-x:auto;padding-bottom:10px">${h}</div>
        <button onclick="descargar()" class="btn-generar" style="margin-top:20px">DESCARGAR IMAGEN 4:5</button>`;
}

function descargar() {
    const el = document.getElementById('tablaCaptura');
    if (!el) { alert('Primero genera los resultados cargando los archivos.'); return; }
    const m = window.MODULO || {};
    html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#0b0b0f', logging: false }).then(canvas => {
        const a = document.createElement('a');
        a.download = 'Entrenos_' + String(m.nombre || 'modulo').replace(/[^\w]+/g, '_') + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
    }).catch(err => { console.error(err); alert('Hubo un error al generar la imagen.'); });
}
