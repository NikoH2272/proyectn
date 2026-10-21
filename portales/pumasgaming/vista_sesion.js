/* Vista de un entreno: mismo diseño, fondo y dimensiones (800x1000) que la imagen del admin */
let _vistaMeta=null;
const _vFecha=iso=>new Date(iso).toLocaleString('sv-SE',{timeZone:'America/Bogota'}).slice(0,16);

function parsearLogsVista(textos){
  const eqs={},jug={},ganadores=[];
  textos.forEach((text,i)=>{
    let bn=null,bp=0,bk=0;
    text.split('\n').forEach(line=>{
      const m=line.match(/TeamName:\s*(.+?)\s+Rank:\s*(\d+)\s+KillScore:\s*(\d+)\s+RankScore:\s*(\d+)\s+TotalScore:\s*(\d+)/i);
      if(m){
        const n=m[1].trim(),e=eqs[n]=eqs[n]||{name:n,totalScore:0,killScore:0,rankScore:0,salasPuntos:{},salasKills:{},salasRank:{},booyahsCount:0};
        const rank=+m[2],ks=+m[3],rs=+m[4],ts=+m[5];
        e.totalScore+=ts;e.killScore+=ks;e.rankScore+=rs;e.salasPuntos[i]=ts;e.salasKills[i]=ks;e.salasRank[i]=rs;
        if(rank===1){e.booyahsCount++;bn=n;bp=ts;bk=ks;}
      }
      const pm=line.match(/NAME:\s*(.+?)\s+ID:\s*\d+.*?KILL:\s*(\d+)/i);
      if(pm){const n=pm[1].trim();(jug[n]=jug[n]||{name:n,kills:0}).kills+=+pm[2];}
    });
    ganadores.push({sala:i+1,team:bn||'N/D',points:bp,kills:bk});
  });
  return {eqs:Object.values(eqs).sort((a,b)=>b.totalScore-a.totalScore),tks:Object.values(jug).sort((a,b)=>b.kills-a.kills),salas:textos.length,rw:ganadores};
}

function capturaHTML(d,meta){
  const cF='#ffffff',nS=d.salas,eqO=d.eqs,tKL=d.tks.slice(0,15),rW=d.rw;
  const nM=(meta.moderador||'').trim()?meta.moderador.trim().toUpperCase():'PROYECTN ZEE';
  const totK=d.tks.reduce((a,c)=>a+c.kills,0);
  const cols=Array.from({length:Math.min(nS,5)});
  return `<div id="tablaCaptura" style="background-image:url('imagenes/FONDOS.png');background-size:cover;background-position:center;">
    <div class="captura-header"><h1 class="captura-titulo"></h1>
      <div class="captura-subtitulo" style="color:${cF};">TIPO: [${esc(meta.jornada||'NORMAL')}] | FECHA: ${meta.fechaTxt} | MOD: ${esc(nM)}</div></div>
    <div class="captura-card card-tabla-general"><div class="card-titulo">TABLA GENERAL (ESTÁNDAR)</div>
      <table class="tabla-general-interna" style="color:${cF};"><thead><tr><th style="text-align:left;">#</th><th style="text-align:left;">EQUIPO</th>${cols.map((_,i)=>`<th style="text-align:center;">S${i+1}</th>`).join('')}<th style="text-align:center;">KILL</th><th style="text-align:center;">TOTAL</th></tr></thead><tbody>
      ${eqO.slice(0,15).map((eq,i)=>{const c=i===0?'#D8C395':i===1?'#B9B2A4':cF;return `<tr><td style="font-weight:bold;color:${c};">#${i+1}</td><td style="font-weight:bold;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="color:${cF};">${esc(eq.name)}</span></td>${cols.map((_,s)=>eq.salasPuntos[s]===undefined?'<td style="text-align:center;color:var(--gray);">-</td>':`<td style="text-align:center;color:${cF};">${eq.salasPuntos[s]}</td>`).join('')}<td style="text-align:center;color:#D8C395;font-weight:bold;">${eq.killScore}</td><td style="text-align:center;color:${c};font-weight:bold;">${eq.totalScore}</td></tr>`;}).join('')}
      </tbody></table></div>
    <div class="captura-card card-equipos-destacados"><div class="card-titulo">RESUMEN DE EQUIPOS DESTACADOS (TOP 6)</div><div class="grid-equipos-destacados">
      ${eqO.slice(0,6).map((eq,i)=>`<div class="item-equipo-destacado"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px;"><span style="color:${i===0?'#D8C395':cF};font-weight:bold;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">#${i+1}${esc(eq.name)}</span><span style="color:#D8C395;font-weight:bold;">👑 ${eq.booyahsCount||0}</span></div><div style="display:flex;justify-content:space-between;color:var(--gray);font-size:0.62rem;"><span>Pts: <strong style="color:${cF};">${eq.totalScore}</strong></span><span>Kills: <strong style="color:#D8C395;">${eq.killScore||0}</strong></span></div></div>`).join('')}</div></div>
    <div class="captura-card card-booyah-sala"><div class="card-titulo">BOOYAH POR SALA (VICTORIAS)</div><div class="grid-booyah-salas" style="grid-template-columns:repeat(${Math.min(Math.max(rW.length,1),5)},1fr);">
      ${rW.length?rW.map(rw=>`<div class="item-booyah-sala"><div style="color:#D8C395;font-family:'Michroma';font-weight:bold;margin-bottom:1px;">SALA ${rw.sala} 👑</div><div style="color:${cF};font-weight:bold;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 auto;">${esc(rw.team)}</div><div style="color:var(--gray);font-size:0.6rem;margin-top:1px;">Pts: <strong style="color:#D8C395;">${rw.points}</strong> | K: <strong style="color:#D8C395;">${rw.kills}</strong></div></div>`).join(''):'<div style="color:var(--gray);font-size:0.72rem;text-align:center;padding:4px;">No hay datos de Booyah registrados.</div>'}</div></div>
    <div class="captura-card card-top-killers"><div class="card-titulo">TOP 15 KILLERS MÁS LETALES</div><div class="grid-top-killers">
      ${tKL.map((tk,i)=>`<div class="item-top-killer"><div style="overflow:hidden;"><span style="color:${i===0?'#D8C395':cF};font-weight:bold;margin-right:2px;">#${i+1}</span><span style="color:${cF};font-weight:bold;max-width:75px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;">${esc(tk.name)}</span></div><span style="color:#D8C395;font-weight:bold;font-size:0.7rem;">${tk.kills}</span></div>`).join('')}</div></div>
    <div class="captura-card card-resumen-general"><div class="card-titulo">RESUMEN GENERAL DE LA PARTIDA</div><div class="grid-resumen-nums">
      <div class="item-resumen-caja"><div style="color:var(--gray);font-size:0.62rem;">SALAS JUGADAS</div><div style="color:#D8C395;font-family:'Michroma';font-weight:bold;font-size:0.9rem;">${nS}</div></div>
      <div class="item-resumen-caja"><div style="color:var(--gray);font-size:0.62rem;">EQUIPOS QUE JUGARON</div><div style="color:#D8C395;font-family:'Michroma';font-weight:bold;font-size:0.9rem;">${eqO.length}</div></div>
      <div class="item-resumen-caja"><div style="color:var(--gray);font-size:0.62rem;">KILL GENERALES</div><div style="color:#D8C395;font-family:'Michroma';font-weight:bold;font-size:0.9rem;">${totK}</div></div></div></div>
  </div>`;
}

async function procesarSesionUnica(id){
  const lista=Object.values(sesionesPorFecha||{}).flat();
  const s=lista.find(x=>String(x.id)===String(id)); if(!s) return;
  const modal=document.getElementById('modalDetalleSesion'),body=document.getElementById('vistaSesionBody');
  modal.style.display='flex';
  body.innerHTML='<p class="vista-cargando">Cargando entrenamiento...</p>';
  try{
    const {data:fl,error}=await supabaseClient.storage.from('entrenamientos_logs').list(s.archivo_url||'');
    if(error||!fl||!fl.length){body.innerHTML='<p class="vista-cargando">No se encontraron archivos de este entrenamiento.</p>';return;}
    fl.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    const textos=await Promise.all(fl.map(async f=>{const {data}=await supabaseClient.storage.from('entrenamientos_logs').download(s.archivo_url+'/'+f.name);return data?await data.text():'';}));
    const d=parsearLogsVista(textos);
    const meta={titulo:s.titulo||'ENTRENOS PROYECTN',jornada:s.jornada,moderador:s.moderador,fecha:s.fecha,fechaTxt:_vFecha(s.fecha)};
    _vistaMeta=meta;
    const sc=Math.min(1,(Math.min(window.innerWidth-40,880)-60)/800);
    body.innerHTML=`<div class="vista-head"><h3>${esc(meta.titulo)}</h3><span>${esc(meta.jornada||'NORMAL')} · ${meta.fechaTxt}</span></div>
      <div id="vistaScaleWrap" style="width:${800*sc}px;height:${1000*sc}px;margin:0 auto;"><div id="vistaScaleInner" data-sc="${sc}" style="width:800px;height:1000px;transform:scale(${sc});transform-origin:top left;">${capturaHTML(d,meta)}</div></div>
      <div class="vista-actions"><button class="btn-generar" onclick="descargarVista()"><i class="fa-solid fa-download"></i> DESCARGAR IMAGEN 4:5</button></div>`;
  }catch(e){console.error(e);body.innerHTML='<p class="vista-cargando">Error al cargar el entrenamiento.</p>';}
}

function descargarVista(){
  const el=document.getElementById('tablaCaptura'),inner=document.getElementById('vistaScaleInner'),wrap=document.getElementById('vistaScaleWrap');
  if(!el) return;
  const prev=inner.style.transform,w=wrap.style.width,h=wrap.style.height;
  inner.style.transform='none';wrap.style.width='800px';wrap.style.height='1000px';
  html2canvas(el,{scale:2,useCORS:true,allowTaint:true,backgroundColor:null}).then(c=>{
    const a=document.createElement('a');
    a.download='ENTRENOS_PUMAS_GG_'+(_vistaMeta?_vistaMeta.fechaTxt.slice(0,10):'')+'.png';
    a.href=c.toDataURL('image/png');a.click();
  }).finally(()=>{inner.style.transform=prev;wrap.style.width=w;wrap.style.height=h;});
}