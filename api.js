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

  var BASE_URL = "http://localhost:3000/api";
  var _isOnline = false;
  var _playerId = null;

  var STATE_KEY = "nexus_state_v1";
  var LEGACY_STATE_KEY = "project_nexus_state_v1";

  /* ===========================================
     DADOS MOCK DE FALLBACK
     =========================================== */
  var MOCK = {
    missions: [
      {
        id: 1,
        codename: "MERIDIAN",
        title: "Operação Meridian",
        location: "Cairo, Egito",
        priority: "ALTA",
        status: "ativa",
        phase: 2,
        totalPhases: 4,
        specialty_filter: ["arqueologia", "historia"],
        description:
          "Rastreamento de artefato roubado do Museo Egizio. Indícios apontam para rede de contrabando operando entre Cairo e Istanbul.",
        objectives: [
          "Localizar o artefato #47",
          "Identificar os intermediários",
          "Recuperar sem expor a Archive",
        ],
        reward: { xp: 350, credits: 1200, artifacts: 1 },
      },
      {
        id: 2,
        codename: "TYPHON",
        title: "Operação Typhon",
        location: "Istambul, Turquia",
        priority: "MEDIA",
        status: "ativa",
        phase: 1,
        totalPhases: 3,
        specialty_filter: ["investigacao", "inteligencia"],
        description:
          "Investigação de documentos históricos falsificados circulando no mercado negro de antiguidades.",
        objectives: [
          "Analisar documentos interceptados",
          "Rastrear a origem das falsificações",
          "Proteger coleções vulneráveis",
        ],
        reward: { xp: 250, credits: 800, artifacts: 0 },
      },
      {
        id: 3,
        codename: "SIGNAL",
        title: "Operação Signal",
        location: "Londres, Reino Unido",
        priority: "BAIXA",
        status: "reconhecimento",
        phase: 1,
        totalPhases: 2,
        specialty_filter: ["tecnologia", "criptografia"],
        description:
          "Monitoramento de sinais de comunicação suspeitos próximo a um depósito de arte classificada.",
        objectives: ["Mapear padrões de comunicação", "Identificar envolvidos"],
        reward: { xp: 150, credits: 500, artifacts: 0 },
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
        name: "Tabuinha de Narmer",
        origin: "Egito Antigo",
        circa: "3100 a.C.",
        category: "Arqueologico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 2,
        name: "Códice de Hammurabi (fragmento)",
        origin: "Mesopotâmia",
        circa: "1750 a.C.",
        category: "Documental",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 3,
        name: "Mosaico de Pela",
        origin: "Macedônia Antiga",
        circa: "300 a.C.",
        category: "Artistico",
        status: "em analise",
        location: "Laboratório",
      },
      {
        id: 4,
        name: "Pergaminho de Qumran",
        origin: "Judeia",
        circa: "100 a.C.",
        category: "Documental",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 5,
        name: "Estela de Rosetta (réplica exata)",
        origin: "Egito Ptolemaico",
        circa: "196 a.C.",
        category: "Arqueologico",
        status: "catalogado",
        location: "Museu Archive",
      },
      {
        id: 6,
        name: "Moeda de Creso",
        origin: "Lídia",
        circa: "550 a.C.",
        category: "Numismatico",
        status: "catalogado",
        location: "Acervo Digital",
      },
      {
        id: 7,
        name: "Taça de Dario I",
        origin: "Pérsia Aquemênida",
        circa: "500 a.C.",
        category: "Artistico",
        status: "em restauracao",
        location: "Laboratório",
      },
      {
        id: 8,
        name: "Lança de Bronze Nórdica",
        origin: "Escandinávia",
        circa: "800 d.C.",
        category: "Arqueologico",
        status: "catalogado",
        location: "Acervo Digital",
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
            // Tenta recuperar playerId do localStorage
            var saved = localStorage.getItem("nexus_player_id");
            if (saved) _playerId = saved;
            return true;
          }
          throw new Error("HTTP " + res.status);
        })
        .catch(function () {
          _isOnline = false;
          console.warn("[ARCHIVE API] Backend offline — usando dados locais");
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
            err.message,
          );
          return null;
        });
    },

    /** Busca lista de missões (opcionalmente filtradas por especialidade) */
    getMissions: function (specialty) {
      return this._request("/missions").then(function (data) {
        var missions = data && data.missions ? data.missions : MOCK.missions;
        // Filtra por especialidade se fornecida
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

    /** Aceita uma missão */
    acceptMission: function (missionId) {
      if (!_playerId)
        return Promise.resolve({
          success: false,
          error: "Jogador não cadastrado",
        });
      return this._post("/missions/" + missionId + "/accept", {
        player_id: _playerId,
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
  };

  /* Expor globalmente */
  window.ArchiveAPI = API;
})();
