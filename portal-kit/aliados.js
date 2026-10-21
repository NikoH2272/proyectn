/* Inicio: sección "Torneos aliados" (sql/17).
   Solo aparece si está activada desde el admin (Personalizar → Inicio) y hay torneos activos.
   Necesita <section id="aliados" hidden> con <div id="aliadosGrid"> y portal.js. */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    function estilos() {
        if (document.getElementById('pgAliadosCss')) return;
        const st = document.createElement('style');
        st.id = 'pgAliadosCss';
        st.textContent = `
.aliados-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:18px;max-width:1180px;margin:0 auto}
.aliado-card{display:flex;flex-direction:column;gap:10px;padding:20px;border:1px solid rgba(220,204,156,.25);border-top:3px solid var(--primary,#D8C395);
  background:linear-gradient(145deg,rgba(220,204,156,.06),transparent 45%),#131313;color:#F4EEDC}
.aliado-top{display:flex;align-items:center;gap:14px}
.aliado-top img{width:64px;height:64px;object-fit:contain;flex-shrink:0;background:#0c0c0c;border:1px solid rgba(255,255,255,.08)}
.aliado-top h3{margin:0;color:var(--primary,#D8C395);font-size:.95rem}
.aliado-fecha{display:inline-block;margin-top:4px;padding:3px 8px;border:1px solid rgba(220,204,156,.35);color:#E8DDBF;font-size:.72rem}
.aliado-card p{margin:0;color:#B9B2A4;font-size:.9rem;line-height:1.6}
.aliado-card .btn-access{margin-top:auto;text-align:center}
.aliados-intro{max-width:760px;margin:-18px auto 28px;color:#B9B2A4;text-align:center}`;
        document.head.appendChild(st);
    }

    async function montar() {
        const sec = document.getElementById('aliados');
        if (!sec || !P.db()) return;
        try {
            const [cfg, lista] = await Promise.all([
                P.db().from('sitio_config').select('valor').eq('clave', 'torneos_aliados').maybeSingle(),
                P.db().from('torneos_aliados').select('*').eq('activo', true).order('orden').order('id')
            ]);
            const c = (cfg.data && cfg.data.valor) || {};
            const filas = lista.data || [];
            if (cfg.error || lista.error || !c.activo || !filas.length) return;
            estilos();
            if (c.titulo) sec.querySelector('.section-title').textContent = c.titulo;
            const intro = sec.querySelector('.aliados-intro');
            if (intro && c.texto) intro.textContent = c.texto;
            document.getElementById('aliadosGrid').innerHTML = filas.map(a => `
                <article class="aliado-card">
                    <div class="aliado-top">
                        <img src="${esc(a.logo || '/imagenes/proyectn.png')}" alt="" onerror="this.onerror=null;this.src='/imagenes/proyectn.png'">
                        <div><h3>${esc(a.nombre)}</h3>${a.fecha_texto ? `<span class="aliado-fecha"><i class="fa-regular fa-calendar"></i> ${esc(a.fecha_texto)}</span>` : ''}</div>
                    </div>
                    ${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}
                    ${a.link ? `<a class="btn-access" href="${esc(a.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver torneo</a>` : ''}
                </article>`).join('');
            sec.hidden = false;
            document.querySelectorAll('[data-nav-aliados]').forEach(n => { n.hidden = false; });
        } catch (e) { /* sin sql/17 la sección no sale */ }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
