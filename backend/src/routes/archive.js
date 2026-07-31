const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/artifacts', (req, res) => {
  const db = getDb();
  try {
    const artifacts = db.prepare('SELECT * FROM artifacts ORDER BY name ASC').all();
    res.json({ artifacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/suspects', (req, res) => {
  const db = getDb();
  try {
    const suspects = db.prepare('SELECT * FROM suspects ORDER BY alias ASC').all();
    res.json({ suspects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', (req, res) => {
  const db = getDb();
  try {
    const totalArtifacts = db.prepare('SELECT COUNT(*) as count FROM artifacts').get().count;
    const totalSuspects = db.prepare('SELECT COUNT(*) as count FROM suspects').get().count;
    const completedMissions = db.prepare('SELECT COUNT(*) as count FROM missions WHERE status = "concluida"').get().count;
    
    res.json({
      stats: {
        totalArtifacts,
        categories: [
          { name: 'Arqueologico', count: Math.floor(totalArtifacts * 0.4) },
          { name: 'Documental', count: Math.floor(totalArtifacts * 0.3) },
          { name: 'Artistico', count: Math.floor(totalArtifacts * 0.2) },
          { name: 'Cientifico', count: Math.floor(totalArtifacts * 0.1) }
        ],
        recentAdditions: Math.floor(Math.random() * 5) + 1,
        totalSuspects,
        completedMissions,
        system_integrity: '99.8%',
        active_nodes: 1402
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;