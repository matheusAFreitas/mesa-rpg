const WorldMap = {
  canvas: null, ctx: null,
  pan: { x: 0, y: 0 }, zoom: 1,
  tool: 'select',
  dragging: null,   // location id being dragged
  panning: false,
  panStart: null,
  connectFrom: null,  // location id awaiting second click
  selected: null,     // location id selected
  _raf: null,
  _dirty: true,


  init() {
    this.canvas = document.getElementById('wm-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.syncPositions();
    this.resize();
    this.bindEvents();
    this.startLoop();
    this.updateHint();
  },

  syncPositions() {
    if (!App.db.worldMap) App.db.worldMap = { positions: {}, edges: [] };
    const pos = App.db.worldMap.positions;
    const locs = App.db.location;

    // Assign default positions to new locations
    locs.forEach((loc, i) => {
      if (!pos[loc.id]) {
        const angle = (i / Math.max(locs.length, 1)) * Math.PI * 2;
        const r = 180 + (i % 3) * 80;
        pos[loc.id] = { x: 400 + Math.cos(angle) * r, y: 300 + Math.sin(angle) * r };
      }
    });
    // Remove positions for deleted locations
    for (const id of Object.keys(pos)) {
      if (!locs.find(l => l.id === id)) delete pos[id];
    }
    // Remove edges for deleted locations
    App.db.worldMap.edges = (App.db.worldMap.edges || []).filter(e =>
      locs.find(l => l.id === e.from) && locs.find(l => l.id === e.to)
    );
  },

  resize() {
    const wrap = this.canvas.parentElement;
    this.canvas.width = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
    this._dirty = true;
  },

  startLoop() {
    const loop = () => {
      if (this._dirty) { this.draw(); this._dirty = false; }
      this._raf = requestAnimationFrame(loop);
    };
    if (this._raf) cancelAnimationFrame(this._raf);
    loop();
  },

  // ---- Coordinate transforms ----
  toScreen(wx, wy) { return [wx * this.zoom + this.pan.x, wy * this.zoom + this.pan.y]; },
  toWorld(sx, sy)  { return [(sx - this.pan.x) / this.zoom, (sy - this.pan.y) / this.zoom]; },

  nodeAt(sx, sy) {
    const R = 28 * this.zoom;
    for (const loc of App.db.location) {
      const p = App.db.worldMap.positions[loc.id];
      if (!p) continue;
      const [nx, ny] = this.toScreen(p.x, p.y);
      if (Math.hypot(sx - nx, sy - ny) < R) return loc;
    }
    return null;
  },

  edgeAt(sx, sy) {
    for (const e of App.db.worldMap.edges) {
      const p1 = App.db.worldMap.positions[e.from];
      const p2 = App.db.worldMap.positions[e.to];
      if (!p1 || !p2) continue;
      const [x1,y1] = this.toScreen(p1.x, p1.y);
      const [x2,y2] = this.toScreen(p2.x, p2.y);
      if (this.ptSegDist(sx, sy, x1, y1, x2, y2) < 7) return e;
    }
    return null;
  },

  ptSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2-x1, dy = y2-y1;
    if (!dx && !dy) return Math.hypot(px-x1, py-y1);
    const t = Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy) / (dx*dx+dy*dy)));
    return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
  },

  // ---- Draw ----
  draw() {
    const cv = this.canvas, ctx = this.ctx;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Faint grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gs = 60 * this.zoom;
    const ox = ((this.pan.x % gs) + gs) % gs;
    const oy = ((this.pan.y % gs) + gs) % gs;
    for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Edges
    for (const e of App.db.worldMap.edges) {
      const p1 = App.db.worldMap.positions[e.from];
      const p2 = App.db.worldMap.positions[e.to];
      if (!p1 || !p2) continue;
      const [x1,y1] = this.toScreen(p1.x, p1.y);
      const [x2,y2] = this.toScreen(p2.x, p2.y);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Midpoint label if label exists
      if (e.label) {
        ctx.fillStyle = '#666';
        ctx.font = `${Math.max(9, 11 * this.zoom)}px Segoe UI`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.label, (x1+x2)/2, (y1+y2)/2 - 8);
      }
    }

    // Connect preview line
    if (this.connectFrom && this._mousePos) {
      const p = App.db.worldMap.positions[this.connectFrom];
      if (p) {
        const [x1,y1] = this.toScreen(p.x, p.y);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(this._mousePos[0], this._mousePos[1]);
        ctx.strokeStyle = 'rgba(192,57,43,0.6)';
        ctx.setLineDash([6,4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // Nodes
    const NODE_R = 28;
    for (const loc of App.db.location) {
      const p = App.db.worldMap.positions[loc.id];
      if (!p) continue;
      const [sx, sy] = this.toScreen(p.x, p.y);
      const r = NODE_R * this.zoom;

      const isSel = loc.id === this.selected;
      const isFrom = loc.id === this.connectFrom;

      // Shadow
      ctx.shadowColor = isFrom ? '#c0392b' : isSel ? '#ffffff44' : 'transparent';
      ctx.shadowBlur = isFrom || isSel ? 14 : 0;

      // Fill
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
      ctx.fillStyle = App.uNodeFill(loc.universe);
      ctx.fill();

      // Border
      ctx.strokeStyle = isFrom ? '#c0392b' : isSel ? '#fff' : App.uNodeBorder(loc.universe);
      ctx.lineWidth = isFrom || isSel ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Status dot
      if (loc.status) {
        const dotColor = loc.status==='Seguro'?'#27ae60':loc.status==='Perigoso'?'#e74c3c':'#888';
        ctx.beginPath(); ctx.arc(sx + r*0.65, sy - r*0.65, r*0.22, 0, Math.PI*2);
        ctx.fillStyle = dotColor; ctx.fill();
      }

      // Label
      if (this.zoom > 0.35) {
        const fontSize = Math.max(8, Math.round(11 * this.zoom));
        ctx.font = `${fontSize}px Segoe UI`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ddd';
        const name = loc.name.length > 13 ? loc.name.slice(0, 11) + '…' : loc.name;
        ctx.fillText(name, sx, sy);
      }
    }
  },

  // ---- Events ----
  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('mousedown', e => this.onDown(e));
    cv.addEventListener('mousemove', e => this.onMove(e));
    cv.addEventListener('mouseup',   e => this.onUp(e));
    cv.addEventListener('wheel',     e => this.onWheel(e), { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this.onRightClick(e); });
    window.addEventListener('resize', () => this.resize());
  },

  _rect() { return this.canvas.getBoundingClientRect(); },

  onDown(e) {
    const rect = this._rect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const node = this.nodeAt(sx, sy);

    if (this.tool === 'select') {
      if (node) {
        this.dragging = node.id;
        this.selected = node.id;
        this.showPanel(node);
      } else {
        this.panning = true;
        this.panStart = [e.clientX - this.pan.x, e.clientY - this.pan.y];
        this.selected = null;
        this.hidePanel();
      }
    } else if (this.tool === 'connect') {
      if (node) {
        if (!this.connectFrom) {
          this.connectFrom = node.id;
        } else if (this.connectFrom !== node.id) {
          // Create edge if it doesn't already exist
          const exists = App.db.worldMap.edges.find(edge =>
            (edge.from===this.connectFrom&&edge.to===node.id) ||
            (edge.from===node.id&&edge.to===this.connectFrom)
          );
          if (!exists) {
            App.db.worldMap.edges.push({ from: this.connectFrom, to: node.id });
            App.save();
          }
          this.connectFrom = null;
        } else {
          this.connectFrom = null;
        }
      } else {
        this.connectFrom = null;
      }
    } else if (this.tool === 'deledge') {
      const edge = this.edgeAt(sx, sy);
      if (edge) {
        App.db.worldMap.edges = App.db.worldMap.edges.filter(e => e !== edge);
        App.save();
      }
    }
    this._dirty = true;
  },

  onMove(e) {
    const rect = this._rect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    this._mousePos = [sx, sy];

    if (this.dragging) {
      const [wx, wy] = this.toWorld(sx, sy);
      App.db.worldMap.positions[this.dragging] = { x: wx, y: wy };
      this._dirty = true;
    } else if (this.panning) {
      this.pan.x = e.clientX - this.panStart[0];
      this.pan.y = e.clientY - this.panStart[1];
      this._dirty = true;
    } else if (this.connectFrom || this.tool === 'connect') {
      this._dirty = true;
    }
  },

  onUp(e) {
    if (this.dragging) { App.save(); }
    this.dragging = null;
    this.panning = false;
  },

  onWheel(e) {
    e.preventDefault();
    const rect = this._rect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.15, Math.min(4, this.zoom * delta));
    // Zoom toward mouse position
    this.pan.x = sx - (sx - this.pan.x) * (newZoom / this.zoom);
    this.pan.y = sy - (sy - this.pan.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
    this._dirty = true;
  },

  onRightClick(e) {
    // Right-click on node: deselect connect
    this.connectFrom = null;
    this._dirty = true;
  },

  // ---- Tools ----
  setTool(t) {
    this.tool = t;
    this.connectFrom = null;
    document.querySelectorAll('.wm-tool').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === t);
    });
    this._dirty = true;
  },

  zoomIn()  { this.zoom = Math.min(4, this.zoom * 1.25); this._dirty = true; },
  zoomOut() { this.zoom = Math.max(0.15, this.zoom * 0.8); this._dirty = true; },
  resetView() {
    this.pan = { x: 0, y: 0 }; this.zoom = 1;
    this._dirty = true;
  },

  // ---- Info panel ----
  showPanel(loc) {
    const panel = document.getElementById('wm-panel');
    const stColor = loc.status==='Seguro'?'#55cc55':loc.status==='Perigoso'?'#cc5555':'var(--text2)';
    panel.style.display = 'block';
    panel.innerHTML = `
      <span class="close-btn" onclick="WorldMap.hidePanel()">✕</span>
      <h4>${loc.name}</h4>
      <div style="margin-bottom:6px;">
        <span class="tag" style="${App.tagStyle(loc.universe)}">${loc.universe||'—'}</span>
        ${loc.status ? `<span style="font-size:11px;color:${stColor}">${loc.status}</span>` : ''}
      </div>
      ${loc.description ? `<p style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:8px;">${loc.description}</p>` : ''}
      ${loc.connections ? `<p style="font-size:11px;color:var(--text2);">📍 ${loc.connections}</p>` : ''}
      <button class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%;" onclick="App.openModal('location','${loc.id}')">✏ Editar</button>`;
  },

  hidePanel() {
    document.getElementById('wm-panel').style.display = 'none';
    this.selected = null;
    this._dirty = true;
  },

  updateHint() {
    const hint = document.getElementById('wm-hint');
    if (hint) hint.style.display = App.db.location.length ? 'none' : 'block';
  }
};
