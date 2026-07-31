const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { generateMission } = require('../services/missionGenerator');

router.get('/', (req, res) => {
  const db = getDb();
  try {
    // Retorna todas as missões para o frontend filtrar, ou filtra por status se fornecido
    const status = req.query.status;
    let missions;
    if (status) {
      missions = db.prepare('SELECT * FROM missions WHERE status = ? ORDER BY created_at DESC').all(status);
    } else {
      missions = db.prepare('SELECT * FROM missions ORDER BY created_at DESC').all();
    }
    
    // Formata para o frontend entender arrays e objetos vindos do JSON do SQLite
    const formattedMissions = missions.map(m => ({
      ...m,
      specialty_filter: m.specialty_filter ? JSON.parse(m.specialty_filter) : [],
      objectives: m.objectives ? JSON.parse(m.objectives) : [],
      reward: {
        xp: m.reward_xp,
        credits: m.reward_credits,
        artifacts: m.reward_artifacts
      }
    }));

    res.json({ missions: formattedMissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate', (req, res) => {
  const db = getDb();
  try {
    const newMission = generateMission();
    const stmt = db.prepare(`
      INSERT INTO missions (codename, title, location, priority, status, phase, total_phases, specialty_filter, description, objectives, reward_xp, reward_credits, reward_artifacts)
      VALUES (@codename, @title, @location, @priority, @status, @phase, @total_phases, @specialty_filter, @description, @objectives, @reward_xp, @reward_credits, @reward_artifacts)
    `);
    
    const params = {
      ...newMission,
      specialty_filter: JSON.stringify(newMission.specialty_filter),
      objectives: JSON.stringify(newMission.objectives)
    };
    
    const info = stmt.run(params);
    
    // Retorna no formato que o frontend espera
    res.status(201).json({
      id: info.lastInsertRowid,
      ...newMission,
      reward: { xp: newMission.reward_xp, credits: newMission.reward_credits, artifacts: newMission.reward_artifacts }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/accept', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { player_id } = req.body;
  
  try {
    const stmt = db.prepare('UPDATE missions SET status = "ativa", player_id = ? WHERE id = ? AND status = "disponivel"');
    const info = stmt.run(player_id, id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Missão não encontrada ou já aceita.' });
    
    res.json({ success: true, message: 'Missão aceita. Boa sorte, Operativo.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/complete', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ? AND status = "ativa"').get(id);
    if (!mission) return res.status(404).json({ success: false, error: 'Missão ativa não encontrada.' });

    const updateMission = db.prepare('UPDATE missions SET status = "concluida" WHERE id = ?');
    updateMission.run(id);

    const updatePlayer = db.prepare(`
      UPDATE players SET 
        credits = credits + ?, 
        xp = xp + ?,
        artifacts_recovered = artifacts_recovered + ?,
        missions_completed = missions_completed + 1
      WHERE id = ?
    `);
    updatePlayer.run(mission.reward_credits, mission.reward_xp, mission.reward_artifacts, mission.player_id);

    res.json({ 
      success: true, 
      rewards: { credits: mission.reward_credits, xp: mission.reward_xp, artifacts: mission.reward_artifacts } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;