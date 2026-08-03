const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { 
  authenticate, 
  authorizeOwnResource, 
  generateToken 
} = require('../middlewares/auth');
const { validate, schemas } = require('../middlewares/validate');
const { strictLimiter } = require('../middlewares/rateLimiter');
const logger = require('../utils/logger');

/**
 * POST /api/players
 * Cria novo jogador (rota pública, com rate limit)
 */
router.post(
  '/',
  strictLimiter,
  validate(schemas.createPlayer),
  (req, res, next) => {
    try {
      const db = getDb();
      const { name, codename, specialty } = req.body;
      
      // Sanitização extra (defesa em profundidade)
      const cleanCodename = codename.trim().replace(/[^\w-]/g, '');
      
      const insert = db.prepare(
        'INSERT INTO players (name, codename, specialty) VALUES (?, ?, ?)'
      );
      
      const info = insert.run(name, cleanCodename, specialty);
      const player = db.prepare('SELECT * FROM players WHERE id = ?')
        .get(info.lastInsertRowid);
      
      // Gera token JWT para o novo player
      const token = generateToken(player);
      
      logger.info({
        event: 'player_created',
        playerId: player.id,
        codename: player.codename
      });
      
      res.status(201).json({ player, token });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({
          error: 'Codinome já está em uso',
          code: 'CODENAME_TAKEN'
        });
      }
      next(err);
    }
  }
);

/**
 * POST /api/players/login
 * Autentica jogador existente (retorna token)
 */
router.post(
  '/login',
  strictLimiter,
  (req, res, next) => {
    try {
      const { codename } = req.body;
      
      if (!codename) {
        return res.status(400).json({
          error: 'Codinome é obrigatório',
          code: 'CODENAME_REQUIRED'
        });
      }
      
      const db = getDb();
      const player = db.prepare('SELECT * FROM players WHERE codename = ?')
        .get(codename);
      
      if (!player) {
        return res.status(401).json({
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      const token = generateToken(player);
      
      logger.info({
        event: 'player_login',
        playerId: player.id
      });
      
      res.json({ player, token });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/players/:id
 * Retorna dados do jogador (só o próprio pode acessar)
 */
router.get(
  '/:id',
  authenticate,
  authorizeOwnResource,
  (req, res, next) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id);
      
      const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      
      if (!player) {
        return res.status(404).json({ error: 'Operativo não encontrado' });
      }
      
      const activeMissions = db.prepare(
        'SELECT * FROM missions WHERE player_id = ? AND status = ?'
      ).all(id, 'ativa');
      
      const upgrades = db.prepare(`
        SELECT u.* FROM upgrades u 
        INNER JOIN player_upgrades pu ON u.id = pu.upgrade_id 
        WHERE pu.player_id = ?
      `).all(id);
      
      res.json({
        ...player,
        active_missions: activeMissions,
        upgrades: upgrades
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/players/:id
 * Atualiza dados do jogador (só o próprio, validado)
 */
router.put(
  '/:id',
  authenticate,
  authorizeOwnResource,
  validate(schemas.updatePlayer),
  (req, res, next) => {
    try {
      const db = getDb();
      const { id } = req.params;
      const data = req.body;
      
      // Constrói UPDATE dinâmico apenas com campos fornecidos
      const fields = [];
      const values = [];
      
      const fieldMap = {
        name: 'name',
        codename: 'codename',
        level: 'level',
        xp: 'xp',
        xpToNext: 'xp_to_next',
        credits: 'credits',
        rank: 'rank',
        missionsCompleted: 'missions_completed',
        missionsFailed: 'missions_failed',
        artifactsRecovered: 'artifacts_recovered',
        agentsRecruited: 'agents_recruited'
      };
      
      for (const [jsField, dbField] of Object.entries(fieldMap)) {
        if (data[jsField] !== undefined) {
          fields.push(`${dbField} = ?`);
          values.push(data[jsField]);
        }
      }
      
      if (fields.length === 0) {
        return res.status(400).json({
          error: 'Nenhum campo para atualizar',
          code: 'NO_FIELDS'
        });
      }
      
      values.push(id);
      
      const sql = `UPDATE players SET ${fields.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);
      
      logger.info({
        event: 'player_updated',
        playerId: parseInt(id),
        fields: Object.keys(data)
      });
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/players/:id/upgrades
 * Compra upgrade (com transação e validações)
 */
router.post(
  '/:id/upgrades',
  authenticate,
  authorizeOwnResource,
  validate(schemas.buyUpgrade),
  (req, res, next) => {
    try {
      const db = getDb();
      const playerId = parseInt(req.params.id);
      const { upgrade_id } = req.body;
      
      const buyUpgrade = db.transaction(() => {
        const upgrade = db.prepare('SELECT * FROM upgrades WHERE id = ?')
          .get(upgrade_id);
        
        if (!upgrade) {
          throw Object.assign(
            new Error('Upgrade não encontrado'),
            { status: 404 }
          );
        }
        
        const player = db.prepare('SELECT * FROM players WHERE id = ?')
          .get(playerId);
        
        if (player.credits < upgrade.cost) {
          throw Object.assign(
            new Error('Créditos insuficientes'),
            { status: 400, code: 'INSUFFICIENT_CREDITS' }
          );
        }
        
        // Verifica requisitos (se houver)
        if (upgrade.required_level && player.level < upgrade.required_level) {
          throw Object.assign(
            new Error(`Requer nível ${upgrade.required_level}`),
            { status: 400, code: 'LEVEL_REQUIRED' }
          );
        }
        
        const existing = db.prepare(
          'SELECT * FROM player_upgrades WHERE player_id = ? AND upgrade_id = ?'
        ).get(playerId, upgrade_id);
        
        if (existing) {
          throw Object.assign(
            new Error('Upgrade já adquirido'),
            { status: 400, code: 'ALREADY_OWNED' }
          );
        }
        
        // Aplica compra
        db.prepare('UPDATE players SET credits = credits - ? WHERE id = ?')
          .run(upgrade.cost, playerId);
        
        db.prepare(
          'INSERT INTO player_upgrades (player_id, upgrade_id) VALUES (?, ?)'
        ).run(playerId, upgrade_id);
        
        return upgrade;
      });
      
      const upgrade = buyUpgrade();
      
      logger.info({
        event: 'upgrade_purchased',
        playerId,
        upgradeId: upgrade_id,
        upgradeName: upgrade.name,
        cost: upgrade.cost
      });
      
      res.json({
        success: true,
        message: `${upgrade.name} desbloqueado.`,
        upgrade
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
  }
);

module.exports = router;