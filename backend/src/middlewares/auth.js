/**
 * Middleware de autenticação JWT
 * Protege rotas sensíveis e injeta req.playerId
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'archive-os-secret-dev-only';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Token de autenticação ausente',
      code: 'AUTH_REQUIRED'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.playerId = decoded.playerId;
    req.playerCodename = decoded.codename;
    next();
  } catch (err) {
    return res.status(401).json({ 
      error: 'Token inválido ou expirado',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Garante que o player só pode acessar seus próprios recursos
 */
function authorizeOwnResource(req, res, next) {
  const resourceId = parseInt(req.params.id);
  
  if (resourceId !== req.playerId) {
    return res.status(403).json({ 
      error: 'Acesso negado a recurso de outro operativo',
      code: 'FORBIDDEN'
    });
  }
  
  next();
}

/**
 * Gera token JWT para um player
 */
function generateToken(player) {
  return jwt.sign(
    { 
      playerId: player.id, 
      codename: player.codename,
      specialty: player.specialty
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authenticate, authorizeOwnResource, generateToken };