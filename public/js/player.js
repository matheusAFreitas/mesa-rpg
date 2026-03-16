function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// =========================================================
// Player App
// =========================================================
const Player = {
  db: null,
  pj: null,         // selected PJ object
  pendingPJ: null,  // PJ waiting for PIN confirmation
  _notesDraft: undefined,
  _notesTimer: null,
  _privateNotesTimer: null,
  _hpDelta: 1,
  _sessionId: 'ps-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  _heartbeatTimer: null,
  _gmStatusTimer: null,

  _beat() {
    if (!this.pj) return;
    fetch('/api/player/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this._sessionId,
        pjName: this.pj.name,
        pjId: this.pj.id,
        hp: this.pj.hp,
        hpMax: this.pj.hp_max
      })
    }).catch(() => {});
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this._beat();
    this._heartbeatTimer = setInterval(() => this._beat(), 8000);
    this._pollGmStatus();
    this._gmStatusTimer = setInterval(() => this._pollGmStatus(), 5000);
  },

  stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
    clearInterval(this._gmStatusTimer);
    this._gmStatusTimer = null;
  },

  async _pollGmStatus() {
    try {
      const r = await fetch('/api/gm/status');
      const { online } = await r.json();
      const dot   = document.getElementById('gm-status-dot');
      const label = document.getElementById('gm-status-label');
      if (!dot) return;
      dot.className   = 'gm-status-dot ' + (online ? 'online' : 'offline');
      label.textContent = online ? 'Mestre online' : 'Mestre offline';
    } catch (e) {}
  },

  async init() {
    const res = await fetch('/api/player/data');
    this.db = await res.json();
    // Check if there's a pending request from a previous session
    const pendingId = localStorage.getItem('pending-request-id');
    if (pendingId) {
      const approved = this.db.pj.find(p => p.id === pendingId);
      const stillPending = (this.db.pending_pj || []).find(p => p.id === pendingId);
      if (approved) {
        localStorage.removeItem('pending-request-id');
        this.renderSelector();
      } else if (stillPending) {
        this.showPending(pendingId, stillPending.name);
      } else {
        localStorage.removeItem('pending-request-id');
        this.renderSelector();
      }
    } else {
      this.renderSelector();
    }
    // SSE — atualiza em tempo real quando o servidor muda
    const es = new EventSource('/api/events');
    es.onmessage = async () => {
      const r = await fetch('/api/player/data');
      this.db = await r.json();
      if (this.pj) {
        this.pj = this.db.pj.find(p => p.id === this.pj.id) || this.pj;
        this.renderFicha();
        PMap.syncAndDraw();
        PCombat.render();
      } else {
        const pendingId = localStorage.getItem('pending-request-id');
        if (pendingId) {
          const approved     = this.db.pj.find(p => p.id === pendingId);
          const stillPending = (this.db.pending_pj || []).find(p => p.id === pendingId);
          if (approved) {
            // Aprovado — vai para seleção
            localStorage.removeItem('pending-request-id');
            document.getElementById('screen-pending').style.display = 'none';
            document.getElementById('screen-select').style.display = '';
            this.renderSelector();
            return;
          } else if (!stillPending) {
            // Rejeitado — avisa o jogador e para aqui
            localStorage.removeItem('pending-request-id');
            document.getElementById('screen-pending').style.display = 'none';
            document.getElementById('screen-select').style.display = '';
            this.renderSelector('❌ Seu personagem foi <strong>rejeitado</strong> pelo Mestre.<br>Crie um novo personagem ou aguarde contato.');
            return;
          }
          return; // ainda pendente, não re-renderiza
        }
        // Re-render selector se estiver visível (ex: GM deletou personagens)
        if (document.getElementById('screen-select').style.display !== 'none') {
          this.renderSelector();
        }
      }
    };
  },

  renderSelector(rejectionMsg) {
    const grid  = document.getElementById('pj-grid');
    const empty = document.getElementById('pj-empty');
    if (!this.db.pj || !this.db.pj.length) {
      grid.innerHTML = '';
      empty.innerHTML = rejectionMsg || 'Nenhum personagem cadastrado ainda.<br>Crie um personagem ou aguarde o Mestre adicioná-lo.';
      empty.className = rejectionMsg ? 'empty-msg rejected' : 'empty-msg';
      empty.style.display = '';
    } else {
      empty.style.display = 'none';
      grid.innerHTML = this.db.pj.map(p => {
        const pct = p.hp_max ? Math.max(0, Math.min(100, (p.hp / p.hp_max) * 100)) : 100;
        const color = pct > 60 ? '#27ae60' : pct > 25 ? '#f39c12' : '#e74c3c';
        const uSlug = (p.universe||'').toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
        const tagClass = ['doom','fallout','twd','l4d','alltomorrows','ryukendo'].includes(uSlug) ? `tag-${uSlug}` : 'tag-custom';
        return `<div class="pj-sel-card" onclick="Player.select('${p.id}')">
          <div class="name">${p.name||'—'}</div>
          <div class="meta" style="margin-top:3px;">
            ${p.universe ? `<span class="tag ${tagClass}" style="font-size:10px;">${p.universe}</span>` : ''}
            ${p.class ? `<span style="font-size:11px;color:var(--text2);margin-left:4px;">${p.class}</span>` : ''}
          </div>
          ${p.hp_max ? `<div class="hp-bar" style="margin-top:10px;"><div class="hp-fill" style="width:${pct}%;background:${color};"></div></div>` : ''}
          ${p.pin ? '<div style="font-size:10px;color:var(--text2);margin-top:6px;">🔒 PIN necessário</div>' : ''}
        </div>`;
      }).join('');
    }
    // Botão de criar personagem (remove o anterior antes de inserir)
    const old = document.getElementById('create-btn-wrap');
    if (old) old.remove();
    grid.insertAdjacentHTML('afterend', `
      <div id="create-btn-wrap" style="text-align:center;margin-top:24px;">
        <button class="btn btn-secondary" onclick="Player.showCreate()">+ Criar Personagem</button>
      </div>`);
  },

  showCreate() {
    document.getElementById('screen-select').style.display = 'none';
    const sel = document.getElementById('cr-universe');
    sel.innerHTML = (this.db.universes || []).map(u => `<option value="${u.name}">${u.name}</option>`).join('');
    document.getElementById('screen-create').style.display = 'block';
    PlayerCreate.init();
    document.getElementById('cr-name').focus();
  },

  cancelCreate() {
    document.getElementById('screen-create').style.display = 'none';
    document.getElementById('screen-select').style.display = '';
  },

  async submitRequest() {
    const name = document.getElementById('cr-name').value.trim();
    if (!name) { alert('Nome é obrigatório.'); return; }
    const payload = {
      name,
      class:    document.getElementById('cr-class').value.trim(),
      universe: document.getElementById('cr-universe').value,
      stats:    PlayerCreate.readStats(),
      notes:    document.getElementById('cr-notes').value.trim(),
    };
    const res = await fetch('/api/player/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem('pending-request-id', data.id);
      document.getElementById('screen-create').style.display = 'none';
      this.showPending(data.id, name);
    }
  },

  showPending(id, name) {
    document.getElementById('screen-select').style.display = 'none';
    document.getElementById('pending-name').textContent = name;
    document.getElementById('screen-pending').style.display = 'flex';
  },

  async cancelRequest() {
    const id = localStorage.getItem('pending-request-id');
    if (id) {
      await fetch(`/api/gm/pending/${id}`, { method: 'DELETE' });
      localStorage.removeItem('pending-request-id');
    }
    document.getElementById('screen-pending').style.display = 'none';
    document.getElementById('screen-select').style.display = '';
    this.renderSelector();
  },

  select(id) {
    const pj = this.db.pj.find(p => p.id === id);
    if (!pj) return;
    if (pj.pin) {
      this.pendingPJ = pj;
      document.getElementById('pin-desc').textContent = `PIN para "${pj.name}"`;
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-error').textContent = '';
      document.getElementById('pin-overlay').classList.add('open');
      setTimeout(() => document.getElementById('pin-input').focus(), 50);
    } else {
      this.enterAs(pj);
    }
  },

  confirmPin() {
    const val = document.getElementById('pin-input').value.trim();
    if (val === String(this.pendingPJ.pin)) {
      document.getElementById('pin-overlay').classList.remove('open');
      this.enterAs(this.pendingPJ);
      this.pendingPJ = null;
    } else {
      document.getElementById('pin-error').textContent = 'PIN incorreto.';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-input').focus();
    }
  },

  cancelPin() {
    document.getElementById('pin-overlay').classList.remove('open');
    this.pendingPJ = null;
  },

  enterAs(pj) {
    this.pj = pj;
    document.getElementById('screen-select').style.display = 'none';
    document.getElementById('screen-player').classList.add('active');
    document.getElementById('ph-name').textContent = pj.name || '—';
    document.getElementById('ph-meta').textContent = [pj.class, pj.universe].filter(Boolean).join(' · ');
    this.showTab('ficha');
    this.renderFicha();
    PMap.init(this.db);
    this.startHeartbeat();
    PCombat.render();
  },

  logout() {
    this.stopHeartbeat();
    this.pj = null;
    document.getElementById('screen-select').style.display = '';
    document.getElementById('screen-player').classList.remove('active');
    this.renderSelector();
  },

  showTab(tab) {
    ['ficha','dados','mapa'].forEach(t => {
      document.getElementById('tab-'+t).classList.toggle('active', t === tab);
      document.getElementById('tbtn-'+t).classList.toggle('active', t === tab);
    });
    if (tab === 'mapa')  setTimeout(() => PMap.resize(), 30);
    if (tab === 'dados') PDice.setup();
  },

  renderFicha() {
    if (!this.pj) return;
    const p = this.pj;
    const hp = Number(p.hp) || 0;
    const hpMax = Number(p.hp_max) || 0;
    const pct = hpMax ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0;
    const hpColor = pct > 60 ? '#27ae60' : pct > 25 ? '#f39c12' : '#e74c3c';
    const hpClass = pct > 60 ? '' : pct > 25 ? 'warn' : 'crit';

    const stats = p.stats || {};
    const statKeys = Object.keys(stats).filter(k => stats[k] !== '' && stats[k] !== undefined);

    const uSlug = (p.universe||'').toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
    const tagClass = ['doom','fallout','twd','l4d','alltomorrows','ryukendo'].includes(uSlug) ? `tag-${uSlug}` : 'tag-custom';

    // Preserve cursor position for both note textareas
    const activeId    = document.activeElement && document.activeElement.id;
    const notesEl0    = document.getElementById('player-notes');
    const privateEl0  = document.getElementById('player-notes-private');
    const notesSel    = notesEl0   ? [notesEl0.selectionStart,   notesEl0.selectionEnd]   : null;
    const privateSel  = privateEl0 ? [privateEl0.selectionStart, privateEl0.selectionEnd] : null;
    const notesValue  = this._notesDraft !== undefined ? this._notesDraft : (p.notes || '');

    const lvl    = p.level || 1;
    const xp     = Number(p.xp) || 0;
    const xpNext = Number(p.xp_next) || 0;
    const xpPct  = xpNext > 0 ? Math.min(100, xp / xpNext * 100) : 0;
    const inv    = p.inventory || [];

    document.getElementById('ficha-content').innerHTML = `
      ${p.gm_notes_unread ? `
      <div class="gm-notif gm-notif-secret">
        <div class="gm-notif-icon">🔒</div>
        <div class="gm-notif-text">
          <strong>O Mestre anotou algo sobre você</strong>
          <span>O conteúdo é secreto — apenas o Mestre tem acesso.</span>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="Player.dismissGmSecretNotif()">OK</button>
      </div>` : ''}

      <!-- Info geral -->
      <div class="ficha-section">
        <h3>Informações</h3>
        <div class="info-row">
          ${p.class    ? `<div class="info-field"><label>Classe</label><div class="val">${p.class}</div></div>` : ''}
          ${p.universe ? `<div class="info-field"><label>Universo</label><div class="val"><span class="tag ${tagClass}">${p.universe}</span></div></div>` : ''}
        </div>
      </div>

      <!-- Nível / XP -->
      <div class="ficha-section">
        <h3>Nível</h3>
        <div class="level-block">
          <div class="level-num">
            <div class="lv-label">Nível</div>
            <div class="lv-val">${lvl}</div>
          </div>
          ${xpNext > 0 ? `<div class="xp-col">
            <div class="xp-row"><span>XP</span><span>${xp} / ${xpNext}</span></div>
            <div class="hp-bar-big"><div class="hp-bar-fill" style="width:${xpPct}%;background:var(--accent);"></div></div>
          </div>` : xp > 0 ? `<div style="font-size:13px;color:var(--text2);">XP acumulado: <strong style="color:var(--text)">${xp}</strong></div>` : ''}
        </div>
      </div>

      <!-- HP -->
      ${hpMax ? `<div class="ficha-section">
        <h3>Pontos de Vida</h3>
        <div class="hp-row">
          <div class="hp-display ${hpClass}" id="hp-val-display">${hp}</div>
          <div class="hp-max">/ ${hpMax}</div>
          <div class="hp-controls">
            <div class="hp-adj-label">dano / cura</div>
            <div class="hp-adj">
              <button class="btn-icon" style="color:var(--danger)" onclick="Player.adjustHP(-1)" title="Aplicar dano">−</button>
              <input id="hp-delta" type="number" value="${this._hpDelta || 1}" min="1" max="999">
              <button class="btn-icon" style="color:var(--ok)" onclick="Player.adjustHP(1)" title="Curar">+</button>
            </div>
          </div>
        </div>
        <div class="hp-bar-big"><div class="hp-bar-fill" style="width:${pct}%;background:${hpColor};"></div></div>
      </div>` : ''}

      <!-- Stats -->
      ${statKeys.length ? `<div class="ficha-section">
        <h3>Atributos</h3>
        <div class="stat-block">
          ${statKeys.map(k => `<div class="stat"><div class="stat-label">${k}</div><div class="stat-value">${stats[k]}</div></div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Inventário -->
      <div class="ficha-section">
        <h3>Inventário</h3>
        <div class="inv-list">
          ${inv.length ? inv.map(it => `
            <div class="inv-item">
              <div class="inv-item-name">${it.name}</div>
              <div class="inv-qty">
                <button class="btn-icon" onclick="Player.adjustQty('${it.id}',-1)">−</button>
                <span>${it.qty}</span>
                <button class="btn-icon" onclick="Player.adjustQty('${it.id}',1)">+</button>
              </div>
              <button class="btn-icon" style="color:var(--danger)" onclick="Player.removeItem('${it.id}')" title="Remover">✕</button>
            </div>`).join('') : '<div class="inv-empty">Nenhum item no inventário.</div>'}
        </div>
        <div class="inv-add-row">
          <input id="inv-new-name" type="text" placeholder="Nome do item..." onkeydown="if(event.key==='Enter')Player.addItem()">
          <button class="btn btn-secondary btn-sm" onclick="Player.addItem()">+ Adicionar</button>
        </div>
      </div>

      ${p.gm_to_player_notes ? `
      <!-- Recados do Mestre (só leitura) -->
      <div class="ficha-section">
        <h3>Recados do Mestre ${p.gm_to_player_unread ? '<span class="badge-new">novo</span>' : ''}</h3>
        <div class="notes-box gm-recado-box">${esc(p.gm_to_player_notes)}</div>
        ${p.gm_to_player_unread ? `<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="Player.dismissGmToPlayerNotif()">Marcar como lido</button>` : ''}
      </div>` : ''}

      <!-- Notas compartilhadas -->
      <div class="ficha-section">
        <h3>Notas <span class="notes-hint">salvo automaticamente</span></h3>
        <textarea id="player-notes" class="notes-edit" placeholder="Suas anotações de personagem...">${notesValue}</textarea>
      </div>

      <!-- Notas privadas (não aparecem na interface do Mestre) -->
      <div class="ficha-section">
        <h3>Notas Privadas <span class="notes-hint">o Mestre não vê</span></h3>
        <textarea id="player-notes-private" class="notes-edit" placeholder="Segredos, teorias, suspeitas...">${p.private_notes || ''}</textarea>
      </div>
    `;

    // Bind notas privadas (salvo no servidor, não exposto ao Mestre)
    const privateEl = document.getElementById('player-notes-private');
    privateEl.addEventListener('input', () => {
      this.pj.private_notes = privateEl.value;
      clearTimeout(this._privateNotesTimer);
      this._privateNotesTimer = setTimeout(() => {
        fetch(`/api/player/pj/${this.pj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ private_notes: this.pj.private_notes })
        });
      }, 1200);
    });

    // Bind notes auto-save
    const notesEl = document.getElementById('player-notes');
    notesEl.addEventListener('input', () => {
      this._notesDraft = notesEl.value;
      clearTimeout(this._notesTimer);
      this._notesTimer = setTimeout(() => {
        this.pj.notes = notesEl.value;
        this._notesDraft = undefined;
        fetch(`/api/player/pj/${this.pj.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: this.pj.notes })
        });
      }, 1200);
    });

    if (activeId === 'player-notes' && notesSel) {
      notesEl.focus();
      notesEl.setSelectionRange(notesSel[0], notesSel[1]);
    }
    const privateEl2 = document.getElementById('player-notes-private');
    if (activeId === 'player-notes-private' && privateSel && privateEl2) {
      privateEl2.focus();
      privateEl2.setSelectionRange(privateSel[0], privateSel[1]);
    }
  },

  saveInventory() {
    fetch(`/api/player/pj/${this.pj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory: this.pj.inventory })
    });
  },

  addItem() {
    const input = document.getElementById('inv-new-name');
    const name = (input ? input.value : '').trim();
    if (!name) return;
    if (!this.pj.inventory) this.pj.inventory = [];
    this.pj.inventory.push({ id: 'i' + Date.now().toString(36), name, qty: 1 });
    this.saveInventory();
    this.renderFicha();
    // Restore focus to the add input
    const newInput = document.getElementById('inv-new-name');
    if (newInput) newInput.focus();
  },

  adjustQty(id, sign) {
    const item = (this.pj.inventory || []).find(x => x.id === id);
    if (!item) return;
    item.qty = Math.max(1, (item.qty || 1) + sign);
    this.saveInventory();
    this.renderFicha();
  },

  removeItem(id) {
    this.pj.inventory = (this.pj.inventory || []).filter(x => x.id !== id);
    this.saveInventory();
    this.renderFicha();
  },

  dismissGmSecretNotif() {
    if (!this.pj) return;
    this.pj.gm_notes_unread = false;
    fetch(`/api/player/pj/${this.pj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gm_notes_unread: false })
    });
    this.renderFicha();
  },

  dismissGmToPlayerNotif() {
    if (!this.pj) return;
    this.pj.gm_to_player_unread = false;
    fetch(`/api/player/pj/${this.pj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gm_to_player_unread: false })
    });
    this.renderFicha();
  },

  adjustHP(sign) {
    const deltaEl = document.getElementById('hp-delta');
    const delta = parseInt(deltaEl ? deltaEl.value : this._hpDelta) || 1;
    this._hpDelta = delta;
    const newHP = Math.max(0, Math.min(Number(this.pj.hp_max)||9999, (Number(this.pj.hp)||0) + sign * delta));
    this.pj.hp = newHP;
    fetch(`/api/player/pj/${this.pj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hp: newHP })
    });
    this._beat();
    this.renderFicha();
  }
};

// =========================================================
// Player Dice
// =========================================================
const PDice = {
  log: [],

  setup() {
    const el = document.getElementById('pdice-btns');
    if (!el || el.dataset.built) return;
    el.dataset.built = '1';
    const DICE = [[4,'◆'],[6,'⬡'],[8,'◈'],[10,'⬟'],[12,'⬠'],[20,'⭐'],[100,'💯']];
    DICE.forEach(([s, icon]) => {
      const b = document.createElement('div');
      b.className = 'die-btn';
      b.innerHTML = `<span class="die-icon">${icon}</span><span class="die-lbl">d${s}</span>`;
      b.onclick = () => this.roll(1, s);
      el.appendChild(b);
    });
  },

  roll(qty, sides, mod = 0) {
    const rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    const desc   = `${qty}d${sides}${mod > 0 ? '+' + mod : mod < 0 ? mod : ''}`;
    const detail = qty > 1
      ? `[${rolls.join(', ')}]${mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''}`
      : (mod ? `${mod > 0 ? '+' : ''}${mod}` : '');

    const numEl = document.getElementById('pdice-num');
    if (numEl) {
      numEl.textContent = total;
      numEl.style.color = sides === 20 && rolls[0] === 20 ? '#f0c040'
                        : sides === 20 && rolls[0] === 1  ? '#cc4444'
                        : 'var(--accent)';
    }
    const detEl = document.getElementById('pdice-detail');
    if (detEl) detEl.textContent = `${desc}${detail ? '  ' + detail : ''}`;

    this.log.unshift({ desc, total, detail, t: new Date().toLocaleTimeString('pt-BR') });
    this.log = this.log.slice(0, 25);
    this.renderHistory();

    // Notifica o Mestre sobre a rolagem
    if (Player.pj) {
      const last_roll = { total, desc, ts: Date.now() };
      Player.pj.last_roll = last_roll;
      fetch(`/api/player/pj/${Player.pj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_roll })
      });
    }
  },

  rollCustom() {
    const qty   = parseInt(document.getElementById('pdc-qty').value)   || 1;
    const sides = parseInt(document.getElementById('pdc-sides').value) || 6;
    const mod   = parseInt(document.getElementById('pdc-mod').value)   || 0;
    this.roll(qty, sides, mod);
  },

  renderHistory() {
    const el = document.getElementById('pdice-history');
    if (!el) return;
    el.innerHTML = this.log.map(h =>
      `<div>${h.t} — <b>${h.desc}</b> = <span style="color:var(--accent)">${h.total}</span>${h.detail ? '  ' + h.detail : ''}</div>`
    ).join('');
  }
};

// =========================================================
// Player Map (read-only world map)
// =========================================================
const PMap = {
  canvas: null, ctx: null, db: null,
  pan: { x: 0, y: 0 }, zoom: 1,
  panning: false, panStart: null,
  selected: null,
  _raf: null, _dirty: true,

  uColors: {
    doom:        { fill: '#2a0000', border: '#c0392b' },
    fallout:     { fill: '#1a1a00', border: '#aaaa00' },
    twd:         { fill: '#0e0e06', border: '#7a7a3a' },
    l4d:         { fill: '#001a00', border: '#338833' },
    alltomorrows:{ fill: '#0a0018', border: '#7744cc' },
    ryukendo:    { fill: '#001220', border: '#2277aa' },
  },

  uSlug(name) {
    return (name||'').toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
  },
  nodeFill(u)   { return (this.uColors[this.uSlug(u)] || { fill: '#1a1a1a' }).fill; },
  nodeBorder(u) { return (this.uColors[this.uSlug(u)] || { border: '#444' }).border; },

  init(db) {
    this.db = db;
    this.canvas = document.getElementById('wm-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.bindEvents();
    this.startLoop();
  },

  syncAndDraw() {
    if (!this.canvas) return;
    this._dirty = true;
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

  toScreen(wx, wy) { return [wx * this.zoom + this.pan.x, wy * this.zoom + this.pan.y]; },
  toWorld(sx, sy)  { return [(sx - this.pan.x) / this.zoom, (sy - this.pan.y) / this.zoom]; },

  nodeAt(sx, sy) {
    if (!this.db || !this.db.worldMap) return null;
    const R = 28 * this.zoom;
    for (const loc of (this.db.location || [])) {
      const p = (this.db.worldMap.positions || {})[loc.id];
      if (!p) continue;
      const [nx, ny] = this.toScreen(p.x, p.y);
      if (Math.hypot(sx - nx, sy - ny) < R) return loc;
    }
    return null;
  },

  draw() {
    if (!this.canvas || !this.db) return;
    const cv = this.canvas, ctx = this.ctx;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gs = 60 * this.zoom;
    const ox = ((this.pan.x % gs) + gs) % gs;
    const oy = ((this.pan.y % gs) + gs) % gs;
    for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    const wm = this.db.worldMap || { positions: {}, edges: [] };
    const locs = this.db.location || [];

    // Edges
    for (const e of (wm.edges || [])) {
      const p1 = wm.positions[e.from], p2 = wm.positions[e.to];
      if (!p1 || !p2) continue;
      const [x1,y1] = this.toScreen(p1.x, p1.y);
      const [x2,y2] = this.toScreen(p2.x, p2.y);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.stroke();
    }

    // Nodes
    const NODE_R = 28;
    for (const loc of locs) {
      const p = wm.positions[loc.id];
      if (!p) continue;
      const [sx, sy] = this.toScreen(p.x, p.y);
      const r = NODE_R * this.zoom;
      const isSel = loc.id === this.selected;

      ctx.shadowColor = isSel ? '#ffffff44' : 'transparent';
      ctx.shadowBlur = isSel ? 14 : 0;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
      ctx.fillStyle = this.nodeFill(loc.universe); ctx.fill();
      ctx.strokeStyle = isSel ? '#fff' : this.nodeBorder(loc.universe);
      ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
      ctx.shadowBlur = 0;

      if (loc.status) {
        const dotColor = loc.status==='Seguro'?'#27ae60':loc.status==='Perigoso'?'#e74c3c':'#888';
        ctx.beginPath(); ctx.arc(sx + r*0.65, sy - r*0.65, r*0.22, 0, Math.PI*2);
        ctx.fillStyle = dotColor; ctx.fill();
      }

      if (this.zoom > 0.35) {
        const fontSize = Math.max(8, Math.round(11 * this.zoom));
        ctx.font = `${fontSize}px Segoe UI`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ddd';
        const name = loc.name.length > 13 ? loc.name.slice(0,11)+'…' : loc.name;
        ctx.fillText(name, sx, sy);
      }
    }
  },

  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('mousedown', e => this.onDown(e));
    cv.addEventListener('mousemove', e => this.onMove(e));
    cv.addEventListener('mouseup',   () => this.onUp());
    cv.addEventListener('wheel',     e => this.onWheel(e), { passive: false });
    window.addEventListener('resize', () => this.resize());

    // Touch support
    cv.addEventListener('touchstart',  e => this.onTouchStart(e), { passive: false });
    cv.addEventListener('touchmove',   e => this.onTouchMove(e),  { passive: false });
    cv.addEventListener('touchend',    () => this.onUp());
  },

  _rect() { return this.canvas.getBoundingClientRect(); },

  onDown(e) {
    const rect = this._rect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const node = this.nodeAt(sx, sy);
    if (node) {
      this.selected = node.id;
      this.showPanel(node);
    } else {
      this.panning = true;
      this.panStart = [e.clientX - this.pan.x, e.clientY - this.pan.y];
      this.selected = null;
      this.hidePanel();
    }
    this._dirty = true;
  },

  onMove(e) {
    if (!this.panning) return;
    this.pan.x = e.clientX - this.panStart[0];
    this.pan.y = e.clientY - this.panStart[1];
    this._dirty = true;
  },

  onUp() { this.panning = false; },

  onWheel(e) {
    e.preventDefault();
    const rect = this._rect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.15, Math.min(4, this.zoom * delta));
    this.pan.x = sx - (sx - this.pan.x) * (newZoom / this.zoom);
    this.pan.y = sy - (sy - this.pan.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
    this._dirty = true;
  },

  _touch: null,
  onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this._touch = [t.clientX, t.clientY];
      this.panStart = [t.clientX - this.pan.x, t.clientY - this.pan.y];
      this.panning = true;
    }
  },
  onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.panning) {
      const t = e.touches[0];
      this.pan.x = t.clientX - this.panStart[0];
      this.pan.y = t.clientY - this.panStart[1];
      this._dirty = true;
    }
  },

  zoomIn()    { this.zoom = Math.min(4, this.zoom * 1.25); this._dirty = true; },
  zoomOut()   { this.zoom = Math.max(0.15, this.zoom * 0.8); this._dirty = true; },
  resetView() { this.pan = { x: 0, y: 0 }; this.zoom = 1; this._dirty = true; },

  showPanel(loc) {
    const panel = document.getElementById('wm-panel');
    const stColor = loc.status==='Seguro'?'#55cc55':loc.status==='Perigoso'?'#cc5555':'var(--text2)';
    const uSlug = (loc.universe||'').toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
    const tagClass = ['doom','fallout','twd','l4d','alltomorrows','ryukendo'].includes(uSlug) ? `tag-${uSlug}` : 'tag-custom';
    panel.style.display = 'block';
    panel.innerHTML = `
      <span class="close-btn" onclick="PMap.hidePanel()" style="position:absolute;top:8px;right:10px;cursor:pointer;color:var(--text2);">✕</span>
      <h4 style="margin-bottom:8px;padding-right:16px;">${loc.name}</h4>
      <div style="margin-bottom:6px;">
        ${loc.universe ? `<span class="tag ${tagClass}" style="font-size:10px;">${loc.universe}</span>` : ''}
        ${loc.status ? `<span style="font-size:11px;color:${stColor};margin-left:4px;">${loc.status}</span>` : ''}
      </div>
      ${loc.description ? `<p style="font-size:12px;color:var(--text2);line-height:1.5;">${loc.description}</p>` : ''}
    `;
  },

  hidePanel() {
    document.getElementById('wm-panel').style.display = 'none';
    this.selected = null;
    this._dirty = true;
  }
};

// =========================================================
// Player Create — stats editor helper
// =========================================================
const BASE_STATS = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'];

const PlayerCreate = {
  init() {
    const editor = document.getElementById('cr-stats-editor');
    if (!editor) return;
    editor.innerHTML = BASE_STATS.map(k => `
      <div class="stats-row">
        <input type="text" class="stat-key" value="${k}" readonly style="color:var(--text2);cursor:default;">
        <input type="number" class="stat-val" placeholder="0">
        <span style="width:28px;flex-shrink:0;"></span>
      </div>`).join('');
  },
  addStatRow() {
    const editor = document.getElementById('cr-stats-editor');
    editor.insertAdjacentHTML('beforeend', `
      <div class="stats-row">
        <input type="text"   class="stat-key" placeholder="NOME" maxlength="10">
        <input type="number" class="stat-val" placeholder="0">
        <button type="button" class="btn-icon" onclick="this.closest('.stats-row').remove()" title="Remover">✕</button>
      </div>`);
    const rows = editor.querySelectorAll('.stats-row');
    rows[rows.length - 1].querySelector('.stat-key').focus();
  },
  readStats() {
    const stats = {};
    document.querySelectorAll('#cr-stats-editor .stats-row').forEach(row => {
      const k = row.querySelector('.stat-key').value.trim().toUpperCase();
      const v = row.querySelector('.stat-val').value.trim();
      if (k && v) stats[k] = v;
    });
    return stats;
  }
};

// =========================================================
// Player Combat HUD
// =========================================================
const PCombat = {
  render() {
    const hud = document.getElementById('pcombat-hud');
    if (!hud) return;

    const combat = Player.db && Player.db.combat;
    if (!Player.pj || !combat || !combat.list || !combat.list.length) {
      hud.classList.remove('active');
      document.getElementById('screen-player').style.paddingBottom = '';
      return;
    }

    const myEntry    = combat.list.find(x => x.pj_id === Player.pj.id);
    const activeEntry = combat.list[combat.cur];

    if (!myEntry) {
      // Combate ativo mas jogador não está nele
      hud.classList.add('active');
      hud.innerHTML = `
        <div class="pcombat-notif">
          <span class="pcombat-notif-dot"></span>
          <span>⚔️ <strong>Combate ativo</strong></span>
        </div>`;
      document.getElementById('screen-player').style.paddingBottom = '52px';
      return;
    }

    // Jogador está no combate
    const isMyTurn = activeEntry && activeEntry.id === myEntry.id;
    const target   = myEntry.target_id ? combat.list.find(x => x.id === myEntry.target_id) : null;

    const myPct     = myEntry.hp_max > 0 ? Math.max(0, myEntry.hp / myEntry.hp_max * 100) : 100;
    const myHpColor = myPct > 50 ? '#27ae60' : myPct > 25 ? '#f39c12' : '#e74c3c';

    let targetHTML = '';
    if (target) {
      const tPct     = target.hp_max > 0 ? Math.max(0, target.hp / target.hp_max * 100) : 100;
      const tHpColor = tPct > 50 ? '#27ae60' : tPct > 25 ? '#f39c12' : '#e74c3c';
      targetHTML = `
        <div class="pcombat-divider"></div>
        <div class="pcombat-target">
          <div class="pcombat-target-label">⚔️ Atacando</div>
          <div class="pcombat-target-name">${esc(target.name)}</div>
          <div class="pcombat-target-hp">
            <span style="color:${tHpColor};font-weight:700;">${target.hp}</span>
            <span style="color:var(--text2);font-size:11px;"> / ${target.hp_max}</span>
          </div>
          <div class="pcombat-hp-bar"><div class="pcombat-hp-fill" style="width:${tPct}%;background:${tHpColor};"></div></div>
          ${(target.conds||[]).length ? `<div class="pcombat-conds">${target.conds.map(c=>`<span class="pcombat-cond">${esc(c)}</span>`).join('')}</div>` : ''}
        </div>`;
    }

    hud.classList.add('active');
    hud.innerHTML = `
      <div class="pcombat-main${isMyTurn ? ' my-turn' : ''}">
        <div class="pcombat-round">Rodada ${combat.round}</div>
        <div class="pcombat-turn${isMyTurn ? ' active' : ''}">
          ${isMyTurn ? '⚡ Seu turno!' : `Vez de: <strong>${esc(activeEntry ? activeEntry.name : '?')}</strong>`}
        </div>
        <div class="pcombat-my-hp">
          Você: <span style="color:${myHpColor};font-weight:700;">${myEntry.hp}/${myEntry.hp_max}</span>
          ${myEntry.init != null ? `<span style="color:var(--text2);font-size:11px;"> · Init ${myEntry.init}</span>` : ''}
          ${(myEntry.conds||[]).length ? `<div class="pcombat-conds" style="margin-top:3px;">${myEntry.conds.map(c=>`<span class="pcombat-cond">${esc(c)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      ${targetHTML}`;
    document.getElementById('screen-player').style.paddingBottom = '68px';
  }
};

// Allow Enter key to confirm PIN
document.getElementById('pin-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') Player.confirmPin();
});

// Para o heartbeat ao fechar a aba
window.addEventListener('beforeunload', () => Player.stopHeartbeat());

Player.init();
