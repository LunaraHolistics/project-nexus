/**
 * ARCHIVE OS — Sistema de Animações Interativas
 * Project Nexus v3.0 (corrigido e aprimorado)
 * 
 * Compatível com ES5 para máximo suporte a browsers antigos.
 * Todas as funções validam entrada e protegem contra null.
 */

(function() {
  'use strict';

  /* ============================================
     UTILITÁRIOS INTERNOS
     ============================================ */
  
  /**
   * Verifica se um elemento existe no DOM
   */
  function isValidElement(el) {
    return el && typeof el === 'object' && el.nodeType === 1;
  }

  /**
   * Executa callback com proteção contra erros
   */
  function safeCallback(callback) {
    if (typeof callback === 'function') {
      try {
        callback();
      } catch (e) {
        console.warn('[ANIMATIONS] Erro no callback:', e);
      }
    }
  }

  /**
   * Toca som do sistema de áudio com segurança
   */
  function playSound(methodName) {
    if (!window.ArchiveAudio) return;
    try {
      if (typeof window.ArchiveAudio[methodName] === 'function') {
        window.ArchiveAudio[methodName]();
      }
    } catch (e) {
      console.warn('[ANIMATIONS] Erro ao tocar som ' + methodName + ':', e);
    }
  }

  /* ============================================
     SISTEMA DE ANIMAÇÕES
     ============================================ */
  
  var AnimationSystem = {
    
    /**
     * Cria efeito de confetti para celebração
     * ✅ CORRIGIDO: closure bug no loop com IIFE
     */
    createConfetti: function(container, count) {
      if (!isValidElement(container)) {
        console.warn('[ANIMATIONS] createConfetti: container inválido');
        return;
      }
      
      count = count || 30;
      var colors = ['#C5A059', '#FFBF00', '#CD7F32', '#e9c176'];
      
      for (var i = 0; i < count; i++) {
        // ✅ IIFE para capturar 'particle' corretamente em cada iteração
        (function() {
          var particle = document.createElement('div');
          particle.className = 'particle';
          particle.style.cssText = 
            'position:absolute;' +
            'left:' + (Math.random() * 100) + '%;' +
            'top:-10px;' +
            'width:' + (Math.random() * 8 + 4) + 'px;' +
            'height:' + (Math.random() * 8 + 4) + 'px;' +
            'background-color:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
            'animation-delay:' + (Math.random() * 0.5) + 's;' +
            'animation-duration:' + (Math.random() * 1 + 1) + 's;' +
            'pointer-events:none;' +
            'z-index:9999;';
          
          container.appendChild(particle);
          
          // Remove após animação (referência correta agora)
          setTimeout(function() {
            if (particle && particle.parentNode) {
              particle.parentNode.removeChild(particle);
            }
          }, 2500);
        })();
      }
    },

    /**
     * Animação de captura do ladrão/suspeito
     */
    animateCapture: function(element, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      element.classList.add('animate-capture');
      playSound('playSuccess');
      
      setTimeout(function() {
        if (element) element.classList.remove('animate-capture');
        safeCallback(callback);
      }, 1500);
    },

    /**
     * Animação de recuperação de artefato
     */
    animateArtifactRecovery: function(element, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      element.classList.add('animate-artifact-reveal', 'animate-artifact-glow');
      
      // Confetti (usando this.createConfetti com proteção)
      var self = this;
      if (element.offsetParent) {
        try {
          self.createConfetti(element.offsetParent, 20);
        } catch (e) {
          console.warn('[ANIMATIONS] Erro ao criar confetti:', e);
        }
      }
      
      playSound('playSuccess');
      
      setTimeout(function() {
        if (element) {
          element.classList.remove('animate-artifact-reveal', 'animate-artifact-glow');
        }
        safeCallback(callback);
      }, 2000);
    },

    /**
     * Animação de scan/decrypt
     * ✅ APRIMORADO: proteção contra múltiplas chamadas simultâneas
     */
    animateScan: function(element, duration, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      duration = duration || 2000;
      
      // Previne múltiplas linhas de scan simultâneas
      var existingScan = element.querySelector('.animate-scan-line');
      if (existingScan) {
        existingScan.remove();
      }
      
      var scanLine = document.createElement('div');
      scanLine.className = 'animate-scan-line';
      scanLine.style.cssText = 
        'position:absolute;' +
        'left:0;' +
        'right:0;' +
        'height:2px;' +
        'background:linear-gradient(90deg, transparent, var(--amber, #FFBF00), transparent);' +
        'box-shadow:0 0 10px var(--amber, #FFBF00);' +
        'z-index:100;' +
        'pointer-events:none;' +
        'animation:scanMove ' + (duration / 1000) + 's linear;';
      
      var originalPosition = window.getComputedStyle(element).position;
      if (originalPosition === 'static') {
        element.style.position = 'relative';
      }
      
      element.appendChild(scanLine);
      
      setTimeout(function() {
        if (scanLine && scanLine.parentNode) {
          scanLine.parentNode.removeChild(scanLine);
        }
        safeCallback(callback);
      }, duration);
    },

    /**
     * Animação de missão completa
     * ✅ CORRIGIDO: removida dependência de animate-glow (duplicata)
     */
    animateMissionComplete: function(element, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      element.classList.add('animate-mission-complete');
      
      // Confetti explosivo
      var self = this;
      if (element.offsetParent) {
        try {
          self.createConfetti(element.offsetParent, 50);
        } catch (e) {
          console.warn('[ANIMATIONS] Erro ao criar confetti:', e);
        }
      }
      
      playSound('playMissionComplete');
      
      setTimeout(function() {
        if (element) {
          element.classList.remove('animate-mission-complete');
        }
        safeCallback(callback);
      }, 2500);
    },

    /**
     * Animação de erro/shake
     */
    animateError: function(element, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      element.classList.add('animate-shake');
      playSound('playError');
      
      setTimeout(function() {
        if (element) element.classList.remove('animate-shake');
        safeCallback(callback);
      }, 500);
    },

    /**
     * Transição suave entre telas
     * ✅ APRIMORADO: verifica existência de ambos os elementos
     */
    transitionScreen: function(fromElement, toElement, callback) {
      if (!isValidElement(fromElement) || !isValidElement(toElement)) {
        console.warn('[ANIMATIONS] transitionScreen: elementos inválidos');
        safeCallback(callback);
        return;
      }
      
      fromElement.classList.add('fade-out');
      
      setTimeout(function() {
        fromElement.style.display = 'none';
        toElement.style.display = 'block';
        
        // Força reflow
        void toElement.offsetHeight;
        
        toElement.classList.add('fade-in');
        
        setTimeout(function() {
          if (toElement) toElement.classList.remove('fade-in');
          if (fromElement) fromElement.classList.remove('fade-out');
          safeCallback(callback);
        }, 400);
      }, 400);
    },

    /**
     * Efeito de digitação (typewriter)
     * ✅ APRIMORADO: retorna função de cancelamento
     */
    typeWriter: function(element, text, speed, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return { cancel: function() {} };
      }
      
      speed = speed || 50;
      element.textContent = '';
      var i = 0;
      var cancelled = false;
      var timeoutId = null;
      
      function type() {
        if (cancelled) return;
        
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          timeoutId = setTimeout(type, speed);
        } else {
          safeCallback(callback);
        }
      }
      
      type();
      
      // Retorna objeto para cancelar a digitação
      return {
        cancel: function() {
          cancelled = true;
          if (timeoutId) clearTimeout(timeoutId);
        },
        complete: function() {
          cancelled = true;
          if (timeoutId) clearTimeout(timeoutId);
          element.textContent = text;
          safeCallback(callback);
        }
      };
    },

    /**
     * Efeito de glitch digital
     * ✅ CORRIGIDO: único timer, proteção contra chamadas rápidas
     */
    glitchEffect: function(element, duration, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      duration = duration || 500;
      var originalText = element.textContent;
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
      var iterations = 0;
      var maxIterations = Math.max(5, Math.floor(duration / 50));
      var completed = false;
      
      // Previne chamadas simultâneas
      if (element.dataset.glitching === 'true') {
        return;
      }
      element.dataset.glitching = 'true';
      
      var interval = setInterval(function() {
        if (completed) {
          clearInterval(interval);
          return;
        }
        
        var scrambled = '';
        for (var i = 0; i < originalText.length; i++) {
          if (originalText[i] === ' ') {
            scrambled += ' ';
          } else {
            scrambled += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        element.textContent = scrambled;
        iterations++;
        
        if (iterations >= maxIterations) {
          completed = true;
          clearInterval(interval);
          element.textContent = originalText;
          element.dataset.glitching = 'false';
          safeCallback(callback);
        }
      }, 50);
      
      // Timeout de segurança
      setTimeout(function() {
        if (!completed) {
          completed = true;
          clearInterval(interval);
          element.textContent = originalText;
          element.dataset.glitching = 'false';
        }
      }, duration + 100);
    },

    /**
     * ✅ NOVO: Animação de glow pulsante (útil para highlights)
     */
    animateGlow: function(element, duration, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      duration = duration || 1500;
      element.classList.add('animate-glow');
      
      setTimeout(function() {
        if (element) element.classList.remove('animate-glow');
        safeCallback(callback);
      }, duration);
    },

    /**
     * ✅ NOVO: Fade in simples
     */
    fadeIn: function(element, duration, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      duration = duration || 400;
      element.style.opacity = '0';
      element.style.display = 'block';
      element.style.transition = 'opacity ' + (duration / 1000) + 's ease';
      
      // Força reflow
      void element.offsetHeight;
      
      element.style.opacity = '1';
      
      setTimeout(function() {
        element.style.transition = '';
        safeCallback(callback);
      }, duration);
    },

    /**
     * ✅ NOVO: Fade out simples
     */
    fadeOut: function(element, duration, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      duration = duration || 400;
      element.style.transition = 'opacity ' + (duration / 1000) + 's ease';
      element.style.opacity = '0';
      
      setTimeout(function() {
        element.style.display = 'none';
        element.style.transition = '';
        element.style.opacity = '';
        safeCallback(callback);
      }, duration);
    },

    /**
     * ✅ NOVO: Animação de pulso (chama atenção)
     */
    animatePulse: function(element, times, callback) {
      if (!isValidElement(element)) {
        safeCallback(callback);
        return;
      }
      
      times = times || 3;
      var count = 0;
      
      function pulse() {
        if (count >= times) {
          safeCallback(callback);
          return;
        }
        
        element.classList.add('animate-pulse');
        count++;
        
        setTimeout(function() {
          element.classList.remove('animate-pulse');
          setTimeout(pulse, 200);
        }, 600);
      }
      
      pulse();
    },

    /**
     * ✅ NOVO: Helper para limpar todas as animações de um elemento
     */
    clearAnimations: function(element) {
      if (!isValidElement(element)) return;
      
      var animationClasses = [
        'animate-capture',
        'animate-artifact-reveal',
        'animate-artifact-glow',
        'animate-mission-complete',
        'animate-glow',
        'animate-shake',
        'animate-pulse',
        'fade-in',
        'fade-out'
      ];
      
      animationClasses.forEach(function(cls) {
        element.classList.remove(cls);
      });
      
      // Remove scans ativos
      var scans = element.querySelectorAll('.animate-scan-line');
      scans.forEach(function(scan) {
        if (scan.parentNode) scan.parentNode.removeChild(scan);
      });
    }
  };

  /* ============================================
     INICIALIZAÇÃO — CSS DINÂMICO
     ============================================ */
  
  // Injeta animações CSS que são usadas pelos métodos JS
  // (fallback caso animations.css não carregue)
  function injectFallbackAnimations() {
    if (document.getElementById('archive-animations-fallback')) return;
    
    var style = document.createElement('style');
    style.id = 'archive-animations-fallback';
    style.textContent = [
      '@keyframes scanMove { 0% { top: 0; } 100% { top: 100%; } }',
      '.animate-capture { animation: captureZoom 1.5s ease-out; }',
      '@keyframes captureZoom { 0% { transform: scale(1); } 50% { transform: scale(1.1); filter: brightness(1.5); } 100% { transform: scale(1); } }',
      '.animate-artifact-reveal { animation: artifactReveal 2s ease-out; }',
      '@keyframes artifactReveal { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }',
      '.animate-artifact-glow { box-shadow: 0 0 40px rgba(255,191,0,0.6); }',
      '.animate-mission-complete { animation: missionComplete 2.5s ease-out; }',
      '@keyframes missionComplete { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); filter: brightness(1.3); } }',
      '.animate-shake { animation: shake 0.5s ease; }',
      '@keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }',
      '.animate-glow { animation: glow 1.5s ease-in-out infinite; }',
      '@keyframes glow { 0%,100% { box-shadow: 0 0 10px rgba(255,191,0,0.3); } 50% { box-shadow: 0 0 30px rgba(255,191,0,0.8); } }',
      '.animate-pulse { animation: pulse 0.6s ease; }',
      '@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }',
      '.particle { animation: particleFall linear forwards; }',
      '@keyframes particleFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }',
      '.fade-in { animation: fadeIn 0.4s ease-out; }',
      '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '.fade-out { animation: fadeOut 0.4s ease-in forwards; }',
      '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }'
    ].join('\n');
    
    (document.head || document.getElementsByTagName('head')[0]).appendChild(style);
  }

  // Injeta CSS fallback após DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFallbackAnimations);
  } else {
    injectFallbackAnimations();
  }

  /* ============================================
     EXPOSIÇÃO GLOBAL
     ============================================ */
  
  window.ArchiveAnimations = AnimationSystem;

  // Log de inicialização
  console.log('[ANIMATIONS] ✅ Archive Animations v3.0 carregado (' + 
    Object.keys(AnimationSystem).length + ' métodos disponíveis)');
})();