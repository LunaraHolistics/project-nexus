const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { generateMission } = require('../services/missionGenerator');

// Listar missões (filtro por status)
router.get('/', (req, res) => {
  const db = getDb();
  const status = req.query.status || 'disponivel';
  try {
    const missions = db.prepare('SELECT * FROM missions WHERE status = ? ORDER BY created_at DESC').all(status);
    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gerar nova missão procedural
router.post('/generate', (req, res) => {
  const db = getDb();
  try {
    const newMission = generateMission();
    const stmt = db.prepare(`
      INSERT INTO missions (title, location, objective, target, threat_level, reward_credits, reward_influence, status)
      VALUES (@title, @location, @objective, @target, @threat_level, @reward_credits, @reward_influence, @status)
    `);
    const info = stmt.run(newMission);
    res.status(201).json({ id: info.lastInsertRowid, ...newMission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aceitar missão (atribuir ao jogador)
router.post('/:id/accept', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { player_id } = req.body;
  
  try {
    const stmt = db.prepare('UPDATE missions SET status = "ativa", player_id = ? WHERE id = ? AND status = "disponivel"');
    const info = stmt.run(player_id, id);
    if (info.changes === 0) return res.status(404).json({ error: 'Missão não encontrada ou já aceita.' });
    res.json({ success: true, message: 'Missão aceita. Boa sorte, Operativo.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Completar missão (dar recompensas)
router.post('/:id/complete', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ? AND status = "ativa"').get(id);
    if (!mission) return res.status(404).json({ error: 'Missão ativa não encontrada.' });

    const updateMission = db.prepare('UPDATE missions SET status = "concluida" WHERE id = ?');
    updateMission.run(id);

    const updatePlayer = db.prepare('UPDATE players SET credits = credits + ?, influence_level = influence_level + ? WHERE id = ?');
    updatePlayer.run(mission.reward_credits, mission.reward_influence, mission.player_id);

    res.json({ 
      success: true, 
      rewards: { credits: mission.reward_credits, influence: mission.reward_influence } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;