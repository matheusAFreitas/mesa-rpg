const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const DEFAULT_DB = {
  pj: [], npc: [], creature: [], location: [], session: [],
  combat: { list: [], round: 1, cur: 0 },
  notes: '',
  worldMap: { positions: {}, edges: [] },
  dungeons: [],
  universes: [],
  pending_pj: []
};

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_DB };
  }
}

const sseClients = new Set();

// ---- Presença de jogadores (in-memory, reseta com o servidor) ----
const activePlayers = new Map();
const PLAYER_TTL_MS = 20000;

// ---- Presença do GM (in-memory) ----
let gmLastSeen = 0;
const GM_TTL_MS = 12000;

setInterval(() => {
  const cutoff = Date.now() - PLAYER_TTL_MS;
  for (const [sid, p] of activePlayers) {
    if (p.lastSeen < cutoff) activePlayers.delete(sid);
  }
}, 20000);

function broadcastUpdate() {
  for (const client of sseClients) client.write('data: update\n\n');
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  broadcastUpdate();
}

app.use(express.json({ limit: '10mb' }));

// Named routes before static
app.get('/',        (req, res) => res.sendFile(path.join(CLIENT_DIR, 'landing.html')));
app.get('/mestre',  (req, res) => res.sendFile(path.join(CLIENT_DIR, 'mestre.html')));
app.get('/jogador', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'player.html')));

app.use(express.static(CLIENT_DIR));

// SSE — clientes se inscrevem aqui e recebem "update" sempre que o DB mudar
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);
  // Heartbeat a cada 25s para manter a conexão viva
  const hb = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { sseClients.delete(res); clearInterval(hb); });
});

// Heartbeat do GM — registra presença
app.post('/api/gm/heartbeat', (req, res) => {
  gmLastSeen = Date.now();
  res.json({ ok: true });
});

// Status do GM — jogadores consultam isso
app.get('/api/gm/status', (req, res) => {
  res.json({ online: (Date.now() - gmLastSeen) < GM_TTL_MS });
});

// Heartbeat do jogador — registra presença
app.post('/api/player/heartbeat', (req, res) => {
  const { sessionId, pjName, pjId, hp, hpMax } = req.body;
  if (!sessionId) return res.json({ ok: false });
  activePlayers.set(sessionId, { pjName: pjName || 'Jogador', pjId, hp, hpMax, lastSeen: Date.now() });
  res.json({ ok: true });
});

// Lista de jogadores ativos para o GM (inclui campos do DB para detecção de mudanças)
app.get('/api/gm/active-players', (req, res) => {
  const cutoff = Date.now() - PLAYER_TTL_MS;
  const db = readDB();
  const players = [];
  for (const [, p] of activePlayers) {
    if (p.lastSeen < cutoff) continue;
    const pjData = db.pj.find(x => x.id === p.pjId) || {};
    players.push({
      pjName: p.pjName, pjId: p.pjId,
      hp:    pjData.hp    !== undefined ? pjData.hp    : p.hp,
      hpMax: pjData.hp_max !== undefined ? pjData.hp_max : p.hpMax,
      notes: pjData.notes,
      private_notes: pjData.private_notes,
      inventory: pjData.inventory,
      last_roll: pjData.last_roll
    });
  }
  res.json({ players });
});

// GM auth
app.get('/api/gm/auth', (req, res) => {
  const db = readDB();
  res.json({ hasPassword: !!db.gm_password });
});

app.post('/api/gm/auth', async (req, res) => {
  const db = readDB();
  const { password } = req.body;
  if (!password || !password.trim()) return res.json({ ok: false, error: 'empty' });
  if (!db.gm_password) {
    db.gm_password = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
    writeDB(db);
    return res.json({ ok: true, set: true });
  }
  const match = await bcrypt.compare(password, db.gm_password);
  res.json({ ok: match });
});

app.delete('/api/gm/password', (req, res) => {
  const db = readDB();
  delete db.gm_password;
  writeDB(db);
  res.json({ ok: true });
});

app.put('/api/gm/password', async (req, res) => {
  const db = readDB();
  const { current, newPassword } = req.body;
  if (db.gm_password) {
    const match = await bcrypt.compare(current || '', db.gm_password);
    if (!match) return res.json({ ok: false, error: 'wrong' });
  }
  if (!newPassword || !newPassword.trim())
    return res.json({ ok: false, error: 'empty' });
  db.gm_password = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/local-ip', (req, res) => {
  const nets = os.networkInterfaces();
  let ip = null;
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) { ip = addr.address; break; }
    }
    if (ip) break;
  }
  res.json({ ip, port: PORT });
});

app.delete('/api/db', async (req, res) => {
  const db = readDB();
  const { password } = req.body;
  if (!password || !password.trim()) return res.json({ ok: false, error: 'empty' });
  if (!db.gm_password) return res.json({ ok: false, error: 'no_password' });
  const match = await bcrypt.compare(password, db.gm_password);
  if (!match) return res.json({ ok: false, error: 'wrong' });
  writeDB({ ...DEFAULT_DB, gm_password: db.gm_password });
  res.json({ ok: true });
});

app.get('/api/db', (req, res) => res.json(readDB()));

app.put('/api/db', (req, res) => {
  const oldDb = readDB();
  const newDb = req.body;
  // Detect gm_notes / gm_to_player_notes changes → set unread flags for players
  if (Array.isArray(newDb.pj) && Array.isArray(oldDb.pj)) {
    newDb.pj.forEach(newPj => {
      const oldPj = oldDb.pj.find(p => p.id === newPj.id);
      if (!oldPj) return;
      if (newPj.gm_notes !== oldPj.gm_notes && (newPj.gm_notes || '').trim())
        newPj.gm_notes_unread = true;
      if (newPj.gm_to_player_notes !== oldPj.gm_to_player_notes && (newPj.gm_to_player_notes || '').trim())
        newPj.gm_to_player_unread = true;
    });
  }
  writeDB(newDb);
  res.json({ ok: true });
});

// Player-facing: strips gm_notes but passes gm_to_player_notes + unread flags
app.get('/api/player/data', (req, res) => {
  const db = readDB();
  // eslint-disable-next-line no-unused-vars
  const pj = db.pj.map(({ gm_notes, ...rest }) => rest);
  const rawCombat = db.combat || { list: [], round: 1, cur: 0 };
  const combat = {
    ...rawCombat,
    list: rawCombat.list.map(c => {
      if (!c.pj_id) return c;
      const pjRec = db.pj.find(p => p.id === c.pj_id);
      if (!pjRec) return c;
      return { ...c, name: pjRec.name, hp: pjRec.hp, hp_max: pjRec.hp_max };
    })
  };
  res.json({ pj, pending_pj: db.pending_pj || [], location: db.location, worldMap: db.worldMap, universes: db.universes, combat });
});

// Player submits a character creation request
app.post('/api/player/request', (req, res) => {
  const db = readDB();
  if (!db.pending_pj) db.pending_pj = [];
  const entry = { ...req.body, id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), submittedAt: new Date().toISOString() };
  db.pending_pj.push(entry);
  writeDB(db);
  res.json({ ok: true, id: entry.id });
});

// GM approves a pending request (moves to pj[])
app.post('/api/gm/approve/:id', (req, res) => {
  const db = readDB();
  const idx = (db.pending_pj || []).findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const pj = db.pending_pj.splice(idx, 1)[0];
  delete pj.submittedAt;
  db.pj.push(pj);
  writeDB(db);
  res.json({ ok: true });
});

// GM rejects a pending request
app.delete('/api/gm/pending/:id', (req, res) => {
  const db = readDB();
  const idx = (db.pending_pj || []).findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  db.pending_pj.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// Player can update their own HP (and temp HP)
app.patch('/api/player/pj/:id', (req, res) => {
  const db = readDB();
  const pj = db.pj.find(p => p.id === req.params.id);
  if (!pj) return res.status(404).json({ error: 'not found' });
  if (req.body.hp                   !== undefined) pj.hp                   = req.body.hp;
  if (req.body.notes                !== undefined) pj.notes                = req.body.notes;
  if (req.body.private_notes        !== undefined) pj.private_notes        = req.body.private_notes;
  if (req.body.inventory            !== undefined) pj.inventory            = req.body.inventory;
  if (req.body.gm_notes_unread      !== undefined) pj.gm_notes_unread      = req.body.gm_notes_unread;
  if (req.body.gm_to_player_unread  !== undefined) pj.gm_to_player_unread  = req.body.gm_to_player_unread;
  if (req.body.last_roll            !== undefined) pj.last_roll            = req.body.last_roll;
  writeDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🎲  Mesa do Mestre rodando em http://localhost:${PORT}\n`);
});
