/**
 * ARCHIVE IMPORTER — Project Nexus v2.0
 * Importa missões e artefatos de arquivos JSON para o banco de dados
 * 
 * Uso:
 *   node backend/importer.js missions.json    # Importa missões
 *   node backend/importer.js artifacts.json   # Importa artefatos
 *   node backend/importer.js both.json        # Importa ambos
 */

const fs = require('fs');
const path = require('path');
const { initDatabase, getDb } = require('./src/database');

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('[IMPORTER] Uso: node importer.js <arquivo.json>');
    console.error('Exemplos:');
    console.error('  node importer.js missions.json');
    console.error('  node importer.js artifacts.json');
    process.exit(1);
  }
  return args[0];
}

function loadData(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`[IMPORTER] Erro: Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  try {
    const data = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[IMPORTER] Erro ao ler arquivo:', err.message);
    process.exit(1);
  }
}

async function importMissions(missions) {
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO missions 
    (codename, title, location, priority, specialty_filter, description, objectives, reward_xp, reward_credits, reward_artifacts, status, phase, total_phases)
    VALUES (@codename, @title, @location, @priority, @specialty_filter, @description, @objectives, @reward_xp, @reward_credits, @reward_artifacts, 'disponivel', 1, @totalPhases)
  `);

  missions.forEach(mission => {
    try {
      const result = stmt.run({
        codename: mission.codename,
        title: mission.title,
        location: mission.location,
        priority: mission.priority || 'MÉDIA',
        specialty_filter: JSON.stringify(mission.specialty_filter || []),
        description: mission.description,
        objectives: JSON.stringify(mission.objectives || []),
        reward_xp: mission.reward?.xp || 500,
        reward_credits: mission.reward?.credits || 1000,
        reward_artifacts: mission.reward?.artifacts || 0,
        totalPhases: mission.totalPhases || 3
      });

      if (result.changes > 0) {
        imported++;
        console.log(`  ✓ ${mission.codename} - ${mission.title}`);
      } else {
        skipped++;
        console.log(`  ⊘ ${mission.codename} (já existe)`);
      }
    } catch (err) {
      console.error(`  ✗ Erro ao importar ${mission.codename}:`, err.message);
    }
  });

  return { imported, skipped };
}

async function importArtifacts(artifacts) {
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO artifacts 
    (name, origin, circa, category, status, location)
    VALUES (@name, @origin, @circa, @category, @status, @location)
  `);

  artifacts.forEach(artifact => {
    try {
      const result = stmt.run({
        name: artifact.name,
        origin: artifact.origin,
        circa: artifact.circa,
        category: artifact.category,
        status: artifact.status || 'em analise',
        location: artifact.location || 'Laboratório'
      });

      if (result.changes > 0) {
        imported++;
        console.log(`  ✓ ${artifact.name} (${artifact.origin})`);
      } else {
        skipped++;
        console.log(`  ⊘ ${artifact.name} (já existe)`);
      }
    } catch (err) {
      console.error(`  ✗ Erro ao importar ${artifact.name}:`, err.message);
    }
  });

  return { imported, skipped };
}

async function main() {
  const fileName = parseArgs();
  const data = loadData(fileName);

  console.log('\n[IMPORTER] Iniciando importação...');
  console.log(`[IMPORTER] Arquivo: ${fileName}`);

  try {
    await initDatabase();
    const db = getDb();

    // Verificar tipo de dado
    if (Array.isArray(data)) {
      // Detectar se é missão ou artefato pelo primeiro item
      const firstItem = data[0];
      if (firstItem.codename) {
        console.log('[IMPORTER] Importando MISSÕES...');
        const result = await importMissions(data);
        console.log(`\n[IMPORTER] ✅ Conclusão: ${result.imported} importadas, ${result.skipped} puladas`);
      } else if (firstItem.name && firstItem.origin) {
        console.log('[IMPORTER] Importando ARTEFATOS...');
        const result = await importArtifacts(data);
        console.log(`\n[IMPORTER] ✅ Conclusão: ${result.imported} importados, ${result.skipped} pulados`);
      } else {
        console.error('[IMPORTER] Erro: Formato de dados não reconhecido');
        process.exit(1);
      }
    } else if (data.missions && data.artifacts) {
      // Arquivo com ambos
      console.log('[IMPORTER] Importando MISSÕES e ARTEFATOS...');
      const missionsResult = await importMissions(data.missions);
      const artifactsResult = await importArtifacts(data.artifacts);
      console.log(`\n[IMPORTER] ✅ Conclusão:`);
      console.log(`   Missões: ${missionsResult.imported} importadas, ${missionsResult.skipped} puladas`);
      console.log(`   Artefatos: ${artifactsResult.imported} importados, ${artifactsResult.skipped} pulados`);
    } else {
      console.error('[IMPORTER] Erro: Estrutura JSON inválida');
      process.exit(1);
    }

    console.log('[IMPORTER] Banco de dados atualizado com sucesso!\n');

  } catch (err) {
    console.error('[IMPORTER] Erro crítico:', err);
    process.exit(1);
  }
}

main();