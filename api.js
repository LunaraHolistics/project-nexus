/**
 * ARCHIVE API Client — Project Nexus v2.0
 * Cliente de comunicação com o backend Node.js (porta 3000).
 * Resiliente: retorna dados mock se o backend estiver offline.
 *
 * Uso nas telas individuais:
 * <script src="../api.js"></script>
 * <script>
 *   await window.ArchiveAPI.init();
 *   var missions = await window.ArchiveAPI.getMissions();
 * </script>
 */
(function () {
  "use strict";

  // Detectar ambiente automaticamente
  var BASE_URL = (function() {
    // Produção (Vercel/Netlify) - MUDAR DEPOIS QUANDO TIVER BACKEND
    if (window.location.hostname !== 'localhost') {
      return 'https://project-nexus-mi7.netlify.app/'; // ← Trocar quando deploy backend
    }
    // Desenvolvimento local
    return 'http://localhost:3000/api';
  })();

  var _isOnline = false;
  var _playerId = null;

  var STATE_KEY = "nexus_state_v1";
  var LEGACY_STATE_KEY = "project_nexus_state_v1";

  /* ===========================================
     DADOS MOCK DE FALLBACK - EVOLUÇÃO COMPLETA
     =========================================== */
  var MOCK = {
    missions: [
      { id: 1, codename: 'MERIDIAN', title: 'O Cálice de Antioquia', location: 'Viena, Áustria', priority: 'ALTA', status: 'ativa', phase: 1, totalPhases: 3, specialty_filter: ['arqueologia', 'historia'], description: 'Recuperação de um artefato Classe-4. Inteligência sugere conexão com rede clandestina.', objectives: ['Localizar cofre', 'Neutralizar courier', 'Recuperar cálice'], reward: {xp: 500, credits: 1200, artifacts: 1} },
      { id: 2, codename: 'TYPHON', title: 'Manuscrito de Voynich', location: 'Londres, Reino Unido', priority: 'MÉDIA', status: 'ativa', phase: 1, totalPhases: 2, specialty_filter: ['criptografia', 'historia'], description: 'Estudo de um manuscrito criptografado. Suspeita de segredos químicos ocultos.', objectives: ['Obter acesso', 'Escanear páginas', 'Traduzir fragmento'], reward: {xp: 300, credits: 800, artifacts: 0} },
      { id: 3, codename: 'SIGNAL', title: 'Máscara Dourada Inca', location: 'Cusco, Peru', priority: 'CRÍTICA', status: 'ativa', phase: 1, totalPhases: 5, specialty_filter: ['arqueologia', 'investigacao'], description: 'Recuperação urgente antes da venda em leilão privado.', objectives: ['Infiltrar mansão', 'Localizar máscara', 'Extrair via helicóptero'], reward: {xp: 1000, credits: 2500, artifacts: 1} },
      { id: 4, codename: 'PHOENIX', title: 'Moedas de Ouro Romano', location: 'Roma, Itália', priority: 'BAIXA', status: 'ativa', phase: 1, totalPhases: 2, specialty_filter: ['historia', 'arqueologia'], description: 'Rastreamento de moedas raras contrabandeadas.', objectives: ['Identificar fonte', 'Monitorar transação', 'Apreender carga'], reward: {xp: 200, credits: 500, artifacts: 0} },
      { id: 5, codename: 'ECLIPSE', title: 'Estátua de Shiva', location: 'Mumbai, Índia', priority: 'ALTA', status: 'ativa', phase: 2, totalPhases: 4, specialty_filter: ['arqueologia', 'investigacao'], description: 'A estátua foi roubada de um templo protegido.', objectives: ['Localizar templo', 'Monitorar suspeito', 'Resgatar estátua'], reward: {xp: 700, credits: 1800, artifacts: 1} },
      { id: 6, codename: 'SENTINEL', title: 'Arma de Samurai', location: 'Tóquio, Japão', priority: 'MÉDIA', status: 'ativa', phase: 1, totalPhases: 3, specialty_filter: ['historia', 'investigacao'], description: 'Espada antiga do período Edo sendo negociada.', objectives: ['Infiltrar dojo', 'Verificar autenticidade', 'Recuperar katana'], reward: {xp: 400, credits: 1000, artifacts: 0} },
      { id: 7, codename: 'VIPER', title: 'Pergaminhos do Mar Morto', location: 'Cairo, Egito', priority: 'CRÍTICA', status: 'ativa', phase: 1, totalPhases: 6, specialty_filter: ['historia', 'arqueologia'], description: 'Recuperar fragmentos antes da destruição.', objectives: ['Alcançar sítio', 'Proteger pergaminhos', 'Extrair sob fogo'], reward: {xp: 1200, credits: 3000, artifacts: 1} },
      { id: 8, codename: 'GHOST', title: 'Colar de Pérolas Chinês', location: 'Pequim, China', priority: 'MÉDIA', status: 'ativa', phase: 2, totalPhases: 3, specialty_filter: ['investigacao', 'inteligencia'], description: 'Joia da dinastia Qing em rota de contrabando.', objectives: ['Rastrear courier', 'Identificar comprador', 'Interceptar'], reward: {xp: 450, credits: 1100, artifacts: 0} },
      { id: 9, codename: 'IRONCLAD', title: 'Relíquia Viking', location: 'Berlim, Alemanha', priority: 'BAIXA', status: 'ativa', phase: 1, totalPhases: 2, specialty_filter: ['arqueologia', 'historia'], description: 'Amuleto encontrado em escavação.', objectives: ['Monitorar museu', 'Registrar inventário', 'Apreender'], reward: {xp: 250, credits: 600, artifacts: 0} },
      { id: 10, codename: 'SHADOW', title: 'Joias Reais', location: 'Paris, França', priority: 'ALTA', status: 'ativa', phase: 1, totalPhases: 4, specialty_filter: ['investigacao', 'inteligencia'], description: 'Roubo de joias no Louvre.', objectives: ['Infiltrar Louvre', 'Desativar alarme', 'Recuperar'], reward: {xp: 800, credits: 2000, artifacts: 1} },
      { id: 11, codename: 'VALKYRIE', title: 'Busto Grego', location: 'Atenas, Grécia', priority: 'MÉDIA', status: 'ativa', phase: 1, totalPhases: 3, specialty_filter: ['arqueologia', 'historia'], description: 'Busto sendo leiloado ilegalmente.', objectives: ['Verificar galeria', 'Localizar busto', 'Apreender'], reward: {xp: 500, credits: 1300, artifacts: 0} },
      { id: 12, codename: 'PEGASUS', title: 'Relógio de Bolso', location: 'Nova York, EUA', priority: 'BAIXA', status: 'ativa', phase: 1, totalPhases: 2, specialty_filter: ['tecnologia', 'investigacao'], description: 'Relógio de inventor famoso.', objectives: ['Rastrear leilão', 'Monitorar', 'Interceptar'], reward: {xp: 300, credits: 700, artifacts: 0} },
      { id: 13, codename: 'ORACLE', title: 'Máscara Asteca', location: 'Cidade do México, México', priority: 'ALTA', status: 'ativa', phase: 2, totalPhases: 4, specialty_filter: ['arqueologia', 'historia'], description: 'Máscara roubada de sítio arqueológico.', objectives: ['Explorar sítio', 'Rastrear suspeitos', 'Recuperar'], reward: {xp: 900, credits: 2200, artifacts: 1} },
      { id: 14, codename: 'TITAN', title: 'Estátua de Bronze', location: 'Roma, Itália', priority: 'CRÍTICA', status: 'ativa', phase: 1, totalPhases: 5, specialty_filter: ['arqueologia', 'investigacao'], description: 'Estátua de valor inestimável.', objectives: ['Infiltrar cofre', 'Desativar laser', 'Extrair'], reward: {xp: 1500, credits: 3500, artifacts: 1} },
      { id: 15, codename: 'SERPENT', title: 'Adaga Pérsia', location: 'Dubai, EAU', priority: 'MÉDIA', status: 'ativa', phase: 1, totalPhases: 3, specialty_filter: ['historia', 'investigacao'], description: 'Adaga cerimonial em leilão.', objectives: ['Infiltrar evento', 'Localizar item', 'Extrair'], reward: {xp: 600, credits: 1500, artifacts: 0} },
      { id: 16, codename: 'GRIFFIN', title: 'Amuleto Egípcio', location: 'Luxor, Egito', priority: 'ALTA', status: 'ativa', phase: 2, totalPhases: 4, specialty_filter: ['arqueologia', 'historia'], description: 'Amuleto escondido em tumba.', objectives: ['Explorar tumba', 'Localizar amuleto', 'Extrair'], reward: {xp: 750, credits: 1900, artifacts: 1} },
      { id: 17, codename: 'DRAGON', title: 'Vaso Chinês', location: 'Bangkok, Tailândia', priority: 'MÉDIA', status: 'ativa', phase: 1, totalPhases: 3, specialty_filter: ['historia', 'arqueologia'], description: 'Vaso de dinastia Ming.', objectives: ['Rastrear contrabando', 'Identificar local', 'Apreender'], reward: {xp: 550, credits: 1400, artifacts: 0} },
      { id: 18, codename: 'HYDRA', title: 'Espada Medieval', location: 'Moscou, Rússia', priority: 'ALTA', status: 'ativa', phase: 1, totalPhases: 4, specialty_filter: ['historia', 'investigacao'], description: 'Espada em coleção privada.', objectives: ['Infiltrar propriedade', 'Localizar espada', 'Recuperar'], reward: {xp: 850, credits: 2100, artifacts: 0} },
      { id: 19, codename: 'PHANTOM', title: 'Anel de Sinete', location: 'Rio de Janeiro, Brasil', priority: 'BAIXA', status: 'ativa', phase: 1, totalPhases: 2, specialty_filter: ['investigacao', 'inteligencia'], description: 'Anel em colecionador.', objectives: ['Localizar anel', 'Monitorar', 'Interceptar'], reward: {xp: 350, credits: 900, artifacts: 0} },
      { id: 20, codename: 'CERBERUS', title: 'Manuscrito Persa', location: 'Istambul, Turquia', priority: 'CRÍTICA', status: 'ativa', phase: 1, totalPhases: 6, specialty_filter: ['historia', 'criptografia'], description: 'Manuscrito perdido de sabedoria.', objectives: ['Localizar biblioteca', 'Proteger item', 'Extrair'], reward: {xp: 1300, credits: 3200, artifacts: 1} }
    ],
    
    player: {
      name: "Diretor",
      codename: "NOVICE",
      level: 1,
      xp: 0,
      xpToNext: 500,
      credits: 1000,
      rank: "Diretor Interino",
      missionsCompleted: 0,
      missionsFailed: 0,
      artifactsRecovered: 0,
      agentsRecruited: 3
    },
    
    artifacts: [
      { id: 1, name: 'Cálice de Antioquia', origin: 'Bizâncio', circa: 'Século I', category: 'Religioso', status: 'em analise', location: 'Laboratório' },
      { id: 2, name: 'Manuscrito de Voynich', origin: 'Europa Central', circa: 'Século XV', category: 'Documental', status: 'em restauracao', location: 'Acervo Digital' },
      { id: 3, name: 'Máscara de Jade Inca', origin: 'Império Inca', circa: 'Século XV', category: 'Arqueologico', status: 'catalogado', location: 'Museu Archive' },
      { id: 4, name: 'Adaga de Bronze Pérsica', origin: 'Pérsia', circa: 'Século V a.C.', category: 'Militar', status: 'em analise', location: 'Laboratório' },
      { id: 5, name: 'Vaso Dinastia Ming', origin: 'China', circa: 'Século XIV', category: 'Artistico', status: 'confidencial', location: 'Cofre Omega' },
      { id: 6, name: 'Moedas de Ouro Romano', origin: 'Roma', circa: 'Século II', category: 'Numismatico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 7, name: 'Espada de Samurai', origin: 'Japão', circa: 'Século XVII', category: 'Militar', status: 'em restauracao', location: 'Laboratório' },
      { id: 8, name: 'Papiro Egípcio', origin: 'Egito', circa: 'Século XII a.C.', category: 'Documental', status: 'em analise', location: 'Acervo Digital' },
      { id: 9, name: 'Estátua de Shiva', origin: 'Índia', circa: 'Século X', category: 'Artistico', status: 'confidencial', location: 'Célula-47' },
      { id: 10, name: 'Amuleto de Proteção', origin: 'Egito', circa: 'Século VIII a.C.', category: 'Religioso', status: 'catalogado', location: 'Acervo Digital' },
      { id: 11, name: 'Anel de Sinete', origin: 'França', circa: 'Século XVI', category: 'Artistico', status: 'emprestado', location: 'Museu Externo' },
      { id: 12, name: 'Relógio de Inventores', origin: 'Suíça', circa: 'Século XVIII', category: 'Cientifico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 13, name: 'Máscara Asteca', origin: 'Império Asteca', circa: 'Século XIV', category: 'Arqueologico', status: 'em analise', location: 'Laboratório' },
      { id: 14, name: 'Busto Grego', origin: 'Grécia', circa: 'Século IV a.C.', category: 'Artistico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 15, name: 'Pergaminho de Sabedoria', origin: 'Pérsia', circa: 'Século X', category: 'Documental', status: 'em restauracao', location: 'Laboratório' },
      { id: 16, name: 'Escudo Viking', origin: 'Escandinávia', circa: 'Século IX', category: 'Militar', status: 'catalogado', location: 'Acervo Digital' },
      { id: 17, name: 'Jarro Grego', origin: 'Grécia', circa: 'Século V a.C.', category: 'Artistico', status: 'em analise', location: 'Laboratório' },
      { id: 18, name: 'Colar de Pérolas', origin: 'China', circa: 'Século XVIII', category: 'Artistico', status: 'confidencial', location: 'Cofre Omega' },
      { id: 19, name: 'Bússola Antiga', origin: 'China', circa: 'Século XI', category: 'Cientifico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 20, name: 'Adaga Asteca', origin: 'Império Asteca', circa: 'Século XV', category: 'Militar', status: 'em analise', location: 'Laboratório' },
      { id: 21, name: 'Manuscrito Maya', origin: 'Império Maia', circa: 'Século XIII', category: 'Documental', status: 'em restauracao', location: 'Laboratório' },
      { id: 22, name: 'Busto Romano', origin: 'Roma', circa: 'Século I', category: 'Artistico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 23, name: 'Elmo Medieval', origin: 'Europa', circa: 'Século XII', category: 'Militar', status: 'confidencial', location: 'Célula-47' },
      { id: 24, name: 'Pote de Cerâmica', origin: 'Mesopotâmia', circa: 'Século III a.C.', category: 'Arqueologico', status: 'catalogado', location: 'Acervo Digital' },
      { id: 25, name: 'Cálice de Ouro', origin: 'Europa', circa: 'Século XII', category: 'Religioso', status: 'em analise', location: 'Laboratório' }
    ],
    
    archive: {
      totalArtifacts: 47,
      categories: [
        { name: "Arqueologico", count: 18 },
        { name: "Documental", count: 12 },
        { name: "Artistico", count: 9 },
        { name: "Numismatico", count: 5 },
        { name: "Cientifico", count: 3 }
      ],
      recentAdditions: 5
    },
    
    upgrades: [
      {
        id: 1,
        name: "Criptografia Quântica",
        category: "Tecnologia",
        cost: 4500,
        requirement: "Rede II",
        description: "Segurança de comunicações +45%."
      },
      {
        id: 2,
        name: "Rede de Informantes",
        category: "Inteligência",
        cost: 3200,
        requirement: "Nível 2",
        description: "Cobertura de vigilância +30%."
      },
      {
        id: 3,
        name: "Análise Preditiva",
        category: "Análise",
        cost: 6800,
        requirement: "Tecnologia III",
        description: "IA de previsão de movimentos."
      }
    ]
  };

  /* ===========================================
     API PÚBLICA
     =========================================== */
  var API = {
    /**
     * Inicializa o cliente. Tenta conectar ao backend.
     * Retorna true se online, false caso contrário.
     */
    init: function () {
      return fetch(BASE_URL + "/health", { signal: AbortSignal.timeout(3000) })
        .then(function (res) {
          if (res.ok) {
            _isOnline = true;
            console.log("[ARCHIVE API] Backend conectado em " + BASE_URL);
            var saved = localStorage.getItem("nexus_player_id");
            if (saved) _playerId = saved;
            return true;
          }
          throw new Error("HTTP " + res.status);
        })
        .catch(function () {
          _isOnline = false;
          console.warn("[ARCHIVE API] Backend offline — MODO STANDALONE ativado");
          console.log("[ARCHIVE API] Usando localStorage para persistência");
          
          // CARREGA DADOS DO LOCALSTORAGE QUANDO OFFLINE
          var state = API.getState();
          if (state && state.director) {
            console.log("[ARCHIVE API] Diretor carregado:", state.director.codename);
            console.log("[ARCHIVE API] Créditos:", state.stats?.credits || 1000);
          }
          
          return false;
        });
    },

    /** Retorna true se o backend está acessível */
    get online() {
      return _isOnline;
    },

    /** Retorna o playerId atual */
    get playerId() {
      return _playerId;
    },

    /** Define o playerId */
    set playerId(id) {
      _playerId = id;
      if (id) localStorage.setItem("nexus_player_id", id);
    },

    /** Faz uma requisição GET ao backend. Retorna null em caso de falha. */
    _request: function (endpoint) {
      if (!_isOnline) return Promise.resolve(null);
      return fetch(BASE_URL + endpoint, {
        headers: { Accept: "application/json" },
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn("[ARCHIVE API] Falha em " + endpoint + ":", err.message);
          return null;
        });
    },

    /** Faz uma requisição POST ao backend */
    _post: function (endpoint, data) {
      if (!_isOnline) return Promise.resolve(null);
      return fetch(BASE_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn(
            "[ARCHIVE API] Falha POST em " + endpoint + ":",
            err.message
          );
          return null;
        });
    },

    /** Busca lista de missões (opcionalmente filtradas por especialidade) */
    getMissions: function (specialty) {
      return this._request("/missions").then(function (data) {
        var missions = data && data.missions ? data.missions : MOCK.missions;
        if (specialty) {
          return missions.filter(function (m) {
            return (
              !m.specialty_filter ||
              m.specialty_filter.indexOf(specialty) !== -1
            );
          });
        }
        return missions;
      });
    },

    /** Gera nova missão procedural */
    generateMission: function () {
      return this._post("/missions/generate", {}).then(function (data) {
        return data || MOCK.missions[0];
      });
    },

    /** Aceita uma missão — FUNCIONA OFFLINE */
    acceptMission: function (missionId) {
      // PRIORIDADE 1: Backend online
      if (_playerId && _isOnline) {
        return this._post("/missions/" + missionId + "/accept", {
          player_id: _playerId,
        });
      }
      
      // PRIORIDADE 2: Modo offline com localStorage
      var state = this.getState();
      if (state && state.director && state.director.name) {
        console.log("[ARCHIVE API] Missão aceita localmente (offline)");
        return Promise.resolve({
          success: true,
          message: "Missão aceita (modo offline)",
          offline: true
        });
      }
      
      // PRIORIDADE 3: Sem cadastro
      return Promise.resolve({
        success: false,
        error: "Jogador não cadastrado",
      });
    },

    /** Completa uma missão */
    completeMission: function (missionId) {
      return this._post("/missions/" + missionId + "/complete", {});
    },

    /** Busca dados do jogador */
    getPlayer: function () {
      if (!_playerId) return Promise.resolve(MOCK.player);
      return this._request("/player/" + _playerId).then(function (data) {
        return data || MOCK.player;
      });
    },

    /** Cria novo jogador no backend */
    createPlayer: function (name, codename, specialty) {
      return this._post("/player", {
        name: name,
        codename: codename,
        specialty: specialty,
      }).then(function (data) {
        if (data && data.id) {
          _playerId = data.id;
          localStorage.setItem("nexus_player_id", _playerId);
        }
        return data;
      });
    },

    /** Compra um upgrade */
    buyUpgrade: function (upgradeId) {
      if (!_playerId)
        return Promise.resolve({
          success: false,
          error: "Jogador não cadastrado",
        });
      return this._post("/player/" + _playerId + "/upgrades", {
        upgrade_id: upgradeId,
      });
    },

    /** Busca artefatos do acervo */
    getArtifacts: function () {
      return this._request("/archive/artifacts").then(function (data) {
        if (data && data.artifacts) return data.artifacts;
        if (data && Array.isArray(data)) return data;
        return MOCK.artifacts;
      });
    },

    /** Busca estatísticas gerais do acervo */
    getArchiveStats: function () {
      return this._request("/archive/stats").then(function (data) {
        if (data && data.stats) return data.stats;
        return MOCK.archive;
      });
    },

    /** Busca lista de upgrades */
    getUpgrades: function () {
      return this._request("/archive/upgrades").then(function (data) {
        if (data && data.upgrades) return data.upgrades;
        return MOCK.upgrades;
      });
    },

    /** Salva progresso do jogador no backend */
    savePlayer: function (playerData) {
      if (!_isOnline || !_playerId) return Promise.resolve(false);
      return fetch(BASE_URL + "/player/" + _playerId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playerData),
      })
        .then(function (res) {
          return res.ok;
        })
        .catch(function () {
          return false;
        });
    },

    /* ===========================================
       GERENCIAMENTO DE ESTADO LOCAL (localStorage)
       =========================================== */
    getState: function () {
      try {
        var saved = localStorage.getItem(STATE_KEY);
        if (!saved) {
          var legacy = localStorage.getItem(LEGACY_STATE_KEY);
          if (legacy) {
            localStorage.setItem(STATE_KEY, legacy);
            localStorage.removeItem(LEGACY_STATE_KEY);
            saved = legacy;
          }
        }
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    },

    setState: function (partial) {
      var current = this.getState() || {};
      var merged = Object.assign({}, current, partial);
      localStorage.setItem(STATE_KEY, JSON.stringify(merged));
      return merged;
    },

    clearState: function () {
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(LEGACY_STATE_KEY);
      localStorage.removeItem("nexus_player_id");
      _playerId = null;
    },

    getDirectorName: function () {
      var s = this.getState();
      return s && s.director && s.director.name ? s.director.name : null;
    },

    getDirectorCodename: function () {
      var s = this.getState();
      return s && s.director && (s.director.codename || s.director.code)
        ? (s.director.codename || s.director.code)
        : null;
    },

    getDirectorSpecialty: function () {
      var s = this.getState();
      return s && s.director && s.director.specialty
        ? s.director.specialty
        : null;
    },

    /** Sistema de Notificações Toast */
    notify: function (message, type) {
      type = type || 'info';
      var toast = document.createElement('div');
      toast.className = 'archive-notify ' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.padding = '15px 25px';
      if (type === 'error') {
          toast.style.background = '#8B0000';
      } else if (type === 'success') {
          toast.style.background = '#004400';
      } else {
          toast.style.background = '#003344';
      }
      toast.style.color = '#FFBF00';
      toast.style.border = '1px solid #C5A059';
      toast.style.zIndex = '9999';
      toast.style.borderRadius = '4px';
      toast.style.fontFamily = 'JetBrains Mono, monospace';
      toast.style.textTransform = 'uppercase';
      
      setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 500);
      }, 3000);
    }
  };

  /* Expor globalmente */
  window.ArchiveAPI = API;
})();