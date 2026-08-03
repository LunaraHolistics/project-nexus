/**
 * Rate limiting simples em memória
 * Para produção, usar Redis (express-rate-limit + rate-limit-redis)
 */
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 requests por minuto (para login, etc)
  message: { error: 'Limite excedido. Aguarde 1 minuto.' }
});

module.exports = { generalLimiter, strictLimiter };