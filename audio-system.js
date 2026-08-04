/**
 * ARCHIVE Audio System v2.0 — Project Nexus
 * Sistema de áudio sintético leve sem dependências externas.
 * Gera todos os sons via Web Audio API.
 *
 * Características:
 * - 🎵 Sons sintéticos (sem arquivos externos)
 * - 🔇 Sistema de mute com persistência
 * - 🎚️ Controle de volume master
 * - 💾 Preferências salvas em localStorage
 * - 🛡️ Fallback gracioso em browsers antigos
 *
 * Uso:
 * <script src="/audio-system.js"></script>
 * <script>
 *   window.ArchiveAudio.playClick();
 *   window.ArchiveAudio.playSuccess();
 *   window.ArchiveAudio.toggleMute();
 * </script>
 */
(function () {
  "use strict";

  /* ============================================
     CONFIGURAÇÃO
     ============================================ */
  var STORAGE_KEY = "nexus_audio_prefs";
  var DEFAULT_VOLUME = 0.3; // Volume master padrão (30%)
  var DEFAULT_MUTED = false;

  /* ============================================
     ESTADO
     ============================================ */
  var audioCtx = null;
  var masterGain = null;
  var isMuted = false;
  var isSupported = true;
  var masterVolume = DEFAULT_VOLUME;
  var initialized = false;

  /* ============================================
     PREFERÊNCIAS PERSISTIDAS
     ============================================ */
  function loadPreferences() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var prefs = JSON.parse(saved);
        isMuted = !!prefs.muted;
        masterVolume = typeof prefs.volume === "number"
          ? Math.max(0, Math.min(1, prefs.volume))
          : DEFAULT_VOLUME;
        return;
      }
    } catch (e) {
      // Fallback silencioso
    }
    isMuted = DEFAULT_MUTED;
    masterVolume = DEFAULT_VOLUME;
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          muted: isMuted,
          volume: masterVolume,
        })
      );
    } catch (e) {
      // Falha silenciosa se localStorage estiver indisponível
    }
  }

  /* ============================================
     INICIALIZAÇÃO DO WEB AUDIO
     ============================================ */
  function initAudioContext() {
    if (initialized) return audioCtx;

    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        isSupported = false;
        console.warn("[AUDIO] Web Audio API não suportada neste navegador");
        return null;
      }

      audioCtx = new AudioCtx();

      // Cria nó de ganho master para controlar volume global
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      updateMasterVolume();

      initialized = true;
      return audioCtx;
    } catch (e) {
      isSupported = false;
      console.warn("[AUDIO] Falha ao inicializar:", e.message);
      return null;
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      initAudioContext();
    }
    // Resume se estiver suspenso (política de autoplay)
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {
        // Ignora - pode falhar silenciosamente
      });
    }
    return audioCtx;
  }

  function updateMasterVolume() {
    if (masterGain) {
      var vol = isMuted ? 0 : masterVolume;
      masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
  }

  /* ============================================
     FUNÇÃO BASE: TOCAR TOM SINTÉTICO
     ============================================ */
  function playTone(freq, type, duration, vol) {
    vol = typeof vol === "number" ? vol : 0.1;

    if (!isSupported) return;

    var ctx = getAudioContext();
    if (!ctx) return;

    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Envelope ADSR simplificado (Attack-Decay)
      var startTime = ctx.currentTime;
      var attackTime = Math.min(0.01, duration * 0.1);
      var releaseTime = duration - attackTime;

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(vol, startTime + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      // Falha silenciosa - áudio pode ser bloqueado pelo navegador
    }
  }

  /* ============================================
     FUNÇÃO AVANÇADA: TOCAR ACORDE (múltiplos tons)
     ============================================ */
  function playChord(freqs, type, duration, vol) {
    if (!Array.isArray(freqs)) return;
    freqs.forEach(function (freq, i) {
      setTimeout(function () {
        playTone(freq, type, duration, vol);
      }, i * 20); // Pequeno delay entre notas para efeito
    });
  }

  /* ============================================
     FUNÇÃO AVANÇADA: EFEITO DE VARREDURA (SWEEP)
     ============================================ */
  function playSweep(startFreq, endFreq, duration, type, vol) {
    vol = typeof vol === "number" ? vol : 0.1;

    if (!isSupported) return;

    var ctx = getAudioContext();
    if (!ctx) return;

    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = type || "sawtooth";
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(endFreq, 0.001),
        ctx.currentTime + duration
      );

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(masterGain || ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Falha silenciosa
    }
  }

  /* ============================================
     FUNÇÃO AVANÇADA: RUÍDO (NOISE) PARA TEXTURA
     ============================================ */
  function playNoise(duration, vol) {
    vol = typeof vol === "number" ? vol : 0.02;

    if (!isSupported) return;

    var ctx = getAudioContext();
    if (!ctx) return;

    try {
      var bufferSize = ctx.sampleRate * duration;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);

      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }

      var noise = ctx.createBufferSource();
      noise.buffer = buffer;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      // Filtro passa-baixa para não ser agressivo
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2000, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + duration);
    } catch (e) {
      // Falha silenciosa
    }
  }
    /* ============================================
     API PÚBLICA — ARCHIVE AUDIO
     ============================================ */
  window.ArchiveAudio = {
    /* ----- INICIALIZAÇÃO ----- */
    init: function () {
      loadPreferences();
      initAudioContext();
      console.log(
        "[AUDIO] 🎵 Sistema carregado - Volume:",
        Math.round(masterVolume * 100) + "%",
        isMuted ? "(Mudo)" : ""
      );
      return Promise.resolve(true);
    },

    /* ----- SONS BÁSICOS DE INTERAÇÃO ----- */

    /**
     * Click padrão - interface geral
     */
    playClick: function () {
      if (isMuted) return;
      playTone(880, "sine", 0.04, 0.08);
    },

    /**
     * Click suave - menus, navegação
     */
    playSoftClick: function () {
      if (isMuted) return;
      playTone(660, "sine", 0.03, 0.04);
    },

    /**
     * Hover - ao passar o mouse
     */
    playHover: function () {
      if (isMuted) return;
      playTone(1200, "sine", 0.025, 0.02);
    },

    /* ----- SONS DE FEEDBACK ----- */

    /**
     * Success - operações bem-sucedidas
     */
    playSuccess: function () {
      if (isMuted) return;
      // Acorde C maior arpejado: C5, E5, G5
      playTone(523.25, "sine", 0.12, 0.12); // C5
      setTimeout(function () {
        playTone(659.25, "sine", 0.12, 0.12); // E5
      }, 80);
      setTimeout(function () {
        playTone(783.99, "sine", 0.18, 0.12); // G5
      }, 160);
    },

    /**
     * Success curto - confirmações rápidas
     */
    playSuccessShort: function () {
      if (isMuted) return;
      playTone(880, "sine", 0.08, 0.1);
      setTimeout(function () {
        playTone(1108.73, "sine", 0.1, 0.1); // C#6
      }, 60);
    },

    /**
     * Error - falhas e alertas
     */
    playError: function () {
      if (isMuted) return;
      // Dois tons graves descendentes
      playTone(220, "sawtooth", 0.15, 0.1);
      setTimeout(function () {
        playTone(150, "sawtooth", 0.2, 0.1);
      }, 150);
      // Leve ruído de textura
      playNoise(0.2, 0.03);
    },

    /**
     * Warning - alertas não-críticos
     */
    playWarning: function () {
      if (isMuted) return;
      playTone(440, "square", 0.08, 0.06);
      setTimeout(function () {
        playTone(440, "square", 0.08, 0.06);
      }, 150);
    },

    /* ----- SONS TEMÁTICOS ----- */

    /**
     * Boot - som de inicialização do sistema
     */
    playBoot: function () {
      if (isMuted) return;
      // Sequência de tons que "acordam" o sistema
      playSweep(100, 800, 0.4, "sawtooth", 0.06);
      setTimeout(function () {
        playTone(440, "sine", 0.1, 0.08);
      }, 400);
      setTimeout(function () {
        playTone(554.37, "sine", 0.1, 0.08);
      }, 500);
      setTimeout(function () {
        playTone(659.25, "sine", 0.2, 0.1);
      }, 600);
      // Ruído sutil de "sistema ligando"
      playNoise(0.5, 0.015);
    },

    /**
     * Login - som de autenticação
     */
    playLogin: function () {
      if (isMuted) return;
      // Progressão ascendente: D4, A4, D5
      playTone(293.66, "sine", 0.1, 0.1); // D4
      setTimeout(function () {
        playTone(440, "sine", 0.1, 0.1); // A4
      }, 100);
      setTimeout(function () {
        playTone(587.33, "sine", 0.2, 0.12); // D5
      }, 200);
    },

    /**
     * Logout - som de desconexão
     */
    playLogout: function () {
      if (isMuted) return;
      // Progressão descendente: D5, A4, D4
      playTone(587.33, "sine", 0.1, 0.1);
      setTimeout(function () {
        playTone(440, "sine", 0.1, 0.1);
      }, 100);
      setTimeout(function () {
        playTone(293.66, "sine", 0.2, 0.1);
      }, 200);
    },

    /**
     * Transition - ao navegar entre telas
     */
    playTransition: function () {
      if (isMuted) return;
      playSweep(300, 600, 0.15, "sine", 0.06);
      playNoise(0.1, 0.02);
    },

    /**
     * Notification - novas notificações/toasts
     */
    playNotification: function () {
      if (isMuted) return;
      // Duas notas rápidas e agudas (tipo "plink plink")
      playTone(1318.51, "sine", 0.06, 0.1); // E6
      setTimeout(function () {
        playTone(1567.98, "sine", 0.1, 0.1); // G6
      }, 70);
    },

    /**
     * Select - ao selecionar item (missão, artefato)
     */
    playSelect: function () {
      if (isMuted) return;
      playTone(659.25, "triangle", 0.08, 0.1); // E5
      setTimeout(function () {
        playTone(987.77, "triangle", 0.1, 0.1); // B5
      }, 50);
    },

    /**
     * Deselect - ao desselecionar
     */
    playDeselect: function () {
      if (isMuted) return;
      playTone(987.77, "triangle", 0.08, 0.1);
      setTimeout(function () {
        playTone(659.25, "triangle", 0.1, 0.1);
      }, 50);
    },

    /**
     * Type - som de digitação (tecla)
     */
    playType: function () {
      if (isMuted) return;
      playTone(1800 + Math.random() * 200, "square", 0.015, 0.02);
    },

    /**
     * Mission Accept - aceitando uma missão (som épico)
     */
    playMissionAccept: function () {
      if (isMuted) return;
      // Acorde C maior com oitava
      playChord([523.25, 659.25, 783.99, 1046.5], "sine", 0.2, 0.1);
      setTimeout(function () {
        playSweep(400, 1200, 0.3, "sine", 0.08);
      }, 250);
    },

    /**
     * Mission Complete - missão concluída
     */
    playMissionComplete: function () {
      if (isMuted) return;
      // Fanfarra: C5, E5, G5, C6
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (note, i) {
        setTimeout(function () {
          playTone(note, "sine", 0.15, 0.12);
        }, i * 120);
      });
      // Brilho final
      setTimeout(function () {
        playSweep(1500, 3000, 0.4, "sine", 0.05);
      }, 500);
    },

    /**
     * Artifact Found - ao descobrir um artefato
     */
    playArtifactFound: function () {
      if (isMuted) return;
      // Som místico com harmônicos
      playTone(261.63, "sine", 0.3, 0.08); // C4
      playTone(523.25, "sine", 0.3, 0.06); // C5 (oitava)
      setTimeout(function () {
        playTone(783.99, "triangle", 0.4, 0.08); // G5
      }, 200);
      playNoise(0.4, 0.02);
    },

    /* ----- CONTROLES ----- */

    /**
     * Alterna mute (mudo)
     */
    toggleMute: function () {
      isMuted = !isMuted;
      updateMasterVolume();
      savePreferences();
      console.log("[AUDIO] 🔇 Mudo:", isMuted ? "ON" : "OFF");
      // Toca som só se ativou (não estava mudo)
      if (!isMuted) {
        this.playClick();
      }
      return isMuted;
    },

    /**
     * Define se está mudo
     */
    setMuted: function (muted) {
      isMuted = !!muted;
      updateMasterVolume();
      savePreferences();
    },

    /**
     * Retorna se está mudo
     */
    isMuted: function () {
      return isMuted;
    },

    /**
     * Define volume master (0 a 1)
     */
    setVolume: function (vol) {
      vol = Math.max(0, Math.min(1, parseFloat(vol) || 0));
      masterVolume = vol;
      updateMasterVolume();
      savePreferences();
    },

    /**
     * Retorna volume master atual
     */
    getVolume: function () {
      return masterVolume;
    },

    /**
     * Retorna se Web Audio é suportado
     */
    isSupported: function () {
      return isSupported;
    },

    /**
     * Força resume do contexto (para política de autoplay)
     */
    resume: function () {
      if (audioCtx && audioCtx.state === "suspended") {
        return audioCtx.resume();
      }
      return Promise.resolve();
    },
  };

  /* ============================================
     AUTO-INICIALIZAÇÃO
     ============================================ */
  // Inicializa preferências imediatamente
  loadPreferences();

  // Inicializa contexto no primeiro evento de interação do usuário
  // (necessário por causa da política de autoplay dos browsers)
  function autoInit() {
    initAudioContext();
    document.removeEventListener("click", autoInit);
    document.removeEventListener("keydown", autoInit);
    document.removeEventListener("touchstart", autoInit);
  }

  document.addEventListener("click", autoInit, { passive: true });
  document.addEventListener("keydown", autoInit, { passive: true });
  document.addEventListener("touchstart", autoInit, { passive: true });

  // Também expõe init explícito
  console.log("[AUDIO] 🎧 Audio System pronto para uso");
})();