const Dashboard = {
  render() {
    const d = new Date();
    document.getElementById('dash-date').textContent =
      d.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    document.getElementById('quick-notes').value = App.db.notes || '';

    // Quick dice buttons
    const qd = document.getElementById('quick-dice-btns');
    if (qd && !qd.dataset.built) {
      qd.dataset.built = '1';
      [4,6,8,10,12,20,100].forEach(s => {
        const b = document.createElement('div');
        b.className = 'qd';
        b.textContent = 'd' + s;
        b.onclick = () => Dice.roll(1, s);
        qd.appendChild(b);
      });
    }

    // Summary counters
    const labels = { pj:'Jogadores', npc:'NPCs', creature:'Criaturas', location:'Locais', session:'Sessões' };
    document.getElementById('dash-summary').innerHTML =
      Object.entries(labels).map(([k,v]) =>
        `<div class="ctr-item"><span class="ctr-label">${v}</span><span class="ctr-val">${App.db[k].length}</span></div>`
      ).join('');
  },

  updateLastRoll(total, desc) {
    const el = document.getElementById('dash-last-roll');
    if (el) el.innerHTML = `<strong style="color:var(--accent);font-size:22px">${total}</strong> <span style="color:var(--text2)">${desc}</span>`;
  }
};
