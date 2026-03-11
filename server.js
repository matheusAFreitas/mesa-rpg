const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const DEFAULT_DB = {
  pj: [], npc: [], creature: [], location: [], session: [],
  combat: { list: [], round: 1, cur: 0 },
  notes: '',
  worldMap: { positions: {}, edges: [] },
  dungeons: [],
  universes: []
};

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_DB };
  }
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/db', (req, res) => res.json(readDB()));

app.put('/api/db', (req, res) => {
  writeDB(req.body);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🎲  Mesa do Mestre rodando em http://localhost:${PORT}\n`);
});
