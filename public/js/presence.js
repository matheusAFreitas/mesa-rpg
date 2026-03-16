// ---- HUD de Presença de Jogadores ----
const Presence = {
  _pollTimer: null,
  _prevCount: -1,

  init() {
    this.poll();
    this._pollTimer = setInterval(() => this.poll(), 10000);
  },

  async poll() {
    try {
      const r = await fetch('/api/gm/active-players');
      if (!r.ok) return;
      const { players } = await r.json();
      this.render(players);
    } catch { /* silencioso — GM pode estar offline brevemente */ }
  },

  render(players) {
    const hud = document.getElementById('presence-hud');
    if (!hud) return;

    const count = players.length;
    const changed = count !== this._prevCount;
    this._prevCount = count;

    const countEl = hud.querySelector('.presence-count');
    const listEl  = hud.querySelector('.presence-list');

    if (countEl) {
      countEl.textContent = count;
      if (changed) {
        countEl.classList.remove('presence-flash');
        void countEl.offsetWidth; // force reflow
        countEl.classList.add('presence-flash');
      }
    }

    if (listEl) {
      listEl.innerHTML = players.length
        ? players.map(p => `
            <div class="presence-row">
              <span class="presence-dot"></span>
              <span class="presence-name">${esc(p.pjName || 'Jogador')}</span>
            </div>`).join('')
        : '<div class="presence-empty">aguardando jogadores…</div>';
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
