const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// Criar novo jogador
router.post('/', (req, res) => {
  const db = getDb();
  const { name, codename, specialty } = req.body;
  
  if (!name || !codename) {
    return res.status(400).json({ error: 'Nome e Codinome são obrigatórios.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO players (name, codename, specialty) VALUES (?, ?, ?)');
    const info = stmt.run(name, codename, specialty || 'Não especificada');
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(player);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Codinome já está em uso.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Obter perfil do jogador
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

// Comprar upgrade
router.post('/:id/upgrades', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { upgrade_id } = req.body;

  try {
    const upgrade = db.prepare('SELECT * FROM upgrades WHERE id = ?').get(upgrade_id);
    if (!upgrade) return res.status(404).json({ error: 'Upgrade não encontrado.' });

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (player.credits < upgrade.cost) {
      return res.status(400).json({ error: 'Créditos insuficientes.' });
    }

    const existing = db.prepare('SELECT * FROM player_upgrades WHERE player_id = ? AND upgrade_id = ?').get(id, upgrade_id);
    if (existing) return res.status(400).json({ error: 'Upgrade já adquirido.' });

    const transaction = db.transaction(() => {
      db.prepare('UPDATE players SET credits = credits - ? WHERE id = ?').run(upgrade.cost, id);
      db.prepare('INSERT INTO player_upgrades (player_id, upgrade_id) VALUES (?, ?)').run(id, upgrade_id);
    });
    transaction();

    res.json({ success: true, message: `${upgrade.name} desbloqueado.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;