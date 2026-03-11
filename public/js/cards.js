const Cards = {
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
        .map(([k,v]) => `<div class="stat"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join('') : '';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${i.name}</div>
          <span class="tag" style="${uStyle}">${i.universe||'—'}</span>${i.class?`<span class="tag">${i.class}</span>`:''}
        </div>${acts}</div>
        ${i.hp_max>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2)"><span>HP</span><span>${i.hp}/${i.hp_max}</span></div>
        <div class="hp-bar"><div class="hp-fill" style="width:${pct}%;background:${col}"></div></div>`:''}
        <div class="stat-block">${statsHTML}</div>
        ${i.notes?`<div class="card-notes">${i.notes}</div>`:''}
      </div>`;
    }

    if (type === 'npc') {
      const attCol = i.attitude==='Aliado'?'#55cc55':i.attitude==='Inimigo'?'#cc5555':'#cccc55';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${i.name}</div>
          <span class="tag" style="${uStyle}">${i.universe||'—'}</span>
          ${i.faction?`<span class="tag">${i.faction}</span>`:''}
          ${i.attitude?`<span class="tag" style="color:${attCol}">${i.attitude}</span>`:''}
        </div>${acts}</div>
        ${i.role?`<div style="font-size:11px;color:var(--text2);margin-bottom:5px;">${i.role}</div>`:''}
        ${i.notes?`<div class="card-notes">${i.notes}</div>`:''}
      </div>`;
    }

    if (type === 'creature') {
      const thrCol = (i.threat==='Alta'||i.threat==='Extrema') ? '#cc5555' : i.threat==='Média' ? '#ccaa44' : '#55cc55';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${i.name}</div>
          <span class="tag" style="${uStyle}">${i.universe||'—'}</span>
          ${i.threat?`<span class="tag" style="color:${thrCol}">${i.threat}</span>`:''}
        </div>${acts}</div>
        <div class="stat-block">
          ${i.hp?`<div class="stat"><div class="stat-label">HP</div><div class="stat-value">${i.hp}</div></div>`:''}
          ${i.armor?`<div class="stat"><div class="stat-label">Arm.</div><div class="stat-value">${i.armor}</div></div>`:''}
          ${i.damage?`<div class="stat"><div class="stat-label">Dano</div><div class="stat-value">${i.damage}</div></div>`:''}
        </div>
        ${i.abilities?`<div class="card-notes">${i.abilities}</div>`:''}
      </div>`;
    }

    if (type === 'location') {
      const stCol = i.status==='Seguro'?'#55cc55':i.status==='Perigoso'?'#cc5555':'var(--text2)';
      return `<div class="card">
        <div class="card-header"><div>
          <div class="card-title">${i.name}</div>
          <span class="tag" style="${uStyle}">${i.universe||'—'}</span>
          ${i.status?`<span class="tag" style="color:${stCol}">${i.status}</span>`:''}
        </div>${acts}</div>
        ${i.description?`<div class="card-notes">${i.description}</div>`:''}
        ${i.connections?`<div style="font-size:10px;color:var(--text2);margin-top:5px;">📍 ${i.connections}</div>`:''}
      </div>`;
    }
    return '';
  },

  // ---- MODAL FORMS ----
  modalForm(type, i) {
    const unis = App.getUniverseOptions(i?.universe);

    if (type === 'pj') return `<h3>${i?'Editar':'Novo'} PJ</h3>
      <div class="fg"><label>Nome</label><input class="fc" id="f-name" value="${i?.name||''}"></div>
      <div class="fr2">
        <div class="fg"><label>Classe/Origem</label><input class="fc" id="f-class" value="${i?.class||''}"></div>
        <div class="fg"><label>Universo</label><select class="fc" id="f-universe">${unis}</select></div>
      </div>
      <div class="fr2">
        <div class="fg"><label>HP Atual</label><input type="number" class="fc" id="f-hp" value="${i?.hp||''}"></div>
        <div class="fg"><label>HP Máximo</label><input type="number" class="fc" id="f-hp_max" value="${i?.hp_max||''}"></div>
      </div>
      <div class="fg"><label>Atributos (ex: FOR:10, DES:8, INT:6)</label><input class="fc" id="f-stats" value="${i?.stats?Object.entries(i.stats).map(([k,v])=>k+':'+v).join(', '):''}"></div>
      <div class="fg"><label>Anotações</label><textarea class="fc" id="f-notes">${i?.notes||''}</textarea></div>`;

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

  readForm(type) {
    if (type === 'pj') return { name:gv('f-name'), class:gv('f-class'), universe:gv('f-universe'), hp:+gv('f-hp')||0, hp_max:+gv('f-hp_max')||0, stats:parseStats(gv('f-stats')), notes:gv('f-notes') };
    if (type === 'npc') return { name:gv('f-name'), faction:gv('f-faction'), universe:gv('f-universe'), role:gv('f-role'), attitude:gv('f-attitude'), notes:gv('f-notes') };
    if (type === 'creature') return { name:gv('f-name'), universe:gv('f-universe'), threat:gv('f-threat'), hp:gv('f-hp'), armor:gv('f-armor'), damage:gv('f-damage'), abilities:gv('f-abilities') };
    if (type === 'location') return { name:gv('f-name'), universe:gv('f-universe'), status:gv('f-status'), description:gv('f-description'), connections:gv('f-connections') };
    if (type === 'session') return { num:+gv('f-num'), date:gv('f-date'), title:gv('f-title'), summary:gv('f-summary'), npcs_met:gv('f-npcs_met'), locations:gv('f-locations') };
    return {};
  }
};
