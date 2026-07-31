const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../nexus.db');
let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  try {
    // Tenta carregar o banco existente
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } catch (err) {
    // Se não existir, cria um novo em memória
    db = new SQL.Database();
  }

  // Criação das tabelas
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      codename TEXT UNIQUE NOT NULL,
      specialty TEXT,
      credits INTEGER DEFAULT 1000,
      influence_level INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      objective TEXT NOT NULL,
      target TEXT,
      threat_level TEXT DEFAULT 'MÉDIO',
      status TEXT DEFAULT 'disponivel',
      reward_credits INTEGER DEFAULT 0,
      reward_influence INTEGER DEFAULT 0,
      player_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      origin TEXT NOT NULL,
      era TEXT NOT NULL,
      material TEXT,
      status TEXT DEFAULT 'Recuperado',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS suspects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL,
      status TEXT DEFAULT 'Desconhecido',
      last_location TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS upgrades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      cost INTEGER NOT NULL,
      requirement TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS player_upgrades (
      player_id INTEGER,
      upgrade_id INTEGER,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(player_id, upgrade_id)
    );
  `);

  seedData();
  saveDatabase();
  
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function seedData() {
  const artifactCount = db.exec("SELECT COUNT(*) as count FROM artifacts")[0]?.values[0][0] || 0;
  if (artifactCount === 0) {
    db.run("INSERT INTO artifacts (name, origin, era, material, description) VALUES ('Cálice de Prata', 'Pequim, China', '1450', 'Prata, Jade', 'Cálice cerimonial da Dinastia Ming.')");
    db.run("INSERT INTO artifacts (name, origin, era, material, description) VALUES ('Manuscrito Voynich', 'Europa Central', 'Séc. XV', 'Pergaminho', 'Códice ilustrado indecifrado.')");
    db.run("INSERT INTO artifacts (name, origin, era, material, description) VALUES ('Máscara de Ouro', 'Cusco, Peru', '1400', 'Ouro, Turquesa', 'Máscara funerária do Império Inca.')");
  }

  const suspectCount = db.exec("SELECT COUNT(*) as count FROM suspects")[0]?.values[0][0] || 0;
  if (suspectCount === 0) {
    db.run("INSERT INTO suspects (alias, status, last_location, notes) VALUES ('O Relojoeiro', 'Foragido', 'Londres', 'Especialista em dispositivos mecânicos.')");
    db.run("INSERT INTO suspects (alias, status, last_location, notes) VALUES ('Agente V', 'Desaparecido', 'Genebra', 'Ex-operador de inteligência russa.')");
    db.run("INSERT INTO suspects (alias, status, last_location, notes) VALUES ('Victor Volkov', 'Vigilância', 'Tóquio', 'Suspeito de lavagem de artefatos.')");
  }

  const upgradeCount = db.exec("SELECT COUNT(*) as count FROM upgrades")[0]?.values[0][0] || 0;
  if (upgradeCount === 0) {
    db.run("INSERT INTO upgrades (name, category, cost, requirement, description) VALUES ('Criptografia Quântica', 'Tecnologia', 4500, 'Rede II', 'Segurança de comunicações +45%.')");
    db.run("INSERT INTO upgrades (name, category, cost, requirement, description) VALUES ('Rede de Informantes', 'Inteligência', 3200, 'Nível 2', 'Cobertura de vigilância +30%.')");
    db.run("INSERT INTO upgrades (name, category, cost, requirement, description) VALUES ('Análise Preditiva', 'Análise', 6800, 'Tecnologia III', 'IA de previsão de movimentos.')");
  }
  saveDatabase();
}

// Wrapper para imitar a API do better-sqlite3 e não precisar mudar as rotas
function getDb() {
  return {
    prepare: (sql) => {
      return {
        run: (params) => {
          const stmt = db.prepare(sql);
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (params || []);
          stmt.run(values);
          stmt.free();
          const res = db.exec("SELECT last_insert_rowid() as id");
          return { 
            lastInsertRowid: res[0]?.values[0][0], 
            changes: db.getRowsModified() 
          };
        },
        get: (params) => {
          const stmt = db.prepare(sql);
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (params || []);
          stmt.bind(values);
          let result = null;
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.free();
          return result;
        },
        all: (params) => {
          const stmt = db.prepare(sql);
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (params || []);
          stmt.bind(values);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        }
      };
    },
    exec: (sql) => {
      return db.exec(sql);
    },
    transaction: (fn) => {
      return (...args) => {
        db.run("BEGIN TRANSACTION");
        try {
          const result = fn(...args);
          db.run("COMMIT");
          saveDatabase();
          return result;
        } catch (err) {
          db.run("ROLLBACK");
          throw err;
        }
      };
    }
  };
}

module.exports = { initDatabase, getDb };