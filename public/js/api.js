const Api = {
  async load() {
    const r = await fetch('/api/db');
    return r.json();
  },
  async save(db) {
    return fetch('/api/db', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
  }
};
