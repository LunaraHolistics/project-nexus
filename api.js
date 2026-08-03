/**
 * ARCHIVE API Client — Project Nexus v2.0
 * Cliente de comunicação com o backend Node.js (porta 3000).
 * Resiliente: retorna dados mock se o backend estiver offline.
 *
 * Uso nas telas individuais:
 * <script src="/api.js"></script>
 * <script>
 *   await window.ArchiveAPI.init();
 *   var missions = await window.ArchiveAPI.getMissions();
 * </script>
 */
(function () {
  "use strict";

  /* ===========================================
     DETECÇÃO DE AMBIENTE
     =========================================== */
  var BASE_URL = (function () {
    var hostname = window.location.hostname;
    // Ambiente local
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3000/api";
    }
    // Ambiente de preview (Netlify deploy previews)
    if (
      hostname.indexOf("netlify.app") !== -1 ||
      hostname.indexOf("netlify.com") !== -1
    ) {
      return "https://project-nexus-15sj.onrender.com/api";
    }
    // Produção (Netlify ou domínio customizado)
    return "https://project-nexus-15sj.onrender.com/api";
  })();

  var _isOnline = false;
  var _playerId = null;
  var _initPromise = null;

  var STATE_KEY = "nexus_state_v1";
  var LEGACY_STATE_KEY = "project_nexus_state_v1";

  /* ===========================================
     DADOS MOCK DE FALLBACK - EVOLUÇÃO COMPLETA
     =========================================== */
  var MOCK = {
    missions: [
      {
        id: 1,
        codename: "MERIDIAN",
        title: "O Cálice de Antioquia",
        location: "Viena, Áustria",
        priority: "ALTA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["arqueologia", "historia"],
        description:
          "Recuperação de um artefato Classe-4. Inteligência sugere conexão com rede clandestina.",
        objectives: [
          "Localizar cofre",
          "Neutralizar courier",
          "Recuperar cálice",
        ],
        reward: { xp: 500, credits: 1200, artifacts: 1 },
      },
      {
        id: 2,
        codename: "TYPHON",
        title: "Manuscrito de Voynich",
        location: "Londres, Reino Unido",
        priority: "MÉDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["criptografia", "historia"],
        description:
          "Estudo de um manuscrito criptografado. Suspeita de segredos químicos ocultos.",
        objectives: ["Obter acesso", "Escanear páginas", "Traduzir fragmento"],
        reward: { xp: 300, credits: 800, artifacts: 0 },
      },
      {
        id: 3,
        codename: "SIGNAL",
        title: "Máscara Dourada Inca",
        location: "Cusco, Peru",
        priority: "CRÍTICA",
        status: "ativa",
        phase: 1,
        totalPhases: 5,
        specialty_filter: ["arqueologia", "investigacao"],
        description: "Recuperação urgente antes da venda em leilão privado.",
        objectives: [
          "Infiltrar mansão",
          "Localizar máscara",
          "Extrair via helicóptero",
        ],
        reward: { xp: 1000, credits: 2500, artifacts: 1 },
      },
      {
        id: 4,
        codename: "PHOENIX",
        title: "Moedas de Ouro Romano",
        location: "Roma, Itália",
        priority: "BAIXA",
        status: "ativa",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["historia", "arqueologia"],
        description: "Rastreamento de moedas raras contrabandeadas.",
        objectives: [
          "Identificar fonte",
          "Monitorar transação",
          "Apreender carga",
        ],
        reward: { xp: 200, credits: 500, artifacts: 0 },
      },
      {
        id: 5,
        codename: "ECLIPSE",
        title: "Estátua de Shiva",
        location: "Mumbai, Índia",
        priority: "ALTA",
        status: "ativa",
        phase: 2,
        totalPhases: 4,
        specialty_filter: ["arqueologia", "investigacao"],
        description: "A estátua foi roubada de um templo protegido.",
        objectives: [
          "Localizar templo",
          "Monitorar suspeito",
          "Resgatar estátua",
        ],
        reward: { xp: 700, credits: 1800, artifacts: 1 },
      },
      {
        id: 6,
        codename: "SENTINEL",
        title: "Arma de Samurai",
        location: "Tóquio, Japão",
        priority: "MÉDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["historia", "investigacao"],
        description: "Espada antiga do período Edo sendo negociada.",
        objectives: [
          "Infiltrar dojo",
          "Verificar autenticidade",
          "Recuperar katana",
        ],
        reward: { xp: 400, credits: 1000, artifacts: 0 },
      },
      {
        id: 7,
        codename: "VIPER",
        title: "Pergaminhos do Mar Morto",
        location: "Cairo, Egito",
        priority: "CRÍTICA",
        status: "ativa",
        phase: 1,
        totalPhases: 6,
        specialty_filter: ["historia", "arqueologia"],
        description: "Recuperar fragmentos antes da destruição.",
        objectives: [
          "Alcançar sítio",
          "Proteger pergaminhos",
          "Extrair sob fogo",
        ],
        reward: { xp: 1200, credits: 3000, artifacts: 1 },
      },
      {
        id: 8,
        codename: "GHOST",
        title: "Colar de Pérolas Chinês",
        location: "Pequim, China",
        priority: "MÉDIA",
        status: "ativa",
        phase: 2,
        totalPhases: 3,
        specialty_filter: ["investigacao", "inteligencia"],
        description: "Joia da dinastia Qing em rota de contrabando.",
        objectives: [
          "Rastrear courier",
          "Identificar comprador",
          "Interceptar",
        ],
        reward: { xp: 450, credits: 1100, artifacts: 0 },
      },
      {
        id: 9,
        codename: "IRONCLAD",
        title: "Relíquia Viking",
        location: "Berlim, Alemanha",
        priority: "BAIXA",
        status: "ativa",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["arqueologia", "historia"],
        description: "Amuleto encontrado em escavação.",
        objectives: ["Monitorar museu", "Registrar inventário", "Apreender"],
        reward: { xp: 250, credits: 600, artifacts: 0 },
      },
      {
        id: 10,
        codename: "SHADOW",
        title: "Joias Reais",
        location: "Paris, França",
        priority: "ALTA",
        status: "ativa",
        phase: 1,
        totalPhases: 4,
        specialty_filter: ["investigacao", "inteligencia"],
        description: "Roubo de joias no Louvre.",
        objectives: ["Infiltrar Louvre", "Desativar alarme", "Recuperar"],
        reward: { xp: 800, credits: 2000, artifacts: 1 },
      },
      {
        id: 11,
        codename: "VALKYRIE",
        title: "Busto Grego",
        location: "Atenas, Grécia",
        priority: "MÉDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["arqueologia", "historia"],
        description: "Busto sendo leiloado ilegalmente.",
        objectives: ["Verificar galeria", "Localizar busto", "Apreender"],
        reward: { xp: 500, credits: 1300, artifacts: 0 },
      },
      {
        id: 12,
        codename: "PEGASUS",
        title: "Relógio de Bolso",
        location: "Nova York, EUA",
        priority: "BAIXA",
        status: "ativa",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["tecnologia", "investigacao"],
        description: "Relógio de inventor famoso.",
        objectives: ["Rastrear leilão", "Monitorar", "Interceptar"],
        reward: { xp: 300, credits: 700, artifacts: 0 },
      },
      {
        id: 13,
        codename: "ORACLE",
        title: "Máscara Asteca",
        location: "Cidade do México, México",
        priority: "ALTA",
        status: "ativa",
        phase: 2,
        totalPhases: 4,
        specialty_filter: ["arqueologia", "historia"],
        description: "Máscara roubada de sítio arqueológico.",
        objectives: ["Explorar sítio", "Rastrear suspeitos", "Recuperar"],
        reward: { xp: 900, credits: 2200, artifacts: 1 },
      },
      {
        id: 14,
        codename: "TITAN",
        title: "Estátua de Bronze",
        location: "Roma, Itália",
        priority: "CRÍTICA",
        status: "ativa",
        phase: 1,
        totalPhases: 5,
        specialty_filter: ["arqueologia", "investigacao"],
        description: "Estátua de valor inestimável.",
        objectives: ["Infiltrar cofre", "Desativar laser", "Extrair"],
        reward: { xp: 1500, credits: 3500, artifacts: 1 },
      },
      {
        id: 15,
        codename: "SERPENT",
        title: "Adaga Pérsia",
        location: "Dubai, EAU",
        priority: "MÉDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["historia", "investigacao"],
        description: "Adaga cerimonial em leilão.",
        objectives: ["Infiltrar evento", "Localizar item", "Extrair"],
        reward: { xp: 600, credits: 1500, artifacts: 0 },
      },
      {
        id: 16,
        codename: "GRIFFIN",
        title: "Amuleto Egípcio",
        location: "Luxor, Egito",
        priority: "ALTA",
        status: "ativa",
        phase: 2,
        totalPhases: 4,
        specialty_filter: ["arqueologia", "historia"],
        description: "Amuleto escondido em tumba.",
        objectives: ["Explorar tumba", "Localizar amuleto", "Extrair"],
        reward: { xp: 750, credits: 1900, artifacts: 1 },
      },
      {
        id: 17,
        codename: "DRAGON",
        title: "Vaso Chinês",
        location: "Bangkok, Tailândia",
        priority: "MÉDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["historia", "arqueologia"],
        description: "Vaso de dinastia Ming.",
        objectives: ["Rastrear contrabando", "Identificar local", "Apreender"],
        reward: { xp: 550, credits: 1400, artifacts: 0 },
      },
      {
        id: 18,
        codename: "HYDRA",
        title: "Espada Medieval",
        location: "Moscou, Rússia",
        priority: "ALTA",
        status: "ativa",
        phase: 1,
        totalPhases: 4,
        specialty_filter: ["historia", "investigacao"],
        description: "Espada em coleção privada.",
        objectives: ["Infiltrar propriedade", "Localizar espada", "Recuperar"],
        reward: { xp: 850, credits: 2100, artifacts: 0 },
      },
      {
        id: 19,
        codename: "PHANTOM",
        title: "Anel de Sinete",
        location: "Rio de Janeiro, Brasil",
        priority: "BAIXA",
        status: "ativa",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["investigacao", "inteligencia"],
        description: "Anel em colecionador.",
        objectives: ["Localizar anel", "Monitorar", "Interceptar"],
        reward: { xp: 350, credits: 900, artifacts: 0 },
      },
      {
        id: 20,
        codename: "CERBERUS",
        title: "Manuscrito Persa",
        location: "Istambul, Turquia",
        priority: "CRÍTICA",
        status: "ativa",
        phase: 1,
        totalPhases: 6,
        specialty_filter: ["historia", "criptografia"],
        description: "Manuscrito perdido de sabedoria.",
        objectives: ["Localizar biblioteca", "Proteger item", "Extrair"],
        reward: { xp: 1300, credits: 3200, artifacts: 1 },
      },
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
      agentsRecruited: 3,
    },

    artifacts: [
      {
        id: 1,
        name: "Cálice de Antioquia",
        origin: "Bizâncio",
        circa: "Século I",
        category: "Religioso",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 2,
        name: "Manuscrito de Voynich",
        origin: "Europa Central",
        circa: "Século XV",
        category: "Documental",
        status: "em restauracao",
        location: "Acervo Digital",
      },
      {
        id: 3,
        name: "Máscara de Jade Inca",
        origin: "Império Inca",
        circa: "Século XV",
        category: "Arqueologico",
        status: "catalogado",
        location: "Museu Archive",
      },
      {
        id: 4,
        name: "Adaga de Bronze Pérsica",
        origin: "Pérsia",
        circa: "Século V a.C.",
        category: "Militar",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 5,
        name: "Vaso Dinastia Ming",
        origin: "China",
        circa: "Século XIV",
        category: "Artistico",
        status: "confidencial",
        location: "Cofre Omega",
      },
      {
        id: 6,
        name: "Moedas de Ouro Romano",
        origin: "Roma",
        circa: "Século II",
        category: "Numismatico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 7,
        name: "Espada de Samurai",
        origin: "Japão",
        circa: "Século XVII",
        category: "Militar",
        status: "em restauracao",
        location: "Laboratório",
      },
      {
        id: 8,
        name: "Papiro Egípcio",
        origin: "Egito",
        circa: "Século XII a.C.",
        category: "Documental",
        status: "em analise",
        location: "Acervo Digital",
      },
      {
        id: 9,
        name: "Estátua de Shiva",
        origin: "Índia",
        circa: "Século X",
        category: "Artistico",
        status: "confidencial",
        location: "Célula-47",
      },
      {
        id: 10,
        name: "Amuleto de Proteção",
        origin: "Egito",
        circa: "Século VIII a.C.",
        category: "Religioso",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 11,
        name: "Anel de Sinete",
        origin: "França",
        circa: "Século XVI",
        category: "Artistico",
        status: "emprestado",
        location: "Museu Externo",
      },
      {
        id: 12,
        name: "Relógio de Inventores",
        origin: "Suíça",
        circa: "Século XVIII",
        category: "Cientifico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 13,
        name: "Máscara Asteca",
        origin: "Império Asteca",
        circa: "Século XIV",
        category: "Arqueologico",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 14,
        name: "Busto Grego",
        origin: "Grécia",
        circa: "Século IV a.C.",
        category: "Artistico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 15,
        name: "Pergaminho de Sabedoria",
        origin: "Pérsia",
        circa: "Século X",
        category: "Documental",
        status: "em restauracao",
        location: "Laboratório",
      },
      {
        id: 16,
        name: "Escudo Viking",
        origin: "Escandinávia",
        circa: "Século IX",
        category: "Militar",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 17,
        name: "Jarro Grego",
        origin: "Grécia",
        circa: "Século V a.C.",
        category: "Artistico",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 18,
        name: "Colar de Pérolas",
        origin: "China",
        circa: "Século XVIII",
        category: "Artistico",
        status: "confidencial",
        location: "Cofre Omega",
      },
      {
        id: 19,
        name: "Bússola Antiga",
        origin: "China",
        circa: "Século XI",
        category: "Cientifico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 20,
        name: "Adaga Asteca",
        origin: "Império Asteca",
        circa: "Século XV",
        category: "Militar",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 21,
        name: "Manuscrito Maya",
        origin: "Império Maia",
        circa: "Século XIII",
        category: "Documental",
        status: "em restauracao",
        location: "Laboratório",
      },
      {
        id: 22,
        name: "Busto Romano",
        origin: "Roma",
        circa: "Século I",
        category: "Artistico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 23,
        name: "Elmo Medieval",
        origin: "Europa",
        circa: "Século XII",
        category: "Militar",
        status: "confidencial",
        location: "Célula-47",
      },
      {
        id: 24,
        name: "Pote de Cerâmica",
        origin: "Mesopotâmia",
        circa: "Século III a.C.",
        category: "Arqueologico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 25,
        name: "Cálice de Ouro",
        origin: "Europa",
        circa: "Século XII",
        category: "Religioso",
        status: "em analise",
        location: "Laboratório",
      },
    ],

    archive: {
      totalArtifacts: 47,
      categories: [
        { name: "Arqueologico", count: 18 },
        { name: "Documental", count: 12 },
        { name: "Artistico", count: 9 },
        { name: "Numismatico", count: 5 },
        { name: "Cientifico", count: 3 },
      ],
      recentAdditions: 5,
    },

    upgrades: [
      {
        id: 1,
        name: "Criptografia Quântica",
        category: "Tecnologia",
        cost: 4500,
        requirement: "Rede II",
        description: "Segurança de comunicações +45%.",
      },
      {
        id: 2,
        name: "Rede de Informantes",
        category: "Inteligência",
        cost: 3200,
        requirement: "Nível 2",
        description: "Cobertura de vigilância +30%.",
      },
      {
        id: 3,
        name: "Análise Preditiva",
        category: "Análise",
        cost: 6800,
        requirement: "Tecnologia III",
        description: "IA de previsão de movimentos.",
      },
    ],
  };
  /* ===========================================
     UTILITÁRIOS DE FETCH (COMPATÍVEL COM TODOS OS BROWSERS)
     =========================================== */
  function fetchWithTimeout(url, options, timeout) {
    options = options || {};
    timeout = timeout || 5000;

    // Usa AbortController se disponível
    if (typeof AbortController !== "undefined") {
      var controller = new AbortController();
      options.signal = controller.signal;
      var timeoutId = setTimeout(function () {
        controller.abort();
      }, timeout);

      return fetch(url, options).finally(function () {
        clearTimeout(timeoutId);
      });
    }

    // Fallback para browsers antigos (sem AbortController)
    return Promise.race([
      fetch(url, options),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Timeout"));
        }, timeout);
      }),
    ]);
  }

  /* ===========================================
     API PÚBLICA
     =========================================== */
  var API = {
    /**
     * Inicializa a API - verifica conexão com backend
     * Retorna Promise<boolean> (true se online, false se offline)
     */
    init: function () {
      // Evita múltiplas chamadas simultâneas
      if (_initPromise) return _initPromise;

      _initPromise = fetchWithTimeout(BASE_URL + "/health", {}, 3000)
        .then(function (res) {
          if (res.ok) {
            _isOnline = true;
            console.log("[ARCHIVE API] ✅ Backend conectado em " + BASE_URL);
            var saved = localStorage.getItem("nexus_player_id");
            if (saved) _playerId = saved;
            return true;
          }
          throw new Error("HTTP " + res.status);
        })
        .catch(function (err) {
          _isOnline = false;
          console.warn(
            "[ARCHIVE API] ⚠️ Backend offline — MODO STANDALONE ativado",
            err.message || "",
          );
          var state = API.getState();
          if (state && state.director) {
            console.log(
              "[ARCHIVE API] Diretor carregado do localStorage:",
              state.director.codename,
            );
          }
          return false;
        });

      return _initPromise;
    },

    /**
     * Propriedade: está online?
     */
    get online() {
      return _isOnline;
    },

    /**
     * Propriedade: ID do jogador
     */
    get playerId() {
      return _playerId;
    },
    set playerId(id) {
      _playerId = id;
      if (id) {
        localStorage.setItem("nexus_player_id", id);
      } else {
        localStorage.removeItem("nexus_player_id");
      }
    },

    /**
     * Requisição GET genérica
     */
    _request: function (endpoint) {
      if (!_isOnline) return Promise.resolve(null);
      return fetchWithTimeout(
        BASE_URL + endpoint,
        {
          headers: { Accept: "application/json" },
        },
        8000,
      )
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn(
            "[ARCHIVE API] Falha em GET " + endpoint + ":",
            err.message,
          );
          return null;
        });
    },

    /**
     * Requisição POST genérica
     */
    _post: function (endpoint, data) {
      if (!_isOnline) return Promise.resolve(null);
      return fetchWithTimeout(
        BASE_URL + endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(data),
        },
        8000,
      )
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn(
            "[ARCHIVE API] Falha POST em " + endpoint + ":",
            err.message,
          );
          return null;
        });
    },

    /**
     * Requisição PUT genérica
     */
    _put: function (endpoint, data) {
      if (!_isOnline) return Promise.resolve(null);
      return fetchWithTimeout(
        BASE_URL + endpoint,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(data),
        },
        8000,
      )
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.warn(
            "[ARCHIVE API] Falha PUT em " + endpoint + ":",
            err.message,
          );
          return null;
        });
    },

    /* ===========================================
       MISSÕES
       =========================================== */
    getMissions: function (specialty) {
      return this._request("/missions").then(function (data) {
        var missions;
        if (data && data.missions) {
          missions = data.missions;
        } else if (Array.isArray(data)) {
          missions = data;
        } else {
          missions = MOCK.missions;
        }

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

    /**
     * Busca missão específica por ID (útil para telas individuais)
     */
    getMissionById: function (missionId) {
      return this.getMissions().then(function (missions) {
        return (
          missions.find(function (m) {
            return m.id === missionId;
          }) || null
        );
      });
    },

    generateMission: function () {
      return this._post("/missions/generate", {}).then(function (data) {
        return data || MOCK.missions[0];
      });
    },

    /**
     * Aceita missão - salva estado localmente em modo offline
     */
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
        console.log(
          "[ARCHIVE API] Missão aceita localmente (offline):",
          missionId,
        );

        // Busca dados da missão
        var mission = MOCK.missions.find(function (m) {
          return m.id === missionId;
        });

        // Atualiza estado local
        var updatedState = this.setState({
          currentMission: {
            id: missionId,
            codename: mission ? mission.codename : "UNKNOWN",
            title: mission ? mission.title : "Missão",
            acceptedAt: new Date().toISOString(),
            status: "accepted",
          },
          acceptedMissions: (state.acceptedMissions || []).concat([missionId]),
        });

        return Promise.resolve({
          success: true,
          message: "Missão aceita (modo offline)",
          offline: true,
          state: updatedState,
        });
      }

      // PRIORIDADE 3: Sem cadastro
      return Promise.resolve({
        success: false,
        error: "Jogador não cadastrado. Faça login primeiro.",
      });
    },

    /**
     * Completa missão - salva estado localmente em modo offline
     */
    completeMission: function (missionId) {
      if (_playerId && _isOnline) {
        return this._post("/missions/" + missionId + "/complete", {
          player_id: _playerId,
        });
      }

      // Modo offline
      var state = this.getState();
      if (state && state.director) {
        var mission = MOCK.missions.find(function (m) {
          return m.id === missionId;
        });

        var completed = state.completedMissions || [];
        if (completed.indexOf(missionId) === -1) {
          completed.push(missionId);
        }

        var xp = mission ? mission.reward.xp : 100;
        var credits = mission ? mission.reward.credits : 500;

        this.setState({
          completedMissions: completed,
          currentMission: null,
          stats: {
            missionsCompleted: completed.length,
            totalXP: (state.stats ? state.stats.totalXP || 0 : 0) + xp,
            totalCredits:
              (state.stats ? state.stats.totalCredits || 0 : 0) + credits,
          },
        });

        return Promise.resolve({
          success: true,
          message: "Missão completada (modo offline)",
          offline: true,
          reward: mission ? mission.reward : { xp: xp, credits: credits },
        });
      }

      return Promise.resolve({
        success: false,
        error: "Jogador não cadastrado",
      });
    },

    /* ===========================================
       JOGADOR
       =========================================== */
    getPlayer: function () {
      if (!_playerId && !_isOnline) {
        return Promise.resolve(MOCK.player);
      }
      if (!_playerId) return Promise.resolve(MOCK.player);

      return this._request("/player/" + _playerId).then(function (data) {
        return data || MOCK.player;
      });
    },

    /**
     * Cria jogador - salva localmente também
     */
    createPlayer: function (name, codename, specialty) {
      var self = this;

      // Tenta criar no backend
      if (_isOnline) {
        return this._post("/player", {
          name: name,
          codename: codename,
          specialty: specialty,
        }).then(function (data) {
          if (data && data.id) {
            _playerId = data.id;
            localStorage.setItem("nexus_player_id", _playerId);
          }
          // Salva dados localmente também
          self.setState({
            director: {
              name: name,
              codename: codename,
              specialty: specialty,
            },
            player: data || { name: name, codename: codename },
          });
          return data;
        });
      }

      // Modo offline - salva apenas localmente
      this.setState({
        director: {
          name: name,
          codename: codename,
          specialty: specialty,
        },
        player: {
          name: name,
          codename: codename,
          specialty: specialty,
          level: 1,
          xp: 0,
        },
      });

      return Promise.resolve({
        success: true,
        offline: true,
        director: { name: name, codename: codename, specialty: specialty },
      });
    },

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

    /* ===========================================
       ARQUIVO / ACERVO
       =========================================== */
    getArtifacts: function () {
      return this._request("/archive/artifacts").then(function (data) {
        if (data && data.artifacts) return data.artifacts;
        if (data && Array.isArray(data)) return data;
        return MOCK.artifacts;
      });
    },

    getArchiveStats: function () {
      return this._request("/archive/stats").then(function (data) {
        if (data && data.stats) return data.stats;
        return MOCK.archive;
      });
    },

    getUpgrades: function () {
      return this._request("/archive/upgrades").then(function (data) {
        if (data && data.upgrades) return data.upgrades;
        return MOCK.upgrades;
      });
    },

    savePlayer: function (playerData) {
      if (!_isOnline || !_playerId) return Promise.resolve(false);
      return this._put("/player/" + _playerId, playerData).then(
        function (data) {
          return !!data;
        },
      );
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
        console.error("[ARCHIVE API] Erro ao ler state:", e);
        return null;
      }
    },

    setState: function (partial) {
      try {
        var current = this.getState() || {};
        var merged = Object.assign({}, current, partial);
        localStorage.setItem(STATE_KEY, JSON.stringify(merged));
        return merged;
      } catch (e) {
        console.error("[ARCHIVE API] Erro ao salvar state:", e);
        return null;
      }
    },

    clearState: function () {
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(LEGACY_STATE_KEY);
      localStorage.removeItem("nexus_player_id");
      _playerId = null;
      _initPromise = null;
    },

    /* ===========================================
       HELPERS - INFORMAÇÕES DO DIRETOR
       =========================================== */
    isDirectorLoggedIn: function () {
      var s = this.getState();
      return !!(s && s.director && s.director.name);
    },

    getDirector: function () {
      var s = this.getState();
      return s && s.director ? s.director : null;
    },

    getDirectorName: function () {
      var s = this.getState();
      return s && s.director && s.director.name ? s.director.name : null;
    },

    getDirectorCodename: function () {
      var s = this.getState();
      return s && s.director && (s.director.codename || s.director.code)
        ? s.director.codename || s.director.code
        : null;
    },

    getDirectorSpecialty: function () {
      var s = this.getState();
      return s && s.director && s.director.specialty
        ? s.director.specialty
        : null;
    },

    /* ===========================================
       NOTIFICAÇÕES (TOAST)
       =========================================== */
    notify: function (message, type) {
      type = type || "info";

      // Tenta usar o sistema de toast do index.html se disponível
      if (window.parent && window.parent !== window) {
        // Estamos dentro de um iframe - tenta comunicar com o pai
        try {
          window.parent.postMessage(
            {
              type: "ARCHIVE_NOTIFY",
              message: message,
              notifyType: type,
            },
            "*",
          );
          return;
        } catch (e) {
          // Continua para fallback
        }
      }

      // Fallback: criar toast inline
      var toast = document.createElement("div");
      toast.className = "archive-notify archive-notify-" + type;
      toast.textContent = message;

      // Estilos
      toast.style.cssText = [
        "position: fixed",
        "bottom: 20px",
        "right: 20px",
        "padding: 15px 25px",
        "z-index: 99999",
        "border-radius: 4px",
        "font-family: 'JetBrains Mono', monospace",
        "font-size: 12px",
        "letter-spacing: 0.1em",
        "text-transform: uppercase",
        "color: #FFBF00",
        "border: 1px solid #C5A059",
        "box-shadow: 0 8px 24px rgba(0,0,0,0.5)",
        "transition: opacity 0.5s ease",
        "max-width: 400px",
      ].join(";");

      // Cor de fundo por tipo
      if (type === "error") {
        toast.style.background = "#8B0000";
      } else if (type === "success") {
        toast.style.background = "#004400";
      } else if (type === "warning") {
        toast.style.background = "#664400";
      } else {
        toast.style.background = "#003344";
      }

      document.body.appendChild(toast);

      // Remove após 3 segundos
      setTimeout(function () {
        toast.style.opacity = "0";
        setTimeout(function () {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 500);
      }, 3000);
    },

    /* ===========================================
       DADOS MOCK (acesso direto para debugging)
       =========================================== */
    getMockData: function () {
      return MOCK;
    },

    /* ===========================================
       BASE URL (para debugging)
       =========================================== */
    getBaseUrl: function () {
      return BASE_URL;
    },
  };

  /* ===========================================
     LISTENER PARA MENSAGENS DE IFRAMES
     (permite que telas individuais enviem notificações)
     =========================================== */
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "ARCHIVE_NOTIFY") {
      API.notify(event.data.message, event.data.notifyType);
    }
  });

  /* Expor globalmente */
  window.ArchiveAPI = API;

  console.log("[ARCHIVE API] 📦 Cliente carregado - BASE_URL:", BASE_URL);
})();
