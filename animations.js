/**
 * ARCHIVE OS — Sistema de Animações Interativas
 * Project Nexus v2.0
 */

(function() {
  'use strict';

  var AnimationSystem = {
    /**
     * Cria efeito de confetti para celebração
     */
    createConfetti: function(container, count) {
      count = count || 30;
      var colors = ['#C5A059', '#FFBF00', '#CD7F32'];
      
      for (var i = 0; i < count; i++) {
        var particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = '-10px';
        particle.style.width = (Math.random() * 8 + 4) + 'px';
        particle.style.height = (Math.random() * 8 + 4) + 'px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDelay = (Math.random() * 0.5) + 's';
        particle.style.animationDuration = (Math.random() * 1 + 1) + 's';
        
        container.appendChild(particle);
        
        // Remove após animação
        setTimeout(function() {
          particle.remove();
        }, 2000);
      }
    },

    /**
     * Animação de captura do ladrão/suspeito
     */
    animateCapture: function(element, callback) {
      element.classList.add('animate-capture');
      
      // Efeito sonoro (se disponível)
      if (window.ArchiveAudio && window.ArchiveAudio.playSuccess) {
        window.ArchiveAudio.playSuccess();
      }
      
      setTimeout(function() {
        element.classList.remove('animate-capture');
        if (callback) callback();
      }, 1500);
    },

    /**
     * Animação de recuperação de artefato
     */
    animateArtifactRecovery: function(element, callback) {
      element.classList.add('animate-artifact-reveal', 'animate-artifact-glow');
      
      // Confetti
      if (element.offsetParent) {
        this.createConfetti(element.offsetParent, 20);
      }
      
      setTimeout(function() {
        element.classList.remove('animate-artifact-reveal', 'animate-artifact-glow');
        if (callback) callback();
      }, 2000);
    },

    /**
     * Animação de scan/decrypt
     */
    animateScan: function(element, duration, callback) {
      duration = duration || 2000;
      
      var scanLine = document.createElement('div');
      scanLine.style.position = 'absolute';
      scanLine.style.left = '0';
      scanLine.style.right = '0';
      scanLine.style.height = '2px';
      scanLine.style.background = 'linear-gradient(90deg, transparent, var(--amber), transparent)';
      scanLine.style.boxShadow = '0 0 10px var(--amber)';
      scanLine.style.zIndex = '100';
      scanLine.className = 'animate-scan-line';
      
      element.style.position = 'relative';
      element.appendChild(scanLine);
      
      setTimeout(function() {
        scanLine.remove();
        if (callback) callback();
      }, duration);
    },

    /**
     * Animação de missão completa
     */
    animateMissionComplete: function(element, callback) {
      element.classList.add('animate-mission-complete', 'animate-glow');
      
      // Confetti explosivo
      if (element.offsetParent) {
        this.createConfetti(element.offsetParent, 50);
      }
      
      setTimeout(function() {
        element.classList.remove('animate-mission-complete', 'animate-glow');
        if (callback) callback();
      }, 2000);
    },

    /**
     * Animação de erro/shake
     */
    animateError: function(element, callback) {
      element.classList.add('animate-shake');
      
      // Som de erro
      if (window.ArchiveAudio && window.ArchiveAudio.playError) {
        window.ArchiveAudio.playError();
      }
      
      setTimeout(function() {
        element.classList.remove('animate-shake');
        if (callback) callback();
      }, 500);
    },

    /**
     * Transição suave entre telas
     */
    transitionScreen: function(fromElement, toElement, callback) {
      fromElement.classList.add('fade-out');
      
      setTimeout(function() {
        fromElement.style.display = 'none';
        toElement.style.display = 'block';
        
        // Força reflow
        toElement.offsetHeight;
        
        toElement.classList.add('fade-in');
        
        setTimeout(function() {
          toElement.classList.remove('fade-in');
          fromElement.classList.remove('fade-out');
          if (callback) callback();
        }, 400);
      }, 400);
    },

    /**
     * Efeito de digitação (typewriter)
     */
    typeWriter: function(element, text, speed, callback) {
      speed = speed || 50;
      element.textContent = '';
      var i = 0;
      
      function type() {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          setTimeout(type, speed);
        } else if (callback) {
          callback();
        }
      }
      
      type();
    },

    /**
     * Efeito de glitch digital
     */
    glitchEffect: function(element, duration, callback) {
      duration = duration || 500;
      var originalText = element.textContent;
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
      var iterations = 0;
      var maxIterations = 10;
      
      var interval = setInterval(function() {
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
          clearInterval(interval);
          element.textContent = originalText;
          if (callback) callback();
        }
      }, 50);
      
      setTimeout(function() {
        clearInterval(interval);
        element.textContent = originalText;
      }, duration);
    }
  };

  // Expor globalmente
  window.ArchiveAnimations = AnimationSystem;
})();