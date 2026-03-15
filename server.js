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

// Named routes before static
app.get('/',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/mestre',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'mestre.html')));
app.get('/jogador', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));

app.use(express.static(path.join(__dirname, 'public')));

// GM auth
app.get('/api/gm/auth', (req, res) => {
  const db = readDB();
  res.json({ hasPassword: !!db.gm_password });
});

app.post('/api/gm/auth', (req, res) => {
  const db = readDB();
  const { password } = req.body;
  if (!db.gm_password) {
    if (!password || !password.trim()) return res.json({ ok: false, error: 'empty' });
    db.gm_password = password.trim();
    writeDB(db);
    return res.json({ ok: true, set: true });
  }
  res.json({ ok: db.gm_password === password });
});

app.put('/api/gm/password', (req, res) => {
  const db = readDB();
  const { current, newPassword } = req.body;
  if (db.gm_password && db.gm_password !== current)
    return res.json({ ok: false, error: 'wrong' });
  if (!newPassword || !newPassword.trim())
    return res.json({ ok: false, error: 'empty' });
  db.gm_password = newPassword.trim();
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/db', (req, res) => res.json(readDB()));

app.put('/api/db', (req, res) => {
  writeDB(req.body);
  res.json({ ok: true });
});

// Player-facing: strips gm_notes so players never receive it
app.get('/api/player/data', (req, res) => {
  const db = readDB();
  const pj = db.pj.map(({ gm_notes, ...rest }) => rest);
  res.json({ pj, location: db.location, worldMap: db.worldMap, universes: db.universes });
});

// Player can update their own HP (and temp HP)
app.patch('/api/player/pj/:id', (req, res) => {
  const db = readDB();
  const pj = db.pj.find(p => p.id === req.params.id);
  if (!pj) return res.status(404).json({ error: 'not found' });
  if (req.body.hp            !== undefined) pj.hp            = req.body.hp;
  if (req.body.notes         !== undefined) pj.notes         = req.body.notes;
  if (req.body.private_notes !== undefined) pj.private_notes = req.body.private_notes;
  if (req.body.inventory     !== undefined) pj.inventory     = req.body.inventory;
  writeDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🎲  Mesa do Mestre rodando em http://localhost:${PORT}\n`);
});
