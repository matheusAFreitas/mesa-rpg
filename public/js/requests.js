const Requests = {
  render() {
    const list = App.db.pending_pj || [];
    const el = document.getElementById('requests-list');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = '<div class="empty"><div class="ei">📭</div><p>Nenhuma solicitação pendente.</p></div>';
      return;
    }

    el.innerHTML = list.map(p => {
      const stats = p.stats ? Object.entries(p.stats).filter(([,v])=>v)
        .map(([k,v]) => `<div class="stat"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join('') : '';
      const uStyle = App.tagStyle(p.universe);
      const date = p.submittedAt ? new Date(p.submittedAt).toLocaleString('pt-BR') : '';
      return `<div class="card" style="border-color:#5a3a1a">
        <div class="card-header">
          <div>
            <div class="card-title">${p.name}</div>
            <span class="tag" style="${uStyle}">${p.universe||'—'}</span>${p.class?`<span class="tag">${p.class}</span>`:''}
            ${date?`<span style="font-size:10px;color:var(--text2);margin-left:6px;">${date}</span>`:''}
          </div>
          <div class="card-actions">
            <button class="btn btn-ok btn-sm" onclick="Requests.approve('${p.id}')">✓ Aprovar</button>
            <button class="btn btn-danger btn-sm" onclick="Requests.reject('${p.id}')">✕ Rejeitar</button>
          </div>
        </div>
        ${stats ? `<div class="stat-block" style="margin-top:8px">${stats}</div>` : ''}
        ${p.notes ? `<div class="card-notes" style="margin-top:8px">${p.notes}</div>` : ''}
      </div>`;
    }).join('');

    this.updateBadge();
  },

  approve(id) {
    const pending = (App.db.pending_pj || []).find(p => p.id === id);
    if (!pending) return;
    App._pendingApprovalId = id;
    // Passa pending como prefill — o Cards.modalForm renderiza com os dados já preenchidos
    App.openModal('pj', null, pending);
  },

  async reject(id) {
    if (!confirm('Rejeitar e remover esta solicitação?')) return;
    await fetch(`/api/gm/pending/${id}`, { method: 'DELETE' });
    App.db = await Api.load();
    this.render();
  },

  updateBadge() {
    const count = (App.db.pending_pj || []).length;
    const badge = document.getElementById('requests-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count ? 'inline-flex' : 'none';
  }
};
