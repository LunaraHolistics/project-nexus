const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { generateMission, generateMissionBatch, RARITIES } = require('../services/missionGenerator');
const { authenticate } = require('../middlewares/auth');
const { validate, schemas } = require('../middlewares/validate');
const logger = require('../utils/logger');

// ============================================
// HELPERS
// ============================================

/**
 * Helper seguro para parse de JSON
 */
function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    logger.warn({ event: 'json_parse_failed', raw: str.substring(0, 100) });
    return fallback;
  }
}

/**
 * Formata missão do DB para o formato do frontend
 */
function formatMission(m) {
  if (!m) return null;
  
  return {
    id: m.id,
    codename: m.codename,
    title: m.title,
    location: m.location,
    location_data: m.location_data ? safeJsonParse(m.location_data, null) : null,
    priority: m.priority,
    rarity: m.rarity || 'common',
    rarity_label: (RARITIES[m.rarity] || RARITIES.common).label,
    status: m.status,
    phase: m.phase,
    totalPhases: m.total_phases,
    specialty_filter: safeJsonParse(m.specialty_filter, []),
    description: m.description,
    objectives: safeJsonParse(m.objectives, []),
    target: m.target || null,
    estimated_duration: m.estimated_duration || (m.total_phases || 3) * 14,
    reward: {
      xp: m.reward_xp || 0,
      credits: m.reward_credits || 0,
      artifacts: m.reward_artifacts || 0
    },
    player_id: m.player_id,
    created_at: m.created_at,
    generated_at: m.generated_at
  };
}

// ============================================
// LISTAGEM DE MISSÕES
// ============================================

/**
 * GET /api/missions
 * Lista missões com filtros avançados e paginação
 * 
 * Query params:
 *  - status: disponivel | ativa | concluida | falhou | abandonada
 *  - priority: BAIXA | MÉDIA | ALTA | CRÍTICA
 *  - rarity: common | rare | epic | legendary
 *  - location: cidade (busca parcial)
 *  - page: número da página (default: 1)
 *  - limit: itens por página (default: 20, max: 50)
 *  - mine: true = apenas missões do player autenticado
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { 
      status, 
      priority, 
      rarity, 
      location, 
      mine 
    } = req.query;
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    
    // Construção dinâmica de WHERE
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('priority = ?');
      params.push(priority.toUpperCase());
    }
    if (rarity) {
      conditions.push('rarity = ?');
      params.push(rarity.toLowerCase());
    }
    if (location) {
      conditions.push('location LIKE ?');
      params.push(`%${location}%`);
    }
    if (mine === 'true') {
      conditions.push('player_id = ?');
      params.push(req.playerId);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    const missions = db.prepare(
      `SELECT * FROM missions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
    
    const total = db.prepare(
      `SELECT COUNT(*) as count FROM missions ${whereClause}`
    ).get(...params).count;
    
    logger.debug({
      event: 'missions_listed',
      playerId: req.playerId,
      filters: { status, priority, rarity, location, mine },
      total,
      page
    });
    
    res.json({
      missions: missions.map(formatMission),
      pagination: {
        page, 
        limit, 
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      filters: {
        available: {
          statuses: ['disponivel', 'ativa', 'concluida', 'falhou', 'abandonada'],
          priorities: ['BAIXA', 'MÉDIA', 'ALTA', 'CRÍTICA'],
          rarities: Object.keys(RARITIES)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/missions/:id
 * Busca uma missão específica
 */
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        error: 'ID de missão inválido',
        code: 'INVALID_ID'
      });
    }
    
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
    
    if (!mission) {
      return res.status(404).json({
        error: 'Missão não encontrada',
        code: 'MISSION_NOT_FOUND'
      });
    }
    
    res.json({ mission: formatMission(mission) });
  } catch (err) {
    next(err);
  }
});

// ============================================
// GERAÇÃO DE MISSÕES
// ============================================

/**
 * POST /api/missions/generate
 * Gera uma nova missão procedural
 * 
 * Body (opcional):
 *  - forceRarity: common | rare | epic | legendary
 *  - forceLocation: nome da cidade
 */
router.post('/generate', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { forceRarity, forceLocation } = req.body || {};
    
    // Validação de raridade forçada
    if (forceRarity && !RARITIES[forceRarity]) {
      return res.status(400).json({
        error: `Raridade inválida. Use: ${Object.keys(RARITIES).join(', ')}`,
        code: 'INVALID_RARITY'
      });
    }
    
    // Busca dados do player para personalização
    const player = db.prepare(
      'SELECT level, specialty FROM players WHERE id = ?'
    ).get(req.playerId);
    
    // Busca codenames existentes para evitar duplicatas
    const existing = db.prepare(
      'SELECT codename FROM missions ORDER BY created_at DESC LIMIT 100'
    ).all();
    const existingCodenames = existing.map(m => m.codename);
    
    // Gera missão personalizada
    const newMission = generateMission({
      playerLevel: player?.level || 1,
      playerSpecialty: player?.specialty,
      existingCodenames,
      forceRarity,
      forceLocation
    });
    
    // Insere no DB
    const insert = db.prepare(`
      INSERT INTO missions (
        codename, title, location, location_data, priority, rarity, 
        status, phase, total_phases, specialty_filter, description, 
        objectives, target, estimated_duration,
        reward_xp, reward_credits, reward_artifacts,
        generated_at
      ) VALUES (
        @codename, @title, @location, @location_data, @priority, @rarity,
        @status, @phase, @total_phases, @specialty_filter, @description,
        @objectives, @target, @estimated_duration,
        @reward_xp, @reward_credits, @reward_artifacts,
        @generated_at
      )
    `);
    
    const info = insert.run({
      codename: newMission.codename,
      title: newMission.title,
      location: newMission.location,
      location_data: JSON.stringify(newMission.location_data || {}),
      priority: newMission.priority,
      rarity: newMission.rarity,
      status: newMission.status,
      phase: newMission.phase,
      total_phases: newMission.total_phases,
      specialty_filter: JSON.stringify(newMission.specialty_filter || []),
      description: newMission.description,
      objectives: JSON.stringify(newMission.objectives || []),
      target: newMission.target,
      estimated_duration: newMission.estimated_duration,
      reward_xp: newMission.reward_xp,
      reward_credits: newMission.reward_credits,
      reward_artifacts: newMission.reward_artifacts,
      generated_at: newMission.generated_at
    });
    
    logger.info({
      event: 'mission_generated',
      playerId: req.playerId,
      missionId: Number(info.lastInsertRowid),
      codename: newMission.codename,
      rarity: newMission.rarity,
      priority: newMission.priority,
      location: newMission.location
    });
    
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      ...formatMission({ ...newMission, id: Number(info.lastInsertRowid) })
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/missions/generate/batch
 * Gera múltiplas missões de uma vez (para pool do globo)
 * 
 * Body (opcional):
 *  - count: número de missões (default: 5, max: 10)
 */
router.post('/generate/batch', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const count = Math.min(10, Math.max(1, parseInt(req.body?.count) || 5));
    
    // Busca dados do player
    const player = db.prepare(
      'SELECT level, specialty FROM players WHERE id = ?'
    ).get(req.playerId);
    
    // Busca codenames existentes
    const existing = db.prepare(
      'SELECT codename FROM missions ORDER BY created_at DESC LIMIT 200'
    ).all();
    const existingCodenames = existing.map(m => m.codename);
    
    // Gera batch
    const missions = generateMissionBatch(count, {
      playerLevel: player?.level || 1,
      playerSpecialty: player?.specialty,
      existingCodenames
    });
    
    // Insere tudo em transação
    const insertMany = db.transaction((missionsList) => {
      const insert = db.prepare(`
        INSERT INTO missions (
          codename, title, location, location_data, priority, rarity,
          status, phase, total_phases, specialty_filter, description,
          objectives, target, estimated_duration,
          reward_xp, reward_credits, reward_artifacts,
          generated_at
        ) VALUES (
          @codename, @title, @location, @location_data, @priority, @rarity,
          @status, @phase, @total_phases, @specialty_filter, @description,
          @objectives, @target, @estimated_duration,
          @reward_xp, @reward_credits, @reward_artifacts,
          @generated_at
        )
      `);
      
      return missionsList.map(m => {
        const info = insert.run({
          codename: m.codename,
          title: m.title,
          location: m.location,
          location_data: JSON.stringify(m.location_data || {}),
          priority: m.priority,
          rarity: m.rarity,
          status: m.status,
          phase: m.phase,
          total_phases: m.total_phases,
          specialty_filter: JSON.stringify(m.specialty_filter || []),
          description: m.description,
          objectives: JSON.stringify(m.objectives || []),
          target: m.target,
          estimated_duration: m.estimated_duration,
          reward_xp: m.reward_xp,
          reward_credits: m.reward_credits,
          reward_artifacts: m.reward_artifacts,
          generated_at: m.generated_at
        });
        return { id: Number(info.lastInsertRowid), ...m };
      });
    });
    
    const inserted = insertMany(missions);
    
    logger.info({
      event: 'missions_batch_generated',
      playerId: req.playerId,
      count: inserted.length,
      rarities: inserted.reduce((acc, m) => {
        acc[m.rarity] = (acc[m.rarity] || 0) + 1;
        return acc;
      }, {})
    });
    
    res.status(201).json({
      missions: inserted.map(formatMission),
      count: inserted.length
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// CICLO DE VIDA DA MISSÃO
// ============================================

/**
 * POST /api/missions/:id/accept
 * Aceitar missão disponível
 */
router.post(
  '/:id/accept',
  authenticate,
  validate(schemas.acceptMission),
  (req, res, next) => {
    try {
      const db = getDb();
      const missionId = parseInt(req.params.id);
      const playerId = req.body.player_id || req.playerId;
      
      if (isNaN(missionId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de missão inválido',
          code: 'INVALID_ID'
        });
      }
      
      // Transação atômica (sem FOR UPDATE, SQLite não suporta)
      const acceptMission = db.transaction(() => {
        const mission = db.prepare(
          'SELECT * FROM missions WHERE id = ?'
        ).get(missionId);
        
        if (!mission) {
          throw Object.assign(
            new Error('Missão não encontrada'),
            { status: 404, code: 'MISSION_NOT_FOUND' }
          );
        }
        
        if (mission.status !== 'disponivel') {
          throw Object.assign(
            new Error(`Missão não está disponível (status: ${mission.status})`),
            { status: 409, code: 'MISSION_NOT_AVAILABLE' }
          );
        }
        
        // Verifica se player já tem uma missão ativa (opcional - pode ser relaxado)
        const activeMission = db.prepare(
          'SELECT id, codename FROM missions WHERE player_id = ? AND status = ?'
        ).get(playerId, 'ativa');
        
        if (activeMission) {
          throw Object.assign(
            new Error(`Você já tem uma missão ativa: ${activeMission.codename}`),
            { status: 409, code: 'ALREADY_HAS_ACTIVE_MISSION', data: activeMission }
          );
        }
        
        // Verifica specialty filter
        const requiredSpecialties = safeJsonParse(mission.specialty_filter, []);
        if (requiredSpecialties.length > 0) {
          const player = db.prepare(
            'SELECT specialty FROM players WHERE id = ?'
          ).get(playerId);
          
          if (player && !requiredSpecialties.includes(player.specialty)) {
            throw Object.assign(
              new Error(`Sua especialidade (${player.specialty}) não é compatível. Requer: ${requiredSpecialties.join(', ')}`),
              { status: 403, code: 'SPECIALTY_MISMATCH' }
            );
          }
        }
        
        // Atualiza status
        db.prepare(
          'UPDATE missions SET status = ?, player_id = ? WHERE id = ?'
        ).run('ativa', playerId, missionId);
        
        return mission;
      });
      
      const mission = acceptMission();
      
      logger.info({
        event: 'mission_accepted',
        playerId,
        missionId,
        codename: mission.codename,
        rarity: mission.rarity,
        priority: mission.priority
      });
      
      res.json({
        success: true,
        message: `Missão ${mission.codename} aceita. Boa sorte, Operativo.`,
        mission: formatMission({ ...mission, status: 'ativa', player_id: playerId })
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          error: err.message,
          code: err.code,
          data: err.data
        });
      }
      next(err);
    }
  }
);

/**
 * POST /api/missions/:id/complete
 * Completa missão (só o dono)
 */
router.post('/:id/complete', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de missão inválido',
        code: 'INVALID_ID'
      });
    }
    
    const completeMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(
          new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' }
        );
      }
      
      // Só o dono pode completar
      if (mission.player_id !== req.playerId) {
        throw Object.assign(
          new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' }
        );
      }
      
      // Atualiza status
      db.prepare('UPDATE missions SET status = ? WHERE id = ?')
        .run('concluida', missionId);
      
      // Credita recompensas
      db.prepare(`
        UPDATE players SET 
          credits = credits + ?,
          xp = xp + ?,
          artifacts_recovered = artifacts_recovered + ?,
          missions_completed = missions_completed + 1
        WHERE id = ?
      `).run(
        mission.reward_credits,
        mission.reward_xp,
        mission.reward_artifacts,
        mission.player_id
      );
      
      // Verifica level up (a cada 1000 XP)
      const player = db.prepare('SELECT * FROM players WHERE id = ?')
        .get(mission.player_id);
      
      let leveledUp = false;
      if (player.xp >= player.xp_to_next) {
        db.prepare(`
          UPDATE players SET 
            level = level + 1,
            xp = xp - xp_to_next,
            xp_to_next = xp_to_next * 1.5,
            rank = CASE 
              WHEN level + 1 >= 10 THEN 'Diretor Sênior'
              WHEN level + 1 >= 5 THEN 'Agente Especial'
              ELSE rank
            END
          WHERE id = ?
        `).run(mission.player_id);
        leveledUp = true;
      }
      
      return { mission, leveledUp, player };
    });
    
    const { mission, leveledUp, player } = completeMission();
    
    logger.info({
      event: 'mission_completed',
      playerId: req.playerId,
      missionId,
      codename: mission.codename,
      rarity: mission.rarity,
      rewards: {
        credits: mission.reward_credits,
        xp: mission.reward_xp,
        artifacts: mission.reward_artifacts
      },
      leveledUp
    });
    
    res.json({
      success: true,
      message: leveledUp 
        ? `🎉 Missão concluída! Você subiu para o nível ${player.level + 1}!`
        : 'Missão concluída com sucesso.',
      rewards: {
        credits: mission.reward_credits,
        xp: mission.reward_xp,
        artifacts: mission.reward_artifacts
      },
      leveledUp,
      newLevel: leveledUp ? player.level + 1 : null
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }
    next(err);
  }
});

/**
 * POST /api/missions/:id/abandon
 * Abandona missão ativa (com penalidade leve)
 */
router.post('/:id/abandon', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de missão inválido',
        code: 'INVALID_ID'
      });
    }
    
    const abandonMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(
          new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' }
        );
      }
      
      if (mission.player_id !== req.playerId) {
        throw Object.assign(
          new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' }
        );
      }
      
      // Marca como abandonada
      db.prepare('UPDATE missions SET status = ? WHERE id = ?')
        .run('abandonada', missionId);
      
      // Penalidade: perde 10% dos créditos da recompensa potencial
      const penalty = Math.floor(mission.reward_credits * 0.1);
      const player = db.prepare('SELECT credits FROM players WHERE id = ?')
        .get(mission.player_id);
      
      if (player.credits >= penalty) {
        db.prepare('UPDATE players SET credits = credits - ?, missions_failed = missions_failed + 1 WHERE id = ?')
          .run(penalty, mission.player_id);
      } else {
        db.prepare('UPDATE players SET credits = 0, missions_failed = missions_failed + 1 WHERE id = ?')
          .run(mission.player_id);
      }
      
      return { mission, penalty };
    });
    
    const { mission, penalty } = abandonMission();
    
    logger.warn({
      event: 'mission_abandoned',
      playerId: req.playerId,
      missionId,
      codename: mission.codename,
      penalty
    });
    
    res.json({
      success: true,
      message: `Missão ${mission.codename} abandonada. Penalidade: -${penalty} créditos.`,
      penalty,
      mission: formatMission({ ...mission, status: 'abandonada' })
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }
    next(err);
  }
});

/**
 * POST /api/missions/:id/fail
 * Marca missão como falha (game over, perda maior)
 */
router.post('/:id/fail', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de missão inválido',
        code: 'INVALID_ID'
      });
    }
    
    const failMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(
          new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' }
        );
      }
      
      if (mission.player_id !== req.playerId) {
        throw Object.assign(
          new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' }
        );
      }
      
      db.prepare('UPDATE missions SET status = ? WHERE id = ?')
        .run('falhou', missionId);
      
      // Penalidade maior: 30% dos créditos + perde XP
      const creditPenalty = Math.floor(mission.reward_credits * 0.3);
      const xpPenalty = Math.floor(mission.reward_xp * 0.5);
      
      db.prepare(`
        UPDATE players SET 
          credits = MAX(0, credits - ?),
          xp = MAX(0, xp - ?),
          missions_failed = missions_failed + 1
        WHERE id = ?
      `).run(creditPenalty, xpPenalty, mission.player_id);
      
      return { mission, creditPenalty, xpPenalty };
    });
    
    const { mission, creditPenalty, xpPenalty } = failMission();
    
    logger.error({
      event: 'mission_failed',
      playerId: req.playerId,
      missionId,
      codename: mission.codename,
      penalties: { credits: creditPenalty, xp: xpPenalty }
    });
    
    res.json({
      success: true,
      message: `❌ Missão ${mission.codename} falhou. Penalidades aplicadas.`,
      penalties: {
        credits: creditPenalty,
        xp: xpPenalty
      }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code
      });
    }
    next(err);
  }
});

// ============================================
// ESTATÍSTICAS DE MISSÕES
// ============================================

/**
 * GET /api/missions/stats
 * Estatísticas agregadas de missões do player
 */
router.get('/stats/summary', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const playerId = req.playerId;
    
    const stats = db.transaction(() => {
      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM missions 
        WHERE player_id = ? 
        GROUP BY status
      `).all(playerId);
      
      const byRarity = db.prepare(`
        SELECT rarity, COUNT(*) as count 
        FROM missions 
        WHERE player_id = ? AND status = 'concluida'
        GROUP BY rarity
      `).all(playerId);
      
      const byPriority = db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM missions 
        WHERE player_id = ? AND status = 'concluida'
        GROUP BY priority
      `).all(playerId);
      
      const totals = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'concluida' THEN reward_credits ELSE 0 END) as total_credits,
          SUM(CASE WHEN status = 'concluida' THEN reward_xp ELSE 0 END) as total_xp,
          SUM(CASE WHEN status = 'concluida' THEN reward_artifacts ELSE 0 END) as total_artifacts
        FROM missions 
        WHERE player_id = ?
      `).get(playerId);
      
      const legendaryCount = db.prepare(`
        SELECT COUNT(*) as count FROM missions 
        WHERE player_id = ? AND rarity = 'legendary' AND status = 'concluida'
      `).get(playerId).count;
      
      return {
        byStatus: byStatus.reduce((acc, s) => {
          acc[s.status] = s.count;
          return acc;
        }, {}),
        byRarity: byRarity.reduce((acc, r) => {
          acc[r.rarity] = r.count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, p) => {
          acc[p.priority] = p.count;
          return acc;
        }, {}),
        totals: {
          missions: totals.total,
          credits: totals.total_credits || 0,
          xp: totals.total_xp || 0,
          artifacts: totals.total_artifacts || 0,
          legendary_completed: legendaryCount
        },
        successRate: totals.total > 0 
          ? Math.round(((byStatus.find(s => s.status === 'concluida')?.count || 0) / totals.total) * 100)
          : 0
      };
    })();
    
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;