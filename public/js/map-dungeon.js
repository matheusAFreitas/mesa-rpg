const DungeonMap = {
  canvas: null, ctx: null,
  activeDungeon: null,
  activeTile: 'floor',
  activeToken: null,
  painting: false,
  pan: { x: 0, y: 0 }, zoom: 1,
  panning: false, panStart: null,
  _raf: null, _dirty: true,

  TILES: {
    empty:      { color: '#0d0d0d', label: '',  name: 'Vazio' },
    floor:      { color: '#1c1a10', label: '·', name: 'Chão' },
    wall:       { color: '#3a3a3a', label: '',  name: 'Parede' },
    door:       { color: '#6b3a1f', label: 'D', name: 'Porta' },
    stairs_up:  { color: '#1f3a1f', label: '▲', name: 'Escada ↑' },
    stairs_down:{ color: '#1f1f3a', label: '▼', name: 'Escada ↓' },
    water:      { color: '#0a1525', label: '≈', name: 'Água' },
    trap:       { color: '#2a0808', label: '✦', name: 'Armadilha' },
    treasure:   { color: '#252000', label: '★', name: 'Tesouro' },
  },

  init() {
    this.canvas = document.getElementById('dg-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.bindEvents();
    this.buildTilePalette();
    this.renderDungeonList();
    this.updateHint();
    this.startLoop();
  },

  startLoop() {
    const loop = () => {
      if (this._dirty && this.activeDungeon) { this.draw(); this._dirty = false; }
      this._raf = requestAnimationFrame(loop);
    };
    if (this._raf) cancelAnimationFrame(this._raf);
    loop();
  },

  // ---- Build palette ----
  buildTilePalette() {
    const el = document.getElementById('tile-palette');
    if (el.dataset.built) return;
    el.dataset.built = '1';
    Object.entries(this.TILES).forEach(([key, t]) => {
      const b = document.createElement('div');
      b.className = 'tile-btn' + (key === this.activeTile ? ' active' : '');
      b.dataset.tile = key;
      b.innerHTML = `<div class="tile-swatch" style="background:${t.color};border:1px solid #444"></div><span>${t.name}</span>`;
      b.onclick = () => {
        document.querySelectorAll('.tile-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.activeTile = key;
        this.activeToken = null;
        document.querySelectorAll('.token-btn').forEach(x => x.classList.remove('active'));
      };
      el.appendChild(b);
    });
  },

  buildTokenList() {
    const el = document.getElementById('token-list');
    el.innerHTML = '';

    const tokens = [];
    App.db.pj.forEach(p => tokens.push({ id:'pj-'+p.id, name:p.name, color:'#2255aa', symbol: p.name[0].toUpperCase() }));
    App.db.npc.forEach(p => tokens.push({ id:'npc-'+p.id, name:p.name, color:'#aa8800', symbol: p.name[0].toUpperCase() }));
    App.db.creature.forEach(p => tokens.push({ id:'cr-'+p.id, name:p.name, color:'#aa2222', symbol: p.name[0].toUpperCase() }));
    tokens.push({ id:'custom', name:'Token Avulso', color:'#888', symbol:'?' });

    tokens.forEach(t => {
      const b = document.createElement('div');
      b.className = 'token-btn';
      b.dataset.tid = t.id;
      b.innerHTML = `<div class="token-circle" style="background:${t.color}">${t.symbol}</div><span>${t.name}</span>`;
      b.onclick = () => {
        document.querySelectorAll('.token-btn').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tile-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.activeToken = t;
        this.activeTile = null;
      };
      el.appendChild(b);
    });
  },

  // ---- Dungeon list ----
  renderDungeonList() {
    const el = document.getElementById('dungeon-list');
    if (!App.db.dungeons.length) {
      el.innerHTML = `<p style="font-size:11px;color:var(--text2)">Nenhuma dungeon.</p>`;
      return;
    }
    el.innerHTML = App.db.dungeons.map(d => `
      <div class="dl-item ${d.id===this.activeDungeon?.id?'active':''}" onclick="DungeonMap.selectDungeon('${d.id}')">
        <span>${d.name}</span>
        <span style="font-size:10px;color:var(--text2)">${d.width}×${d.height}</span>
      </div>`).join('');
  },

  selectDungeon(id) {
    this.activeDungeon = App.db.dungeons.find(d => d.id === id) || null;
    this.pan = { x: 0, y: 0 }; this.zoom = 1;

    const tilePanel    = document.getElementById('tile-panel');
    const tokenPanel   = document.getElementById('token-panel');
    const settingsPanel= document.getElementById('dungeon-settings-panel');
    const hint         = document.getElementById('dg-hint');

    if (this.activeDungeon) {
      tilePanel.style.display    = 'block';
      tokenPanel.style.display   = 'block';
      settingsPanel.style.display= 'block';
      hint.style.display         = 'none';
      document.getElementById('dg-width').value  = this.activeDungeon.width;
      document.getElementById('dg-height').value = this.activeDungeon.height;
      this.buildTokenList();
      this.resizeCanvas();
    } else {
      tilePanel.style.display    = 'none';
      tokenPanel.style.display   = 'none';
      settingsPanel.style.display= 'none';
      hint.style.display         = 'block';
    }
    this.renderDungeonList();
    this._dirty = true;
  },

  resizeCanvas() {
    const wrap = this.canvas.parentElement;
    this.canvas.width  = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
    this._dirty = true;
  },

  // ---- Grid helpers ----
  cellSize() {
    if (!this.activeDungeon) return 20;
    const maxW = (this.canvas.width  - 20) / this.activeDungeon.width;
    const maxH = (this.canvas.height - 20) / this.activeDungeon.height;
    return Math.max(6, Math.floor(Math.min(maxW, maxH) * this.zoom));
  },

  offset(cs) {
    const d = this.activeDungeon;
    return [
      (this.canvas.width  - d.width  * cs) / 2 + this.pan.x,
      (this.canvas.height - d.height * cs) / 2 + this.pan.y
    ];
  },

  screenToCell(sx, sy) {
    const cs = this.cellSize();
    const [ox, oy] = this.offset(cs);
    const d = this.activeDungeon;
    const x = Math.floor((sx - ox) / cs);
    const y = Math.floor((sy - oy) / cs);
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null;
    return { x, y };
  },

  // ---- Draw ----
  draw() {
    const d = this.activeDungeon;
    if (!d) return;
    const cv = this.canvas, ctx = this.ctx;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, cv.width, cv.height);

    const cs = this.cellSize();
    const [ox, oy] = this.offset(cs);

    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const tile = d.grid[y]?.[x] || 'empty';
        const t = this.TILES[tile] || this.TILES.empty;
        const sx = ox + x * cs, sy = oy + y * cs;

        ctx.fillStyle = t.color;
        ctx.fillRect(sx, sy, cs, cs);

        if (tile !== 'empty') {
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx+0.5, sy+0.5, cs-1, cs-1);
        }

        if (t.label && cs > 12) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.font = `${Math.floor(cs * 0.55)}px serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(t.label, sx + cs/2, sy + cs/2);
        }
      }
    }

    // Grid lines (faint, only when cells are big enough)
    if (cs > 10) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= d.width;  x++) { ctx.beginPath(); ctx.moveTo(ox+x*cs, oy); ctx.lineTo(ox+x*cs, oy+d.height*cs); ctx.stroke(); }
      for (let y = 0; y <= d.height; y++) { ctx.beginPath(); ctx.moveTo(ox, oy+y*cs); ctx.lineTo(ox+d.width*cs, oy+y*cs); ctx.stroke(); }
    }

    // Tokens
    for (const tok of (d.tokens || [])) {
      const sx = ox + tok.x * cs + cs/2;
      const sy = oy + tok.y * cs + cs/2;
      const r  = cs * 0.38;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
      ctx.fillStyle = tok.color || '#888';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, cs * 0.06);
      ctx.stroke();
      if (cs > 12) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(cs * 0.42)}px Segoe UI`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tok.symbol || '?', sx, sy);
      }
    }
  },

  // ---- Paint / place ----
  paintAt(sx, sy) {
    const cell = this.screenToCell(sx, sy);
    if (!cell || !this.activeDungeon) return;

    if (this.activeToken) {
      // Place / remove token
      const d = this.activeDungeon;
      if (!d.tokens) d.tokens = [];
      const existing = d.tokens.find(t => t.x === cell.x && t.y === cell.y);
      if (existing) {
        d.tokens = d.tokens.filter(t => t !== existing);
      } else {
        // Custom token: ask for name/symbol
        let tok = { ...this.activeToken, x: cell.x, y: cell.y };
        if (this.activeToken.id === 'custom') {
          const name = prompt('Nome do token:', 'Token') || 'Token';
          tok = { id: uid(), name, symbol: name[0].toUpperCase(), color: '#888', x: cell.x, y: cell.y };
        } else {
          tok = { ...this.activeToken, id: uid(), x: cell.x, y: cell.y };
        }
        d.tokens.push(tok);
      }
    } else if (this.activeTile) {
      this.activeDungeon.grid[cell.y][cell.x] = this.activeTile;
    }

    this._dirty = true;
    App.save();
  },

  // ---- Events ----
  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('mousedown', e => {
      if (e.button === 1) {
        this.panning = true;
        this.panStart = [e.clientX - this.pan.x, e.clientY - this.pan.y];
      } else if (e.button === 0) {
        const rect = cv.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        if (e.ctrlKey) {
          this.panning = true;
          this.panStart = [e.clientX - this.pan.x, e.clientY - this.pan.y];
        } else {
          this.painting = true;
          this.paintAt(sx, sy);
        }
      } else if (e.button === 2) {
        e.preventDefault();
        const rect = cv.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const cell = this.screenToCell(sx, sy);
        if (cell && this.activeDungeon) {
          this.activeDungeon.grid[cell.y][cell.x] = 'empty';
          // Also remove token at cell
          if (this.activeDungeon.tokens) {
            this.activeDungeon.tokens = this.activeDungeon.tokens.filter(t => !(t.x===cell.x && t.y===cell.y));
          }
          this._dirty = true;
          App.save();
        }
      }
    });
    cv.addEventListener('mousemove', e => {
      if (this.panning) {
        this.pan.x = e.clientX - this.panStart[0];
        this.pan.y = e.clientY - this.panStart[1];
        this._dirty = true;
      } else if (this.painting) {
        const rect = cv.getBoundingClientRect();
        this.paintAt(e.clientX - rect.left, e.clientY - rect.top);
      }
    });
    cv.addEventListener('mouseup',   () => { this.painting = false; this.panning = false; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.3, Math.min(5, this.zoom * delta));
      this._dirty = true;
    }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { if (this.activeDungeon) this.resizeCanvas(); });
  },

  // ---- CRUD ----
  newDungeon() {
    App._mType = 'dungeon';
    App._mId = null;
    document.getElementById('modal-body').innerHTML = `
      <h3>Nova Dungeon</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="Dungeon ${App.db.dungeons.length + 1}"></div>
      <div class="fr2">
        <div class="fg"><label>Largura</label><input type="number" class="fc" id="f-dg-w" value="20" min="5" max="60"></div>
        <div class="fg"><label>Altura</label><input type="number" class="fc" id="f-dg-h" value="20" min="5" max="60"></div>
      </div>
      <div class="modal-btns">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="DungeonMap.saveFromModal()">Criar</button>
      </div>`;
    document.getElementById('overlay').classList.add('open');
  },

  openNewModal() { this.newDungeon(); },

  saveFromModal() {
    const name = gv('f-name') || 'Dungeon';
    const w = Math.max(5, Math.min(60, parseInt(gv('f-dg-w')) || 20));
    const h = Math.max(5, Math.min(60, parseInt(gv('f-dg-h')) || 20));
    const grid = Array.from({ length: h }, () => Array(w).fill('empty'));
    const dungeon = { id: uid(), name, width: w, height: h, grid, tokens: [] };
    App.db.dungeons.push(dungeon);
    App.save();
    App.closeModal();
    this.renderDungeonList();
    this.selectDungeon(dungeon.id);
  },

  resizeGrid() {
    if (!this.activeDungeon) return;
    const w = Math.max(5, Math.min(60, parseInt(document.getElementById('dg-width').value) || 20));
    const h = Math.max(5, Math.min(60, parseInt(document.getElementById('dg-height').value) || 20));
    const old = this.activeDungeon;
    const newGrid = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => (old.grid[y] && old.grid[y][x]) ? old.grid[y][x] : 'empty')
    );
    old.width = w; old.height = h; old.grid = newGrid;
    App.save();
    this.renderDungeonList();
    this._dirty = true;
  },

  deleteDungeon() {
    if (!this.activeDungeon) return;
    if (!confirm(`Excluir "${this.activeDungeon.name}"?`)) return;
    App.db.dungeons = App.db.dungeons.filter(d => d.id !== this.activeDungeon.id);
    App.save();
    this.activeDungeon = null;
    this.renderDungeonList();
    this.selectDungeon(null);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  updateHint() {
    const hint = document.getElementById('dg-hint');
    if (hint) hint.style.display = this.activeDungeon ? 'none' : 'block';
  }
};
