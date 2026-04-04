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
  },

  exportDB() {
    const json = JSON.stringify(App.db, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `mesa-rpg-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importDB() {
    document.getElementById('import-file').value = '';
    document.getElementById('import-file').click();
  },

  _onImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let parsed;
      try { parsed = JSON.parse(e.target.result); } catch (_) {
        alert('Arquivo inválido: não é um JSON válido.'); return;
      }
      Dialog.confirm(
        `Substituir <strong>todos os dados</strong> pelo backup "<em>${esc(file.name)}</em>"?<br>` +
        `<span style="font-size:12px;color:var(--text2)">Esta ação não pode ser desfeita.</span>`,
        async () => {
          await Api.save(parsed);
          App.db = await Api.load();
          App.render(document.querySelector('.nav-item.active').dataset.s);
          Requests.updateBadge();
        }
      );
    };
    reader.readAsText(file);
  }
};
