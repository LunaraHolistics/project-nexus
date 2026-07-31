const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.post('/', (req, res) => {
  const db = getDb();
  const { name, codename, specialty } = req.body;
  
  if (!name || !codename) {
    return res.status(400).json({ error: 'Nome e Codinome são obrigatórios.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO players (name, codename, specialty) VALUES (?, ?, ?)');
    const info = stmt.run(name, codename, specialty || 'Investigação');
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(player);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Codinome já está em uso.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
    if (!player) return res.status(404).json({ error: 'Operativo não encontrado.' });
    
    const activeMissions = db.prepare('SELECT * FROM missions WHERE player_id = ? AND status = "ativa"').all(req.params.id);
    const upgrades = db.prepare(`
      SELECT u.* FROM upgrades u 
      INNER JOIN player_upgrades pu ON u.id = pu.upgrade_id 
      WHERE pu.player_id = ?
    `).all(req.params.id);

    res.json({ ...player, active_missions: activeMissions, upgrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar dados do jogador (usado pelo frontend savePlayer)
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const data = req.body;
  
  try {
    const stmt = db.prepare(`
      UPDATE players SET 
        name = COALESCE(?, name),
        codename = COALESCE(?, codename),
        level = COALESCE(?, level),
        xp = COALESCE(?, xp),
        xp_to_next = COALESCE(?, xp_to_next),
        credits = COALESCE(?, credits),
        rank = COALESCE(?, rank),
        missions_completed = COALESCE(?, missions_completed),
        missions_failed = COALESCE(?, missions_failed),
        artifacts_recovered = COALESCE(?, artifacts_recovered),
        agents_recruited = COALESCE(?, agents_recruited)
      WHERE id = ?
    `);
    
    stmt.run(
      data.name, data.codename, data.level, data.xp, data.xpToNext, 
      data.credits, data.rank, data.missionsCompleted, data.missionsFailed, 
      data.artifactsRecovered, data.agentsRecruited, id
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/upgrades', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { upgrade_id } = req.body;

  try {
    const upgrade = db.prepare('SELECT * FROM upgrades WHERE id = ?').get(upgrade_id);
    if (!upgrade) return res.status(404).json({ success: false, error: 'Upgrade não encontrado.' });

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (player.credits < upgrade.cost) {
      return res.status(400).json({ success: false, error: 'Créditos insuficientes.' });
    }

    const existing = db.prepare('SELECT * FROM player_upgrades WHERE player_id = ? AND upgrade_id = ?').get(id, upgrade_id);
    if (existing) return res.status(400).json({ success: false, error: 'Upgrade já adquirido.' });

    const transaction = db.transaction(() => {
      db.prepare('UPDATE players SET credits = credits - ? WHERE id = ?').run(upgrade.cost, id);
      db.prepare('INSERT INTO player_upgrades (player_id, upgrade_id) VALUES (?, ?)').run(id, upgrade_id);
    });
    transaction();

    res.json({ success: true, message: `${upgrade.name} desbloqueado.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;