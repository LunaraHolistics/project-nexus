const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middlewares/auth');
const { validate, schemas } = require('../middlewares/validate');
const logger = require('../utils/logger');
const { paginate } = require('../utils/pagination');

/**
 * GET /api/archive/artifacts
 * Lista artefatos com paginação e filtros
 */
router.get('/artifacts', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const { category, origin, search } = req.query;
    
    // Construção dinâmica de WHERE
    let where = [];
    let params = [];
    
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (origin) {
      where.push('origin = ?');
      params.push(origin);
    }
    if (search) {
      where.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    
    const query = db.prepare(
      `SELECT * FROM artifacts ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
    );
    
    const countQuery = db.prepare(
      `SELECT COUNT(*) as total FROM artifacts ${whereClause}`
    );
    
    const result = paginate(query, countQuery, params, page, limit);
    
    logger.debug({
      event: 'artifacts_listed',
      playerId: req.playerId,
      total: result.pagination.total,
      page
    });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive/artifacts/:id
 * Detalhe de um artefato específico
 */
router.get('/artifacts/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    
    if (!artifact) {
      return res.status(404).json({ error: 'Artefato não encontrado' });
    }
    
    res.json({ artifact });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive/suspects
 * Lista suspeitos com paginação
 */
router.get('/suspects', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const { status } = req.query;
    
    let query, countQuery, params = [];
    
    if (status) {
      query = db.prepare(
        'SELECT * FROM suspects WHERE status = ? ORDER BY alias ASC LIMIT ? OFFSET ?'
      );
      countQuery = db.prepare('SELECT COUNT(*) as total FROM suspects WHERE status = ?');
      params = [status];
    } else {
      query = db.prepare('SELECT * FROM suspects ORDER BY alias ASC LIMIT ? OFFSET ?');
      countQuery = db.prepare('SELECT COUNT(*) as total FROM suspects');
    }
    
    const result = paginate(query, countQuery, params, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive/stats
 * Estatísticas agregadas do sistema
 */
router.get('/stats', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    
    // Usa transação para garantir consistência
    const getStats = db.transaction(() => {
      const totalArtifacts = db.prepare('SELECT COUNT(*) as count FROM artifacts').get().count;
      const totalSuspects = db.prepare('SELECT COUNT(*) as count FROM suspects').get().count;
      const completedMissions = db.prepare(
        'SELECT COUNT(*) as count FROM missions WHERE status = ?'
      ).get('concluida').count;
      const activeMissions = db.prepare(
        'SELECT COUNT(*) as count FROM missions WHERE status = ?'
      ).get('ativa').count;
      
      // Categorias REAIS (não mais fake com Math.random)
      const categories = db.prepare(`
        SELECT category as name, COUNT(*) as count 
        FROM artifacts 
        GROUP BY category 
        ORDER BY count DESC
      `).all();
      
      // Últimas adições (últimos 7 dias)
      const recentAdditions = db.prepare(`
        SELECT COUNT(*) as count FROM artifacts 
        WHERE created_at > datetime('now', '-7 days')
      `).get().count;
      
      return {
        totalArtifacts,
        totalSuspects,
        completedMissions,
        activeMissions,
        categories,
        recentAdditions,
        system_integrity: '99.8%',
        active_nodes: 1402,
        generated_at: new Date().toISOString()
      };
    });
    
    const stats = getStats();
    
    logger.info({
      event: 'stats_retrieved',
      playerId: req.playerId,
      totalArtifacts: stats.totalArtifacts
    });
    
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;