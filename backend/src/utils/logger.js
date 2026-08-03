/**
 * Logger estruturado
 * Em produção, usar Pino ou Winston
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

// Garante que diretório existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFile = fs.createWriteStream(
  path.join(LOG_DIR, 'archive.log'),
  { flags: 'a' }
);

function formatLog(level, data) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...data
  }) + '\n';
}

const logger = {
  info: (data) => {
    const log = formatLog('INFO', data);
    console.log(log.trim());
    logFile.write(log);
  },
  
  warn: (data) => {
    const log = formatLog('WARN', data);
    console.warn(log.trim());
    logFile.write(log);
  },
  
  error: (data) => {
    const log = formatLog('ERROR', data);
    console.error(log.trim());
    logFile.write(log);
  },
  
  debug: (data) => {
    if (process.env.NODE_ENV !== 'production') {
      const log = formatLog('DEBUG', data);
      console.log(log.trim());
    }
  }
};

module.exports = logger;