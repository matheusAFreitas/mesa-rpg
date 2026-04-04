const Dice = {
  log: [],
  ready: false,

  setup() {
    if (this.ready) return;
    this.ready = true;
    const DICE = [[4,'◆'],[6,'⬡'],[8,'◈'],[10,'⬟'],[12,'⬠'],[20,'⭐'],[100,'💯']];
    const el = document.getElementById('dice-btns');
    if (el && !el.dataset.built) {
      el.dataset.built = '1';
      DICE.forEach(([s,icon]) => {
        const b = document.createElement('div');
        b.className = 'die-btn';
        b.innerHTML = `<span class="die-icon">${icon}</span><span class="die-lbl">d${s}</span>`;
        b.onclick = () => this.roll(1, s);
        el.appendChild(b);
      });
    }
  },

  roll(qty, sides, mod = 0) {
    const rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a,b) => a+b, 0) + mod;
    const desc = `${qty}d${sides}${mod>0?'+'+mod:mod<0?mod:''}`;
    const detail = qty > 1 ? `[${rolls.join(', ')}]${mod ? ` ${mod>0?'+':''}${mod}` : ''}` : (mod ? `${mod>0?'+':''}${mod}` : '');

    const numEl = document.getElementById('dice-num');
    if (numEl) {
      numEl.textContent = total;
      numEl.style.color = sides===20&&total===20 ? '#f0c040' : sides===20&&total===1 ? '#cc4444' : 'var(--accent)';
    }
    const detEl = document.getElementById('dice-detail');
    if (detEl) detEl.textContent = `${desc} ${detail}`;

    this.log.unshift({ desc, total, detail, t: new Date().toLocaleTimeString('pt-BR') });
    this.log = this.log.slice(0, 25);
    this.renderHistory();
    Dashboard.updateLastRoll(total, desc);
    return total;
  },

  rollCustom() {
    const qty   = parseInt(document.getElementById('dc-qty').value) || 1;
    const sides = parseInt(document.getElementById('dc-sides').value) || 6;
    const mod   = parseInt(document.getElementById('dc-mod').value) || 0;
    this.roll(qty, sides, mod);
  },

  renderHistory() {
    const el = document.getElementById('dice-history');
    if (!el) return;
    el.innerHTML = this.log.map(h =>
      `<div style="padding:2px 0;border-bottom:1px solid var(--border)">${h.t} — <b>${h.desc}</b> = <span style="color:var(--accent)">${h.total}</span> ${h.detail}</div>`
    ).join('');
  }
};
