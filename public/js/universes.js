const Universes = {
  render() {
    const el = document.getElementById('universe-cards');
    const list = App.db.universes || [];

    if (!list.length) {
      el.innerHTML = `<div class="empty"><div class="ei">🌌</div><p>Nenhum universo cadastrado.</p></div>`;
      return;
    }

    el.innerHTML = list.map(u => `
      <div class="card" style="border-left: 3px solid ${u.color};">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:28px;height:28px;border-radius:50%;background:${hexToRgba(u.color,0.18)};border:2px solid ${u.color};flex-shrink:0;"></div>
            <div>
              <div class="card-title">${u.name}</div>
              <span class="tag" style="${App.tagStyle(u.name)}">${u.name}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="Universes.openEdit('${u.id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="Universes.delete('${u.id}')">✕</button>
          </div>
        </div>
      </div>`).join('');
  },

  openAdd(editId = null) {
    const u = editId ? App.db.universes.find(x => x.id === editId) : null;
    App._mType = 'universe';
    App._mId = editId;

    document.getElementById('modal-body').innerHTML = `
      <h3>${u ? 'Editar' : 'Novo'} Universo</h3>
      <div class="fg">
        <label>Nome</label>
        <input class="fc" id="f-uname" value="${u?.name || ''}" placeholder="ex: Star Wars, Warhammer...">
      </div>
      <div class="fg">
        <label>Cor</label>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="color" id="f-ucolor" value="${u?.color || '#888888'}" style="width:50px;height:36px;border:none;background:none;cursor:pointer;padding:0;">
          <span style="font-size:12px;color:var(--text2)">Cor usada nas tags e no mapa</span>
        </div>
      </div>
      <div class="fg" style="margin-top:4px;">
        <label>Pré-definidas</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          ${[['#cc2222','Vermelho'],['#aaaa22','Amarelo'],['#22aa22','Verde'],['#2266cc','Azul'],
             ['#9944cc','Roxo'],['#cc6622','Laranja'],['#22aacc','Ciano'],['#cc2266','Rosa'],
             ['#888888','Cinza'],['#dddddd','Branco']].map(([c,n]) =>
            `<div title="${n}" onclick="document.getElementById('f-ucolor').value='${c}'"
              style="width:22px;height:22px;border-radius:4px;background:${c};cursor:pointer;border:2px solid rgba(255,255,255,0.15);"></div>`
          ).join('')}
        </div>
      </div>
      <div class="modal-btns">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Universes.saveFromModal()">Salvar</button>
      </div>`;
    document.getElementById('overlay').classList.add('open');
  },

  openEdit(id) {
    this.openAdd(id);
  },

  saveFromModal() {
    const name  = (gv('f-uname') || '').trim();
    const color = gv('f-ucolor') || '#888888';
    if (!name) { alert('Nome é obrigatório!'); return; }

    const id = App._mId;
    if (id) {
      const u = App.db.universes.find(x => x.id === id);
      if (u) { u.name = name; u.color = color; }
    } else {
      App.db.universes.push({ id: uid(), name, color });
    }

    App.save();
    App.closeModal();
    this.render();
  },

  delete(id) {
    const u = App.db.universes.find(x => x.id === id);
    if (!u) return;
    if (!confirm(`Remover o universo "${u.name}"?\nIsso não remove os itens que usam esse universo.`)) return;
    App.db.universes = App.db.universes.filter(x => x.id !== id);
    App.save();
    this.render();
  }
};
