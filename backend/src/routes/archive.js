const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const logger = require('../utils/logger');
const { paginate } = require('../utils/pagination');

// ============================================
// 🆕 ARCHIVE.JS v2.0 — Modo Demo
// Removido 'authenticate' de todas as rotas.
// Leituras abertas para o jogo funcionar sem login.
// ============================================

/**
 * GET /api/archive/artifacts
 * Lista artefatos com paginação e filtros
 */
router.get('/artifacts', (req, res, next) => {  // 🆕 removi authenticate
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
      total: result.pagination.total,
      page,
      filters: { category, origin, search }
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
router.get('/artifacts/:id', (req, res, next) => {  // 🆕 removi authenticate
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido', code: 'INVALID_ID' });
    }
    
    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    
    if (!artifact) {
      return res.status(404).json({ 
        error: 'Artefato não encontrado', 
        code: 'ARTIFACT_NOT_FOUND' 
      });
    }
    
    logger.debug({
      event: 'artifact_detail',
      artifactId: id,
      name: artifact.name
    });
    
    res.json({ artifact });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive/suspects
 * Lista suspeitos com paginação
 */
router.get('/suspects', (req, res, next) => {  // 🆕 removi authenticate
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
    
    logger.debug({
      event: 'suspects_listed',
      total: result.pagination.total,
      page,
      status
    });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive/stats
 * Estatísticas agregadas do sistema (globais)
 */
router.get('/stats', (req, res, next) => {  // 🆕 removi authenticate
  try {
    const db = getDb();
    
    const getStats = db.transaction(() => {
      const totalArtifacts = db.prepare('SELECT COUNT(*) as count FROM artifacts').get().count;
      const totalSuspects = db.prepare('SELECT COUNT(*) as count FROM suspects').get().count;
      
      // Tratamento defensivo para missões (pode não existir ainda)
      let completedMissions = 0;
      let activeMissions = 0;
      try {
        completedMissions = db.prepare(
          'SELECT COUNT(*) as count FROM missions WHERE status = ?'
        ).get('concluida')?.count || 0;
        activeMissions = db.prepare(
          'SELECT COUNT(*) as count FROM missions WHERE status = ?'
        ).get('ativa')?.count || 0;
      } catch (e) {
        logger.warn({ event: 'missions_stats_unavailable', error: e.message });
      }
      
      // Categorias REAIS
      let categories = [];
      try {
        categories = db.prepare(`
          SELECT category as name, COUNT(*) as count 
          FROM artifacts 
          GROUP BY category 
          ORDER BY count DESC
        `).all();
      } catch (e) {
        logger.warn({ event: 'categories_stats_unavailable', error: e.message });
      }
      
      // Últimas adições (últimos 7 dias)
      let recentAdditions = 0;
      try {
        recentAdditions = db.prepare(`
          SELECT COUNT(*) as count FROM artifacts 
          WHERE created_at > datetime('now', '-7 days')
        `).get()?.count || 0;
      } catch (e) {
        // Se created_at não existir, ignora
      }
      
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
    
    logger.debug({
      event: 'stats_retrieved',
      totalArtifacts: stats.totalArtifacts,
      totalSuspects: stats.totalSuspects
    });
    
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;