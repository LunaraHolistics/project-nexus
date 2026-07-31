const LOCATIONS = ['Londres', 'Tóquio', 'Cairo', 'Berlim', 'Viena', 'Istambul', 'Moscou'];
const OBJECTIVES = [
  'Interceptar o courier antes da troca.',
  'Recuperar o microfilme do esconderijo.',
  'Infiltrar-se na galeria e fotografar o documento.',
  'Rastrear o sinal de rádio até a fonte.',
  'Neutralizar a célula adormecida no setor.'
];
const TARGETS = ['O Relojoeiro', 'Agente V', 'Victor Volkov', 'A Viúva Negra', 'O Arquiteto', 'Desconhecido'];
const THREATS = ['BAIXO', 'MÉDIO', 'ELEVADO', 'CRÍTICO'];

function generateMission() {
  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const objective = OBJECTIVES[Math.floor(Math.random() * OBJECTIVES.length)];
  const target = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const threat = THREATS[Math.floor(Math.random() * THREATS.length)];
  
  // Gera um codinome aleatório para a operação
  const adj = ['Sombria', 'Noturna', 'Silenciosa', 'Vermelha', 'Quebrada', 'Ocult'];
  const noun = ['Aurora', 'Eclipse', 'Sussurro', 'Tempestade', 'Relíquia', 'Sombra'];
  const opName = `Op: ${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`;

  const baseReward = threat === 'CRÍTICO' ? 5000 : threat === 'ELEVADO' ? 2500 : 1200;
  const rewardCredits = baseReward + Math.floor(Math.random() * 1000);
  const rewardInfluence = Math.floor(Math.random() * 3) + 1;

  return {
    title: opName,
    location,
    objective,
    target,
    threat_level: threat,
    reward_credits: rewardCredits,
    reward_influence: rewardInfluence,
    status: 'disponivel'
  };
}

module.exports = { generateMission };