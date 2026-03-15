// ---- HELPERS ----
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function gv(id) { const el = document.getElementById(id); return el ? el.value : null; }

function parseStats(s) {
  if (!s) return {};
  const out = {};
  s.split(',').forEach(p => { const [k,v] = (p||'').trim().split(':'); if (k&&v) out[k.trim().toUpperCase()] = v.trim(); });
  return out;
}

function hexToRgba(hex, alpha) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Default universes seeded on first run
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
    this.startPolling();
    document.addEventListener('input', e => {
      if (e.target.id === 'quick-notes') { this.db.notes = e.target.value; this.save(); }
    });
  },

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      Api.save(this.db);
      this._saveTimer = null;
    }, 600);
  },

  startPolling() {
    setInterval(async () => {
      // Skip if GM has a modal open or has unsaved changes in progress
      if (document.getElementById('overlay').classList.contains('open')) return;
      if (this._saveTimer) return;

      const fresh = await Api.load();
      if (JSON.stringify(fresh) === JSON.stringify(this.db)) return;

      this.db = fresh;
      const active = document.querySelector('.nav-item.active');
      if (active) this.render(active.dataset.s);
    }, 8000);
  },

  setupNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
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
    switch(s) {
      case 'dashboard':   Dashboard.render(); break;
      case 'pj':          Cards.render('pj'); break;
      case 'npc':         Cards.render('npc'); break;
      case 'creature':    Cards.render('creature'); break;
      case 'location':    Cards.render('location'); break;
      case 'session':     Sessions.render(); break;
      case 'combat':      Combat.render(); break;
      case 'dice':        Dice.setup(); break;
      case 'map-world':   WorldMap.init(); break;
      case 'map-dungeon': DungeonMap.init(); break;
      case 'universes':   Universes.render(); break;
    }
  },

  // ---- Universe helpers ----
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

  // ---- MODAL ----
  _mType: null,
  _mId: null,

  openModal(type, id = null) {
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
      const item = id ? this.db[type]?.find(x => x.id === id) : null;
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
    if (!item.name) { alert('Nome é obrigatório!'); return; }

    if (id) {
      const idx = this.db[type].findIndex(x => x.id === id);
      if (idx >= 0) this.db[type][idx] = { ...this.db[type][idx], ...item };
    } else {
      item.id = uid();
      this.db[type].push(item);
    }

    this.save();
    this.closeModal();
    this.render(document.querySelector('.nav-item.active').dataset.s);
  },

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
