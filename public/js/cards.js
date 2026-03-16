const BASE_STATS = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'];

// Debounced search handler — called from oninput in HTML
const _searchDebounced = {};

const Cards = {

  // ---- Atributos (stats editor) ----
  statRowHTML(k = '', v = '', fixed = false) {
    const keyInput = fixed
      ? `<input type="text" class="fc stat-key" value="${k}" readonly style="color:var(--text2);cursor:default;">`
      : `<input type="text" class="fc stat-key" placeholder="NOME" value="${k}" maxlength="10">`;
    const removeBtn = fixed
      ? `<span style="width:26px;flex-shrink:0;"></span>`
      : `<button type="button" class="btn-icon-sm" onclick="this.closest('.stats-row').remove()" title="Remover">✕</button>`;
    return `<div class="stats-row">
      ${keyInput}
      <input type="number" class="fc stat-val" placeholder="0" value="${v}">
      ${removeBtn}
    </div>`;
  },

  // ---- Busca com debounce ----
  search(type) {
    if (!_searchDebounced[type]) {
      _searchDebounced[type] = debounce(() => Cards.render(type), 250);
    }
    _searchDebounced[type]();
  },

  addStatRow() {
    document.getElementById('stats-editor').insertAdjacentHTML('beforeend', this.statRowHTML());
    const rows = document.querySelectorAll('#stats-editor .stats-row');
    rows[rows.length - 1].querySelector('.stat-key').focus();
  },

  // ---- Inventário (editor no modal) ----
  invRowHTML(item = {}) {
    const id = item.id || ('i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4));
    return `<div class="inv-row" style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
      <input type="hidden" class="inv-id" value="${id}">
      <input type="text" class="fc inv-name" placeholder="Nome do item" value="${esc(item.name||'')}" style="flex:1;">
      <input type="number" class="fc inv-qty" value="${item.qty||1}" min="1" style="width:64px;">
      <button type="button" class="btn-icon-sm" onclick="this.closest('.inv-row').remove()" title="Remover">✕</button>
    </div>`;
  },

  addInvRow() {
    document.getElementById('inv-editor').insertAdjacentHTML('beforeend', this.invRowHTML());
    const rows = document.querySelectorAll('#inv-editor .inv-row');
    rows[rows.length - 1].querySelector('.inv-name').focus();
  },

  // ---- Renderização da lista ----
  render(type) {
    const q = (document.getElementById('search-' + type) || {}).value || '';
    const items = App.db[type].filter(i => !q || JSON.stringify(i).toLowerCase().includes(q.toLowerCase()));
    const el = document.getElementById('cards-' + type);
    if (!items.length) {
      el.innerHTML = `<div class="empty"><div class="ei">📭</div><p>Nenhum registro.</p></div>`;
      return;
    }
    el.innerHTML = items.map(i => this.cardHTML(type, i)).join('');
  },

  // ---- HTML de cada card (por tipo) ----
  cardHTML(type, i) {
    const uStyle = App.tagStyle(i.universe);
    const editBtn = `<button class="btn btn-secondary btn-sm" onclick="App.openModal('${type}','${i.id}')">✏</button>`;
    const delBtn  = `<button class="btn btn-danger btn-sm" onclick="App.deleteItem('${type}','${i.id}')">✕</button>`;
    const combatBtn = (type==='creature'||type==='npc')
      ? `<button class="btn btn-ok btn-sm" title="Adicionar ao combate" onclick="App.addToCombat('${type}','${i.id}')">⚔</button>` : '';
    const acts = `<div class="card-actions">${editBtn}${delBtn}${combatBtn}</div>`;

    if (type === 'pj') {
      const pct = i.hp_max > 0 ? Math.max(0, i.hp / i.hp_max * 100) : 100;
      const col = pct > 50 ? 'var(--ok)' : pct > 25 ? 'var(--warn)' : 'var(--danger)';
      const statsHTML = i.stats ? Object.entries(i.stats).filter(([,v])=>v)
        .map(([k,v]) => `<div class="stat"><div class="stat-label">${esc(k)}</div><div class="stat-value">${esc(v)}</div></div>`).join('') : '';
      const lvl = i.level || 1;
      const xp = i.xp || 0; const xpNext = i.xp_next || 0;
      const xpPct = xpNext > 0 ? Math.min(100, xp / xpNext * 100) : 0;
      const inv = i.inventory || [];
      const invHTML = inv.length
        ? inv.map(it => `<span class="tag" style="font-size:10px;">${esc(it.name)}${it.qty>1?` ×${it.qty}`:''}</span>`).join(' ')
        : `<span style="font-size:11px;color:var(--text2)">—</span>`;
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${esc(i.name)} <span style="font-size:11px;color:var(--accent);font-weight:600;">Nv.${lvl}</span></div>
          <span class="tag" style="${uStyle}">${esc(i.universe)||'—'}</span>${i.class?`<span class="tag">${esc(i.class)}</span>`:''}
        </div>${acts}</div>
        ${i.hp_max>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2)"><span>HP</span><span>${esc(i.hp)}/${esc(i.hp_max)}</span></div>
        <div class="hp-bar"><div class="hp-fill" style="width:${pct}%;background:${col}"></div></div>`:''}
        ${xpNext>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:4px"><span>XP</span><span>${xp}/${xpNext}</span></div>
        <div class="hp-bar"><div class="hp-fill" style="width:${xpPct}%;background:var(--accent)"></div></div>`:''}
        <div class="stat-block">${statsHTML}</div>
        <div style="margin-top:6px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:3px;">Inventário</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">${invHTML}</div>
        ${i.notes?`<div class="card-notes">${esc(i.notes)}</div>`:''}
      </div>`;
    }

    if (type === 'npc') {
      const attCol = i.attitude==='Aliado'?'#55cc55':i.attitude==='Inimigo'?'#cc5555':'#cccc55';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${esc(i.name)}</div>
          <span class="tag" style="${uStyle}">${esc(i.universe)||'—'}</span>
          ${i.faction?`<span class="tag">${esc(i.faction)}</span>`:''}
          ${i.attitude?`<span class="tag" style="color:${attCol}">${esc(i.attitude)}</span>`:''}
        </div>${acts}</div>
        ${i.role?`<div style="font-size:11px;color:var(--text2);margin-bottom:5px;">${esc(i.role)}</div>`:''}
        ${i.notes?`<div class="card-notes">${esc(i.notes)}</div>`:''}
      </div>`;
    }

    if (type === 'creature') {
      const thrCol = (i.threat==='Alta'||i.threat==='Extrema') ? '#cc5555' : i.threat==='Média' ? '#ccaa44' : '#55cc55';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${esc(i.name)}</div>
          <span class="tag" style="${uStyle}">${esc(i.universe)||'—'}</span>
          ${i.threat?`<span class="tag" style="color:${thrCol}">${esc(i.threat)}</span>`:''}
        </div>${acts}</div>
        <div class="stat-block">
          ${i.hp?`<div class="stat"><div class="stat-label">HP</div><div class="stat-value">${esc(i.hp)}</div></div>`:''}
          ${i.armor?`<div class="stat"><div class="stat-label">Arm.</div><div class="stat-value">${esc(i.armor)}</div></div>`:''}
          ${i.damage?`<div class="stat"><div class="stat-label">Dano</div><div class="stat-value">${esc(i.damage)}</div></div>`:''}
        </div>
        ${i.abilities?`<div class="card-notes">${esc(i.abilities)}</div>`:''}
      </div>`;
    }

    if (type === 'location') {
      const stCol = i.status==='Seguro'?'#55cc55':i.status==='Perigoso'?'#cc5555':'var(--text2)';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${esc(i.name)}</div>
          <span class="tag" style="${uStyle}">${esc(i.universe)||'—'}</span>
          ${i.status?`<span class="tag" style="color:${stCol}">${esc(i.status)}</span>`:''}
        </div>${acts}</div>
        ${i.description?`<div class="card-notes">${esc(i.description)}</div>`:''}
        ${i.connections?`<div style="font-size:10px;color:var(--text2);margin-top:5px;">📍 ${esc(i.connections)}</div>`:''}
      </div>`;
    }
    return '';
  },

  // ---- Formulários do modal (por tipo) ----
  modalForm(type, i) {
    const unis = App.getUniverseOptions(i?.universe);

    if (type === 'pj') return `<h3>${i?'Editar':'Novo'} PJ</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="${i?.name||''}"></div>
      <div class="fr2">
        <div class="fg"><label>Classe/Origem</label><input class="fc" id="f-class" value="${i?.class||''}"></div>
        <div class="fg"><label>Universo</label><select class="fc" id="f-universe">${unis}</select></div>
      </div>
      <div class="fr2">
        <div class="fg"><label>HP Atual *</label><input type="number" class="fc" id="f-hp" value="${i?.hp||''}" onchange="const m=document.getElementById('f-hp_max');if(!m.value)m.value=this.value;"></div>
        <div class="fg"><label>HP Máximo *</label><input type="number" class="fc" id="f-hp_max" value="${i?.hp_max||''}"></div>
      </div>
      <div class="fr3">
        <div class="fg"><label>Nível</label><input type="number" class="fc" id="f-level" value="${i?.level||1}" min="1"></div>
        <div class="fg"><label>XP Atual</label><input type="number" class="fc" id="f-xp" value="${i?.xp||0}" min="0"></div>
        <div class="fg"><label>XP p/ Próx. Nível</label><input type="number" class="fc" id="f-xp_next" value="${i?.xp_next||0}" min="0" placeholder="0 = sem barra"></div>
      </div>
      <div class="fg">
        <label>Atributos</label>
        <div id="stats-editor" class="stats-editor">
          ${BASE_STATS.map(k => Cards.statRowHTML(k, i?.stats?.[k] || '', true)).join('')}
          ${i?.stats ? Object.entries(i.stats).filter(([k])=>!BASE_STATS.includes(k)).map(([k,v])=>Cards.statRowHTML(k,v)).join('') : ''}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="Cards.addStatRow()">+ Atributo Custom</button>
      </div>
      <div class="fg"><label>Inventário</label>
        <div id="inv-editor">
          ${(i?.inventory||[]).map(it => Cards.invRowHTML(it)).join('')}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="Cards.addInvRow()">+ Adicionar Item</button>
      </div>
      <div class="fg"><label>Anotações (jogador vê e edita)</label><textarea class="fc" id="f-notes">${i?.notes||''}</textarea></div>
      <div class="fg"><label>Recados para o Jogador (Mestre escreve — jogador só lê)</label><textarea class="fc" id="f-gm_to_player_notes" style="border-color:#1a4a5a">${i?.gm_to_player_notes||''}</textarea></div>
      <div class="fg"><label>Notas Secretas do Mestre (jogador não vê — mas é avisado que algo foi escrito)</label><textarea class="fc" id="f-gm_notes" style="border-color:#5a3a1a">${i?.gm_notes||''}</textarea></div>
      <div class="fg"><label>PIN do Jogador (opcional — protege a ficha na visão de jogador)</label><input class="fc" id="f-pin" placeholder="Deixe em branco para sem PIN" value="${i?.pin||''}"></div>`;

    if (type === 'npc') return `<h3>${i?'Editar':'Novo'} NPC</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="${i?.name||''}"></div>
      <div class="fr2">
        <div class="fg"><label>Facção/Grupo</label><input class="fc" id="f-faction" value="${i?.faction||''}"></div>
        <div class="fg"><label>Universo</label><select class="fc" id="f-universe">${unis}</select></div>
      </div>
      <div class="fr2">
        <div class="fg"><label>Papel/Função</label><input class="fc" id="f-role" value="${i?.role||''}"></div>
        <div class="fg"><label>Atitude</label><select class="fc" id="f-attitude">
          ${['Neutro','Aliado','Inimigo','Desconhecido'].map(a=>`<option${i?.attitude===a?' selected':''}>${a}</option>`).join('')}
        </select></div>
      </div>
      <div class="fg"><label>Anotações</label><textarea class="fc" id="f-notes">${i?.notes||''}</textarea></div>`;

    if (type === 'creature') return `<h3>${i?'Editar':'Nova'} Criatura</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="${i?.name||''}"></div>
      <div class="fr2">
        <div class="fg"><label>Universo</label><select class="fc" id="f-universe">${unis}</select></div>
        <div class="fg"><label>Ameaça</label><select class="fc" id="f-threat">
          ${['Baixa','Média','Alta','Extrema'].map(t=>`<option${i?.threat===t?' selected':''}>${t}</option>`).join('')}
        </select></div>
      </div>
      <div class="fr3">
        <div class="fg"><label>HP</label><input type="number" class="fc" id="f-hp" value="${i?.hp||''}"></div>
        <div class="fg"><label>Armadura</label><input class="fc" id="f-armor" value="${i?.armor||''}"></div>
        <div class="fg"><label>Dano</label><input class="fc" id="f-damage" value="${i?.damage||''}"></div>
      </div>
      <div class="fg"><label>Habilidades / Comportamento</label><textarea class="fc" id="f-abilities">${i?.abilities||''}</textarea></div>`;

    if (type === 'location') return `<h3>${i?'Editar':'Novo'} Local</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="${i?.name||''}"></div>
      <div class="fr2">
        <div class="fg"><label>Universo</label><select class="fc" id="f-universe">${unis}</select></div>
        <div class="fg"><label>Status</label><select class="fc" id="f-status">
          ${['Seguro','Perigoso','Abandonado','Destruído','Desconhecido'].map(s=>`<option${i?.status===s?' selected':''}>${s}</option>`).join('')}
        </select></div>
      </div>
      <div class="fg"><label>Descrição</label><textarea class="fc" id="f-description">${i?.description||''}</textarea></div>
      <div class="fg"><label>Conexões / Locais próximos</label><input class="fc" id="f-connections" value="${i?.connections||''}"></div>`;

    if (type === 'session') return `<h3>${i?'Editar':'Nova'} Sessão</h3>
      <div class="fr2">
        <div class="fg"><label>Número</label><input type="number" class="fc" id="f-num" value="${i?.num||App.db.session.length+1}"></div>
        <div class="fg"><label>Data</label><input type="date" class="fc" id="f-date" value="${i?.date||new Date().toISOString().split('T')[0]}"></div>
      </div>
      <div class="fg"><label>Título</label><input class="fc" id="f-title" value="${i?.title||''}"></div>
      <div class="fg"><label>Resumo</label><textarea class="fc" id="f-summary" style="min-height:120px">${i?.summary||''}</textarea></div>
      <div class="fg"><label>NPCs encontrados</label><input class="fc" id="f-npcs_met" value="${i?.npcs_met||''}"></div>
      <div class="fg"><label>Locais visitados</label><input class="fc" id="f-locations" value="${i?.locations||''}"></div>`;

    return '';
  },

  // ---- Leitura dos valores do formulário ----
  readForm(type) {
    if (type === 'pj') {
      const pin = getVal('f-pin').trim();
      const stats = {};
      document.querySelectorAll('#stats-editor .stats-row').forEach(row => {
        const k = row.querySelector('.stat-key').value.trim().toUpperCase();
        const v = row.querySelector('.stat-val').value.trim();
        if (k && v) stats[k] = v;
      });
      const inventory = [];
      document.querySelectorAll('#inv-editor .inv-row').forEach(row => {
        const name = row.querySelector('.inv-name').value.trim();
        const qty  = parseInt(row.querySelector('.inv-qty').value) || 1;
        const id   = row.querySelector('.inv-id').value;
        if (name) inventory.push({ id, name, qty });
      });
      return { name:getVal('f-name'), class:getVal('f-class'), universe:getVal('f-universe'), hp:+getVal('f-hp')||0, hp_max:+getVal('f-hp_max')||0, level:+getVal('f-level')||1, xp:+getVal('f-xp')||0, xp_next:+getVal('f-xp_next')||0, stats, inventory, notes:getVal('f-notes'), gm_to_player_notes:getVal('f-gm_to_player_notes'), gm_notes:getVal('f-gm_notes'), ...(pin ? {pin} : {pin:''}) };
    }
    if (type === 'npc') return { name:getVal('f-name'), faction:getVal('f-faction'), universe:getVal('f-universe'), role:getVal('f-role'), attitude:getVal('f-attitude'), notes:getVal('f-notes') };
    if (type === 'creature') return { name:getVal('f-name'), universe:getVal('f-universe'), threat:getVal('f-threat'), hp:getVal('f-hp'), armor:getVal('f-armor'), damage:getVal('f-damage'), abilities:getVal('f-abilities') };
    if (type === 'location') return { name:getVal('f-name'), universe:getVal('f-universe'), status:getVal('f-status'), description:getVal('f-description'), connections:getVal('f-connections') };
    if (type === 'session') return { num:+getVal('f-num'), date:getVal('f-date'), title:getVal('f-title'), summary:getVal('f-summary'), npcs_met:getVal('f-npcs_met'), locations:getVal('f-locations') };
    return {};
  }
};
