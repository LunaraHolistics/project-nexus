const LOCATIONS = ['Londres, Reino Unido', 'Tóquio, Japão', 'Cairo, Egito', 'Berlim, Alemanha', 'Viena, Áustria', 'Istambul, Turquia', 'Moscou, Rússia', 'Cusco, Peru'];
const OBJECTIVES_POOL = [
  ['Interceptar o courier', 'Analisar o local', 'Extrair o alvo'],
  ['Infiltrar a instalação', 'Desativar sistemas de segurança', 'Recuperar o artefato'],
  ['Rastrear a origem do sinal', 'Identificar os envolvidos', 'Neutralizar a ameaça'],
  ['Obter acesso ao cofre', 'Copiar os dados criptografados', 'Escapar sem ser detectado']
];
const TARGETS = ['O Relojoeiro', 'Agente V', 'Victor Volkov', 'A Viúva Negra', 'O Arquiteto', 'Sindicato do Vazio'];
const PRIORITIES = ['BAIXA', 'MÉDIA', 'ALTA', 'CRÍTICA'];
const SPECIALTIES = ['arqueologia', 'historia', 'criptografia', 'investigacao', 'inteligencia', 'tecnologia'];

function generateMission() {
  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const objectives = OBJECTIVES_POOL[Math.floor(Math.random() * OBJECTIVES_POOL.length)];
  const target = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
  const specialty1 = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const specialty2 = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  
  const adj = ['Sombria', 'Noturna', 'Silenciosa', 'Vermelha', 'Quebrada', 'Ocult', 'Fantasma'];
  const noun = ['Aurora', 'Eclipse', 'Sussurro', 'Tempestade', 'Relíquia', 'Sombra', 'Cerberus'];
  const codename = `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`.toUpperCase();

  const baseReward = priority === 'CRÍTICA' ? 3000 : priority === 'ALTA' ? 1500 : 800;
  const rewardXp = Math.floor(baseReward / 2);
  const rewardCredits = baseReward + Math.floor(Math.random() * 500);
  const rewardArtifacts = Math.random() > 0.6 ? 1 : 0;

  return {
    codename,
    title: `Operação ${codename}`,
    location,
    priority,
    status: 'disponivel',
    phase: 1,
    totalPhases: Math.floor(Math.random() * 4) + 2,
    specialty_filter: [specialty1, specialty2],
    description: `Inteligência indica atividade suspeita de ${target} em ${location}. Ação imediata requerida.`,
    objectives,
    reward_xp: rewardXp,
    reward_credits: rewardCredits,
    reward_artifacts: rewardArtifacts
  };
}

module.exports = { generateMission };