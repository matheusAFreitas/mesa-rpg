const Api = {
  async load() {
    try {
      const r = await fetch('/api/db');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      console.error('[Api.load] Falha ao carregar dados:', err);
      alert('Erro ao carregar dados do servidor. Verifique a conexão e recarregue a página.');
      throw err;
    }
  },
  async save(db) {
    try {
      const r = await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (err) {
      console.error('[Api.save] Falha ao salvar dados:', err);
      alert('Erro ao salvar dados. Suas alterações podem não ter sido persistidas.');
      throw err;
    }
  }
};
