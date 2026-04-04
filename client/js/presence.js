// ---- HUD de Presença de Jogadores ----
const Presence = {
  _pollTimer: null,
  _prevCount: -1,
  _prevStructKey: '',
  _changedInfo: new Map(), // pjId → { types: Set<string>, timer }
  _prevHP: new Map(),      // pjId → last known hp (from heartbeat)
  _prevState: new Map(),   // pjId → { notes, inventory, private_notes, last_roll_ts }
  _lastRoll: new Map(),    // pjId → { total, desc }

  init() {
    this.poll();
    this._pollTimer = setInterval(() => this.poll(), 1000);
  },

  async poll() {
    try {
      const r = await fetch('/api/gm/active-players');
      if (!r.ok) return;
      const { players } = await r.json();
      this.render(players);
    } catch { /* silencioso */ }
  },

  _triggerChanged(pjId, types) {
    const existing = this._changedInfo.get(pjId);
    if (existing) {
      clearTimeout(existing.timer);
      types.forEach(t => existing.types.add(t));
      existing.timer = setTimeout(() => { this._changedInfo.delete(pjId); this._refreshRows(); }, 5000);
    } else {
      const timer = setTimeout(() => { this._changedInfo.delete(pjId); this._refreshRows(); }, 5000);
      this._changedInfo.set(pjId, { types: new Set(types), timer });
    }
  },

  // Recebe lista de { id, name, types[] } detectados via SSE
  notifyChanges(changes) {
    changes.forEach(c => this._triggerChanged(c.id, c.types));
    this._refreshRows();
  },

  _changeIcons(pjId) {
    const info = this._changedInfo.get(pjId);
    const a = t => (info && info.types.has(t)) ? ' active' : '';
    const roll = this._lastRoll.get(pjId);
    const rollLabel = roll ? `${roll.desc} = ${roll.total}` : 'Dado rolado';
    const rollNum = (info && info.types.has('roll') && roll)
      ? `<span class="chg-dice-num">${roll.total}</span>` : '';
    return `<span class="chg-icon chg-hp${a('hp')}"         title="HP alterado">♥</span>` +
           `<span class="chg-icon chg-notes${a('notes')}"   title="Notas alteradas">✏</span>` +
           `<span class="chg-icon chg-inv${a('inventory')}" title="Inventário alterado">⚔</span>` +
           `<span class="chg-icon chg-priv${a('private')}"  title="Notas privadas">🔒</span>` +
           `<span class="chg-icon chg-dice${a('roll')}"     title="${rollLabel}">🎲${rollNum}</span>`;
  },

  // Atualiza apenas as classes active nos ícones (sem reconstruir o DOM — preserva animação)
  _refreshRows() {
    const listEl = document.getElementById('presence-hud')?.querySelector('.presence-list');
    if (!listEl) return;
    const typeMap = { 'chg-hp': 'hp', 'chg-notes': 'notes', 'chg-inv': 'inventory', 'chg-priv': 'private', 'chg-dice': 'roll' };
    listEl.querySelectorAll('.presence-row').forEach(row => {
      const info = this._changedInfo.get(row.dataset.pjid);
      row.querySelectorAll('.chg-icon').forEach(el => {
        const type = Object.entries(typeMap).find(([cls]) => el.classList.contains(cls))?.[1];
        if (!type) return;
        const shouldBeActive = !!(info && info.types.has(type));
        if (shouldBeActive && !el.classList.contains('active')) {
          el.classList.add('active');       // adicionar a classe reinicia a animação CSS
        } else if (!shouldBeActive) {
          el.classList.remove('active');
        }
      });
    });
  },

  render(players) {
    const hud = document.getElementById('presence-hud');
    if (!hud) return;

    const count = players.length;
    const countChanged = count !== this._prevCount;
    this._prevCount = count;

    const countEl = hud.querySelector('.presence-count');
    const listEl  = hud.querySelector('.presence-list');

    if (countEl) {
      countEl.textContent = count;
      if (countChanged) {
        countEl.classList.remove('presence-flash');
        void countEl.offsetWidth;
        countEl.classList.add('presence-flash');
      }
    }

    if (listEl) {
      // Detecta mudanças nos dados dos jogadores
      players.forEach(p => {
        const pjId = p.pjId;
        if (!pjId) return;

        // HP via heartbeat
        if (p.hp != null) {
          const prevHP = this._prevHP.get(pjId);
          if (prevHP !== undefined && prevHP !== p.hp) this._triggerChanged(pjId, ['hp']);
          this._prevHP.set(pjId, p.hp);
        }

        // Notes/inventário/notas privadas — dados já vêm direto do poll (independente de App.db)
        const prev = this._prevState.get(pjId);
        if (prev) {
          const types = [];
          if (prev.notes          !== p.notes)                                          types.push('notes');
          if (prev.private_notes  !== p.private_notes)                                  types.push('private');
          if (JSON.stringify(prev.inventory) !== JSON.stringify(p.inventory))           types.push('inventory');
          if (prev.last_roll_ts   !== p.last_roll?.ts && p.last_roll?.ts)               types.push('roll');
          if (types.length) this._triggerChanged(pjId, types);
        }
        if (p.last_roll) this._lastRoll.set(pjId, p.last_roll);
        this._prevState.set(pjId, {
          notes:         p.notes,
          inventory:     p.inventory,
          private_notes: p.private_notes,
          last_roll_ts:  p.last_roll?.ts
        });
      });

      // Reconstrói o DOM apenas quando a estrutura muda (jogadores/nomes/HP)
      // Evita resetar animações dos ícones a cada poll
      const structKey = players.map(p => `${p.pjId}:${p.pjName}:${p.hp}/${p.hpMax}:${p.last_roll?.ts||0}`).join('|');
      if (structKey !== this._prevStructKey) {
        this._prevStructKey = structKey;
        listEl.innerHTML = players.length
          ? players.map(p => {
              const hpText = p.hp != null ? `<span class="presence-hp">${p.hp}/${p.hpMax}</span>` : '';
              return `
              <div class="presence-row" data-pjid="${esc(p.pjId || '')}">
                <span class="presence-dot"></span>
                <span class="presence-name">${esc(p.pjName || 'Jogador')}</span>
                ${hpText}
                <span class="presence-icons">${this._changeIcons(p.pjId)}</span>
              </div>`;
            }).join('')
          : '<div class="presence-empty">aguardando jogadores…</div>';
      }

      // Sempre sincroniza estado dos ícones sem reconstruir o DOM
      this._refreshRows();
    }

    hud.dataset.online = count > 0 ? '1' : '0';
  },

  toggle() {
    const hud = document.getElementById('presence-hud');
    if (!hud) return;
    hud.dataset.collapsed = hud.dataset.collapsed === '1' ? '0' : '1';
    const btn = hud.querySelector('.presence-toggle');
    if (btn) btn.textContent = hud.dataset.collapsed === '1' ? '+' : '−';
  }
};

document.addEventListener('DOMContentLoaded', () => Presence.init());
