/**
 * INJECT ASSETS — Project Nexus
 * Injeta viewport, animações e service worker em todos os arquivos HTML
 * 
 * Uso: node inject-assets.js
 */

const fs = require('fs');
const path = require('path');

const dirs = ['.', './telas-individuais'];

const headInject = `
  <!-- Mobile Viewport Otimizado -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  
  <!-- Animações Archive OS -->
  <link rel="stylesheet" href="__PATH__animations.css">
  <script src="__PATH__animations.js"></script>`;

const bodyInject = `
  <!-- Service Worker para PWA -->
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('[PWA] Service Worker registrado'))
        .catch(err => console.error('[PWA] Falha no registro:', err));
    }
  </script>`;

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Determina o caminho relativo (vazio para raiz, '../' para subpastas)
    const assetPath = dir === '.' ? '' : '../';
    const formattedHeadInject = headInject.replace(/__PATH__/g, assetPath);
    
    // 1. Atualizar ou injetar Viewport
    if (content.includes('<meta name="viewport"')) {
      content = content.replace(
        /<meta name="viewport"[^>]*>/,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
      );
    }
    
    // 2. Injetar CSS e JS de animação no <head>
    if (!content.includes('animations.css')) {
      content = content.replace('<head>', `<head>${formattedHeadInject}`);
    }
    
    // 3. Injetar Service Worker antes de </body>
    if (!content.includes('serviceWorker')) {
      content = content.replace('</body>', `${bodyInject}\n</body>`);
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Atualizado: ${filePath}`);
  });
});

console.log('\n✅ Injeção de assets concluída com sucesso!');