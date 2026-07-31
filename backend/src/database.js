const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../nexus.db');
let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  try {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } catch (err) {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      codename TEXT UNIQUE NOT NULL,
      specialty TEXT,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      xp_to_next INTEGER DEFAULT 500,
      credits INTEGER DEFAULT 1000,
      rank TEXT DEFAULT 'Diretor Interino',
      missions_completed INTEGER DEFAULT 0,
      missions_failed INTEGER DEFAULT 0,
      artifacts_recovered INTEGER DEFAULT 0,
      agents_recruited INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codename TEXT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT DEFAULT 'MÉDIA',
      status TEXT DEFAULT 'disponivel',
      phase INTEGER DEFAULT 1,
      total_phases INTEGER DEFAULT 3,
      specialty_filter TEXT,
      description TEXT,
      objectives TEXT,
      reward_xp INTEGER DEFAULT 0,
      reward_credits INTEGER DEFAULT 0,
      reward_artifacts INTEGER DEFAULT 0,
      player_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      origin TEXT NOT NULL,
      circa TEXT,
      category TEXT,
      status TEXT DEFAULT 'em analise',
      location TEXT
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
    const artifacts = [
      ['Cálice de Antioquia', 'Bizâncio', 'Século I', 'Religioso', 'em analise', 'Laboratório'],
      ['Manuscrito de Voynich', 'Europa Central', 'Século XV', 'Documental', 'em restauracao', 'Acervo Digital'],
      ['Máscara de Jade Inca', 'Império Inca', 'Século XV', 'Arqueologico', 'catalogado', 'Museu Archive']
    ];
    const stmt = db.prepare("INSERT INTO artifacts (name, origin, circa, category, status, location) VALUES (?, ?, ?, ?, ?, ?)");
    artifacts.forEach(a => stmt.run(a));
    stmt.free();
  }

  const missionCount = db.exec("SELECT COUNT(*) as count FROM missions")[0]?.values[0][0] || 0;
  if (missionCount === 0) {
    const missions = [
      ['MERIDIAN', 'O Cálice de Antioquia', 'Viena, Áustria', 'ALTA', 'disponivel', 1, 3, '["arqueologia", "historia"]', 'Recuperação de um artefato Classe-4.', '["Localizar cofre", "Neutralizar courier", "Recuperar cálice"]', 500, 1200, 1],
      ['TYPHON', 'Manuscrito de Voynich', 'Londres, Reino Unido', 'MÉDIA', 'disponivel', 1, 2, '["criptografia", "historia"]', 'Estudo de um manuscrito criptografado.', '["Obter acesso", "Escanear páginas", "Traduzir fragmento"]', 300, 800, 0]
    ];
    const stmt = db.prepare(`INSERT INTO missions (codename, title, location, priority, status, phase, total_phases, specialty_filter, description, objectives, reward_xp, reward_credits, reward_artifacts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    missions.forEach(m => stmt.run(m));
    stmt.free();
  }

  const upgradeCount = db.exec("SELECT COUNT(*) as count FROM upgrades")[0]?.values[0][0] || 0;
  if (upgradeCount === 0) {
    const upgrades = [
      ['Criptografia Quântica', 'Tecnologia', 4500, 'Rede II', 'Segurança de comunicações +45%.'],
      ['Rede de Informantes', 'Inteligência', 3200, 'Nível 2', 'Cobertura de vigilância +30%.'],
      ['Análise Preditiva', 'Análise', 6800, 'Tecnologia III', 'IA de previsão de movimentos.']
    ];
    const stmt = db.prepare("INSERT INTO upgrades (name, category, cost, requirement, description) VALUES (?, ?, ?, ?, ?)");
    upgrades.forEach(u => stmt.run(u));
    stmt.free();
  }
  saveDatabase();
}

function getDb() {
  return {
    prepare: (sql) => {
      return {
        run: (params) => {
          const stmt = db.prepare(sql);
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (Array.isArray(params) ? params : []);
          stmt.run(values);
          const res = db.exec("SELECT last_insert_rowid() as id");
          const result = { 
            lastInsertRowid: res[0]?.values[0][0] || 0, 
            changes: db.getRowsModified() 
          };
          stmt.free();
          return result;
        },
        get: (params) => {
          const stmt = db.prepare(sql);
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (Array.isArray(params) ? params : [params]);
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
          const values = params && typeof params === 'object' && !Array.isArray(params) ? Object.values(params) : (Array.isArray(params) ? params : [params]);
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