// Universos padrão — semeados no primeiro uso
const DEFAULT_UNIVERSES = [
  { id: 'u-doom',  name: 'Doom',              color: '#cc2222' },
  { id: 'u-fo',    name: 'Fallout',            color: '#aaaa22' },
  { id: 'u-twd',   name: 'The Walking Dead',   color: '#889944' },
  { id: 'u-l4d',   name: 'Left 4 Dead',        color: '#44aa44' },
  { id: 'u-at',    name: 'All Tomorrows',       color: '#9966dd' },
  { id: 'u-ryu',   name: 'Ryukendo',            color: '#4499cc' },
];

// ---- APP ----
const App = {
  db: null,
  _saveTimer: null,

  async init() {
    this.db = await Api.load();
    // Seed universes if missing
    if (!this.db.universes || !this.db.universes.length) {
      this.db.universes = DEFAULT_UNIVERSES.map(u => ({ ...u }));
      await Api.save(this.db);
    }
    this.setupNav();
    this.render('dashboard');
    Requests.updateBadge();
    this.startSSE();
    document.addEventListener('input', e => {
      if (e.target.id === 'quick-notes') { this.db.notes = e.target.value; this.save(); }
    });
  },

  // ---- Persistência ----
  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      Api.save(this.db);
      this._saveTimer = null;
      this._lastSaveTime = Date.now();
    }, 600);
  },

  // ---- Sincronização em tempo real ----
  startSSE() {
    const es = new EventSource('/api/events');
    es.onmessage = async () => {
      try {
        const fresh = await Api.load();
        if (JSON.stringify(fresh) === JSON.stringify(this.db)) return;

        // Detecta PJs que alteraram hp, notes, inventário ou notas privadas
        // (sempre executa, independente dos guards — atividade do jogador nunca deve ser ignorada)
        if (window.Presence) {
          const changed = [];
          (fresh.pj || []).forEach(newPj => {
            const old = (this.db.pj || []).find(p => p.id === newPj.id);
            if (!old) return;
            const types = [];
            if (old.hp            !== newPj.hp)                                              types.push('hp');
            if (old.notes         !== newPj.notes)                                           types.push('notes');
            if (JSON.stringify(old.inventory) !== JSON.stringify(newPj.inventory))           types.push('inventory');
            if (old.private_notes !== newPj.private_notes)                                   types.push('private');
            if (types.length) changed.push({ id: newPj.id, name: newPj.name, types });
          });
          if (changed.length) Presence.notifyChanges(changed);
        }

        // Atualiza o db local antes dos guards para que o poll() tenha dados frescos
        this.db = fresh;
        Requests.updateBadge();

        // Guards aplicados apenas ao re-render da view do GM (evita loop nos próprios saves)
        if (document.getElementById('overlay').classList.contains('open')) return;
        if (this._saveTimer) return;
        if (this._lastSaveTime && Date.now() - this._lastSaveTime < 1500) return;

        const active = document.querySelector('.nav-item.active');
        if (active) this.render(active.dataset.s);

        // Atualiza presença imediatamente após qualquer mudança de DB
        if (window.Presence) Presence.poll();
      } catch (err) {
        console.error('[SSE] Falha ao sincronizar:', err);
      }
    };
    es.onerror = (err) => {
      console.warn('[SSE] Conexão perdida, tentando reconectar...', err);
    };
  },

  // ---- Navegação ----
  setupNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      if (!el.dataset.s) return;
      el.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        const s = el.dataset.s;
        document.getElementById('s-' + s).classList.add('active');
        this.render(s);
      });
    });
  },

  render(s) {
    switch (s) {
      case 'dashboard':   Dashboard.render();        break;
      case 'pj':          Cards.render('pj');         break;
      case 'npc':         Cards.render('npc');        break;
      case 'creature':    Cards.render('creature');   break;
      case 'location':    Cards.render('location');   break;
      case 'session':     Sessions.render();          break;
      case 'combat':      Combat.render();            break;
      case 'dice':        Dice.setup();               break;
      case 'map-world':   WorldMap.init();            break;
      case 'map-dungeon': DungeonMap.init();          break;
      case 'universes':   Universes.render();         break;
      case 'requests':    Requests.render();          break;
    }
  },

  // ---- Universos ----
  getUniverseNames() {
    return (this.db.universes || []).map(u => u.name);
  },

  getUniverseOptions(selected) {
    return (this.db.universes || []).map(u =>
      `<option${u.name === selected ? ' selected' : ''}>${u.name}</option>`
    ).join('');
  },

  tagStyle(name) {
    const u = (this.db.universes || []).find(x => x.name === name);
    if (!u) return '';
    return `background:${hexToRgba(u.color, 0.13)};color:${u.color};border-color:${hexToRgba(u.color, 0.4)}`;
  },

  uNodeFill(name) {
    const u = (this.db.universes || []).find(x => x.name === name);
    return u ? hexToRgba(u.color, 0.18) : '#1a1a1a';
  },

  uNodeBorder(name) {
    const u = (this.db.universes || []).find(x => x.name === name);
    return u ? u.color : '#444';
  },

  // ---- Modal ----
  _mType: null,
  _mId: null,
  _pendingApprovalId: null,

  openModal(type, id = null, prefill = null) {
    this._mType = type;
    this._mId = id;

    let formHTML = '';
    if (type === 'combatant') {
      formHTML = Combat.modalForm();
    } else if (type === 'dungeon') {
      DungeonMap.openNewModal(); return;
    } else if (type === 'universe') {
      Universes.openAdd(id); return;
    } else {
      const item = id ? this.db[type]?.find(x => x.id === id) : (prefill || null);
      formHTML = Cards.modalForm(type, item);
    }

    document.getElementById('modal-body').innerHTML = formHTML + `
      <div class="modal-btns">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.saveModal()">Salvar</button>
      </div>`;
    document.getElementById('overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('overlay').classList.remove('open');
    this._pendingApprovalId = null;
  },

  closeModalOutside(e) {
    if (e.target === document.getElementById('overlay')) this.closeModal();
  },

  saveModal() {
    const type = this._mType, id = this._mId;

    if (type === 'combatant') { Combat.saveFromModal(); return; }
    if (type === 'dungeon')   { DungeonMap.saveFromModal(); return; }
    if (type === 'universe')  { Universes.saveFromModal(); return; }

    const item = Cards.readForm(type);
    if (type === 'session') {
      if (!item.title) { alert('Título é obrigatório!'); return; }
    } else {
      if (!item.name) { alert('Nome é obrigatório!'); return; }
    }
    if (type === 'pj' && (!item.hp || !item.hp_max)) { alert('HP Atual e HP Máximo são obrigatórios!'); return; }

    if (id) {
      const idx = this.db[type].findIndex(x => x.id === id);
      if (idx >= 0) this.db[type][idx] = { ...this.db[type][idx], ...item };
    } else {
      item.id = this._pendingApprovalId || uid();
      if (this._pendingApprovalId) {
        this.db.pending_pj = (this.db.pending_pj || []).filter(p => p.id !== this._pendingApprovalId);
        this._pendingApprovalId = null;
      }
      this.db[type].push(item);
    }

    this.save();
    this.closeModal();
    this.render(document.querySelector('.nav-item.active').dataset.s);
  },

  // ---- CRUD ----
  deleteItem(type, id) {
    if (!confirm('Remover este item?')) return;
    this.db[type] = this.db[type].filter(x => x.id !== id);
    this.save();
    this.render(document.querySelector('.nav-item.active').dataset.s);
  },

  addToCombat(type, srcId) {
    const src = this.db[type].find(x => x.id === srcId);
    if (!src) return;
    this.db.combat.list.push({
      id: uid(), name: src.name, type: 'enemy',
      hp: parseInt(src.hp) || 10, hp_max: parseInt(src.hp) || 10,
      init: null, conds: []
    });
    this.save();
    document.querySelector('[data-s="combat"]').click();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
