const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { generateMission, generateMissionBatch, RARITIES } = require('../services/missionGenerator');
const { authenticate } = require('../middlewares/auth');
const { validate, schemas } = require('../middlewares/validate');
const logger = require('../utils/logger');

// ============================================
// 🆕 MIDDLEWARE: AUTH OPCIONAL (para demo)
// Tenta usar token JWT se existir, senão segue.
// Permite o jogo funcionar sem login rígido.
// ============================================
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(
        header.split(' ')[1],
        process.env.JWT_SECRET || 'archive-os-secret-dev-only'
      );
      req.playerId = decoded.playerId;
    } catch (e) {
      // token inválido → ignora, segue sem playerId
    }
  }
  // Fallback: aceita player_id vindo no body da requisição
  if (!req.playerId && req.body && req.body.player_id) {
    req.playerId = req.body.player_id;
  }
  next();
}

// ============================================
// HELPERS
// ============================================

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
// LISTAGEM (AGORA SEM authenticate)
// ============================================

router.get('/', (req, res, next) => {  // 🆕 removi authenticate
  try {
    const db = getDb();
    const { status, priority, rarity, location, mine } = req.query;
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    
    const conditions = [];
    const params = [];
    
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (priority) { conditions.push('priority = ?'); params.push(priority.toUpperCase()); }
    if (rarity) { conditions.push('rarity = ?'); params.push(rarity.toLowerCase()); }
    if (location) { conditions.push('location LIKE ?'); params.push(`%${location}%`); }
    if (mine === 'true' && req.playerId) { 
      conditions.push('player_id = ?'); 
      params.push(req.playerId); 
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const missions = db.prepare(
      `SELECT * FROM missions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
    
    const total = db.prepare(
      `SELECT COUNT(*) as count FROM missions ${whereClause}`
    ).get(...params).count;
    
    logger.debug({
      event: 'missions_listed',
      filters: { status, priority, rarity, location, mine },
      total, page
    });
    
    res.json({
      missions: missions.map(formatMission),
      pagination: {
        page, limit, total,
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
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {  // 🆕 removi authenticate
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        error: 'ID de missão inválido', code: 'INVALID_ID'
      });
    }
    
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
    
    if (!mission) {
      return res.status(404).json({
        error: 'Missão não encontrada', code: 'MISSION_NOT_FOUND'
      });
    }
    
    res.json({ mission: formatMission(mission) });
  } catch (err) { next(err); }
});

// ============================================
// GERAÇÃO (optionalAuth em vez de authenticate)
// ============================================

router.post('/generate', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const { forceRarity, forceLocation } = req.body || {};
    
    if (forceRarity && !RARITIES[forceRarity]) {
      return res.status(400).json({
        error: `Raridade inválida. Use: ${Object.keys(RARITIES).join(', ')}`,
        code: 'INVALID_RARITY'
      });
    }
    
    // Só busca player se tiver playerId
    let player = null;
    if (req.playerId) {
      player = db.prepare(
        'SELECT level, specialty FROM players WHERE id = ?'
      ).get(req.playerId);
    }
    
    const existing = db.prepare(
      'SELECT codename FROM missions ORDER BY created_at DESC LIMIT 100'
    ).all();
    const existingCodenames = existing.map(m => m.codename);
    
    const newMission = generateMission({
      playerLevel: player?.level || 1,
      playerSpecialty: player?.specialty,
      existingCodenames,
      forceRarity,
      forceLocation
    });
    
    const insert = db.prepare(`
      INSERT INTO missions (
        codename, title, location, location_data, priority, rarity, 
        status, phase, total_phases, specialty_filter, description, 
        objectives, target, estimated_duration,
        reward_xp, reward_credits, reward_artifacts, generated_at
      ) VALUES (
        @codename, @title, @location, @location_data, @priority, @rarity,
        @status, @phase, @total_phases, @specialty_filter, @description,
        @objectives, @target, @estimated_duration,
        @reward_xp, @reward_credits, @reward_artifacts, @generated_at
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
      playerId: req.playerId || 'anon',
      missionId: Number(info.lastInsertRowid),
      codename: newMission.codename,
      rarity: newMission.rarity
    });
    
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      ...formatMission({ ...newMission, id: Number(info.lastInsertRowid) })
    });
  } catch (err) { next(err); }
});

router.post('/generate/batch', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const count = Math.min(10, Math.max(1, parseInt(req.body?.count) || 5));
    
    let player = null;
    if (req.playerId) {
      player = db.prepare(
        'SELECT level, specialty FROM players WHERE id = ?'
      ).get(req.playerId);
    }
    
    const existing = db.prepare(
      'SELECT codename FROM missions ORDER BY created_at DESC LIMIT 200'
    ).all();
    const existingCodenames = existing.map(m => m.codename);
    
    const missions = generateMissionBatch(count, {
      playerLevel: player?.level || 1,
      playerSpecialty: player?.specialty,
      existingCodenames
    });
    
    const insertMany = db.transaction((missionsList) => {
      const insert = db.prepare(`
        INSERT INTO missions (
          codename, title, location, location_data, priority, rarity,
          status, phase, total_phases, specialty_filter, description,
          objectives, target, estimated_duration,
          reward_xp, reward_credits, reward_artifacts, generated_at
        ) VALUES (
          @codename, @title, @location, @location_data, @priority, @rarity,
          @status, @phase, @total_phases, @specialty_filter, @description,
          @objectives, @target, @estimated_duration,
          @reward_xp, @reward_credits, @reward_artifacts, @generated_at
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
      playerId: req.playerId || 'anon',
      count: inserted.length
    });
    
    res.status(201).json({
      missions: inserted.map(formatMission),
      count: inserted.length
    });
  } catch (err) { next(err); }
});
// ============================================
// CICLO DE VIDA (optionalAuth + validações relaxadas)
// ============================================

router.post('/:id/accept', optionalAuth, validate(schemas.acceptMission), (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    const playerId = req.body.player_id || req.playerId;
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false, error: 'ID de missão inválido', code: 'INVALID_ID'
      });
    }
    
    // 🆕 Validação: exige identificação do player
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Identificação do operativo obrigatória',
        code: 'PLAYER_REQUIRED'
      });
    }
    
    const acceptMission = db.transaction(() => {
      const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
      
      if (!mission) {
        throw Object.assign(new Error('Missão não encontrada'), 
          { status: 404, code: 'MISSION_NOT_FOUND' });
      }
      
      if (mission.status !== 'disponivel') {
        throw Object.assign(
          new Error(`Missão não está disponível (status: ${mission.status})`),
          { status: 409, code: 'MISSION_NOT_AVAILABLE' }
        );
      }
      
      const activeMission = db.prepare(
        'SELECT id, codename FROM missions WHERE player_id = ? AND status = ?'
      ).get(playerId, 'ativa');
      
      if (activeMission) {
        throw Object.assign(
          new Error(`Você já tem uma missão ativa: ${activeMission.codename}`),
          { status: 409, code: 'ALREADY_HAS_ACTIVE_MISSION', data: activeMission }
        );
      }
      
      const requiredSpecialties = safeJsonParse(mission.specialty_filter, []);
      if (requiredSpecialties.length > 0) {
        const player = db.prepare('SELECT specialty FROM players WHERE id = ?').get(playerId);
        if (player && !requiredSpecialties.includes(player.specialty)) {
          throw Object.assign(
            new Error(`Especialidade incompatível. Requer: ${requiredSpecialties.join(', ')}`),
            { status: 403, code: 'SPECIALTY_MISMATCH' }
          );
        }
      }
      
      db.prepare('UPDATE missions SET status = ?, player_id = ? WHERE id = ?')
        .run('ativa', playerId, missionId);
      
      return mission;
    });
    
    const mission = acceptMission();
    
    logger.info({
      event: 'mission_accepted', playerId, missionId, codename: mission.codename
    });
    
    res.json({
      success: true,
      message: `Missão ${mission.codename} aceita. Boa sorte, Operativo.`,
      mission: formatMission({ ...mission, status: 'ativa', player_id: playerId })
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false, error: err.message, code: err.code, data: err.data
      });
    }
    next(err);
  }
});

router.post('/:id/complete', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false, error: 'ID de missão inválido', code: 'INVALID_ID'
      });
    }
    
    const completeMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' });
      }
      
      // 🆕 Só valida dono SE tiver playerId (sem token, confia no dono gravado)
      if (req.playerId && mission.player_id !== req.playerId) {
        throw Object.assign(new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' });
      }
      
      db.prepare('UPDATE missions SET status = ? WHERE id = ?').run('concluida', missionId);
      
      db.prepare(`
        UPDATE players SET 
          credits = credits + ?, xp = xp + ?,
          artifacts_recovered = artifacts_recovered + ?,
          missions_completed = missions_completed + 1
        WHERE id = ?
      `).run(
        mission.reward_credits, mission.reward_xp,
        mission.reward_artifacts, mission.player_id
      );
      
      const player = db.prepare('SELECT * FROM players WHERE id = ?').get(mission.player_id);
      
      let leveledUp = false;
      if (player.xp >= player.xp_to_next) {
        db.prepare(`
          UPDATE players SET 
            level = level + 1, xp = xp - xp_to_next,
            xp_to_next = xp_to_next * 1.5,
            rank = CASE 
              WHEN level + 1 >= 10 THEN 'Diretor Sênior'
              WHEN level + 1 >= 5 THEN 'Agente Especial'
              ELSE rank END
          WHERE id = ?
        `).run(mission.player_id);
        leveledUp = true;
      }
      
      return { mission, leveledUp, player };
    });
    
    const { mission, leveledUp, player } = completeMission();
    
    logger.info({
      event: 'mission_completed', playerId: req.playerId, missionId,
      codename: mission.codename, leveledUp
    });
    
    res.json({
      success: true,
      message: leveledUp 
        ? `🎉 Missão concluída! Nível ${player.level + 1}!`
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
        success: false, error: err.message, code: err.code
      });
    }
    next(err);
  }
});

router.post('/:id/abandon', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false, error: 'ID de missão inválido', code: 'INVALID_ID'
      });
    }
    
    const abandonMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' });
      }
      
      // 🆕 Só valida dono se tiver playerId
      if (req.playerId && mission.player_id !== req.playerId) {
        throw Object.assign(new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' });
      }
      
      db.prepare('UPDATE missions SET status = ? WHERE id = ?').run('abandonada', missionId);
      
      const penalty = Math.floor(mission.reward_credits * 0.1);
      const player = db.prepare('SELECT credits FROM players WHERE id = ?').get(mission.player_id);
      
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
      event: 'mission_abandoned', missionId, codename: mission.codename, penalty
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
        success: false, error: err.message, code: err.code
      });
    }
    next(err);
  }
});

router.post('/:id/fail', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const missionId = parseInt(req.params.id);
    
    if (isNaN(missionId)) {
      return res.status(400).json({
        success: false, error: 'ID de missão inválido', code: 'INVALID_ID'
      });
    }
    
    const failMission = db.transaction(() => {
      const mission = db.prepare(
        'SELECT * FROM missions WHERE id = ? AND status = ?'
      ).get(missionId, 'ativa');
      
      if (!mission) {
        throw Object.assign(new Error('Missão ativa não encontrada'),
          { status: 404, code: 'MISSION_NOT_FOUND' });
      }
      
      // 🆕 Só valida dono se tiver playerId
      if (req.playerId && mission.player_id !== req.playerId) {
        throw Object.assign(new Error('Você não é o dono desta missão'),
          { status: 403, code: 'FORBIDDEN' });
      }
      
      db.prepare('UPDATE missions SET status = ? WHERE id = ?').run('falhou', missionId);
      
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
      event: 'mission_failed', missionId, codename: mission.codename,
      penalties: { credits: creditPenalty, xp: xpPenalty }
    });
    
    res.json({
      success: true,
      message: `❌ Missão ${mission.codename} falhou. Penalidades aplicadas.`,
      penalties: { credits: creditPenalty, xp: xpPenalty }
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false, error: err.message, code: err.code
      });
    }
    next(err);
  }
});

// ============================================
// ESTATÍSTICAS (optionalAuth — só retorna dados se tiver playerId)
// ============================================

router.get('/stats/summary', optionalAuth, (req, res, next) => {  // 🆕 optionalAuth
  try {
    const db = getDb();
    const playerId = req.playerId;
    
    // Se não tiver playerId, retorna stats zeradas (não falha)
    if (!playerId) {
      return res.json({
        stats: {
          byStatus: {}, byRarity: {}, byPriority: {},
          totals: { missions: 0, credits: 0, xp: 0, artifacts: 0, legendary_completed: 0 },
          successRate: 0
        }
      });
    }
    
    const stats = db.transaction(() => {
      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as count FROM missions 
        WHERE player_id = ? GROUP BY status
      `).all(playerId);
      
      const byRarity = db.prepare(`
        SELECT rarity, COUNT(*) as count FROM missions 
        WHERE player_id = ? AND status = 'concluida' GROUP BY rarity
      `).all(playerId);
      
      const byPriority = db.prepare(`
        SELECT priority, COUNT(*) as count FROM missions 
        WHERE player_id = ? AND status = 'concluida' GROUP BY priority
      `).all(playerId);
      
      const totals = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'concluida' THEN reward_credits ELSE 0 END) as total_credits,
          SUM(CASE WHEN status = 'concluida' THEN reward_xp ELSE 0 END) as total_xp,
          SUM(CASE WHEN status = 'concluida' THEN reward_artifacts ELSE 0 END) as total_artifacts
        FROM missions WHERE player_id = ?
      `).get(playerId);
      
      const legendaryCount = db.prepare(`
        SELECT COUNT(*) as count FROM missions 
        WHERE player_id = ? AND rarity = 'legendary' AND status = 'concluida'
      `).get(playerId).count;
      
      return {
        byStatus: byStatus.reduce((a, s) => { a[s.status] = s.count; return a; }, {}),
        byRarity: byRarity.reduce((a, r) => { a[r.rarity] = r.count; return a; }, {}),
        byPriority: byPriority.reduce((a, p) => { a[p.priority] = p.count; return a; }, {}),
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
  } catch (err) { next(err); }
});

module.exports = router;