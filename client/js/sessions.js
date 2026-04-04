const Sessions = {
  render() {
    const el = document.getElementById('session-list');
    if (!App.db.session.length) {
      el.innerHTML = `<div class="empty" style="grid-column:unset"><div class="ei">📖</div><p>Nenhuma sessão registrada ainda.</p></div>`;
      return;
    }
    el.innerHTML = [...App.db.session].reverse().map(s => `
      <div class="sitem">
        <div class="shead">
          <div>
            <div class="snum">Sessão ${esc(s.num)} — ${esc(s.date)}</div>
            <div class="stitle">${esc(s.title)||'(sem título)'}</div>
          </div>
          <div style="display:flex;gap:5px;">
            <button class="btn btn-secondary btn-sm" onclick="App.openModal('session','${s.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="App.deleteItem('session','${s.id}')">✕</button>
          </div>
        </div>
        ${s.summary ? `<div class="snotes">${esc(s.summary)}</div>` : ''}
        ${s.npcs_met ? `<div style="font-size:10px;color:var(--text2);margin-top:6px;">👥 ${esc(s.npcs_met)}</div>` : ''}
        ${s.locations ? `<div style="font-size:10px;color:var(--text2);">📍 ${esc(s.locations)}</div>` : ''}
      </div>`).join('');
  }
};
