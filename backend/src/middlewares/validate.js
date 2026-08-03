/**
 * Middleware de validação com Joi
 * Reutilizável para qualquer rota
 */
const Joi = require('joi');

function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true  // Remove campos desconhecidos (segurança)
    });

    if (error) {
      const errors = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      
      return res.status(400).json({
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req[property] = value;
    next();
  };
}

// Schemas reutilizáveis
const schemas = {
  createPlayer: Joi.object({
    name: Joi.string().min(2).max(60).required(),
    codename: Joi.string().min(2).max(30).pattern(/^[a-zA-Z0-9_-]+$/).required(),
    specialty: Joi.string().min(2).max(40).default('Investigação')
  }),

  updatePlayer: Joi.object({
    name: Joi.string().min(2).max(60),
    level: Joi.number().integer().min(1),
    xp: Joi.number().integer().min(0),
    credits: Joi.number().integer().min(0),
    rank: Joi.string().max(50),
    artifactsRecovered: Joi.number().integer().min(0),
    agentsRecruited: Joi.number().integer().min(0)
  }).min(1), // Pelo menos um campo

  buyUpgrade: Joi.object({
    upgrade_id: Joi.number().integer().positive().required()
  }),

  acceptMission: Joi.object({
    player_id: Joi.number().integer().positive()
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('disponivel', 'ativa', 'concluida', 'falhou')
  })
};

module.exports = { validate, schemas };