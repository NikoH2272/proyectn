/* =====================================================================
   PROYECTN · Juegos por portal — Snake · Tetris · 3 en Línea
   - montar(portal, destino, tipo?): monta el juego activo
   ===================================================================== */
(function () {
    const P = window.PumasPortal;
    const esc = P.escaparHtml;

    const GRID = 20, CELL = 20, W = GRID * CELL;
    const MALAS = /\b(puta|puto|culero|pendejo|chingad|mierda|cono|verga|cabron|mamada|pinche|carajo|joder|cojones|ojete|perra|marica|maricon|joto|hdp|imbecil)\b/i;

    function estilos() {
        if (document.getElementById('pgJuegosCss')) return;
        const st = document.createElement('style');
        st.id = 'pgJuegosCss';
        st.textContent = `
.pgj{width:min(100%,1180px);margin:0 auto;padding:clamp(40px,5vw,64px) clamp(18px,4vw,40px)}
.pgj+.pgj{padding-top:0}
.pgj-caja{padding:clamp(18px,3vw,30px);border:1px solid rgba(var(--primary-rgb,216,195,149),.35);
  border-top:3px solid var(--primary,#D8C395);border-radius:3px;
  background:linear-gradient(145deg,rgba(var(--primary-rgb,216,195,149),.07),transparent 45%),#121212;
  color:var(--light,#F4EEDC)}
.pgj h2{margin:0 0 6px;color:var(--primary,#D8C395);font:900 clamp(1.2rem,2.6vw,1.8rem)/1.15 var(--font-display,'Michroma',sans-serif);text-transform:uppercase}
.pgj p.pgj-sub{margin:0 0 18px;color:var(--gray,#B9B2A4);line-height:1.6}
.pgj-layout{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:start}
.pgj-canvas-col{display:flex;flex-direction:column;align-items:center}
.pgj-canvas-col canvas{display:block;border:2px solid rgba(var(--primary-rgb,216,195,149),.35);border-radius:2px;max-width:min(88vw,400px)}
.pgj-score-live{color:var(--primary,#D8C395);font:900 1rem var(--font-display,'Michroma',sans-serif);
  text-align:center;margin:10px 0 0;letter-spacing:.06em}
.pgj-controles{font-size:.72rem;color:var(--gray,#B9B2A4);margin:6px 0 0;text-align:center;display:none}
@media(pointer:fine){.pgj-controles{display:block}}
.pgj-dpad{display:none;flex-direction:column;align-items:center;gap:4px;margin-top:10px;user-select:none}
@media(pointer:coarse){.pgj-dpad{display:flex}}
.pgj-dpad-row{display:flex;gap:4px}
.pgj-dpad button{width:56px;height:56px;border:1px solid rgba(var(--primary-rgb,216,195,149),.5);border-radius:4px;
  background:rgba(var(--primary-rgb,216,195,149),.12);color:var(--primary,#D8C395);
  font-size:1.4rem;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  display:flex;align-items:center;justify-content:center}
.pgj-dpad button:active{background:rgba(var(--primary-rgb,216,195,149),.35)}
.pgj-deadline{display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:12px;
  border:1px solid rgba(var(--primary-rgb,216,195,149),.3);border-radius:6px;
  background:rgba(var(--primary-rgb,216,195,149),.06)}
.pgj-deadline-label{color:#B9B2A4;font:700 .68rem var(--font-display,'Michroma',sans-serif);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.pgj-deadline-clock{color:var(--primary,#D8C395);font:900 1rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;margin-left:4px}
.pgj-deadline-clock.urgente{color:#ff4d4d;animation:pgjblink .6s infinite alternate}
@keyframes pgjblink{to{opacity:.3}}
.pgj-cerrado-msg{padding:10px 14px;border:1px solid rgba(229,72,77,.4);border-radius:6px;
  color:#ff8a8d;font-size:.88rem;margin-bottom:12px;background:rgba(229,72,77,.06)}
.pgj-tetris-body{display:flex;gap:20px;align-items:flex-start;justify-content:center}
.pgj-tetris-side{display:none;min-width:150px;flex-shrink:0}
@media(pointer:fine){.pgj-tetris-side{display:block}}
.pgj-dpad-tetris{gap:8px;margin-top:16px;width:100%}
.pgj-dpad-tetris .pgj-dpad-row{justify-content:center;gap:8px}
.pgj-dpad-tetris button{width:82px;height:82px;font-size:1.7rem;border-radius:10px;border-width:2px;flex-direction:column;gap:2px}
.pgj-dpad-tetris button small{font-size:.55rem;display:block;font-family:var(--font-display,'Michroma',sans-serif);letter-spacing:.05em;opacity:.8}
.pgj-dpad-tetris button[data-act="rot"]{width:110px;height:74px}
.pgj-dpad-tetris button[data-act="drp"]{width:260px;height:64px;font-size:.9rem;letter-spacing:.06em}
.pgj form{display:grid;gap:12px;max-width:320px;margin-bottom:18px}
.pgj label{display:block;margin-bottom:5px;color:var(--primary,#D8C395);
  font:800 .66rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;text-transform:uppercase}
.pgj input{width:100%;min-height:46px;padding:10px 12px;
  border:1px solid rgba(var(--primary-rgb,216,195,149),.3);border-radius:2px;
  color:var(--light,#F4EEDC);background:#0c0c0c;font-size:16px;box-sizing:border-box}
.pgj-btn{min-height:48px;border:1px solid var(--primary,#D8C395);border-radius:2px;
  color:var(--on-primary,#0A0A0A);background:var(--primary,#D8C395);
  font:900 .8rem var(--font-display,'Michroma',sans-serif);letter-spacing:.05em;
  text-transform:uppercase;cursor:pointer;transition:opacity .15s;padding:0 20px}
.pgj-btn:disabled{opacity:.5;cursor:not-allowed}
.pgj-btn-sec{background:transparent;color:var(--primary,#D8C395)}
.pgj-msg{min-height:1.2em;color:#ff8a8d;font-size:.9rem;margin:4px 0 0}
.pgj-lb{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:10px}
.pgj-lb th{color:var(--primary,#D8C395);font:700 .7rem var(--font-display,'Michroma',sans-serif);
  letter-spacing:.08em;padding:8px;border-bottom:1px solid rgba(var(--primary-rgb,216,195,149),.25);text-align:left}
.pgj-lb td{padding:8px;border-bottom:1px solid rgba(255,255,255,.06);color:var(--light,#F4EEDC)}
.pgj-lb .pos{font:700 .8rem var(--font-display,'Michroma',sans-serif);color:var(--primary,#D8C395);white-space:nowrap}
.pgj-lb .pts{text-align:right;color:#FFD54A;font-weight:700}
.pgj-info{font-size:.82rem;color:var(--gray,#B9B2A4);margin:4px 0 0}
.pgj-3-result{font:900 1.1rem var(--font-display,'Michroma',sans-serif);text-align:center;margin:10px 0;min-height:1.4em}
@media(max-width:720px){.pgj-layout{grid-template-columns:1fr;direction:initial}}`;
        document.head.appendChild(st);
    }

    function contenedor(destino) {
        let c = destino ? document.getElementById(destino) : document.getElementById('pgJuego');
        if (!c) {
            c = document.createElement('section');
            c.id = 'pgJuego';
            const pie = document.querySelector('footer');
            if (pie) pie.before(c); else document.body.appendChild(c);
        }
        c.classList.add('pgj');
        c.hidden = false;
        return c;
    }

    /* ═══════════════════════════════
       MOTOR SNAKE
    ═══════════════════════════════ */
    let _sn, _dir, _nd, _food, _pts, _spd, _tid, _ctx, _running;

    function _rndFood() {
        let f;
        do { f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }; }
        while (_sn.some(s => s.x === f.x && s.y === f.y));
        return f;
    }

    function _draw() {
        _ctx.fillStyle = '#0a0a0a'; _ctx.fillRect(0, 0, W, W);
        _ctx.strokeStyle = 'rgba(255,255,255,.04)'; _ctx.lineWidth = .5;
        for (let i = 0; i <= GRID; i++) {
            _ctx.beginPath(); _ctx.moveTo(i * CELL, 0); _ctx.lineTo(i * CELL, W); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(0, i * CELL); _ctx.lineTo(W, i * CELL); _ctx.stroke();
        }
        _ctx.fillStyle = '#e84d4d';
        _ctx.fillRect(_food.x * CELL + 3, _food.y * CELL + 3, CELL - 6, CELL - 6);
        _sn.forEach((s, i) => {
            _ctx.fillStyle = i === 0 ? '#D8C395' : `rgba(216,195,149,${Math.max(.25, .9 - i * .025)})`;
            _ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
        });
    }

    function _stop() { clearTimeout(_tid); _running = false; }

    function iniciarSnake(canvas, onOver, onScore, diffBoost = 1.0) {
        _ctx  = canvas.getContext('2d');
        _sn   = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        _dir  = { x: 1, y: 0 }; _nd = { x: 1, y: 0 };
        _food = _rndFood(); _pts = 0; _spd = Math.max(40, Math.round(150 / diffBoost)); _running = true;
        clearTimeout(_tid);

        function step() {
            if (!_running) return;
            _dir = _nd;
            const hd = { x: _sn[0].x + _dir.x, y: _sn[0].y + _dir.y };
            if (hd.x < 0 || hd.x >= GRID || hd.y < 0 || hd.y >= GRID ||
                _sn.some(s => s.x === hd.x && s.y === hd.y)) {
                _running = false; _draw(); onOver(_pts); return;
            }
            _sn.unshift(hd);
            if (hd.x === _food.x && hd.y === _food.y) {
                _pts += 10; _food = _rndFood(); _spd = Math.max(75, _spd - 2); onScore(_pts);
            } else { _sn.pop(); }
            _draw();
            _tid = setTimeout(step, _spd);
        }

        function onKey(e) {
            const m = { ArrowUp:'u', ArrowDown:'d', ArrowLeft:'l', ArrowRight:'r',
                        w:'u', s:'d', a:'l', d:'r', W:'u', S:'d', A:'l', D:'r' };
            const v = m[e.key]; if (!v) return;
            if (v === 'u' && _dir.y !== 1)  _nd = { x: 0, y: -1 };
            if (v === 'd' && _dir.y !== -1) _nd = { x: 0, y:  1 };
            if (v === 'l' && _dir.x !== 1)  _nd = { x: -1, y: 0 };
            if (v === 'r' && _dir.x !== -1) _nd = { x: 1,  y: 0 };
            e.preventDefault();
        }
        document.addEventListener('keydown', onKey);
        canvas._kclean = () => document.removeEventListener('keydown', onKey);

        let tx = 0, ty = 0;
        canvas.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; e.preventDefault(); }, { passive: false });
        canvas.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0 && _dir.x !== -1) _nd = { x: 1, y: 0 };
                if (dx < 0 && _dir.x !==  1) _nd = { x: -1, y: 0 };
            } else {
                if (dy > 0 && _dir.y !== -1) _nd = { x: 0, y: 1 };
                if (dy < 0 && _dir.y !==  1) _nd = { x: 0, y: -1 };
            }
            e.preventDefault();
        }, { passive: false });
        step();
    }

    /* ═══════════════════════════════
       MOTOR TETRIS
    ═══════════════════════════════ */
    const T_COLS = 10, T_ROWS = 20, T_CELL = 24;
    const T_W = T_COLS * T_CELL, T_H = T_ROWS * T_CELL;
    const T_PIEZAS = [
        { s: [[1,1,1,1]],           c: '#00E5FF' },
        { s: [[1,1],[1,1]],         c: '#FFD740' },
        { s: [[0,1,0],[1,1,1]],     c: '#CE93D8' },
        { s: [[0,1,1],[1,1,0]],     c: '#69F0AE' },
        { s: [[1,1,0],[0,1,1]],     c: '#EF5350' },
        { s: [[1,0,0],[1,1,1]],     c: '#448AFF' },
        { s: [[0,0,1],[1,1,1]],     c: '#FFA726' },
    ];

    function iniciarTetris(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        let board, pieza, sig, px, py, pts, lineas, nivel, _tid, running;

        function nuevaPieza() {
            const d = T_PIEZAS[Math.floor(Math.random() * T_PIEZAS.length)];
            return { s: d.s.map(r => [...r]), c: d.c };
        }

        function rotar(s) {
            const rows = s.length, cols = s[0].length;
            const r = Array.from({ length: cols }, () => Array(rows).fill(0));
            for (let i = 0; i < rows; i++)
                for (let j = 0; j < cols; j++) r[j][rows - 1 - i] = s[i][j];
            return r;
        }

        function colisiona(s, ox, oy) {
            for (let r = 0; r < s.length; r++)
                for (let c = 0; c < s[r].length; c++)
                    if (s[r][c]) {
                        const nx = ox + c, ny = oy + r;
                        if (nx < 0 || nx >= T_COLS || ny >= T_ROWS) return true;
                        if (ny >= 0 && board[ny][nx]) return true;
                    }
            return false;
        }

        function fijar() {
            for (let r = 0; r < pieza.s.length; r++)
                for (let c = 0; c < pieza.s[r].length; c++)
                    if (pieza.s[r][c]) {
                        if (py + r < 0) { running = false; clearTimeout(_tid); onOver(pts); return; }
                        board[py + r][px + c] = pieza.c;
                    }
            let limpias = 0;
            for (let r = T_ROWS - 1; r >= 0; r--) {
                if (board[r].every(c => c)) {
                    board.splice(r, 1);
                    board.unshift(Array(T_COLS).fill(0));
                    limpias++; r++;
                }
            }
            if (limpias > 0) {
                pts += ([0, 100, 300, 500, 800][limpias] || 800) * (nivel + 1);
                lineas += limpias; nivel = Math.floor(lineas / 10); onScore(pts);
            }
            pieza = sig; sig = nuevaPieza();
            px = Math.floor(T_COLS / 2) - Math.floor(pieza.s[0].length / 2);
            py = 0;
            if (colisiona(pieza.s, px, py)) { running = false; clearTimeout(_tid); onOver(pts); return; }
        }

        function dibujar() {
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, T_W, T_H);
            ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = .5;
            for (let c = 0; c <= T_COLS; c++) { ctx.beginPath(); ctx.moveTo(c*T_CELL,0); ctx.lineTo(c*T_CELL,T_H); ctx.stroke(); }
            for (let r = 0; r <= T_ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*T_CELL); ctx.lineTo(T_W,r*T_CELL); ctx.stroke(); }
            for (let r = 0; r < T_ROWS; r++)
                for (let c = 0; c < T_COLS; c++)
                    if (board[r][c]) { ctx.fillStyle = board[r][c]; ctx.fillRect(c*T_CELL+1, r*T_CELL+1, T_CELL-2, T_CELL-2); }
            if (pieza) {
                ctx.fillStyle = pieza.c;
                // Ghost piece
                let gy = py;
                while (!colisiona(pieza.s, px, gy + 1)) gy++;
                ctx.globalAlpha = .2;
                for (let r = 0; r < pieza.s.length; r++)
                    for (let c = 0; c < pieza.s[r].length; c++)
                        if (pieza.s[r][c]) ctx.fillRect((px+c)*T_CELL+1, (gy+r)*T_CELL+1, T_CELL-2, T_CELL-2);
                ctx.globalAlpha = 1;
                for (let r = 0; r < pieza.s.length; r++)
                    for (let c = 0; c < pieza.s[r].length; c++)
                        if (pieza.s[r][c]) ctx.fillRect((px+c)*T_CELL+1, (py+r)*T_CELL+1, T_CELL-2, T_CELL-2);
            }
        }

        function intervaloMs() {
            // Velocidad base según puntos acumulados
            let base = 500;
            if      (pts >= 10000) base = 250;   // 2x
            else if (pts >= 5000)  base = 333;   // 1.5x
            else if (pts >= 2500)  base = 400;   // 1.25x
            // Cada millón suma dificultad extra
            const millones = Math.floor(pts / 1000000);
            if (millones > 0) base = Math.max(50, Math.floor(base / (1 + millones * 0.5)));
            // Factor por nivel (líneas despejadas) + diffBoost adaptativo
            return Math.max(50, Math.floor((base - nivel * 20) / diffBoost));
        }

        function step() {
            if (!running) return;
            if (colisiona(pieza.s, px, py + 1)) fijar();
            else py++;
            dibujar();
            if (running) _tid = setTimeout(step, intervaloMs());
        }

        function iniciar() {
            board = Array.from({ length: T_ROWS }, () => Array(T_COLS).fill(0));
            pts = 0; lineas = 0; nivel = 0; running = true;
            pieza = nuevaPieza(); sig = nuevaPieza();
            px = Math.floor(T_COLS / 2) - Math.floor(pieza.s[0].length / 2);
            py = 0; clearTimeout(_tid); step();
        }

        function onKey(e) {
            if (!running) return;
            if (e.key === 'ArrowLeft')  { if (!colisiona(pieza.s, px-1, py)) { px--; dibujar(); } }
            if (e.key === 'ArrowRight') { if (!colisiona(pieza.s, px+1, py)) { px++; dibujar(); } }
            if (e.key === 'ArrowDown')  { if (!colisiona(pieza.s, px, py+1)) { py++; } else fijar(); dibujar(); }
            if (e.key === 'ArrowUp') {
                const nr = rotar(pieza.s);
                if (!colisiona(nr, px, py)) { pieza.s = nr; dibujar(); }
            }
            if (e.key === ' ') {
                while (!colisiona(pieza.s, px, py + 1)) py++;
                fijar(); dibujar();
            }
            e.preventDefault();
        }
        document.addEventListener('keydown', onKey);
        canvas._tclean = () => { document.removeEventListener('keydown', onKey); clearTimeout(_tid); };

        // Touch swipe + tap-rotate
        let _tx = 0, _ty = 0;
        canvas.addEventListener('touchstart', e => { _tx = e.touches[0].clientX; _ty = e.touches[0].clientY; e.preventDefault(); }, { passive: false });
        canvas.addEventListener('touchend', e => {
            if (!running) return;
            const dx = e.changedTouches[0].clientX - _tx;
            const dy = e.changedTouches[0].clientY - _ty;
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
                const nr = rotar(pieza.s);
                if (!colisiona(nr, px, py)) { pieza.s = nr; dibujar(); }
                return;
            }
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0 && !colisiona(pieza.s, px+1, py)) { px++; dibujar(); }
                if (dx < 0 && !colisiona(pieza.s, px-1, py)) { px--; dibujar(); }
            } else if (dy > 0) {
                while (!colisiona(pieza.s, px, py + 1)) py++;
                fijar(); dibujar();
            }
            e.preventDefault();
        }, { passive: false });

        iniciar();
    }

    /* ═══════════════════════════════
       MOTOR PAC-MAN
    ═══════════════════════════════ */
    const PM_CELL = 18;
    // Maze: # wall  . dot  o power  ' ' tunnel/empty  G ghost-house  P player-start
    const PM_MAZE_SRC = [
        '#####################',
        '#.........#.........#',
        '#.##.####.#.####.##.#',
        '#o##.####.#.####.##o#',
        '#.##.####.#.####.##.#',
        '#...................#',
        '#.##.#.#####.#.##.#.#',
        '#....#.......#....#.#',
        '######.##D##.######.#',
        '     #.#GGG#.#      .',
        '######.#GGG#.######  ',
        '.......#GGG#.........',
        '######.#####.######  ',
        '     #.......#      .',
        '######.#####.######  ',
        '#.........#.........#',
        '#.##.####.#.####.##.#',
        '#o..#.....P.....#..o#',
        '###.#.#.#####.#.#.###',
        '#....#.......#....#.#',
        '#.######.#.######...#',
        '#...................#',
        '#####################',
    ];
    const PM_ROWS = PM_MAZE_SRC.length;
    const PM_COLS = PM_MAZE_SRC[0].length;
    const PM_W = PM_COLS * PM_CELL, PM_H = PM_ROWS * PM_CELL;

    function iniciarPacman(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        let maze, dots, powers, pacX, pacY, pacDx, pacDy, ndx, ndy;
        let ghosts, score, lives, frightenTick, frightDur, gameOver, won, _tid, running;

        function parseMaze() {
            maze = []; dots = []; powers = [];
            let px = 10, py = 18;
            for (let r = 0; r < PM_ROWS; r++) {
                maze[r] = [];
                for (let c = 0; c < PM_COLS; c++) {
                    const ch = PM_MAZE_SRC[r][c] || ' ';
                    maze[r][c] = ch;
                    if (ch === '.') dots.push({ r, c, eaten: false });
                    if (ch === 'o') powers.push({ r, c, eaten: false });
                    if (ch === 'P') { px = c; py = r; }
                }
            }
            return { px, py };
        }

        function isWall(c, r) {
            if (r < 0 || r >= PM_ROWS || c < 0 || c >= PM_COLS) return true;
            const ch = maze[r]?.[c];
            return ch === '#';
        }

        function canMove(c, r) {
            if (c < 0 || c >= PM_COLS || r < 0 || r >= PM_ROWS) return false;
            const ch = maze[r]?.[c];
            return ch !== '#' && ch !== 'D'; // Pac-Man blocked by door
        }

        function canMoveGhost(c, r) {
            if (c < 0 || c >= PM_COLS || r < 0 || r >= PM_ROWS) return false;
            return maze[r]?.[c] !== '#'; // ghosts pass through D
        }

        function initGhosts() {
            // Ghost house interior: cols 8-10, rows 9-11 (G cells). Exit door: col 9 row 8 (D)
            ghosts = [
                { c: 9,  r: 10, dx: 0, dy: -1, color: '#FF0000', mode: 'exit', delay: 0,   tick: 0 }, // Blinky
                { c: 8,  r: 10, dx: -1,dy: 0,  color: '#FFB8FF', mode: 'exit', delay: 50,  tick: 0 }, // Pinky
                { c: 10, r: 10, dx: 1, dy: 0,  color: '#00FFFF', mode: 'exit', delay: 100, tick: 0 }, // Inky
                { c: 9,  r: 11, dx: 0, dy: -1, color: '#FFB852', mode: 'exit', delay: 150, tick: 0 }, // Clyde
            ];
        }

        function moveGhost(g) {
            g.tick++;
            if (g.mode === 'exit') {
                if (g.tick < g.delay) return;
                const exitCol = 9;
                if (g.c < exitCol && canMoveGhost(g.c + 1, g.r)) { g.c++; return; }
                if (g.c > exitCol && canMoveGhost(g.c - 1, g.r)) { g.c--; return; }
                if (canMoveGhost(g.c, g.r - 1)) { g.r--; }
                if (g.r <= 6) { g.mode = 'chase'; g.dx = 1; g.dy = 0; }
                return;
            }
            const frightened = frightenTick > 0;
            // Possible directions
            const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
            const opts = dirs.filter(d => {
                if (d.dx === -g.dx && d.dy === -g.dy) return false; // no reverse
                return canMoveGhost(g.c + d.dx, g.r + d.dy);
            });
            if (!opts.length) { g.dx = -g.dx; g.dy = -g.dy; return; }
            const randThresh = Math.max(0.05, 0.3 / diffBoost);
            if (frightened || Math.random() < randThresh) {
                const pick = opts[Math.floor(Math.random() * opts.length)];
                g.dx = pick.dx; g.dy = pick.dy;
            } else {
                // Chase Pacman
                const best = opts.reduce((a, b) => {
                    const da = Math.hypot(g.c+a.dx-pacX, g.r+a.dy-pacY);
                    const db = Math.hypot(g.c+b.dx-pacX, g.r+b.dy-pacY);
                    return da < db ? a : b;
                });
                g.dx = best.dx; g.dy = best.dy;
            }
            const nc = g.c + g.dx, nr = g.r + g.dy;
            if (canMoveGhost(nc, nr)) { g.c = nc; g.r = nr; }
        }

        function step() {
            if (!running) return;
            // Move pac
            if (canMove(pacX + ndx, pacY + ndy)) { pacDx = ndx; pacDy = ndy; }
            const nx = pacX + pacDx, ny = pacY + pacDy;
            // Tunnel wrap
            const wnx = (nx + PM_COLS) % PM_COLS;
            if (canMove(wnx, ny)) { pacX = wnx; pacY = ny; }

            // Eat dots
            dots.forEach(d => { if (!d.eaten && d.c === pacX && d.r === pacY) { d.eaten = true; score += 10; onScore(score); } });
            powers.forEach(p => { if (!p.eaten && p.c === pacX && p.r === pacY) { p.eaten = true; score += 50; frightenTick = frightDur; onScore(score); } });

            if (frightenTick > 0) frightenTick--;

            // Move ghosts (always move exiting ghosts; random for chase)
            ghosts.forEach(g => { if (g.mode === 'exit' || Math.random() < 0.5) moveGhost(g); });

            // Ghost collision
            ghosts.forEach(g => {
                if (g.c === pacX && g.r === pacY) {
                    if (frightenTick > 0) { score += 200; g.c = 10; g.r = 11; onScore(score); }
                    else { lives--; if (lives <= 0) { running = false; clearTimeout(_tid); onOver(score); return; } pacX = 10; pacY = 18; }
                }
            });

            // Win
            if (dots.every(d => d.eaten) && powers.every(p => p.eaten)) { running = false; clearTimeout(_tid); won = true; onOver(score); return; }

            draw();
            if (running) _tid = setTimeout(step, Math.max(60, Math.floor(120 / diffBoost)));
        }

        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PM_W, PM_H);
            for (let r = 0; r < PM_ROWS; r++) {
                for (let c = 0; c < PM_COLS; c++) {
                    const ch = maze[r][c];
                    const x = c * PM_CELL, y = r * PM_CELL;
                    if (ch === '#') {
                        ctx.fillStyle = '#1a1aff';
                        ctx.fillRect(x+1, y+1, PM_CELL-2, PM_CELL-2);
                        ctx.strokeStyle = '#3333ff'; ctx.lineWidth = 1;
                        ctx.strokeRect(x+1, y+1, PM_CELL-2, PM_CELL-2);
                    }
                }
            }
            // Dots
            ctx.fillStyle = '#fff';
            dots.forEach(d => { if (!d.eaten) { ctx.beginPath(); ctx.arc(d.c*PM_CELL+PM_CELL/2, d.r*PM_CELL+PM_CELL/2, 2, 0, Math.PI*2); ctx.fill(); } });
            // Powers
            ctx.fillStyle = '#FFD54A';
            powers.forEach(p => { if (!p.eaten) { ctx.beginPath(); ctx.arc(p.c*PM_CELL+PM_CELL/2, p.r*PM_CELL+PM_CELL/2, 5, 0, Math.PI*2); ctx.fill(); } });
            // Ghosts
            ghosts.forEach(g => {
                const frightened = frightenTick > 0;
                ctx.fillStyle = frightened ? (frightenTick < 60 && Math.floor(Date.now()/300)%2 ? '#fff' : '#0000ff') : g.color;
                const gx = g.c * PM_CELL + PM_CELL/2, gy = g.r * PM_CELL + PM_CELL/2;
                ctx.beginPath();
                ctx.arc(gx, gy - 2, PM_CELL/2 - 2, Math.PI, 0);
                ctx.lineTo(gx + PM_CELL/2 - 2, gy + PM_CELL/2);
                for (let i = 0; i < 3; i++) {
                    ctx.quadraticCurveTo(gx + PM_CELL/2 - 2 - (i+1)*((PM_CELL-4)/3) + (PM_CELL-4)/6, gy + PM_CELL/4, gx + PM_CELL/2 - 2 - (i+1)*((PM_CELL-4)/3), gy + PM_CELL/2);
                }
                ctx.closePath(); ctx.fill();
                if (!frightened) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx-3, gy-4, 3, 0, Math.PI*2); ctx.arc(gx+3, gy-4, 3, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(gx-3+g.dx, gy-4+g.dy, 1.5, 0, Math.PI*2); ctx.arc(gx+3+g.dx, gy-4+g.dy, 1.5, 0, Math.PI*2); ctx.fill(); }
            });
            // Pac-Man
            const angle = (Date.now() / 100) % (Math.PI * 2);
            const mouth = 0.2 + 0.2 * Math.abs(Math.sin(angle));
            const pxc = pacX * PM_CELL + PM_CELL/2, pyc = pacY * PM_CELL + PM_CELL/2;
            const dir = Math.atan2(pacDy, pacDx);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(pxc, pyc);
            ctx.arc(pxc, pyc, PM_CELL/2 - 1, dir + mouth, dir + Math.PI * 2 - mouth);
            ctx.closePath(); ctx.fill();
            // HUD
            ctx.fillStyle = '#FFD54A'; ctx.font = '12px Michroma,monospace';
            ctx.fillText('♥'.repeat(lives), 4, 14);
            ctx.fillText('PTS: ' + score, PM_W - 90, 14);
        }

        function iniciar() {
            const { px, py } = parseMaze();
            pacX = px; pacY = py; pacDx = 0; pacDy = 0; ndx = 0; ndy = -1;
            score = 0; lives = 3; frightenTick = 0; frightDur = 150; running = true; won = false;
            initGhosts();
            clearTimeout(_tid);
            step();
        }

        function onKey(e) {
            if (!running) return;
            if (e.key === 'ArrowLeft')  { ndx = -1; ndy = 0; }
            if (e.key === 'ArrowRight') { ndx =  1; ndy = 0; }
            if (e.key === 'ArrowUp')    { ndx = 0; ndy = -1; }
            if (e.key === 'ArrowDown')  { ndx = 0; ndy =  1; }
        }
        document.addEventListener('keydown', onKey);
        const _clean = () => { running = false; clearTimeout(_tid); document.removeEventListener('keydown', onKey); };
        canvas._pmclean = _clean;
        iniciar();
        return { stop: _clean };
    }

    /* ═══════════════════════════════
       MOTOR BREAKOUT
    ═══════════════════════════════ */
    const BK_W = 360, BK_H = 480;
    const BK_COLS = 10, BK_ROWS = 7;
    const BK_BW = BK_W / BK_COLS, BK_BH = 18;

    function iniciarBreakout(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        const PAD_W = 70, PAD_H = 10, BALL_R = 7;
        let padX, ballX, ballY, bvx, bvy, bricks, score, lives, level, _tid, running;
        const COLORS = ['#FF4444','#FF8C00','#FFD700','#88DD00','#00CCFF','#AA66FF','#FF66AA'];

        function initBricks() {
            bricks = [];
            for (let r = 0; r < BK_ROWS; r++)
                for (let c = 0; c < BK_COLS; c++)
                    bricks.push({ r, c, alive: true, pts: (BK_ROWS - r) * 10 });
        }

        function levelSpd() { return 5 * (1 + Math.floor(level / 2) * 0.1) * diffBoost; }

        function step() {
            if (!running) return;
            ballX += bvx; ballY += bvy;
            // Walls
            if (ballX - BALL_R < 0) { ballX = BALL_R; bvx = -bvx; }
            if (ballX + BALL_R > BK_W) { ballX = BK_W - BALL_R; bvx = -bvx; }
            if (ballY - BALL_R < 0) { ballY = BALL_R; bvy = -bvy; }
            // Paddle
            const padY = BK_H - 40;
            if (ballY + BALL_R >= padY && ballY + BALL_R <= padY + PAD_H + Math.abs(bvy) &&
                ballX >= padX - PAD_W/2 && ballX <= padX + PAD_W/2) {
                bvy = -Math.abs(bvy);
                bvx += (ballX - padX) / (PAD_W/2) * 2; // spin
            }
            // Brick collision
            bricks.forEach(b => {
                if (!b.alive) return;
                const bx = b.c * BK_BW, by = 50 + b.r * (BK_BH + 4);
                if (ballX+BALL_R > bx && ballX-BALL_R < bx+BK_BW && ballY+BALL_R > by && ballY-BALL_R < by+BK_BH) {
                    b.alive = false; score += b.pts; onScore(score);
                    // Bounce
                    const cx = bx + BK_BW/2, cy = by + BK_BH/2;
                    if (Math.abs(ballX - cx) > Math.abs(ballY - cy)) bvx = -bvx; else bvy = -bvy;
                }
            });
            // Speed cap
            const maxSpd = Math.max(9, levelSpd() * 1.5);
            const minSpd = Math.max(4, levelSpd() * 0.8);
            const spd = Math.hypot(bvx, bvy);
            if (spd > maxSpd) { bvx = bvx/spd*maxSpd; bvy = bvy/spd*maxSpd; }
            if (spd < minSpd) { bvx = bvx/spd*minSpd; bvy = bvy/spd*minSpd; }
            // Fall
            if (ballY - BALL_R > BK_H) { lives--; if (lives <= 0) { running = false; clearTimeout(_tid); onOver(score); return; } resetBall(); }
            // Win / next level
            if (bricks.every(b => !b.alive)) { level++; initBricks(); resetBall(); onScore(score); return; }
            draw();
            if (running) _tid = setTimeout(step, 14);
        }

        function resetBall() {
            const spd = levelSpd();
            ballX = padX; ballY = BK_H - 70;
            bvx = (Math.random() - 0.5) * 4 * (spd / 5); bvy = -spd;
        }

        function draw() {
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, BK_W, BK_H);
            bricks.forEach(b => {
                if (!b.alive) return;
                const bx = b.c * BK_BW + 2, by = 50 + b.r * (BK_BH + 4);
                ctx.fillStyle = COLORS[b.r % COLORS.length];
                ctx.fillRect(bx, by, BK_BW - 4, BK_BH);
            });
            // Paddle
            ctx.fillStyle = '#D8C395';
            ctx.beginPath(); ctx.roundRect(padX - PAD_W/2, BK_H - 40, PAD_W, PAD_H, 5); ctx.fill();
            // Ball
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(ballX, ballY, BALL_R, 0, Math.PI*2); ctx.fill();
            // HUD
            ctx.fillStyle = '#FFD54A'; ctx.font = '12px Michroma,monospace';
            ctx.fillText('♥'.repeat(lives), 6, 20);
            ctx.fillText('NV:' + (level+1) + '  PTS: ' + score, BK_W - 120, 20);
        }

        function iniciar() {
            padX = BK_W / 2; score = 0; lives = 3; level = 0; running = true;
            initBricks(); resetBall(); clearTimeout(_tid); step();
        }

        let _keys = {};
        function onKey(e) { _keys[e.key] = e.type === 'keydown'; }
        function movePad() { if (_keys['ArrowLeft']) padX = Math.max(PAD_W/2, padX - 6); if (_keys['ArrowRight']) padX = Math.min(BK_W - PAD_W/2, padX + 6); }
        const _origStep = step;
        // Hook pad movement into game loop via mousemove/touch
        canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); padX = Math.max(PAD_W/2, Math.min(BK_W - PAD_W/2, (e.clientX - r.left) * BK_W / r.width)); });
        canvas.addEventListener('touchmove', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); padX = Math.max(PAD_W/2, Math.min(BK_W - PAD_W/2, (e.touches[0].clientX - r.left) * BK_W / r.width)); }, { passive: false });
        document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
        const _clean = () => { running = false; clearTimeout(_tid); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); };
        canvas._bkclean = _clean;
        iniciar();
        return { stop: _clean, movePad };
    }

    /* ═══════════════════════════════
       MOTOR BOMBERMAN
    ═══════════════════════════════ */
    const BM_COLS = 15, BM_ROWS = 13, BM_CELL = 30;
    const BM_W = BM_COLS * BM_CELL, BM_H = BM_ROWS * BM_CELL;

    function iniciarBomberman(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        let grid, player, enemies, bombs, explosions, score, _tid, running;

        // 0=open 1=solid wall 2=soft block
        function initGrid() {
            grid = Array.from({ length: BM_ROWS }, (_, r) =>
                Array.from({ length: BM_COLS }, (_, c) => {
                    if (r % 2 === 0 && c % 2 === 0) return 1; // solid pillar
                    // safe zone around player start
                    if ((r <= 1 && c <= 2) || (r <= 2 && c <= 1)) return 0;
                    return Math.random() < 0.55 ? 2 : 0; // soft block
                })
            );
        }

        function initEnemies() {
            enemies = [
                { c: BM_COLS-2, r: 1,          dx: -1, dy: 0, alive: true, tick: 0 },
                { c: BM_COLS-2, r: BM_ROWS-2,  dx: 0,  dy: -1, alive: true, tick: 0 },
                { c: 1,         r: BM_ROWS-2,  dx: 1,  dy: 0, alive: true, tick: 0 },
            ];
        }

        function isPassable(c, r) {
            if (c < 0 || c >= BM_COLS || r < 0 || r >= BM_ROWS) return false;
            return grid[r][c] === 0;
        }

        function moveEnemy(en) {
            en.tick++;
            const mvInterval = Math.max(3, Math.floor(8 / diffBoost));
            if (en.tick % mvInterval !== 0) return;
            const nc = en.c + en.dx, nr = en.r + en.dy;
            if (!isPassable(nc, nr) || Math.random() < 0.2) {
                const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
                const opts = dirs.filter(d => isPassable(en.c+d.dx, en.r+d.dy));
                if (opts.length) { const p = opts[Math.floor(Math.random()*opts.length)]; en.dx=p.dx; en.dy=p.dy; }
                return;
            }
            en.c = nc; en.r = nr;
        }

        function placeBomb() {
            if (!running) return;
            const { c, r } = player;
            if (bombs.find(b => b.c === c && b.r === r)) return;
            bombs.push({ c, r, timer: 90, exploding: false });
        }

        function explodeBomb(b) {
            b.exploding = true;
            const cells = [{ c: b.c, r: b.r }];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dc,dr]) => {
                for (let i = 1; i <= 2; i++) {
                    const ec = b.c+dc*i, er = b.r+dr*i;
                    if (ec<0||ec>=BM_COLS||er<0||er>=BM_ROWS) break;
                    if (grid[er][ec] === 1) break;
                    cells.push({ c: ec, r: er });
                    if (grid[er][ec] === 2) { grid[er][ec] = 0; score += 5; onScore(score); break; }
                }
            });
            explosions.push({ cells, life: 25 });
            // Kill enemies/player in blast
            enemies.forEach(en => { if (en.alive && cells.find(cl => cl.c===en.c && cl.r===en.r)) { en.alive=false; score+=100; onScore(score); } });
            if (cells.find(cl => cl.c===player.c && cl.r===player.r)) { running=false; clearTimeout(_tid); onOver(score); }
        }

        function step() {
            if (!running) return;
            bombs.forEach(b => {
                b.timer--;
                if (b.timer <= 0 && !b.exploding) explodeBomb(b);
            });
            explosions.forEach(ex => ex.life--);
            bombs     = bombs.filter(b => b.timer > -20);
            explosions= explosions.filter(ex => ex.life > 0);
            enemies.filter(en => en.alive).forEach(moveEnemy);
            // Enemy touches player
            if (enemies.some(en => en.alive && en.c===player.c && en.r===player.r)) { running=false; clearTimeout(_tid); onOver(score); return; }
            // Win
            if (enemies.every(en => !en.alive)) { running=false; clearTimeout(_tid); onOver(score + 500); return; }
            draw();
            if (running) _tid = setTimeout(step, 50);
        }

        function draw() {
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,BM_W,BM_H);
            for (let r=0;r<BM_ROWS;r++) for (let c=0;c<BM_COLS;c++) {
                const x=c*BM_CELL, y=r*BM_CELL;
                if (grid[r][c]===1) { ctx.fillStyle='#444'; ctx.fillRect(x+1,y+1,BM_CELL-2,BM_CELL-2); }
                else if (grid[r][c]===2) { ctx.fillStyle='#8B6914'; ctx.fillRect(x+2,y+2,BM_CELL-4,BM_CELL-4); ctx.strokeStyle='#6B4F10'; ctx.strokeRect(x+2,y+2,BM_CELL-4,BM_CELL-4); }
            }
            bombs.forEach(b => {
                const x=b.c*BM_CELL+BM_CELL/2, y=b.r*BM_CELL+BM_CELL/2;
                const p = 1 - b.timer/90, r2 = 8 + p*4;
                ctx.fillStyle=`rgba(30,30,30,${0.7+p*0.3})`;
                ctx.beginPath(); ctx.arc(x,y,r2,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle='#888'; ctx.lineWidth=2;
                ctx.beginPath(); ctx.arc(x,y,r2,0,Math.PI*2); ctx.stroke();
                // Fuse
                ctx.strokeStyle='#FFD700'; ctx.lineWidth=2;
                ctx.beginPath(); ctx.moveTo(x,y-r2); ctx.bezierCurveTo(x+5,y-r2-8,x+10,y-r2-6,x+8,y-r2-12); ctx.stroke();
            });
            explosions.forEach(ex => {
                ex.cells.forEach(cl => {
                    ctx.fillStyle=`rgba(255,150,0,${ex.life/25})`;
                    ctx.fillRect(cl.c*BM_CELL+1,cl.r*BM_CELL+1,BM_CELL-2,BM_CELL-2);
                    ctx.fillStyle=`rgba(255,255,100,${ex.life/25*0.7})`;
                    ctx.fillRect(cl.c*BM_CELL+6,cl.r*BM_CELL+6,BM_CELL-12,BM_CELL-12);
                });
            });
            enemies.filter(en=>en.alive).forEach(en => {
                const x=en.c*BM_CELL+BM_CELL/2, y=en.r*BM_CELL+BM_CELL/2;
                ctx.fillStyle='#ff4444';
                ctx.beginPath(); ctx.arc(x,y,BM_CELL/2-3,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#fff'; ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText('👾',x,y);
            });
            // Player
            const px=player.c*BM_CELL+BM_CELL/2, py=player.r*BM_CELL+BM_CELL/2;
            ctx.fillStyle='#4dff91';
            ctx.beginPath(); ctx.arc(px,py,BM_CELL/2-3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#fff'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('🙂',px,py);
            // Score + enemies left
            ctx.fillStyle='#FFD54A'; ctx.font='11px Michroma,monospace'; ctx.textAlign='left';
            ctx.fillText('PTS:'+score+'  👾:'+enemies.filter(e=>e.alive).length, 4, 14);
        }

        function iniciar() {
            initGrid(); initEnemies();
            player = { c: 1, r: 1, dx: 0, dy: 0 };
            bombs = []; explosions = []; score = 0; running = true;
            clearTimeout(_tid); step();
        }

        let _moveQ = null, _moveInterval = null;
        function tryMove(dc, dr) {
            const nc = player.c+dc, nr = player.r+dr;
            if (isPassable(nc, nr)) { player.c = nc; player.r = nr; draw(); }
        }
        function onKey(e) {
            if (!running) return;
            if (e.key==='ArrowLeft')  tryMove(-1,0);
            if (e.key==='ArrowRight') tryMove(1,0);
            if (e.key==='ArrowUp')    tryMove(0,-1);
            if (e.key==='ArrowDown')  tryMove(0,1);
            if (e.key===' ') { e.preventDefault(); placeBomb(); }
        }
        document.addEventListener('keydown', onKey);
        const _clean = () => { running=false; clearTimeout(_tid); clearInterval(_moveInterval); document.removeEventListener('keydown', onKey); };
        canvas._bmclean = _clean;
        iniciar();
        return { stop: _clean, placeBomb, tryMove };
    }

    /* ═══════════════════════════════
       MOTOR 3 EN LÍNEA
    ═══════════════════════════════ */
    const TL_SIZE = 270;
    const TL_CELL = TL_SIZE / 3;
    const TL_LINES = [
        [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
        [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
        [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
    ];

    function iniciar3enLinea(canvas, onResult) {
        const ctx = canvas.getContext('2d');
        let board, turno, over, wins = 0, partidas = 0;

        function checkWin(sym) {
            return TL_LINES.find(l => l.every(([r, c]) => board[r][c] === sym)) || null;
        }

        function minimax(b, isMax, depth) {
            if (depth > 8) return 0;
            if (TL_LINES.some(l => l.every(([r,c]) => b[r][c] === 'O'))) return 10 - depth;
            if (TL_LINES.some(l => l.every(([r,c]) => b[r][c] === 'X'))) return depth - 10;
            const empty = [];
            for (let r = 0; r < 3; r++)
                for (let c = 0; c < 3; c++)
                    if (!b[r][c]) empty.push([r, c]);
            if (!empty.length) return 0;
            if (isMax) {
                let best = -Infinity;
                for (const [r, c] of empty) {
                    b[r][c] = 'O';
                    best = Math.max(best, minimax(b, false, depth + 1));
                    b[r][c] = null;
                }
                return best;
            } else {
                let best = Infinity;
                for (const [r, c] of empty) {
                    b[r][c] = 'X';
                    best = Math.min(best, minimax(b, true, depth + 1));
                    b[r][c] = null;
                }
                return best;
            }
        }

        function cpuMove() {
            const empty = [];
            for (let r = 0; r < 3; r++)
                for (let c = 0; c < 3; c++)
                    if (!board[r][c]) empty.push([r, c]);
            if (!empty.length) return;
            // 25% random para que sea beatable
            if (Math.random() < 0.25) {
                const [r, c] = empty[Math.floor(Math.random() * empty.length)];
                board[r][c] = 'O'; return;
            }
            const copy = board.map(row => [...row]);
            let best = -Infinity, bm = empty[0];
            for (const [r, c] of empty) {
                copy[r][c] = 'O';
                const s = minimax(copy, false, 0);
                copy[r][c] = null;
                if (s > best) { best = s; bm = [r, c]; }
            }
            board[bm[0]][bm[1]] = 'O';
        }

        function dibujar(wl) {
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, TL_SIZE, TL_SIZE);
            ctx.strokeStyle = 'rgba(216,195,149,.4)'; ctx.lineWidth = 3;
            for (let i = 1; i < 3; i++) {
                ctx.beginPath(); ctx.moveTo(i*TL_CELL, 12); ctx.lineTo(i*TL_CELL, TL_SIZE-12); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12, i*TL_CELL); ctx.lineTo(TL_SIZE-12, i*TL_CELL); ctx.stroke();
            }
            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                const cx = c*TL_CELL + TL_CELL/2, cy = r*TL_CELL + TL_CELL/2, p = TL_CELL/3.5;
                if (board[r][c] === 'X') {
                    ctx.strokeStyle = '#D8C395'; ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.moveTo(cx-p,cy-p); ctx.lineTo(cx+p,cy+p); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(cx+p,cy-p); ctx.lineTo(cx-p,cy+p); ctx.stroke();
                } else if (board[r][c] === 'O') {
                    ctx.strokeStyle = '#4dff91'; ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.arc(cx, cy, p, 0, Math.PI*2); ctx.stroke();
                }
            }
            if (wl) {
                const [r0,c0] = wl[0], [r2,c2] = wl[2];
                ctx.strokeStyle = '#FFD54A'; ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(c0*TL_CELL + TL_CELL/2, r0*TL_CELL + TL_CELL/2);
                ctx.lineTo(c2*TL_CELL + TL_CELL/2, r2*TL_CELL + TL_CELL/2);
                ctx.stroke();
            }
        }

        function reset() {
            board = Array.from({ length: 3 }, () => Array(3).fill(null));
            turno = 'X'; over = false; dibujar(null);
        }

        canvas.addEventListener('click', e => {
            if (over || turno !== 'X') return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (TL_SIZE / rect.width);
            const y = (e.clientY - rect.top) * (TL_SIZE / rect.height);
            const c = Math.min(2, Math.floor(x / TL_CELL));
            const r = Math.min(2, Math.floor(y / TL_CELL));
            if (board[r][c]) return;
            board[r][c] = 'X';
            const wl = checkWin('X');
            dibujar(wl);
            if (wl)  { over = true; partidas++; wins++; onResult('win', wins, partidas); return; }
            const isFull = board.every(row => row.every(v => v !== null));
            if (isFull) { over = true; partidas++; onResult('tie', wins, partidas); return; }
            turno = 'O';
            setTimeout(() => {
                cpuMove();
                const wlO = checkWin('O');
                dibujar(wlO);
                if (wlO) { over = true; partidas++; onResult('loss', wins, partidas); return; }
                if (board.every(row => row.every(v => v !== null))) { over = true; partidas++; onResult('tie', wins, partidas); return; }
                turno = 'X';
            }, 350);
        });

        reset();
        return { reset, wins: () => wins, partidas: () => partidas };
    }

    /* ═══════════════════════════════
       LEADERBOARD HTML
    ═══════════════════════════════ */
    function lbHTML(entradas) {
        if (!entradas || !entradas.length)
            return `<p style="color:#555;font-style:italic;font-size:.85rem">Aún no hay puntuaciones.</p>`;
        return `<table class="pgj-lb"><thead><tr><th>#</th><th>Jugador</th><th style="text-align:right">Pts</th></tr></thead><tbody>
            ${entradas.slice(0, 20).map((r, i) => {
                const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `<tr><td class="pos">${m}</td><td>${esc(r.nombre)}</td><td class="pts">${r.puntos}</td></tr>`;
            }).join('')}</tbody></table>`;
    }

    /* ═══════════════════════════════
       RENDER GENÉRICO (registro + LB)
    ═══════════════════════════════ */
    function renderBase(cont, cfg, portal, tipo, { titulo, subtitulo, idLabel, canvasHtml, canvasW, canvasH, controles, dpadHtml }, jugador, entradas, renderJuego) {
        cont.innerHTML = `<div class="pgj-caja"${cfg.config && cfg.config.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
            <h2>${titulo}</h2>
            <p class="pgj-sub">${subtitulo}</p>
            <div class="pgj-layout">
                <div>
                    ${jugador
                        ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>${jugador.ig ? ` · ${idLabel}: ${esc(jugador.ig)}` : ''}
                            <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                           <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ Jugar</button>`
                        : `<form id="pgjForm">
                            <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                            <div><label for="pgjId">${idLabel} de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                            <button type="submit" class="pgj-btn">Listo para jugar →</button>
                            <p class="pgj-msg" id="pgjMsgForm"></p>
                           </form>`}
                    <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                    ${lbHTML(entradas)}
                </div>
                <div class="pgj-canvas-col">
                    ${canvasHtml}
                    ${controles ? `<p class="pgj-controles">${controles}</p>` : ''}
                    ${dpadHtml || ''}
                </div>
            </div>
        </div>`;

        document.getElementById('pgjForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const nombre = document.getElementById('pgjNom').value.trim();
            const ig = document.getElementById('pgjId').value.trim();
            const msgEl = document.getElementById('pgjMsgForm');
            if (!nombre) { msgEl.textContent = 'El nombre es requerido.'; return; }
            if (MALAS.test(nombre)) { msgEl.textContent = 'Ese nombre no está permitido.'; return; }
            const clave = 'pg_jug_' + portal + '_' + tipo;
            try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
            jugador = { nombre, ig };
            renderBase(cont, cfg, portal, tipo, { titulo, subtitulo, idLabel, canvasHtml, canvasW, canvasH, controles, dpadHtml }, jugador, entradas, renderJuego);
        });

        document.getElementById('pgjCambiar')?.addEventListener('click', () => {
            _stop();
            const clave = 'pg_jug_' + portal + '_' + tipo;
            try { localStorage.removeItem(clave); } catch (_) {}
            jugador = null;
            renderBase(cont, cfg, portal, tipo, { titulo, subtitulo, idLabel, canvasHtml, canvasW, canvasH, controles, dpadHtml }, jugador, entradas, renderJuego);
        });

        document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
    }

    /* Reloj regresivo en lobbies de juego */
    function relojJuego(deadline) {
        const id = 'pgjClock';
        function tick() {
            const el = document.getElementById(id);
            if (!el) { clearInterval(iv); return; }
            const rem = Math.max(0, Math.floor((new Date(deadline) - Date.now()) / 1000));
            const d = Math.floor(rem / 86400), h = Math.floor((rem % 86400) / 3600),
                  m = Math.floor((rem % 3600) / 60), s = rem % 60;
            el.textContent = d > 0
                ? `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
                : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            el.className = 'pgj-deadline-clock' + (rem < 3600 ? ' urgente' : '');
            if (rem === 0) { clearInterval(iv); location.reload(); }
        }
        tick();
        const iv = setInterval(tick, 1000);
    }

    /* ═══════════════════════════════
       RENDER SNAKE
    ═══════════════════════════════ */
    async function montarSnake(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🐍 Snake');
        const clave = 'pg_jug_' + portal + '_juego';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                <p class="pgj-info" style="margin-bottom:14px">
                    Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b>
                    &nbsp;·&nbsp;
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:32px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </p>
                <div class="pgj-layout">
                    <div>
                        <p class="pgj-score-live" id="pgjScoreLive">PUNTOS: 0</p>
                        <p class="pgj-controles" style="text-align:left;margin-top:16px">Flechas · WASD · Desliza</p>
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCv" width="${W}" height="${W}"></canvas>
                        <p class="pgj-controles">⬆ ⬇ ⬅ ➡ &nbsp;·&nbsp; WASD</p>
                        <div class="pgj-dpad" id="pgjDpad">
                            <div class="pgj-dpad-row"><button data-dir="u">⬆</button></div>
                            <div class="pgj-dpad-row">
                                <button data-dir="l">⬅</button>
                                <button data-dir="d">⬇</button>
                                <button data-dir="r">➡</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { _stop(); if (cv?._kclean) cv._kclean(); inicioSnake(); });
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                const btn = e.target.closest('[data-dir]');
                if (!btn) return;
                const v = btn.dataset.dir;
                if (v === 'u' && _dir.y !== 1)  _nd = { x: 0, y: -1 };
                if (v === 'd' && _dir.y !== -1) _nd = { x: 0, y:  1 };
                if (v === 'l' && _dir.x !== 1)  _nd = { x: -1, y: 0 };
                if (v === 'r' && _dir.x !== -1) _nd = { x: 1,  y: 0 };
                e.preventDefault();
            });
            iniciarSnake(cv,
                async (finalPts) => {
                    if (cv?._kclean) cv._kclean();
                    const el = document.getElementById('pgjScoreLive');
                    if (el) el.textContent = 'PUNTOS: ' + finalPts;
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego', { nombre: jug.nombre, ig: jug.ig || '', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Snake]', e?.message || e); }
                    }
                    inicioSnake('Game over · ' + finalPts + ' puntos');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: ' + pts; },
                diffBoost
            );
        }

        function inicioSnake(msg) {
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Snake clásico — muros = Game Over. Tu puntuación queda en el ranking.</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                                <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjFf">ID de Free Fire</label><input id="pgjFf" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCv" width="${W}" height="${W}" style="opacity:.25"></canvas>
                        <p class="pgj-controles">⬆ ⬇ ⬅ ➡ &nbsp;·&nbsp; WASD &nbsp;·&nbsp; Desliza</p>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle = '#0a0a0a'; cx.fillRect(0, 0, W, W); }
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled = true; b.textContent = '⛔ Cerrado'; } }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjFf').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent = 'El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent = 'Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioSnake();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => {
                _stop(); try { localStorage.removeItem(clave); } catch (_) {} jugador = null; inicioSnake();
            });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioSnake();
    }

    /* ═══════════════════════════════
       RENDER TETRIS
    ═══════════════════════════════ */
    async function montarTetris(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🟦 Tetris');
        const clave = 'pg_jug_' + portal + '_juego_tetris';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 12px;text-align:center;font-size:1.1rem">PUNTOS: 0</p>
                <div class="pgj-tetris-body">
                    <div class="pgj-tetris-side">
                        <p style="font-size:.72rem;color:#888;margin:0 0 10px">⬆ Rotar · ⬇ Bajar<br>Espacio = Drop rápido</p>
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        <div id="pgjLbWrap">${lbHTML(entradas)}</div>
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCv" width="${T_W}" height="${T_H}" style="max-height:min(72vh,460px)"></canvas>
                        <p class="pgj-controles">← → Mover · ↑ Rotar · ↓ Bajar · Espacio = Drop</p>
                    </div>
                </div>
                <div class="pgj-dpad pgj-dpad-tetris" id="pgjDpad">
                    <div class="pgj-dpad-row">
                        <button data-act="rot">🔄<small>ROTAR</small></button>
                    </div>
                    <div class="pgj-dpad-row">
                        <button data-act="lft">⬅</button>
                        <button data-act="dwn">⬇<small>BAJAR</small></button>
                        <button data-act="rgt">➡</button>
                    </div>
                    <div class="pgj-dpad-row">
                        <button data-act="drp">⬇⬇ DROP RÁPIDO ⬇⬇</button>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { if (cv?._tclean) cv._tclean(); inicioTetris(); });
            let _dpadInterval = null;
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                const btn = e.target.closest('[data-act]');
                if (!btn) return;
                e.preventDefault();
                const fireAct = (a) => {
                    if (a === 'lft') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft',  bubbles: true }));
                    if (a === 'rgt') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
                    if (a === 'dwn') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown',  bubbles: true }));
                    if (a === 'rot') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp',    bubbles: true }));
                    if (a === 'drp') document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ',          bubbles: true }));
                };
                const a = btn.dataset.act;
                fireAct(a);
                if (a === 'lft' || a === 'rgt' || a === 'dwn') {
                    clearInterval(_dpadInterval);
                    _dpadInterval = setInterval(() => fireAct(a), 120);
                }
            });
            document.getElementById('pgjDpad')?.addEventListener('pointerup',    () => clearInterval(_dpadInterval));
            document.getElementById('pgjDpad')?.addEventListener('pointerleave', () => clearInterval(_dpadInterval));
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            iniciarTetris(cv,
                async (finalPts) => {
                    if (cv?._tclean) cv._tclean();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_tetris', { nombre: jug.nombre, ig: jug.ig || '', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_tetris');
                            if (cfg2?.entradas) {
                                entradas = cfg2.entradas;
                                const lb = document.getElementById('pgjLbWrap');
                                if (lb) lb.innerHTML = lbHTML(entradas);
                            }
                        } catch (e) { console.error('[PG Tetris]', e?.message || e); }
                    }
                    inicioTetris('Game over · ' + finalPts + ' pts');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: ' + pts; },
                diffBoost
            );
        }

        function inicioTetris(msg) {
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Tetris clásico — completa líneas para sumar puntos. Tu mejor puntaje queda en el ranking.</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                                <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${T_W}" height="${T_H}" style="opacity:.2;max-height:min(82vh,480px)"></canvas>
                        <p class="pgj-controles">← → Mover · ↑ Rotar · Espacio = Drop</p>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle = '#0a0a0a'; cx.fillRect(0, 0, T_W, T_H); }
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled = true; b.textContent = '⛔ Cerrado'; } }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent = 'El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent = 'Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioTetris();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => {
                try { localStorage.removeItem(clave); } catch (_) {} jugador = null; inicioTetris();
            });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioTetris();
    }

    /* ═══════════════════════════════
       RENDER 3 EN LÍNEA
    ═══════════════════════════════ */
    async function montar3enLinea(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '✕○ Tres en Línea');
        const clave = 'pg_jug_' + portal + '_juego_3lineas';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            let motor = null;
            // Victorias previas guardadas en BD para este jugador (acumulado histórico)
            const prevWins = (entradas.find(e => e.nombre.toLowerCase() === jug.nombre.toLowerCase())?.puntos) || 0;
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                <p class="pgj-info" style="margin-bottom:10px">
                    Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b>
                    &nbsp;·&nbsp;
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:32px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </p>
                <div class="pgj-layout">
                    <div>
                        <p class="pgj-score-live" id="pgjWins">VICTORIAS: 0</p>
                        <p class="pgj-3-result" id="pgjResult" style="color:#aaa">Tú: ✕ &nbsp; CPU: ○</p>
                        <button class="pgj-btn pgj-btn-sec" id="pgjSigRonda" style="margin:12px 0;min-height:38px;padding:0 16px;font-size:.75rem" hidden>▶ Siguiente ronda</button>
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        <div id="pgjLbWrap">${lbHTML(entradas)}</div>
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCv" width="${TL_SIZE}" height="${TL_SIZE}" style="cursor:pointer;max-width:min(88vw,${TL_SIZE}px)"></canvas>
                        <p class="pgj-controles">Haz clic para colocar tu pieza</p>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            motor = iniciar3enLinea(cv, async (resultado, sessionWins, partidas) => {
                const totalWins = prevWins + sessionWins; // acumulado histórico + sesión actual
                const wEl = document.getElementById('pgjWins');
                const rEl = document.getElementById('pgjResult');
                const sigBtn = document.getElementById('pgjSigRonda');
                if (wEl) wEl.textContent = 'VICTORIAS: ' + totalWins;
                if (rEl) {
                    if (resultado === 'win') rEl.textContent = '🏆 ¡Ganaste esta ronda!';
                    else if (resultado === 'loss') rEl.textContent = '😔 Ganó la CPU esta vez';
                    else rEl.textContent = '🤝 Empate';
                    rEl.style.color = resultado === 'win' ? '#FFD54A' : resultado === 'loss' ? '#ff6b6b' : '#aaa';
                }
                if (sigBtn) sigBtn.hidden = false;
                if (resultado === 'win' && jug) {
                    try {
                        await P.dinamica.registrar(portal, 'juego_3lineas', { nombre: jug.nombre, ig: jug.ig || '', metadata: { puntos: totalWins } });
                        const cfg2 = await P.dinamica.publico(portal, 'juego_3lineas');
                        if (cfg2?.entradas) {
                            entradas = cfg2.entradas;
                            const lb = document.getElementById('pgjLbWrap');
                            if (lb) lb.innerHTML = lbHTML(entradas);
                        }
                    } catch (e) { console.error('[PG 3enLinea]', e?.message || e); }
                }
            });
            document.getElementById('pgjSalir').addEventListener('click', () => inicio3enLinea());
            document.getElementById('pgjSigRonda')?.addEventListener('click', () => {
                motor.reset();
                const rEl = document.getElementById('pgjResult');
                if (rEl) { rEl.textContent = 'Tú: ✕ &nbsp; CPU: ○'; rEl.style.color = '#aaa'; }
                const sigBtn = document.getElementById('pgjSigRonda');
                if (sigBtn) sigBtn.hidden = true;
            });
        }

        async function inicio3enLinea(msg) {
            try {
                const fresh = await P.dinamica.publico(portal, 'juego_3lineas');
                if (fresh?.entradas) entradas = fresh.entradas;
            } catch (_) {}
            cont.innerHTML = `<div class="pgj-caja"${cfg.config?.fondo ? ` style="background-image:url('${cfg.config.fondo}');background-size:cover;background-blend-mode:overlay"` : ''}>
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Tres en línea vs CPU — gana la mayor cantidad de rondas. ¡El jugador con más victorias gana!</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                                <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p style="color:#4dff91;font-size:.9rem;margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ Jugar</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        <div id="pgjLbWrap">${lbHTML(entradas)}</div>
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${TL_SIZE}" height="${TL_SIZE}" style="opacity:.25;max-width:min(88vw,${TL_SIZE}px)"></canvas>
                        <p class="pgj-controles">Haz clic en el tablero para jugar</p>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle = '#0a0a0a'; cx.fillRect(0, 0, TL_SIZE, TL_SIZE); }
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled = true; b.textContent = '⛔ Cerrado'; } }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent = 'El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent = 'Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicio3enLinea();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => {
                try { localStorage.removeItem(clave); } catch (_) {} jugador = null; inicio3enLinea();
            });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicio3enLinea();
    }

    /* ═══════════════════════════════
       RENDER PAC-MAN
    ═══════════════════════════════ */
    async function montarPacman(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🟡 Pac-Man');
        const clave = 'pg_jug_' + portal + '_juego_pacman';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 8px;text-align:center">PUNTOS: 0</p>
                <div style="display:flex;justify-content:center">
                    <canvas id="pgjCv" width="${PM_W}" height="${PM_H}" style="max-width:100%;max-height:min(68vh,${PM_H}px)"></canvas>
                </div>
                <div class="pgj-dpad" id="pgjDpad" style="margin-top:10px">
                    <div class="pgj-dpad-row"><button data-act="up">⬆</button></div>
                    <div class="pgj-dpad-row">
                        <button data-act="lft">⬅</button>
                        <button data-act="dwn">⬇</button>
                        <button data-act="rgt">➡</button>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { cv?._pmclean?.(); inicioPacman(); });
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            const motor = iniciarPacman(cv,
                async (finalPts) => {
                    cv?._pmclean?.();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_pacman', { nombre: jug.nombre, ig: jug.ig||'', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_pacman');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Pacman]', e?.message||e); }
                    }
                    inicioPacman('Game over · ' + finalPts + ' pts');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: '+pts; },
                diffBoost
            );
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                const a = e.target.closest('[data-act]')?.dataset.act;
                if (a==='lft') document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
                if (a==='rgt') document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
                if (a==='up')  document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
                if (a==='dwn') document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            });
        }

        function inicioPacman(msg) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Pac-Man clásico — come todos los puntos, evita los fantasmas. Power pellets = fantasmas vulnerables.</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                               <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${PM_W}" height="${PM_H}" style="opacity:.2;max-height:min(72vh,${PM_H}px)"></canvas>
                    </div>
                </div>
            </div>`;
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled=true; b.textContent='⛔ Cerrado'; } }
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,PM_W,PM_H); }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent='El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent='Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioPacman();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => { try { localStorage.removeItem(clave); } catch (_) {} jugador=null; inicioPacman(); });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioPacman();
    }

    /* ═══════════════════════════════
       RENDER BREAKOUT
    ═══════════════════════════════ */
    async function montarBreakout(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🧱 Breakout');
        const clave = 'pg_jug_' + portal + '_juego_breakout';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 8px;text-align:center">PUNTOS: 0</p>
                <div style="display:flex;justify-content:center">
                    <canvas id="pgjCv" width="${BK_W}" height="${BK_H}" style="max-width:100%;max-height:min(70vh,${BK_H}px);touch-action:none"></canvas>
                </div>
                <p class="pgj-controles" style="text-align:center">Mouse / Touch = mover paleta · ← → = teclado</p>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { cv?._bkclean?.(); inicioBreakout(); });
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            const motor = iniciarBreakout(cv,
                async (finalPts) => {
                    cv?._bkclean?.();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_breakout', { nombre: jug.nombre, ig: jug.ig||'', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_breakout');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Breakout]', e?.message||e); }
                    }
                    inicioBreakout('Game over · ' + finalPts + ' pts');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: '+pts; },
                diffBoost
            );
        }

        function inicioBreakout(msg) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Breakout — destruye todos los ladrillos. Mouse/touch para mover la paleta.</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                               <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${BK_W}" height="${BK_H}" style="opacity:.2;max-height:min(72vh,${BK_H}px)"></canvas>
                    </div>
                </div>
            </div>`;
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled=true; b.textContent='⛔ Cerrado'; } }
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle='#0a0a0a'; cx.fillRect(0,0,BK_W,BK_H); }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent='El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent='Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioBreakout();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => { try { localStorage.removeItem(clave); } catch (_) {} jugador=null; inicioBreakout(); });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioBreakout();
    }

    /* ═══════════════════════════════
       RENDER BOMBERMAN
    ═══════════════════════════════ */
    async function montarBomberman(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '💣 Bomberman');
        const clave = 'pg_jug_' + portal + '_juego_bomberman';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 8px;text-align:center">PUNTOS: 0</p>
                <div style="display:flex;justify-content:center">
                    <canvas id="pgjCv" width="${BM_W}" height="${BM_H}" style="max-width:100%;max-height:min(68vh,${BM_H}px)"></canvas>
                </div>
                <div class="pgj-dpad" id="pgjDpad" style="margin-top:10px;display:flex !important;flex-direction:column;align-items:center;gap:4px">
                    <div class="pgj-dpad-row"><button data-act="up" style="width:72px;height:72px;font-size:1.6rem">⬆</button></div>
                    <div class="pgj-dpad-row">
                        <button data-act="lft" style="width:72px;height:72px;font-size:1.6rem">⬅</button>
                        <div style="width:72px"></div>
                        <button data-act="rgt" style="width:72px;height:72px;font-size:1.6rem">➡</button>
                    </div>
                    <div class="pgj-dpad-row"><button data-act="dwn" style="width:72px;height:72px;font-size:1.6rem">⬇</button></div>
                    <div style="margin-top:8px">
                        <button data-act="bmb" style="width:220px;height:64px;font-size:1.1rem;background:rgba(255,100,0,.25);border:2px solid rgba(255,100,0,.6);color:#ff8a40;border-radius:8px;font-family:var(--font-display,'Michroma',sans-serif);cursor:pointer;touch-action:manipulation">💣 BOMBA</button>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { cv?._bmclean?.(); inicioBomberman(); });
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            const motor = iniciarBomberman(cv,
                async (finalPts) => {
                    cv?._bmclean?.();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_bomberman', { nombre: jug.nombre, ig: jug.ig||'', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_bomberman');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Bomberman]', e?.message||e); }
                    }
                    inicioBomberman('Game over · ' + finalPts + ' pts');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: '+pts; },
                diffBoost
            );
            let _dpadIv = null;
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                const a = e.target.closest('[data-act]')?.dataset.act;
                if (!a) return; e.preventDefault();
                const fire = act => {
                    if (act==='lft') motor.tryMove(-1,0);
                    if (act==='rgt') motor.tryMove(1,0);
                    if (act==='up')  motor.tryMove(0,-1);
                    if (act==='dwn') motor.tryMove(0,1);
                    if (act==='bmb') motor.placeBomb();
                };
                fire(a);
                if (a !== 'bmb') { clearInterval(_dpadIv); _dpadIv = setInterval(() => fire(a), 180); }
            });
            document.getElementById('pgjDpad')?.addEventListener('pointerup',    () => clearInterval(_dpadIv));
            document.getElementById('pgjDpad')?.addEventListener('pointerleave', () => clearInterval(_dpadIv));
        }

        function inicioBomberman(msg) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Bomberman — coloca bombas para destruir bloques y eliminar a los 3 enemigos. ¡Cuidado con tus propias explosiones!</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                               <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${BM_W}" height="${BM_H}" style="opacity:.2;max-height:min(68vh,${BM_H}px)"></canvas>
                    </div>
                </div>
            </div>`;
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled=true; b.textContent='⛔ Cerrado'; } }
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle='#1a1a1a'; cx.fillRect(0,0,BM_W,BM_H); }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent='El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent='Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioBomberman();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => { try { localStorage.removeItem(clave); } catch (_) {} jugador=null; inicioBomberman(); });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioBomberman();
    }

    /* ─── Dificultad adaptativa basada en ranking ─── */
    function calcDiffBoost(entradas, jugadorNombre) {
        if (!entradas || !entradas.length || !jugadorNombre) return 1.0;
        const myEntry = entradas.find(e => e.nombre === jugadorNombre);
        const myPts = parseInt(myEntry?.metadata?.puntos || myEntry?.puntos || 0);
        const otherPts = entradas
            .filter(e => e.nombre !== jugadorNombre)
            .map(e => parseInt(e.metadata?.puntos || e.puntos || 0))
            .filter(s => s > 0)
            .sort((a, b) => b - a)
            .slice(0, 10);
        if (!otherPts.length || myPts <= 0) return 1.0;
        const avg = otherPts.reduce((a, b) => a + b, 0) / otherPts.length;
        if (avg <= 0) return 1.0;
        const gap = (myPts - avg) / avg;
        if (gap < 0) return Math.max(0.8, 1 + gap * 0.25);
        if (gap < 0.4) return 1.0;
        return Math.min(2.0, 1.1 + (gap - 0.4) * 0.5);
    }

    /* ═══════════════════════════════
       MOTOR SPACE INVADERS
    ═══════════════════════════════ */
    const IV_W = 360, IV_H = 480;
    const IV_ROWS = 5, IV_COLS = 10;

    function iniciarInvaders(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        let invaders, player, bullets, ibullets, score, lives, ivDx, ivTick, shootCooldown, _tid, running;

        function initInvaders() {
            invaders = [];
            for (let r = 0; r < IV_ROWS; r++)
                for (let c = 0; c < IV_COLS; c++)
                    invaders.push({ r, c, x: 30 + c * 30, y: 55 + r * 28, alive: true });
            ivDx = 1; ivTick = 0;
        }

        function step() {
            if (!running) return;
            ivTick++;
            if (shootCooldown > 0) shootCooldown--;

            const alive = invaders.filter(iv => iv.alive);
            if (!alive.length) { running = false; clearTimeout(_tid); onOver(score + 500); return; }

            const ivInterval = Math.max(4, Math.floor((32 - alive.length / 4) / diffBoost));
            if (ivTick % ivInterval === 0) {
                const rightmost = Math.max(...alive.map(iv => iv.x));
                const leftmost  = Math.min(...alive.map(iv => iv.x));
                let drop = false;
                if (rightmost > IV_W - 28 && ivDx > 0) { ivDx = -1; drop = true; }
                if (leftmost  < 10         && ivDx < 0) { ivDx = 1;  drop = true; }
                if (drop) alive.forEach(iv => iv.y += 18);
                else alive.forEach(iv => iv.x += ivDx * 7);
            }

            if (alive.length && Math.random() < 0.015 * diffBoost) {
                const shooter = alive[Math.floor(Math.random() * alive.length)];
                ibullets.push({ x: shooter.x + 14, y: shooter.y + 20 });
            }

            bullets  = bullets.filter(b => b.y > 0);
            bullets.forEach(b => b.y -= 10);
            ibullets = ibullets.filter(b => b.y < IV_H);
            ibullets.forEach(b => b.y += 5 * diffBoost);

            bullets.forEach(b => {
                if (b.y < 0) return;
                invaders.forEach(iv => {
                    if (!iv.alive) return;
                    if (b.x > iv.x && b.x < iv.x + 28 && b.y > iv.y && b.y < iv.y + 22) {
                        iv.alive = false; b.y = -100;
                        score += iv.r < 2 ? 30 : iv.r < 4 ? 20 : 10;
                        onScore(score);
                    }
                });
            });

            ibullets.forEach(b => {
                if (Math.abs(b.x - player.x) < 16 && b.y > IV_H - 44 && b.y < IV_H - 12) {
                    b.y = IV_H + 100; lives--;
                    if (lives <= 0) { running = false; clearTimeout(_tid); onOver(score); return; }
                }
            });

            if (alive.some(iv => iv.y > IV_H - 55)) { running = false; clearTimeout(_tid); onOver(score); return; }

            draw();
            if (running) _tid = setTimeout(step, 16);
        }

        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, IV_W, IV_H);
            ctx.strokeStyle = 'rgba(0,229,255,.06)'; ctx.lineWidth = .5;
            for (let i = 0; i < IV_W; i += 30) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,IV_H); ctx.stroke(); }
            invaders.filter(iv => iv.alive).forEach(iv => {
                const e = iv.r < 2 ? '👾' : iv.r < 4 ? '🛸' : '🤖';
                ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(e, iv.x + 14, iv.y + 11);
            });
            ctx.fillStyle = '#4dff91';
            ctx.beginPath(); ctx.moveTo(player.x, IV_H - 38); ctx.lineTo(player.x - 18, IV_H - 22); ctx.lineTo(player.x + 18, IV_H - 22); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#4dff91'; ctx.fillRect(player.x - 3, IV_H - 44, 6, 8);
            ctx.fillStyle = '#FFD54A';
            bullets.forEach(b => { ctx.fillRect(b.x - 2, b.y - 6, 4, 12); });
            ctx.fillStyle = '#FF4444';
            ibullets.forEach(b => { ctx.fillRect(b.x - 2, b.y - 6, 4, 12); });
            ctx.fillStyle = '#FFD54A'; ctx.font = '12px Michroma,monospace'; ctx.textAlign = 'left';
            ctx.fillText('♥'.repeat(lives) + '  PTS: ' + score, 6, 16);
        }

        function shoot() { if (!running || shootCooldown > 0) return; bullets.push({ x: player.x, y: IV_H - 46 }); shootCooldown = 15; }

        function iniciar() {
            initInvaders(); player = { x: IV_W / 2 };
            bullets = []; ibullets = []; score = 0; lives = 3; shootCooldown = 0; running = true;
            clearTimeout(_tid); step();
        }

        let _keys = {};
        const _moveIv = setInterval(() => {
            if (!running) return;
            if (_keys['ArrowLeft'])  player.x = Math.max(18, player.x - 6);
            if (_keys['ArrowRight']) player.x = Math.min(IV_W - 18, player.x + 6);
        }, 16);
        function onKey(e) {
            _keys[e.key] = e.type === 'keydown';
            if (e.type === 'keydown' && e.key === ' ') { e.preventDefault(); shoot(); }
            if (['ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
        }
        document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
        const _clean = () => { running=false; clearTimeout(_tid); clearInterval(_moveIv); document.removeEventListener('keydown',onKey); document.removeEventListener('keyup',onKey); };
        canvas._ivclean = _clean;
        iniciar();
        return { stop: _clean, shoot, moveLeft: () => { player.x = Math.max(18, player.x - 8); }, moveRight: () => { player.x = Math.min(IV_W-18, player.x + 8); } };
    }

    /* ═══════════════════════════════
       MOTOR FLAPPY BIRD
    ═══════════════════════════════ */
    const FB_W = 320, FB_H = 480;

    function iniciarFlappy(canvas, onOver, onScore, diffBoost = 1.0) {
        const ctx = canvas.getContext('2d');
        let bird, pipes, score, pipeTimer, _tid, running;
        const GRAVITY = 0.38 * Math.min(1.5, diffBoost);
        const FLAP_V  = -7;
        const PIPE_W  = 52;
        const GAP     = Math.max(90, Math.floor(155 / diffBoost));
        const PIPE_SPD = Math.min(5, 2 + diffBoost * 0.5);

        function addPipe() {
            const gapY = 80 + Math.floor(Math.random() * (FB_H - 160 - GAP));
            pipes.push({ x: FB_W + 10, gapY, passed: false });
        }

        function step() {
            if (!running) return;
            bird.vy += GRAVITY;
            bird.y  += bird.vy;
            pipeTimer++;
            if (pipeTimer >= 90) { addPipe(); pipeTimer = 0; }
            pipes.forEach(p => p.x -= PIPE_SPD);
            pipes = pipes.filter(p => p.x > -PIPE_W - 10);
            pipes.forEach(p => {
                if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score++; onScore(score); }
            });
            if (bird.y + 12 >= FB_H - 20 || bird.y - 12 <= 0) { running=false; clearTimeout(_tid); onOver(score); return; }
            for (const p of pipes) {
                if (bird.x + 10 > p.x && bird.x - 10 < p.x + PIPE_W) {
                    if (bird.y - 12 < p.gapY || bird.y + 12 > p.gapY + GAP) { running=false; clearTimeout(_tid); onOver(score); return; }
                }
            }
            draw();
            if (running) _tid = setTimeout(step, 16);
        }

        function draw() {
            ctx.fillStyle = '#0a1a2a'; ctx.fillRect(0, 0, FB_W, FB_H);
            // Stars
            ctx.fillStyle = 'rgba(255,255,255,.35)';
            for (let i = 0; i < 20; i++) { ctx.fillRect((i*53+7)%FB_W, (i*37+11)%280, 2, 2); }
            // Ground
            ctx.fillStyle = '#2a5a1a'; ctx.fillRect(0, FB_H-20, FB_W, 20);
            ctx.fillStyle = '#3a7a2a'; ctx.fillRect(0, FB_H-20, FB_W, 5);
            // Pipes
            ctx.fillStyle = '#228B22';
            pipes.forEach(p => {
                ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
                ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, FB_H - (p.gapY + GAP));
                ctx.fillStyle = '#1a6a1a';
                ctx.fillRect(p.x - 4, p.gapY - 14, PIPE_W + 8, 14);
                ctx.fillRect(p.x - 4, p.gapY + GAP, PIPE_W + 8, 14);
                ctx.fillStyle = '#228B22';
            });
            // Bird
            ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.save(); ctx.translate(bird.x, bird.y);
            ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/6, bird.vy * 0.06)));
            ctx.fillText('🐦', 0, 0); ctx.restore();
            // Score
            ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Michroma,monospace'; ctx.textAlign = 'center';
            ctx.fillText(score, FB_W/2, 32);
        }

        function flap() { if (running) bird.vy = FLAP_V; }

        function iniciar() {
            bird = { x: 80, y: FB_H/2, vy: -3 };
            pipes = []; score = 0; pipeTimer = 60; running = true;
            clearTimeout(_tid); step();
        }

        function onKey(e) { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } }
        document.addEventListener('keydown', onKey);
        canvas.addEventListener('click', flap);
        canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
        const _clean = () => { running=false; clearTimeout(_tid); document.removeEventListener('keydown',onKey); };
        canvas._fbclean = _clean;
        iniciar();
        return { stop: _clean, flap };
    }

    /* ═══════════════════════════════
       RENDER SPACE INVADERS
    ═══════════════════════════════ */
    async function montarInvaders(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🚀 Space Invaders');
        const clave = 'pg_jug_' + portal + '_juego_invaders';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 8px;text-align:center">PUNTOS: 0</p>
                <div style="display:flex;justify-content:center">
                    <canvas id="pgjCv" width="${IV_W}" height="${IV_H}" style="max-width:100%;max-height:min(70vh,${IV_H}px)"></canvas>
                </div>
                <div class="pgj-dpad" id="pgjDpad" style="margin-top:10px;display:flex !important;flex-direction:column;align-items:center;gap:6px">
                    <div class="pgj-dpad-row">
                        <button data-act="lft" style="width:100px;height:72px;font-size:1.6rem">⬅</button>
                        <button data-act="sht" style="width:120px;height:72px;font-size:1rem;background:rgba(77,255,145,.2);border-color:rgba(77,255,145,.6);color:#4dff91;font-family:var(--font-display,'Michroma',sans-serif)">🚀 DISPARAR</button>
                        <button data-act="rgt" style="width:100px;height:72px;font-size:1.6rem">➡</button>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { cv?._ivclean?.(); inicioInvaders(); });
            const motor = iniciarInvaders(cv,
                async (finalPts) => {
                    cv?._ivclean?.();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_invaders', { nombre: jug.nombre, ig: jug.ig||'', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_invaders');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Invaders]', e?.message||e); }
                    }
                    inicioInvaders('Game over · ' + finalPts + ' pts');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: '+pts; },
                diffBoost
            );
            let _dpadIv = null;
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                const a = e.target.closest('[data-act]')?.dataset.act;
                if (!a) return; e.preventDefault();
                if (a === 'sht') { motor.shoot(); return; }
                const move = () => { if (a==='lft') motor.moveLeft(); if (a==='rgt') motor.moveRight(); };
                move(); clearInterval(_dpadIv); _dpadIv = setInterval(move, 60);
            });
            document.getElementById('pgjDpad')?.addEventListener('pointerup',    () => clearInterval(_dpadIv));
            document.getElementById('pgjDpad')?.addEventListener('pointerleave', () => clearInterval(_dpadIv));
        }

        function inicioInvaders(msg) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Space Invaders — dispara a los invasores antes de que lleguen. ¡Filas superiores valen más puntos!</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                               <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${IV_W}" height="${IV_H}" style="opacity:.2;max-height:min(72vh,${IV_H}px)"></canvas>
                    </div>
                </div>
            </div>`;
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled=true; b.textContent='⛔ Cerrado'; } }
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,IV_W,IV_H); }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent='El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent='Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioInvaders();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => { try { localStorage.removeItem(clave); } catch (_) {} jugador=null; inicioInvaders(); });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioInvaders();
    }

    /* ═══════════════════════════════
       RENDER FLAPPY BIRD
    ═══════════════════════════════ */
    async function montarFlappy(portal, cont, cfg) {
        let entradas = cfg.entradas || [];
        const titulo = esc(cfg.titulo || '🐦 Flappy Bird');
        const clave = 'pg_jug_' + portal + '_juego_flappy';
        let jugador = null;
        try { jugador = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (_) {}

        function renderJuego(jug) {
            const diffBoost = calcDiffBoost(entradas, jug.nombre);
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <span class="pgj-info">Jugador: <b style="color:var(--primary,#D8C395)">${esc(jug.nombre)}</b></span>
                    <button class="pgj-btn pgj-btn-sec" id="pgjSalir" style="min-height:30px;padding:2px 12px;font-size:.7rem">✕ Salir</button>
                </div>
                <p class="pgj-score-live" id="pgjScoreLive" style="margin:0 0 8px;text-align:center">PUNTOS: 0</p>
                <div style="display:flex;justify-content:center">
                    <canvas id="pgjCv" width="${FB_W}" height="${FB_H}" style="max-width:100%;max-height:min(70vh,${FB_H}px);cursor:pointer"></canvas>
                </div>
                <p class="pgj-controles" style="text-align:center;margin-top:6px">Toca / Espacio / Click = volar</p>
                <div class="pgj-dpad" id="pgjDpad" style="margin-top:8px">
                    <div class="pgj-dpad-row">
                        <button data-act="flp" style="width:280px;height:72px;font-size:1.2rem">🐦 VOLAR</button>
                    </div>
                </div>
            </div>`;
            const cv = document.getElementById('pgjCv');
            document.getElementById('pgjSalir').addEventListener('click', () => { cv?._fbclean?.(); inicioFlappy(); });
            const motor = iniciarFlappy(cv,
                async (finalPts) => {
                    cv?._fbclean?.();
                    if (finalPts > 0 && jug) {
                        try {
                            await P.dinamica.registrar(portal, 'juego_flappy', { nombre: jug.nombre, ig: jug.ig||'', metadata: { puntos: finalPts } });
                            const cfg2 = await P.dinamica.publico(portal, 'juego_flappy');
                            if (cfg2?.entradas) entradas = cfg2.entradas;
                        } catch (e) { console.error('[PG Flappy]', e?.message||e); }
                    }
                    inicioFlappy('Game over · ' + finalPts + ' tuberías');
                },
                (pts) => { const el = document.getElementById('pgjScoreLive'); if (el) el.textContent = 'PUNTOS: '+pts; },
                diffBoost
            );
            document.getElementById('pgjDpad')?.addEventListener('pointerdown', e => {
                if (e.target.closest('[data-act="flp"]')) { e.preventDefault(); motor.flap(); }
            });
        }

        function inicioFlappy(msg) {
            cont.innerHTML = `<div class="pgj-caja">
                <h2>${titulo}</h2>
                ${cfg.deadline ? `<div class="pgj-deadline"><span class="pgj-deadline-label">Cierra en</span><span class="pgj-deadline-clock" id="pgjClock">…</span></div>` : ''}
                ${cfg.cerrado ? `<div class="pgj-cerrado-msg">⛔ Este juego ya cerró. Gracias por participar.</div>` : ''}
                <p class="pgj-sub">Flappy Bird — toca para volar y esquivar las tuberías. ¡Cuántas más pases, mayor tu puntaje!</p>
                <div class="pgj-layout">
                    <div>
                        ${jugador
                            ? `<p class="pgj-info" style="margin-bottom:12px">Jugando como <b style="color:var(--primary,#D8C395)">${esc(jugador.nombre)}</b>
                               <button class="pgj-btn pgj-btn-sec" id="pgjCambiar" style="min-height:30px;padding:2px 10px;font-size:.65rem;margin-left:8px">Cambiar</button></p>
                               ${msg ? `<p class="pgj-msg" style="margin-bottom:10px">${esc(msg)}</p>` : ''}
                               <button class="pgj-btn" id="pgjJugar" style="margin-bottom:20px;width:100%;max-width:220px">▶ ${msg ? 'Jugar otra vez' : 'Jugar'}</button>`
                            : `<form id="pgjForm">
                                <div><label for="pgjNom">Nombre *</label><input id="pgjNom" required maxlength="40" placeholder="Tu nombre" autocomplete="off"></div>
                                <div><label for="pgjId">ID de Free Fire</label><input id="pgjId" maxlength="40" placeholder="Ej: 123456789" inputmode="numeric"></div>
                                <button type="submit" class="pgj-btn">Listo para jugar →</button>
                                <p class="pgj-msg" id="pgjMsgForm"></p>
                               </form>`}
                        <h3 style="font:700 .72rem var(--font-display,'Michroma',sans-serif);letter-spacing:.1em;color:var(--primary,#D8C395);text-transform:uppercase;margin:0 0 8px">Top 20</h3>
                        ${lbHTML(entradas)}
                    </div>
                    <div class="pgj-canvas-col">
                        <canvas id="pgjCvPrev" width="${FB_W}" height="${FB_H}" style="opacity:.2;max-height:min(72vh,${FB_H}px)"></canvas>
                    </div>
                </div>
            </div>`;
            if (cfg.deadline && !cfg.cerrado) relojJuego(cfg.deadline);
            if (cfg.cerrado) { const b = document.getElementById('pgjJugar'); if (b) { b.disabled=true; b.textContent='⛔ Cerrado'; } }
            const cv = document.getElementById('pgjCvPrev');
            if (cv) { const cx = cv.getContext('2d'); cx.fillStyle='#0a1a2a'; cx.fillRect(0,0,FB_W,FB_H); }
            document.getElementById('pgjForm')?.addEventListener('submit', e => {
                e.preventDefault();
                const nombre = document.getElementById('pgjNom').value.trim();
                const ig = document.getElementById('pgjId').value.trim();
                const msgEl = document.getElementById('pgjMsgForm');
                if (!nombre) { msgEl.textContent='El nombre es requerido.'; return; }
                if (MALAS.test(nombre)) { msgEl.textContent='Ese nombre no está permitido.'; return; }
                try { localStorage.setItem(clave, JSON.stringify({ nombre, ig })); } catch (_) {}
                jugador = { nombre, ig }; inicioFlappy();
            });
            document.getElementById('pgjCambiar')?.addEventListener('click', () => { try { localStorage.removeItem(clave); } catch (_) {} jugador=null; inicioFlappy(); });
            document.getElementById('pgjJugar')?.addEventListener('click', () => renderJuego(jugador));
        }

        inicioFlappy();
    }

    /* ═══════════════════════════════
       DISPATCHER PRINCIPAL
    ═══════════════════════════════ */
    const TIPOS = [
        { tipo: 'juego',           render: montarSnake     },
        { tipo: 'juego_tetris',    render: montarTetris    },
        { tipo: 'juego_3lineas',   render: montar3enLinea  },
        { tipo: 'juego_pacman',    render: montarPacman    },
        { tipo: 'juego_breakout',  render: montarBreakout  },
        { tipo: 'juego_bomberman', render: montarBomberman },
        { tipo: 'juego_invaders',  render: montarInvaders  },
        { tipo: 'juego_flappy',    render: montarFlappy    },
    ];

    async function montar(portal, destino, tipoForzado) {
        estilos();

        if (tipoForzado) {
            const def = TIPOS.find(t => t.tipo === tipoForzado);
            if (!def) return;
            const cont = contenedor(destino);
            cont.innerHTML = `<div class="pgj-caja" style="text-align:center;padding:40px;color:var(--gray,#B9B2A4)">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.6rem;color:var(--primary,#D8C395);display:block;margin-bottom:14px"></i>Cargando…</div>`;
            try {
                const cfg = await P.dinamica.publico(portal, tipoForzado);
                if (!cfg?.activo) { cont.innerHTML = ''; return; }
                const navJuegos = document.getElementById('navJuegos');
                if (navJuegos) navJuegos.hidden = false;
                def.render(portal, cont, cfg);
            } catch (e) {
                cont.innerHTML = `<div class="pgj-caja pgj-msg" style="padding:30px;text-align:center">⚠️ ${esc(e.message)}</div>`;
            }
            return;
        }

        // Sin tipo forzado: verificar todos los tipos y montar los activos
        const cont = contenedor(destino);
        cont.innerHTML = `<div class="pgj-caja" style="text-align:center;padding:40px;color:var(--gray,#B9B2A4)">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.6rem;color:var(--primary,#D8C395);display:block;margin-bottom:14px"></i>Cargando juego…</div>`;

        const activos = [];
        await Promise.all(TIPOS.map(async ({ tipo, render }) => {
            try {
                const cfg = await P.dinamica.publico(portal, tipo);
                if (cfg?.activo) activos.push({ tipo, render, cfg });
            } catch (_) {}
        }));

        if (!activos.length) { cont.innerHTML = ''; return; }

        const navJuegos = document.getElementById('navJuegos');
        if (navJuegos) navJuegos.hidden = false;

        cont.innerHTML = '';
        // Cada juego activo en su propio sub-contenedor
        for (const { tipo, render, cfg } of activos) {
            const sub = document.createElement('div');
            sub.className = 'pgj';
            cont.appendChild(sub);
            render(portal, sub, cfg);
        }
    }

    function autoMontar() {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', autoMontar); return; }
        if (location.pathname.includes('/admin/')) return;
        if (!window.PumasPortal?.PORTALES) return;
        if (!document.getElementById('pgJuego')) return;
        const seg = location.pathname.split('/').filter(Boolean)[0];
        const scriptPortal = document.querySelector('script[data-portal]');
        const portal = (seg && window.PumasPortal.PORTALES[seg]) ? seg
                     : (scriptPortal?.dataset.portal) || null;
        if (!portal || !window.PumasPortal.PORTALES[portal]) return;
        montar(portal, 'pgJuego');
    }
    autoMontar();

    /* Modo admin: carga el juego aunque esté inactivo en BD */
    async function montarAdmin(portal, destino, tipo) {
        estilos();
        const def = TIPOS.find(t => t.tipo === tipo);
        if (!def) { console.warn('[PG Admin] tipo desconocido:', tipo); return; }
        const cont = contenedor(destino);
        cont.innerHTML = `<div class="pgj-caja" style="text-align:center;padding:40px;color:var(--gray,#B9B2A4)">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.6rem;color:var(--primary,#D8C395);display:block;margin-bottom:14px"></i>Cargando (modo admin)…</div>`;
        let cfg = { activo: true, titulo: tipo, entradas: [], cerrado: false };
        try {
            const remote = await P.dinamica.publico(portal, tipo);
            if (remote) cfg = { activo: true, titulo: remote.titulo || tipo, entradas: remote.entradas || [], cerrado: remote.cerrado || false, deadline: remote.deadline, config: remote.config };
        } catch (_) {}
        def.render(portal, cont, cfg);
    }

    window.PumasPortal = window.PumasPortal || {};
    window.PumasPortal.juegos = { montar, montarAdmin };
})();
