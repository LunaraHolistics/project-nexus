/**
 * ARCHIVE OS — Mission Generator v2.0
 * Gera missões procedurais com:
 * - Codenames únicos (evita repetição)
 * - Raridade (comum, rara, épica, lendária)
 * - Adaptação ao nível do player
 * - Narrativa rica e contextual
 */

const crypto = require('crypto');

// ============================================
// POOLS DE DADOS (expandidos)
// ============================================

const LOCATIONS = [
  // Europa
  { city: 'Londres', country: 'Reino Unido', region: 'EU', timezone: 'GMT' },
  { city: 'Berlim', country: 'Alemanha', region: 'EU', timezone: 'CET' },
  { city: 'Viena', country: 'Áustria', region: 'EU', timezone: 'CET' },
  { city: 'Praga', country: 'Tchéquia', region: 'EU', timezone: 'CET' },
  { city: 'Paris', country: 'França', region: 'EU', timezone: 'CET' },
  { city: 'Roma', country: 'Itália', region: 'EU', timezone: 'CET' },
  { city: 'Atenas', country: 'Grécia', region: 'EU', timezone: 'EET' },
  { city: 'Budapeste', country: 'Hungria', region: 'EU', timezone: 'CET' },
  
  // Ásia
  { city: 'Tóquio', country: 'Japão', region: 'AS', timezone: 'JST' },
  { city: 'Istambul', country: 'Turquia', region: 'AS', timezone: 'TRT' },
  { city: 'Moscou', country: 'Rússia', region: 'AS', timezone: 'MSK' },
  { city: 'Seul', country: 'Coreia do Sul', region: 'AS', timezone: 'KST' },
  { city: 'Bangkok', country: 'Tailândia', region: 'AS', timezone: 'ICT' },
  
  // África & Oriente Médio
  { city: 'Cairo', country: 'Egito', region: 'AF', timezone: 'EET' },
  { city: 'Marrakech', country: 'Marrocos', region: 'AF', timezone: 'WET' },
  { city: 'Dubai', country: 'EAU', region: 'ME', timezone: 'GST' },
  { city: 'Jerusalém', country: 'Israel', region: 'ME', timezone: 'IST' },
  
  // Américas
  { city: 'Nova York', country: 'EUA', region: 'AM', timezone: 'EST' },
  { city: 'Cidade do México', country: 'México', region: 'AM', timezone: 'CST' },
  { city: 'Cusco', country: 'Peru', region: 'AM', timezone: 'PET' },
  { city: 'Buenos Aires', country: 'Argentina', region: 'AM', timezone: 'ART' },
  { city: 'Rio de Janeiro', country: 'Brasil', region: 'AM', timezone: 'BRT' }
];

const TARGETS = [
  'O Relojoeiro',
  'Agente V',
  'Victor Volkov',
  'A Condessa',
  'O Arquiteto',
  'Sindicato do Vazio',
  'Irmandade de Clio',
  'O Colecionador',
  'Madame Sombra',
  'Coronel Hades',
  'Ordem do Silêncio',
  'Dr. Chronos',
  'Círculo de Janus',
  'A Tecelã',
  'Profeta das Cinzas'
];

const OBJECTIVES_POOL = {
  interception: [
    'Interceptar o courier',
    'Interceptar a transmissão cifrada',
    'Capturar o mensageiro antes da fronteira',
    'Recuperar a mala diplomática'
  ],
  infiltration: [
    'Infiltrar a instalação',
    'Acessar o cofre subterrâneo',
    'Penetrar a rede interna',
    'Obter credenciais do administrador'
  ],
  extraction: [
    'Extrair o alvo',
    'Resgatar o informante',
    'Evacuar o ativo comprometido',
    'Recuperar o artefato'
  ],
  intelligence: [
    'Analisar o local',
    'Fotografar os documentos',
    'Mapear as rotas de fuga',
    'Identificar os envolvidos',
    'Rastrear a origem do sinal'
  ],
  neutralization: [
    'Desativar sistemas de segurança',
    'Neutralizar a ameaça',
    'Sabotar a transmissão',
    'Comprometer a operação inimiga'
  ],
  escape: [
    'Escapar sem ser detectado',
    'Evacuar em 60 segundos',
    'Desaparecer antes do amanhecer',
    'Apagar todos os vestígios'
  ]
};

const SPECIALTIES = [
  'arqueologia',
  'historia',
  'criptografia',
  'investigacao',
  'inteligencia',
  'tecnologia',
  'linguistica',
  'arte'
];

const CODENAME_ADJ = [
  'Sombria', 'Noturna', 'Silenciosa', 'Vermelha', 'Quebrada',
  'Oculta', 'Fantasma', 'Eterna', 'Fraturada', 'Carmesim',
  'Dourada', 'Cinzenta', 'Profana', 'Sagrada', 'Esquecida',
  'Proibida', 'Errante', 'Velada', 'Invertida', 'Paralela'
];

const CODENAME_NOUN = [
  'Aurora', 'Eclipse', 'Sussurro', 'Tempestade', 'Relíquia',
  'Sombra', 'Cérbero', 'Vigília', 'Labirinto', 'Espelho',
  'Coroa', 'Chama', 'Âncora', 'Bússola', 'Cálice',
  'Pergaminho', 'Selos', 'Obelisco', 'Cifra', 'Profecia'
];

const RARITIES = {
  common:    { weight: 60, multiplier: 1.0, label: 'COMUM',    color: '#c1c7cc' },
  rare:      { weight: 25, multiplier: 1.5, label: 'RARA',     color: '#4a90e2' },
  epic:      { weight: 12, multiplier: 2.5, label: 'ÉPICA',    color: '#C5A059' },
  legendary: { weight: 3,  multiplier: 4.0, label: 'LENDÁRIA', color: '#FFBF00' }
};

// ============================================
// HELPERS
// ============================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  
  for (const item of items) {
    if (random < item.weight) return item;
    random -= item.weight;
  }
  
  return items[items.length - 1];
}

function generateUniqueCodename(existingCodenames = []) {
  const existing = new Set(existingCodenames.map(c => c.toUpperCase()));
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const adj = pick(CODENAME_ADJ);
    const noun = pick(CODENAME_NOUN);
    const codename = `${adj} ${noun}`.toUpperCase();
    
    if (!existing.has(codename)) {
      return codename;
    }
    
    attempts++;
  }
  
  // Fallback: adiciona sufixo numérico
  const adj = pick(CODENAME_ADJ);
  const noun = pick(CODENAME_NOUN);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${adj} ${noun}-${suffix}`.toUpperCase();
}

function selectObjectives(totalPhases) {
  const categories = Object.keys(OBJECTIVES_POOL);
  const selected = [];
  const usedCategories = new Set();
  
  for (let i = 0; i < totalPhases; i++) {
    let category;
    let attempts = 0;
    
    // Evita repetir categoria
    do {
      category = pick(categories);
      attempts++;
    } while (usedCategories.has(category) && attempts < 10);
    
    usedCategories.add(category);
    selected.push(pick(OBJECTIVES_POOL[category]));
  }
  
  return selected;
}

function calculateRewards(priority, rarity, playerLevel = 1) {
  const baseReward = {
    'CRÍTICA': 3000,
    'ALTA': 1500,
    'MÉDIA': 800,
    'BAIXA': 400
  }[priority] || 800;
  
  const rarityMultiplier = RARITIES[rarity].multiplier;
  const levelBonus = 1 + (playerLevel - 1) * 0.05; // +5% por nível
  
  const finalReward = Math.floor(baseReward * rarityMultiplier * levelBonus);
  
  return {
    reward_xp: Math.floor(finalReward / 2),
    reward_credits: finalReward + Math.floor(Math.random() * 500 * rarityMultiplier),
    reward_artifacts: Math.random() < (0.3 * rarityMultiplier) ? Math.ceil(rarityMultiplier) : 0
  };
}

function selectSpecialties() {
  const shuffled = [...SPECIALTIES].sort(() => Math.random() - 0.5);
  const count = Math.random() > 0.7 ? 2 : 1;
  return shuffled.slice(0, count);
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

/**
 * Gera uma missão procedural
 * @param {Object} options
 * @param {number} options.playerLevel - Nível do player (para balanceamento)
 * @param {string} options.playerSpecialty - Especialidade do player
 * @param {Array} options.existingCodenames - Codenames já existentes (evita duplicatas)
 * @param {string} options.forceRarity - Força uma raridade específica
 * @param {string} options.forceLocation - Força uma locação específica
 */
function generateMission(options = {}) {
  const {
    playerLevel = 1,
    playerSpecialty = null,
    existingCodenames = [],
    forceRarity = null,
    forceLocation = null
  } = options;
  
  // 1. Define raridade
  const rarityKey = forceRarity || pickWeighted(
    Object.entries(RARITIES).map(([key, val]) => ({ ...val, key }))
  ).key;
  const rarity = RARITIES[rarityKey];
  
  // 2. Define prioridade (correlacionada com raridade)
  const priorityPool = {
    common:    ['BAIXA', 'BAIXA', 'MÉDIA'],
    rare:      ['MÉDIA', 'MÉDIA', 'ALTA'],
    epic:      ['ALTA', 'ALTA', 'CRÍTICA'],
    legendary: ['CRÍTICA', 'CRÍTICA']
  }[rarityKey];
  const priority = pick(priorityPool);
  
  // 3. Define locação
  const location = forceLocation 
    ? LOCATIONS.find(l => l.city === forceLocation) || pick(LOCATIONS)
    : pick(LOCATIONS);
  
  // 4. Codename único
  const codename = generateUniqueCodename(existingCodenames);
  
  // 5. Alvo
  const target = pick(TARGETS);
  
  // 6. Fases e objetivos
  const totalPhases = Math.floor(Math.random() * 3) + 2 + (rarityKey === 'legendary' ? 1 : 0);
  const objectives = selectObjectives(totalPhases);
  
  // 7. Especialidades (pode incluir a do player para missões personalizadas)
  const specialties = selectSpecialties();
  if (playerSpecialty && Math.random() > 0.5 && !specialties.includes(playerSpecialty)) {
    specialties[0] = playerSpecialty;
  }
  
  // 8. Recompensas balanceadas
  const rewards = calculateRewards(priority, rarityKey, playerLevel);
  
  // 9. Narrativa
  const narrativeTemplates = [
    `Inteligência indica atividade suspeita de ${target} em ${location.city}. Ação imediata requerida.`,
    `Fontes confirmam que ${target} opera atualmente em ${location.city}, ${location.country}. Interceptação prioritária.`,
    `Relatórios de campo apontam ${target} como responsável por eventos recentes em ${location.city}. Investigação autorizada.`,
    `A Archive detectou movimentação de ${target} na região de ${location.city}. Janela de oportunidade limitada.`
  ];
  
  return {
    codename,
    title: `Operação ${codename}`,
    location: `${location.city}, ${location.country}`,
    location_data: location,
    priority,
    rarity: rarityKey,
    rarity_label: rarity.label,
    status: 'disponivel',
    phase: 1,
    total_phases: totalPhases,
    specialty_filter: specialties,
    description: pick(narrativeTemplates),
    objectives,
    target,
    estimated_duration: totalPhases * 14, // minutos
    ...rewards,
    
    // Metadados
    generated_at: new Date().toISOString(),
    seed: crypto.randomBytes(4).toString('hex')
  };
}

/**
 * Gera múltiplas missões de uma vez (para o "pool" do globo)
 */
function generateMissionBatch(count = 5, options = {}) {
  const missions = [];
  const usedCodenames = [];
  
  for (let i = 0; i < count; i++) {
    const mission = generateMission({
      ...options,
      existingCodenames: usedCodenames
    });
    missions.push(mission);
    usedCodenames.push(mission.codename);
  }
  
  return missions;
}

module.exports = { 
  generateMission,
  generateMissionBatch,
  RARITIES,
  LOCATIONS,
  SPECIALTIES
};