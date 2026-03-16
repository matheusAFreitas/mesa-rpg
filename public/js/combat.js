const Combat = {
  render() {
    const c = App.db.combat;
    const ctrl = document.getElementById('combat-ctrl');
    ctrl.innerHTML = `
      <div class="round-info">Rodada <strong>${c.round}</strong></div>
      <button class="btn btn-secondary" onclick="Combat.nextTurn()">▶ Próximo Turno</button>
      <button class="btn btn-secondary" onclick="Combat.rollAllInit()">🎲 Rolar Iniciativa</button>
      <button class="btn btn-secondary" onclick="Combat.sort()">↕ Ordenar</button>
      <button class="btn btn-danger" onclick="Combat.clear()">🗑 Limpar</button>`;

    const el = document.getElementById('combat-list');
    if (!c.list.length) {
      el.innerHTML = `<div class="empty"><div class="ei">⚔️</div><p>Nenhum combatente.</p></div>`;
      return;
    }
    el.innerHTML = c.list.map((x, i) => {
      const pct = x.hp_max > 0 ? Math.max(0, x.hp / x.hp_max * 100) : 100;
      const hpClass = pct > 50 ? 'hp-ok' : pct > 25 ? 'hp-warn' : 'hp-crit';
      const cur = i === c.cur;
      return `<div class="crow ${cur?'active-turn':''} ${x.hp<=0?'dead':''}">
        <span style="width:12px;color:var(--accent);font-size:11px;">${cur?'▶':''}</span>
        <div class="init-badge">${x.init??'?'}</div>
        <div class="cname">
          ${esc(x.name)}
          <div style="margin-top:2px;font-size:10px;">
            <span class="tag">${x.type==='player'?'PJ':'Inimigo'}</span>
            ${(x.conds||[]).map(c=>`<span class="tag" style="color:#ff9944">${esc(c)}</span>`).join('')}
          </div>
        </div>
        <div class="hp-ctrl">
          <span class="hp-lbl ${hpClass}">${x.hp}/${x.hp_max||'?'}</span>
          <input type="number" class="hp-tiny" id="hd-${x.id}" placeholder="±">
          <button class="btn btn-danger btn-sm" onclick="Combat.applyDmg('${x.id}')">Dano</button>
          <button class="btn btn-ok btn-sm" onclick="Combat.applyHeal('${x.id}')">Cura</button>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm" onclick="Combat.setInit('${x.id}')">🎲</button>
          <button class="btn btn-secondary btn-sm" onclick="Combat.addCond('${x.id}')">+</button>
          <button class="btn btn-danger btn-sm" onclick="Combat.remove('${x.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  },

  nextTurn() {
    const c = App.db.combat;
    if (!c.list.length) return;
    c.cur = (c.cur + 1) % c.list.length;
    if (c.cur === 0) c.round++;
    App.save(); this.render();
  },

  sort() {
    App.db.combat.list.sort((a,b) => (b.init||0) - (a.init||0));
    App.db.combat.cur = 0;
    App.save(); this.render();
  },

  rollAllInit() {
    App.db.combat.list.forEach(x => x.init = Math.floor(Math.random()*20)+1);
    this.sort();
  },

  clear() {
    Dialog.confirm('Limpar o combate atual?', () => {
      App.db.combat = { list:[], round:1, cur:0 };
      App.save(); this.render();
    });
  },

  _syncHpToPj(x) {
    if (!x.pj_id) return;
    const pj = App.db.pj.find(p => p.id === x.pj_id);
    if (pj) pj.hp = x.hp;
  },

  applyDmg(id) {
    const x = App.db.combat.list.find(c => c.id === id);
    if (!x) return;
    const v = parseInt(document.getElementById('hd-'+id).value) || 0;
    x.hp = Math.max(0, x.hp - v);
    this._syncHpToPj(x);
    App.save(); this.render();
  },

  applyHeal(id) {
    const x = App.db.combat.list.find(c => c.id === id);
    if (!x) return;
    const v = parseInt(document.getElementById('hd-'+id).value) || 0;
    x.hp = Math.min(x.hp_max || 999, x.hp + v);
    this._syncHpToPj(x);
    App.save(); this.render();
  },

  setInit(id) {
    const x = App.db.combat.list.find(c => c.id === id);
    if (!x) return;
    Dialog.prompt(`Iniciativa para <strong>${esc(x.name)}</strong>:`, x.init || '', val => {
      x.init = parseInt(val) || 0; App.save(); this.render();
    }, { type: 'number' });
  },

  addCond(id) {
    const x = App.db.combat.list.find(c => c.id === id);
    if (!x) return;
    Dialog.prompt('Condição:', '', val => {
      const v = val.trim();
      if (!v) return;
      if (!x.conds) x.conds = [];
      x.conds.push(v); App.save(); this.render();
    }, { placeholder: 'ex: Sangrando, Atordoado, Infectado' });
  },

  remove(id) {
    App.db.combat.list = App.db.combat.list.filter(x => x.id !== id);
    App.save(); this.render();
  },

  modalForm() {
    return `<h3>Adicionar Combatente</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value=""></div>
      <div class="fr2">
        <div class="fg"><label>Tipo</label><select class="fc" id="f-type">
          <option value="player">PJ</option><option value="enemy">Inimigo</option>
        </select></div>
        <div class="fg"><label>Iniciativa</label><input type="number" class="fc" id="f-init" value=""></div>
      </div>
      <div class="fr2">
        <div class="fg"><label>HP Atual</label><input type="number" class="fc" id="f-hp" value="10"></div>
        <div class="fg"><label>HP Máximo</label><input type="number" class="fc" id="f-hp_max" value="10"></div>
      </div>`;
  },

  saveFromModal() {
    const name = getVal('f-name');
    if (!name) { alert('Nome é obrigatório!'); return; }
    App.db.combat.list.push({
      id: uid(), name, type: getVal('f-type'),
      init: +getVal('f-init') || null,
      hp: +getVal('f-hp') || 10, hp_max: +getVal('f-hp_max') || 10, conds: []
    });
    App.save();
    App.closeModal();
    this.render();
  }
};
