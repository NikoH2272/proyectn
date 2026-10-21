let globalEquipos = [];
let globalTopKillers = [];

// Variables globales para el calendario
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let sesionesPorFecha = {};

function toggleMenu() {
    const nav = document.getElementById('mainNav');
    if (nav) nav.classList.toggle('is-active');
}

function cambiarPestanaPublica(pestana) {
    if (window.event && window.event.preventDefault) window.event.preventDefault();
    const vistas = { global: ['vistaGeneral', 'navGlobal', 'grid'], analisis: ['vistaAnalisis', 'navAnalisis', 'block'], vip: ['vistaVip', 'navVip', 'block'] };
    const elegida = vistas[pestana] ? pestana : 'global';
    Object.entries(vistas).forEach(([k, [vista, nav, display]]) => {
        const v = document.getElementById(vista), n = document.getElementById(nav);
        if (v) v.style.display = k === elegida ? display : 'none';
        if (n) n.style.color = k === elegida ? 'var(--primary)' : 'var(--secondary)';
    });
    if (elegida === 'vip') cargarResultadosVipPublicos();
}

const SUPABASE_URL = "https://bqemjroiegybdzksddkn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZW1qcm9pZWd5YmR6a3NkZGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzgwNDIsImV4cCI6MjEwMzE1NDA0Mn0.49gC204FPWSNxWYa6eZFBgWJgr7ZvFax5mqOM9lyGPo";
const supabaseClient = (typeof supabase !== 'undefined' && supabase.createClient) ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function cargarSesiones() {
    const contenedor = document.getElementById('calendarContainer');
    if (!contenedor) return;

    if (!supabaseClient) {
        document.getElementById('calendarGrid').innerHTML = `<div style="grid-column: span 7; text-align:center; color: #ff3333; padding: 20px;">Error de conexión con Supabase.</div>`;
        return;
    }

    try {
        const { data: sesiones, error } = await supabaseClient
            .from('entrenamientos_sesiones')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        if (!sesiones || sesiones.length === 0) {
            document.getElementById('calendarGrid').innerHTML = `<div style="grid-column: span 7; text-align:center; color: var(--gray); padding: 20px;">Sin registros disponibles.</div>`;
            return;
        }

        let statEntrenamientos = document.getElementById('statTotalEntrenamientos');
        if (statEntrenamientos) statEntrenamientos.textContent = sesiones.length;

        // Agrupar sesiones por fecha exacta
        sesionesPorFecha = {};
        sesiones.forEach(sesion => {
            // Extrae solo la parte de la fecha (YYYY-MM-DD)
            let dateStr = diaLocal(sesion.fecha); 
            if (!sesionesPorFecha[dateStr]) {
                sesionesPorFecha[dateStr] = [];
            }
            sesionesPorFecha[dateStr].push(sesion);
        });

        // Renderizar el calendario con el mes actual
        renderCalendar(currentMonth, currentYear);
        // Si hoy hubo entrenos, se despliegan solos
        const hoyStr = diaLocal(new Date().toISOString());
        if (sesionesPorFecha[hoyStr]) {
            const celda = [...document.querySelectorAll('#calendarGrid .calendar-day')].find(d => (d.getAttribute('onclick') || '').includes(hoyStr));
            if (celda) seleccionarDia(hoyStr, celda);
        }
        
        // Calcular topkillers y equipos
        await calcularTablaGlobalAcumulada(sesiones);

    } catch (err) {
        console.error("Error al cargar sesiones públicas:", err);
        document.getElementById('calendarGrid').innerHTML = `<div style="grid-column: span 7; text-align:center; color: #ff3333; padding: 20px;">Error al cargar datos.</div>`;
    }
}

// Función para dibujar los días del calendario
function renderCalendar(month, year) {
    const grid = document.getElementById('calendarGrid');
    const display = document.getElementById('monthYearDisplay');
    if (!grid || !display) return;

    grid.innerHTML = '';
    const date = new Date(year, month, 1);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    display.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = date.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // Espacios vacíos antes del día 1
    for (let i = 0; i < firstDayIndex; i++) {
        grid.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    // Dibujar días del mes
    for (let day = 1; day <= lastDay; day++) {
        let mStr = (month + 1).toString().padStart(2, '0');
        let dStr = day.toString().padStart(2, '0');
        let dateStr = `${year}-${mStr}-${dStr}`;

        let hasSession = sesionesPorFecha[dateStr] ? true : false;
        let classStr = "calendar-day" + (hasSession ? " has-session" : "");

        grid.innerHTML += `<div class="${classStr}" onclick="seleccionarDia('${dateStr}', this)">${day}</div>`;
    }

    // Ocultar la tabla de abajo si se cambia de mes
    document.getElementById('daySessionsContainer').style.display = 'none';
}

// Cambiar de mes mediante las flechas
function cambiarMes(dir) {
    currentMonth += dir;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
}

// Función al dar clic en un día específico
function seleccionarDia(dateStr, el) {
    // Quitar selección previa
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected-day'));
    
    // Marcar selección actual
    if (!el.classList.contains('empty')) {
        el.classList.add('selected-day');
    }

    const container = document.getElementById('daySessionsContainer');
    const tbody = document.getElementById('bodySesionesDia');
    const title = document.getElementById('selectedDayTitle');

    // Si el día no tiene sesiones, ocultamos la tabla de abajo
    if (!sesionesPorFecha[dateStr]) {
        container.style.display = 'none';
        return;
    }

    // Mostrar tabla y llenar datos
    container.style.display = 'block';
    
    // Formatear la fecha considerando la zona horaria local
    // Ej.: "lunes 5 de octubre de 2026"
    let fechaFormat = new Date(dateStr + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const esHoy = dateStr === diaLocal(new Date().toISOString());
    title.innerHTML = `<i class="fa-solid fa-list-check"></i> ${esHoy ? 'Entrenos de hoy · ' : 'Registro del '}${fechaFormat}`;
    tbody.innerHTML = '';

    sesionesPorFecha[dateStr].forEach(sesion => {
        const ses = { portal: 'entrenamientos', id: sesion.id, titulo: sesion.titulo, fecha: sesion.fecha, jornada: sesion.jornada };
        const fechaTxt = window.PumasDescargas ? PumasDescargas.fechaHTML(sesion.fecha) : '';
        const dl = window.PumasDescargas ? PumasDescargas.botones(ses) : '';
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: bold; color: var(--light);">${esc(sesion.titulo)}<br>${fechaTxt}</td>
                <td style="text-align: center;">
                    <div class="pg-ses-acc" style="justify-content:center">
                        ${dl}
                        <button class="btn-ver" onclick="procesarSesionUnica('${sesion.id}')"><i class="fa-solid fa-table"></i> Ver</button>
                    </div>
                </td>
            </tr>
        `;
    });
}


const ZONA_HORARIA='America/Bogota';
const diaLocal=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:ZONA_HORARIA});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Semana de LUNES a DOMINGO (hora Colombia)
function inicioSemana(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()||7)-1));}
function semanaISO(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),n=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-n);const y=t.getUTCFullYear();return y+'-'+Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);}
function rangoSemana(d){const l=inicioSemana(d),f=new Date(l.getFullYear(),l.getMonth(),l.getDate()+6),o={day:'numeric',month:'short'};return l.toLocaleDateString('es',o)+' – '+f.toLocaleDateString('es',o);}
const MIN_SALAS_KILLER=3; // mínimo de salas jugadas para entrar a los top killers
async function parsearSesion(s){
  const vacio={teams:{},players:{},salas:0,kills:0};
  if(!s.archivo_url) return vacio;
  const {data:fl}=await supabaseClient.storage.from('entrenamientos_logs').list(s.archivo_url);
  if(!fl) return vacio;
  const ck='pg_ses_v3_'+s.id;
  try{const c=JSON.parse(localStorage.getItem(ck)); if(c&&c.salas===fl.length) return c;}catch(e){}
  const out={teams:{},players:{},salas:fl.length,kills:0};
  await Promise.all(fl.map(async f=>{
    const {data}=await supabaseClient.storage.from('entrenamientos_logs').download(s.archivo_url+'/'+f.name); if(!data) return;
    (await data.text()).split('\n').forEach(l=>{
      const t=l.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
      if(t){const e=out.teams[t[1].trim()]=out.teams[t[1].trim()]||{p:0,b:0,k:0}; e.p+=+t[5]; e.k+=+t[3]; if(+t[2]===1) e.b++;}
      const p=l.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
      if(p){const e=out.players[p[1].trim()]=out.players[p[1].trim()]||{k:0,s:0}; e.k+=+p[2]; e.s++; out.kills+=+p[2];}
    });
  }));
  try{localStorage.setItem(ck,JSON.stringify(out));}catch(e){}
  return out;
}
function agregar(lista){
  const eq={},pl={}; let salas=0,kills=0;
  lista.forEach(([s,d])=>{salas+=d.salas;kills+=d.kills;
    for(const n in d.teams){const e=eq[n]=eq[n]||{name:n,pts:0,b:0,k:0,ses:0};e.pts+=d.teams[n].p;e.b+=d.teams[n].b;e.k+=d.teams[n].k||0;e.ses++;}
    for(const n in d.players){const e=pl[n]=pl[n]||{name:n,k:0,s:0};e.k+=d.players[n].k;e.s+=d.players[n].s;}});
  // PR (Puntos Reales) = PG (puntos generales) ÷ sesiones, redondeado a entero · desempate: booyah → puntos totales
  const E=Object.values(eq).map(e=>({...e,pr:Math.round(e.pts/e.ses)})).sort((a,b)=>b.pr-a.pr||b.b-a.b||b.pts-a.pts||a.name.localeCompare(b.name));
  // KDA real = kills ÷ salas jugadas · desempate: kills
  const P=Object.values(pl).filter(x=>x.s>=MIN_SALAS_KILLER).map(x=>({...x,kda:x.k/x.s})).sort((a,b)=>b.kda-a.kda||b.k-a.k);
  return {eq:E,pl:P,salas,kills};
}
async function parsearTodas(sesiones,alAvanzar){
  const res=[];
  for(let i=0;i<sesiones.length;i+=4){
    const ch=sesiones.slice(i,i+4), r=await Promise.all(ch.map(s=>parsearSesion(s).catch(()=>({teams:{},players:{},salas:0,kills:0}))));
    ch.forEach((s,j)=>res.push([s,r[j]])); if(alAvanzar) alAvanzar(res);
  }
  return res;
}
// Siempre la semana ACTUAL (lunes a domingo), aunque todavía no tenga entrenos
function semanaObjetivo(parsed){
  const key=p=>semanaISO(new Date(diaLocal(p[0].fecha)+'T00:00:00'));
  const hoy=new Date(diaLocal(new Date().toISOString())+'T00:00:00');
  const k=semanaISO(hoy), lista=parsed.filter(p=>key(p)===k);
  return {num:k.split('-')[1],lista,actual:true,rango:rangoSemana(hoy)};
}

const _col=i=>i===0?'#D8C395':i===1?'#B9B2A4':i===2?'#cd7f32':'var(--light)';
// data-l = etiqueta que se ve en el celular, donde cada equipo se muestra como ficha
function _filaEq(eq,i){const c=_col(i);return `<tr><td class="c-pos" style="font-weight:bold;color:${c};">#${i+1}</td><td class="eq-nombre" style="font-weight:bold;color:var(--light);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(eq.name)}</td><td data-l="SES" style="text-align:center;color:var(--gray);font-weight:bold;">${eq.ses}</td><td data-l="BOO" style="text-align:center;color:#D8C395;font-weight:bold;">${eq.b}</td><td data-l="KILL" style="text-align:center;color:var(--light);font-weight:bold;">${eq.k}</td><td data-l="PG" style="text-align:center;color:var(--gray);font-weight:bold;">${eq.pts}</td><td class="c-pr" data-l="PR" style="text-align:center;color:${c};font-weight:bold;">${eq.pr}</td></tr>`;}
// Histórico ordenable: PR (PG ÷ sesiones) o PG (puntos totales)
let _historicoPumas=[];
const _ordenPumas={pr:(a,b)=>b.pr-a.pr||b.b-a.b||b.pts-a.pts||a.name.localeCompare(b.name),pg:(a,b)=>b.pts-a.pts||b.pr-a.pr||b.b-a.b||a.name.localeCompare(b.name),kill:(a,b)=>b.k-a.k||b.pr-a.pr||b.pts-a.pts||a.name.localeCompare(b.name)};
const _textoOrden=o=>o==='pg'?'Orden: PG (puntos totales) → PR':o==='kill'?'Orden: KILLS (totales) → PR':'Orden: PR (PG ÷ sesiones) → booyah';
let _semanaPumas=[],_semInfo=null;
function ordenarHistorico(orden){
  document.querySelectorAll('#ordenHistorico .orden-btn').forEach(x=>x.classList.toggle('on',x.dataset.orden===orden));
  const n=document.getElementById('notaHistorico'); if(n) n.textContent=_textoOrden(orden);
  _llenar('bodyTop100a','bodyTop100b',[..._historicoPumas].sort(_ordenPumas[orden]).slice(0,100));
}
// Top 50 de la semana ordenable: PR, PG o KILLS
function ordenarSemana(orden){
  document.querySelectorAll('#ordenSemana .orden-btn').forEach(x=>x.classList.toggle('on',x.dataset.orden===orden));
  const tit=document.getElementById('tituloTop50');
  if(tit&&_semInfo) tit.innerHTML=`Top 50 Equipos · Semana ${_semInfo.num}<span class="wk-range">${_semInfo.rango}${_semInfo.actual?'':' · última semana con datos'} · ${_textoOrden(orden)}</span>`;
  _llenar('bodyTablaGlobal1','bodyTablaGlobal2',[..._semanaPumas].sort(_ordenPumas[orden]).slice(0,50),SIN_SEMANA);
}
const SIN_SEMANA='No tenemos resultados de la semana. Puedes consultar en el calendario los entrenos anteriores o más abajo el histórico.';
function _llenar(idA,idB,lista,vacio){
  const A=document.getElementById(idA),B=document.getElementById(idB); if(!A||!B) return;
  if(!lista.length){A.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:18px;">${vacio||'Sin registros.'}</td></tr>`;B.innerHTML='';return;}
  const m=Math.ceil(lista.length/2);
  A.innerHTML=lista.slice(0,m).map((e,i)=>_filaEq(e,i)).join('');
  B.innerHTML=lista.slice(m).map((e,i)=>_filaEq(e,i+m)).join('');
  const cap=(tb,txt)=>{const tbl=tb.closest('table');let c=tbl.querySelector('caption');if(!c)c=tbl.createCaption();c.textContent=txt;};
  cap(A,`PUESTOS 1 – ${m}`);
  cap(B,lista.length>m?`PUESTOS ${m+1} – ${lista.length}`:'');
  // En el celular: solo los primeros 10 hasta tocar "Ver los N"
  const cont=A.closest('table').parentElement; cont.classList.add('tablas-pumas');
  let b=cont.nextElementSibling&&cont.nextElementSibling.classList.contains('ver-mas')?cont.nextElementSibling:null;
  if(!b){b=document.createElement('button');b.type='button';b.className='ver-mas';cont.after(b);cont.classList.add('recortar');
    b.addEventListener('click',()=>{cont.classList.toggle('recortar');b._t();if(cont.classList.contains('recortar'))cont.scrollIntoView({block:'start'});});}
  b._t=()=>{b.innerHTML=cont.classList.contains('recortar')?`<i class="fa-solid fa-chevron-down"></i> Ver los ${lista.length}`:'<i class="fa-solid fa-chevron-up"></i> Ver menos';};
  b.hidden=lista.length<=10; b._t();
}
async function calcularTablaGlobalAcumulada(sesiones){
  const parsed=await parsearTodas(sesiones);
  const todo=agregar(parsed), sem=semanaObjetivo(parsed), w=agregar(sem.lista);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('statTotalEquipos',todo.eq.length);set('statTotalKills',todo.kills);set('statTotalMapas',todo.salas);
  _semanaPumas=w.eq; _semInfo=sem;
  const _os=document.querySelector('#ordenSemana .orden-btn.on');
  ordenarSemana(_os?_os.dataset.orden:'pr');
  _historicoPumas=todo.eq;
  const _o=document.querySelector('#ordenHistorico .orden-btn.on');
  ordenarHistorico(_o?_o.dataset.orden:'pr');
  // Top killers en dos tablas: por KDA (kills ÷ salas) y por kills totales (mínimo 3 salas)
  const g=document.getElementById('gridTopKillersGlobal');
  const porKills=[...todo.pl].sort((a,b)=>b.k-a.k||b.kda-a.kda);
  const lista=(arr,res)=>arr.length?`<div class="killer-head"><span>#</span><span>JUGADOR</span><span>SALAS</span><span>KILLS</span><span>KDA</span></div>`+arr.slice(0,10).map((tk,i)=>`<div class="killer-card k5"><span style="color:${_col(i)};font-weight:bold;">#${i+1}</span><span class="k-name">${esc(tk.name)}</span><span class="k-num">${tk.s}</span><span class="k-num"${res==='k'?` style="color:${_col(i)};"`:''}>${tk.k}</span><span class="k-num"${res==='kda'?` style="color:${_col(i)};"`:''}>${tk.kda.toFixed(2)}</span></div>`).join(''):'<div style="color:var(--gray);text-align:center;padding:20px;">Sin jugadores con 3 salas o más.</div>';
  if(g) g.innerHTML=`<div class="killers-doble"><div><h4 class="killers-sub">Por KDA <small>kills ÷ salas</small></h4>${lista(todo.pl,'kda')}</div><div><h4 class="killers-sub">Por kills totales <small>sin fórmula</small></h4>${lista(porKills,'k')}</div></div><p class="killers-nota">Solo cuentan jugadores con ${MIN_SALAS_KILLER} salas o más.</p>`;
  // Destacados (mismo bloque que Entrenos LATAM)
  if(window.Latam&&Latam.pintarDestacados){
    const eqs=todo.eq.map(e=>({...e,kps:e.k/e.ses,entrenos:1}));
    Latam.pintarDestacados(
      [...eqs].sort((a,b)=>b.k-a.k||b.kps-a.kps).slice(0,5),
      [...eqs].sort((a,b)=>b.ses-a.ses||b.pr-a.pr).slice(0,5),
      porKills.slice(0,5), false, 'pumasDestacados',
      [...eqs].filter(e=>e.b>0).sort((a,b)=>b.b-a.b||b.pr-a.pr||b.pts-a.pts).slice(0,5));
  }
}

async function cargarResultadosVipPublicos() {
    const tbody = document.getElementById('bodyTablaVip');
    if (!tbody || !supabaseClient) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--primary); padding: 20px;">Cargando todos los equipos VIP...</td></tr>`;

    try {
        const { data: dbOficiales, error: errOficiales } = await supabaseClient.from('equipos_registrados').select('*');
        if (errOficiales || !dbOficiales) throw errOficiales;

        let acumuladoVip = {};
        dbOficiales.forEach(eq => {
            let nombreKey = eq.nombre.trim().toUpperCase();
            acumuladoVip[nombreKey] = {
                nombre: eq.nombre.trim(),
                totalScore: 0,
                booyahs: 0,
                participaciones: 0
            };
        });

        const { data: dbSalas, error: errSalas } = await supabaseClient.from('salas_resultados').select('*');
        if (errSalas || !dbSalas) throw errSalas;

        dbSalas.forEach(fila => {
            let nombreLimpio = fila.equipo_nombre.trim().toUpperCase();
            if (acumuladoVip[nombreLimpio]) {
                acumuladoVip[nombreLimpio].totalScore += Number(fila.total_score || 0);
                acumuladoVip[nombreLimpio].participaciones += 1;
                if (fila.es_booyah === true || Number(fila.rank) === 1) {
                    acumuladoVip[nombreLimpio].booyahs += 1;
                }
            }
        });

        let listaVip = Object.values(acumuladoVip).sort((a, b) => b.totalScore - a.totalScore);
        tbody.innerHTML = '';

        listaVip.forEach((eq, idx) => {
            let colorPos = idx === 0 && eq.totalScore > 0 ? '#D8C395' : (idx === 1 && eq.totalScore > 0 ? '#B9B2A4' : (idx === 2 && eq.totalScore > 0 ? '#cd7f32' : '#fff'));
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px; font-weight: bold; color: ${colorPos};">#${idx+1}</td>
                    <td style="padding: 10px; font-weight: bold; color: #fff;">${eq.nombre}</td>
                    <td style="text-align: center; padding: 10px; color: #D8C395; font-weight: bold;">${eq.booyahs}</td>
                    <td style="text-align: center; padding: 10px; color: ${colorPos}; font-weight: bold; font-family: 'Michroma';">${eq.totalScore}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Error al cargar VIP públicos:", err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ff5555; padding: 20px;">Error al conectar con la base de datos.</td></tr>`;
    }
}

function cerrarModalDetalle() {
    let modal = document.getElementById('modalDetalleSesion');
    if (modal) modal.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', cargarSesiones);