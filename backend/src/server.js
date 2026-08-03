const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { initDatabase, getDb } = require('./database');

const missionsRouter = require('./routes/missions');
const playerRouter = require('./routes/player');
const archiveRouter = require('./routes/archive');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ============================================
// SEGURANÇA
// ============================================
app.use(helmet({
  contentSecurityPolicy: false, // Necessário para servir frontend
  crossOriginEmbedderPolicy: false
}));

// CORS configurável por ambiente
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173', // Vite dev
      'http://localhost:3000', // Backend dev
      'https://project-nexus-mi7.netlify.app',
      'https://project-nexus-15sj.onrender.com'
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Em dev, permite qualquer localhost
    if (!IS_PROD && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    
    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// ============================================
// PERFORMANCE
// ============================================
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================
// REQUEST ID (rastreabilidade)
// ============================================
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ============================================
// REQUEST LOGGING
// ============================================
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, id } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: id,
      method,
      url: originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 50)
    };
    
    if (res.statusCode >= 500) {
      console.error('[ERROR]', JSON.stringify(logData));
    } else if (res.statusCode >= 400) {
      console.warn('[WARN]', JSON.stringify(logData));
    } else if (!IS_PROD) {
      console.log('[REQ]', JSON.stringify(logData));
    }
  });
  
  next();
});

// ============================================
// RATE LIMITING
// ============================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: IS_PROD ? 100 : 1000, // Mais permissivo em dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  skip: (req) => req.path === '/api/health' // Health check não conta
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  message: {
    error: 'Muitas tentativas. Aguarde 1 minuto.',
    code: 'AUTH_RATE_LIMIT'
  }
});

app.use('/api/', globalLimiter);

// ============================================
// HEALTH CHECK AVANÇADO
// ============================================
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    requestId: req.id
  };
  
  try {
    // Testa conexão com DB
    const db = getDb();
    const result = db.prepare('SELECT 1 as ok').get();
    health.database = result?.ok === 1 ? 'connected' : 'error';
    
    // Estatísticas rápidas
    const playersCount = db.prepare('SELECT COUNT(*) as c FROM players').get().c;
    const missionsCount = db.prepare('SELECT COUNT(*) as c FROM missions').get().c;
    
    health.stats = { playersCount, missionsCount };
    health.status = 'healthy';
  } catch (err) {
    health.database = 'error';
    health.dbError = IS_PROD ? 'Unavailable' : err.message;
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ============================================
// API INFO (root da API)
// ============================================
app.get('/api', (req, res) => {
  res.json({
    name: 'ARCHIVE OS API',
    version: '3.0.0',
    description: 'Sistema operacional de investigação geopolítica',
    endpoints: {
      health: '/api/health',
      missions: '/api/missions',
      player: '/api/player',
      archive: '/api/archive'
    },
    docs: 'https://github.com/seu-usuario/archive-os',
    requestId: req.id
  });
});

// ============================================
// ROTAS DA API
// ============================================
app.use('/api/missions', missionsRouter);
app.use('/api/player', authLimiter, playerRouter); // Rate limit extra em auth
app.use('/api/archive', archiveRouter);

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.path,
    method: req.method,
    requestId: req.id,
    suggestion: 'Verifique a documentação em /api'
  });
});

// ============================================
// ERROR HANDLER CENTRALIZADO
// ============================================
app.use((err, req, res, next) => {
  const requestId = req.id;
  
  // Log estruturado
  const errorLog = {
    requestId,
    error: err.message,
    stack: IS_PROD ? undefined : err.stack,
    path: req.path,
    method: req.method,
    body: req.body ? '[redacted]' : undefined
  };
  
  console.error('[ERROR]', JSON.stringify(errorLog));
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Origem não permitida',
      code: 'CORS_BLOCKED',
      requestId
    });
  }
  
  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON inválido no body',
      code: 'INVALID_JSON',
      requestId
    });
  }
  
  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload muito grande (máx 1MB)',
      code: 'PAYLOAD_TOO_LARGE',
      requestId
    });
  }
  
  // Erro genérico
  res.status(err.status || 500).json({
    error: IS_PROD ? 'Erro interno do servidor' : err.message,
    code: err.code || 'INTERNAL_ERROR',
    requestId,
    ...(IS_PROD ? {} : { stack: err.stack })
  });
});

// ============================================
// INICIALIZAÇÃO COM GRACEFUL SHUTDOWN
// ============================================
let server;

async function start() {
  try {
    await initDatabase();
    console.log('✅ Database initialized');
    
    server = app.listen(PORT, () => {
      console.log(`\n🎮 ARCHIVE OS API v3.0`);
      console.log(`├─ Porta: ${PORT}`);
      console.log(`├─ Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`├─ Health: http://localhost:${PORT}/api/health`);
      console.log(`├─ CORS: ${ALLOWED_ORIGINS.length} origens permitidas`);
      console.log(`└─ Rate limit: ${IS_PROD ? '100' : '1000'} req/15min\n`);
    });
    
    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 ${signal} recebido. Encerrando graciosamente...`);
      
      server.close(() => {
        console.log('✅ Servidor HTTP fechado');
      });
      
      try {
        const db = getDb();
        if (db && typeof db.close === 'function') {
          db.close();
          console.log('✅ Conexão com DB fechada');
        }
      } catch (e) {
        console.warn('⚠️ Erro ao fechar DB:', e.message);
      }
      
      setTimeout(() => {
        console.log('⏱️ Timeout de shutdown. Forçando saída.');
        process.exit(0);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Captura erros não tratados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection:', reason);
    });
    
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err);
      shutdown('UNCAUGHT_EXCEPTION');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app; // Para testes