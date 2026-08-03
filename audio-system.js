/**
 * ARCHIVE Audio System - Fallback Garantido
 * Gera sons sintéticos leves sem depender de arquivos externos.
 */
(function() {
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, duration, vol = 0.1) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Falha silenciosa se o áudio for bloqueado pelo navegador
    }
  }

  window.ArchiveAudio = {
    playClick: () => playTone(800, 'sine', 0.05, 0.05),
    playHover: () => playTone(1200, 'sine', 0.03, 0.03),
    playSuccess: () => {
      playTone(523.25, 'sine', 0.1, 0.1); // C5
      setTimeout(() => playTone(659.25, 'sine', 0.2, 0.1), 100); // E5
    },
    playError: () => playTone(150, 'sawtooth', 0.3, 0.1),
    init: () => Promise.resolve()
  };
})();