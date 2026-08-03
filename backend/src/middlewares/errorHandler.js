/**
 * Handler centralizado de erros
 * Previne exposição de stack traces em produção
 */
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log estruturado
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    playerId: req.playerId || 'anonymous'
  });

  // Erros conhecidos
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR'
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Conflito de dados (registro duplicado)',
      code: 'CONFLICT'
    });
  }

  // Erro genérico - não expõe detalhes em produção
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(err.status || 500).json({
    error: isProduction 
      ? 'Erro interno do servidor' 
      : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(isProduction ? {} : { stack: err.stack })
  });
}

module.exports = errorHandler;