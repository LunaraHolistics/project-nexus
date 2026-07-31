/**
 * SEED SCRIPT — Project Nexus
 * Popula o banco de dados com missões e artefatos iniciais
 * 
 * Uso: node backend/seed.js
 */

const { initDatabase, getDb } = require('./src/database');

const missions = [
  { codename: 'MERIDIAN', title: 'O Cálice de Antioquia', location: 'Viena, Áustria', priority: 'ALTA', specialty_filter: ['arqueologia', 'historia'], description: 'Recuperação de um artefato Classe-4.', objectives: ['Localizar cofre', 'Neutralizar courier', 'Recuperar cálice'], reward_xp: 500, reward_credits: 1200, reward_artifacts: 1 },
  { codename: 'TYPHON', title: 'Manuscrito de Voynich', location: 'Londres, Reino Unido', priority: 'MÉDIA', specialty_filter: ['criptografia', 'historia'], description: 'Estudo de manuscrito criptografado.', objectives: ['Obter acesso', 'Escanear páginas', 'Traduzir fragmento'], reward_xp: 300, reward_credits: 800, reward_artifacts: 0 },
  { codename: 'SIGNAL', title: 'Máscara Dourada Inca', location: 'Cusco, Peru', priority: 'CRÍTICA', specialty_filter: ['arqueologia', 'investigacao'], description: 'Recuperação urgente antes de leilão.', objectives: ['Infiltrar mansão', 'Localizar máscara', 'Extrair via helicóptero'], reward_xp: 1000, reward_credits: 2500, reward_artifacts: 1 },
  { codename: 'PHOENIX', title: 'Moedas de Ouro Romano', location: 'Roma, Itália', priority: 'BAIXA', specialty_filter: ['historia', 'arqueologia'], description: 'Rastreamento de moedas contrabandeadas.', objectives: ['Identificar fonte', 'Monitorar transação', 'Apreender carga'], reward_xp: 200, reward_credits: 500, reward_artifacts: 0 },
  { codename: 'ECLIPSE', title: 'Estátua de Shiva', location: 'Mumbai, Índia', priority: 'ALTA', specialty_filter: ['arqueologia', 'investigacao'], description: 'Estátua roubada de templo protegido.', objectives: ['Localizar templo', 'Monitorar suspeito', 'Resgatar estátua'], reward_xp: 700, reward_credits: 1800, reward_artifacts: 1 },
  { codename: 'SENTINEL', title: 'Arma de Samurai', location: 'Tóquio, Japão', priority: 'MÉDIA', specialty_filter: ['historia', 'investigacao'], description: 'Espada do período Edo sendo negociada.', objectives: ['Infiltrar dojo', 'Verificar autenticidade', 'Recuperar katana'], reward_xp: 400, reward_credits: 1000, reward_artifacts: 0 },
  { codename: 'VIPER', title: 'Pergaminhos do Mar Morto', location: 'Cairo, Egito', priority: 'CRÍTICA', specialty_filter: ['historia', 'arqueologia'], description: 'Recuperar fragmentos antes da destruição.', objectives: ['Alcançar sítio', 'Proteger pergaminhos', 'Extrair sob fogo'], reward_xp: 1200, reward_credits: 3000, reward_artifacts: 1 },
  { codename: 'GHOST', title: 'Colar de Pérolas Chinês', location: 'Pequim, China', priority: 'MÉDIA', specialty_filter: ['investigacao', 'inteligencia'], description: 'Joia da dinastia Qing em contrabando.', objectives: ['Rastrear courier', 'Identificar comprador', 'Interceptar'], reward_xp: 450, reward_credits: 1100, reward_artifacts: 0 },
  { codename: 'IRONCLAD', title: 'Relíquia Viking', location: 'Berlim, Alemanha', priority: 'BAIXA', specialty_filter: ['arqueologia', 'historia'], description: 'Amuleto encontrado em escavação.', objectives: ['Monitorar museu', 'Registrar inventário', 'Apreender'], reward_xp: 250, reward_credits: 600, reward_artifacts: 0 },
  { codename: 'SHADOW', title: 'Joias Reais', location: 'Paris, França', priority: 'ALTA', specialty_filter: ['investigacao', 'inteligencia'], description: 'Roubo de joias no Louvre.', objectives: ['Infiltrar Louvre', 'Desativar alarme', 'Recuperar'], reward_xp: 800, reward_credits: 2000, reward_artifacts: 1 },
  { codename: 'VALKYRIE', title: 'Busto Grego', location: 'Atenas, Grécia', priority: 'MÉDIA', specialty_filter: ['arqueologia', 'historia'], description: 'Busto sendo leiloado ilegalmente.', objectives: ['Verificar galeria', 'Localizar busto', 'Apreender'], reward_xp: 500, reward_credits: 1300, reward_artifacts: 0 },
  { codename: 'PEGASUS', title: 'Relógio de Bolso', location: 'Nova York, EUA', priority: 'BAIXA', specialty_filter: ['tecnologia', 'investigacao'], description: 'Relógio de inventor famoso.', objectives: ['Rastrear leilão', 'Monitorar', 'Interceptar'], reward_xp: 300, reward_credits: 700, reward_artifacts: 0 },
  { codename: 'ORACLE', title: 'Máscara Asteca', location: 'Cidade do México, México', priority: 'ALTA', specialty_filter: ['arqueologia', 'historia'], description: 'Máscara roubada de sítio arqueológico.', objectives: ['Explorar sítio', 'Rastrear suspeitos', 'Recuperar'], reward_xp: 900, reward_credits: 2200, reward_artifacts: 1 },
  { codename: 'TITAN', title: 'Estátua de Bronze', location: 'Roma, Itália', priority: 'CRÍTICA', specialty_filter: ['arqueologia', 'investigacao'], description: 'Estátua de valor inestimável.', objectives: ['Infiltrar cofre', 'Desativar laser', 'Extrair'], reward_xp: 1500, reward_credits: 3500, reward_artifacts: 1 },
  { codename: 'SERPENT', title: 'Adaga Pérsia', location: 'Dubai, EAU', priority: 'MÉDIA', specialty_filter: ['historia', 'investigacao'], description: 'Adaga cerimonial em leilão.', objectives: ['Infiltrar evento', 'Localizar item', 'Extrair'], reward_xp: 600, reward_credits: 1500, reward_artifacts: 0 },
  { codename: 'GRIFFIN', title: 'Amuleto Egípcio', location: 'Luxor, Egito', priority: 'ALTA', specialty_filter: ['arqueologia', 'historia'], description: 'Amuleto escondido em tumba.', objectives: ['Explorar tumba', 'Localizar amuleto', 'Extrair'], reward_xp: 750, reward_credits: 1900, reward_artifacts: 1 },
  { codename: 'DRAGON', title: 'Vaso Chinês', location: 'Bangkok, Tailândia', priority: 'MÉDIA', specialty_filter: ['historia', 'arqueologia'], description: 'Vaso de dinastia Ming.', objectives: ['Rastrear contrabando', 'Identificar local', 'Apreender'], reward_xp: 550, reward_credits: 1400, reward_artifacts: 0 },
  { codename: 'HYDRA', title: 'Espada Medieval', location: 'Moscou, Rússia', priority: 'ALTA', specialty_filter: ['historia', 'investigacao'], description: 'Espada em coleção privada.', objectives: ['Infiltrar propriedade', 'Localizar espada', 'Recuperar'], reward_xp: 850, reward_credits: 2100, reward_artifacts: 0 },
  { codename: 'PHANTOM', title: 'Anel de Sinete', location: 'Rio de Janeiro, Brasil', priority: 'BAIXA', specialty_filter: ['investigacao', 'inteligencia'], description: 'Anel em colecionador.', objectives: ['Localizar anel', 'Monitorar', 'Interceptar'], reward_xp: 350, reward_credits: 900, reward_artifacts: 0 },
  { codename: 'CERBERUS', title: 'Manuscrito Persa', location: 'Istambul, Turquia', priority: 'CRÍTICA', specialty_filter: ['historia', 'criptografia'], description: 'Manuscrito perdido de sabedoria.', objectives: ['Localizar biblioteca', 'Proteger item', 'Extrair'], reward_xp: 1300, reward_credits: 3200, reward_artifacts: 1 }
];

const artifacts = [
  { name: 'Cálice de Antioquia', origin: 'Bizâncio', circa: 'Século I', category: 'Religioso', status: 'em analise', location: 'Laboratório' },
  { name: 'Manuscrito de Voynich', origin: 'Europa Central', circa: 'Século XV', category: 'Documental', status: 'em restauracao', location: 'Acervo Digital' },
  { name: 'Máscara de Jade Inca', origin: 'Império Inca', circa: 'Século XV', category: 'Arqueologico', status: 'catalogado', location: 'Museu Archive' },
  { name: 'Adaga de Bronze Pérsica', origin: 'Pérsia', circa: 'Século V a.C.', category: 'Militar', status: 'em analise', location: 'Laboratório' },
  { name: 'Vaso Dinastia Ming', origin: 'China', circa: 'Século XIV', category: 'Artistico', status: 'confidencial', location: 'Cofre Omega' },
  { name: 'Moedas de Ouro Romano', origin: 'Roma', circa: 'Século II', category: 'Numismatico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Espada de Samurai', origin: 'Japão', circa: 'Século XVII', category: 'Militar', status: 'em restauracao', location: 'Laboratório' },
  { name: 'Papiro Egípcio', origin: 'Egito', circa: 'Século XII a.C.', category: 'Documental', status: 'em analise', location: 'Acervo Digital' },
  { name: 'Estátua de Shiva', origin: 'Índia', circa: 'Século X', category: 'Artistico', status: 'confidencial', location: 'Célula-47' },
  { name: 'Amuleto de Proteção', origin: 'Egito', circa: 'Século VIII a.C.', category: 'Religioso', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Anel de Sinete', origin: 'França', circa: 'Século XVI', category: 'Artistico', status: 'emprestado', location: 'Museu Externo' },
  { name: 'Relógio de Inventores', origin: 'Suíça', circa: 'Século XVIII', category: 'Cientifico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Máscara Asteca', origin: 'Império Asteca', circa: 'Século XIV', category: 'Arqueologico', status: 'em analise', location: 'Laboratório' },
  { name: 'Busto Grego', origin: 'Grécia', circa: 'Século IV a.C.', category: 'Artistico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Pergaminho de Sabedoria', origin: 'Pérsia', circa: 'Século X', category: 'Documental', status: 'em restauracao', location: 'Laboratório' },
  { name: 'Escudo Viking', origin: 'Escandinávia', circa: 'Século IX', category: 'Militar', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Jarro Grego', origin: 'Grécia', circa: 'Século V a.C.', category: 'Artistico', status: 'em analise', location: 'Laboratório' },
  { name: 'Colar de Pérolas', origin: 'China', circa: 'Século XVIII', category: 'Artistico', status: 'confidencial', location: 'Cofre Omega' },
  { name: 'Bússola Antiga', origin: 'China', circa: 'Século XI', category: 'Cientifico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Adaga Asteca', origin: 'Império Asteca', circa: 'Século XV', category: 'Militar', status: 'em analise', location: 'Laboratório' },
  { name: 'Manuscrito Maya', origin: 'Império Maia', circa: 'Século XIII', category: 'Documental', status: 'em restauracao', location: 'Laboratório' },
  { name: 'Busto Romano', origin: 'Roma', circa: 'Século I', category: 'Artistico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Elmo Medieval', origin: 'Europa', circa: 'Século XII', category: 'Militar', status: 'confidencial', location: 'Célula-47' },
  { name: 'Pote de Cerâmica', origin: 'Mesopotâmia', circa: 'Século III a.C.', category: 'Arqueologico', status: 'catalogado', location: 'Acervo Digital' },
  { name: 'Cálice de Ouro', origin: 'Europa', circa: 'Século XII', category: 'Religioso', status: 'em analise', location: 'Laboratório' }
];

const upgrades = [
  { name: 'Criptografia Quântica', category: 'Tecnologia', cost: 4500, requirement: 'Rede II', description: 'Segurança de comunicações +45%.' },
  { name: 'Rede de Informantes', category: 'Inteligência', cost: 3200, requirement: 'Nível 2', description: 'Cobertura de vigilância +30%.' },
  { name: 'Análise Preditiva', category: 'Análise', cost: 6800, requirement: 'Tecnologia III', description: 'IA de previsão de movimentos.' }
];

async function seed() {
  try {
    console.log('[SEED] Inicializando banco de dados...');
    await initDatabase();
    const db = getDb();

    // Verificar se já existe dados
    const existingMissions = db.prepare('SELECT COUNT(*) as count FROM missions').get();
    if (existingMissions.count > 0) {
      console.log('[SEED] Banco já possui dados. Pulando seed.');
      return;
    }

    console.log('[SEED] Inserindo missões...');
    const missionStmt = db.prepare(`
      INSERT INTO missions (codename, title, location, priority, specialty_filter, description, objectives, reward_xp, reward_credits, reward_artifacts, status, phase, total_phases)
      VALUES (@codename, @title, @location, @priority, @specialty_filter, @description, @objectives, @reward_xp, @reward_credits, @reward_artifacts, 'disponivel', 1, 3)
    `);

    missions.forEach(mission => {
      missionStmt.run({
        codename: mission.codename,
        title: mission.title,
        location: mission.location,
        priority: mission.priority,
        specialty_filter: JSON.stringify(mission.specialty_filter),
        description: mission.description,
        objectives: JSON.stringify(mission.objectives),
        reward_xp: mission.reward_xp,
        reward_credits: mission.reward_credits,
        reward_artifacts: mission.reward_artifacts
      });
    });

    console.log('[SEED] Inserindo artefatos...');
    const artifactStmt = db.prepare(`
      INSERT INTO artifacts (name, origin, circa, category, status, location)
      VALUES (@name, @origin, @circa, @category, @status, @location)
    `);

    artifacts.forEach(artifact => {
      artifactStmt.run({
        name: artifact.name,
        origin: artifact.origin,
        circa: artifact.circa,
        category: artifact.category,
        status: artifact.status,
        location: artifact.location
      });
    });

    console.log('[SEED] Inserindo upgrades...');
    const upgradeStmt = db.prepare(`
      INSERT INTO upgrades (name, category, cost, requirement, description)
      VALUES (@name, @category, @cost, @requirement, @description)
    `);

    upgrades.forEach(upgrade => {
      upgradeStmt.run({
        name: upgrade.name,
        category: upgrade.category,
        cost: upgrade.cost,
        requirement: upgrade.requirement,
        description: upgrade.description
      });
    });

    console.log('[SEED] ✅ Banco populado com sucesso!');
    console.log(`   - ${missions.length} missões inseridas`);
    console.log(`   - ${artifacts.length} artefatos inseridos`);
    console.log(`   - ${upgrades.length} upgrades inseridos`);

  } catch (error) {
    console.error('[SEED] Erro:', error);
    process.exit(1);
  }
}

seed();