/**
 * ARCHIVE OS — Service Worker
 * Project Nexus v3.0
 * 
 * Estratégia de cache:
 * - HTML: Network-first (sempre tenta rede, fallback para cache)
 * - JS/CSS: Cache-first (prioriza cache, atualiza em background)
 * - Imagens: Cache-first com stale-while-revalidate
 * - Fontes: Cache-first com longo TTL
 */

// ============================================
// CONFIGURAÇÃO
// ============================================

const CACHE_VERSION = 'project-nexus-v3-r1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-${CACHE_VERSION}`;

// Assets críticos que DEVEM estar disponíveis offline
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json'
];

// Arquivos JavaScript e CSS do sistema
const SYSTEM_ASSETS = [
  '/api.js',
  '/audio-system.js',
  '/animations.css',
  '/animations.js'
];

// Todas as telas do Archive OS
const SCREENS = [
  '/01-splash.html',
  '/02-intro.html',
  '/03-cadastro.html',
  '/04-config.html',
  '/05-globo.html',
  '/06-tela-inicial.html',
  '/07-briefing.html',
  '/08-banco-dados.html',
  '/09-teia.html',
  '/10-missao-ativa.html',
  '/11-passaporte.html',
  '/12-diario.html',
  '/13-status-sede.html',
  '/14-conclusao.html',
  '/15-museu.html',
  '/16-biblioteca.html',
  '/17-progressao.html',
  '/18-sala-diretor.html',
  '/19-hq-atrium.html'
];

// Combinar todos os assets estáticos
const STATIC_ASSETS = [
  ...CRITICAL_ASSETS,
  ...SYSTEM_ASSETS,
  ...SCREENS
];

// Domínios de fontes para cache
const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ============================================
// INSTALAÇÃO
// ============================================

self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando assets estáticos...');
        
        // Cache em lotes para não falhar tudo se um arquivo falhar
        const cachePromises = STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[SW] Falha ao cachear ${url}:`, err.message);
            return null; // Não falha a instalação inteira
          });
        });
        
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('[SW] ✅ Instalação completa');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] ❌ Erro na instalação:', err);
      })
  );
});

// ============================================
// ATIVAÇÃO - LIMPEZA DE CACHES ANTIGOS
// ============================================

self.addEventListener('activate', event => {
  console.log('[SW] Ativando nova versão...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('[SW] Caches encontrados:', cacheNames);
      
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Remove caches que não são da versão atual
            return cacheName !== STATIC_CACHE &&
                   cacheName !== DYNAMIC_CACHE &&
                   cacheName !== FONT_CACHE;
          })
          .map(cacheName => {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => {
      console.log('[SW] ✅ Ativação completa');
      return self.clients.claim();
    })
  );
});

// ============================================
// ESTRATÉGIAS DE CACHE
// ============================================

/**
 * Network First: Tenta rede, se falhar usa cache
 * Ideal para HTML (sempre quer versão mais recente)
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Se sucesso, atualiza cache
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Offline, usando cache para:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback: página offline customizada
    return offlineFallback(request);
  }
}

/**
 * Cache First: Usa cache se disponível, senão busca da rede
 * Ideal para assets estáticos (JS, CSS, imagens)
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Stale-while-revalidate: retorna cache imediatamente, atualiza em background
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        caches.open(STATIC_CACHE).then(cache => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {
      // Ignora erros de rede em background
    });
    
    return cachedResponse;
  }
  
  // Se não tem cache, busca da rede
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return offlineFallback(request);
  }
}

/**
 * Cache Only: Usa apenas cache (para fontes que raramente mudam)
 */
async function cacheOnly(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(FONT_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Fallback offline adequado
 */
function offlineFallback(request) {
  // Para navegação HTML, retorna index.html (SPA-like fallback)
  if (request.mode === 'navigate' || request.destination === 'document') {
    return caches.match('/index.html').then(response => {
      return response || new Response(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ARCHIVE OS — Offline</title>
          <style>
            body {
              font-family: 'JetBrains Mono', monospace;
              background: #131313;
              color: #e5e2e1;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .container {
              max-width: 600px;
              padding: 40px;
            }
            h1 {
              color: #C5A059;
              font-size: 48px;
              margin-bottom: 20px;
            }
            p {
              font-size: 16px;
              line-height: 1.6;
              color: #c1c7cc;
            }
            .icon {
              font-size: 80px;
              margin-bottom: 30px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📡</div>
            <h1>OFFLINE</h1>
            <p>ARCHIVE OS requer conexão com a rede para sincronização inicial.</p>
            <p>Verifique sua conexão e recarregue a página.</p>
          </div>
        </body>
        </html>
      `, {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    });
  }
  
  // Para outros tipos de request, retorna resposta vazia
  return new Response('', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// ============================================
// INTERCEPTAÇÃO DE REQUESTS
// ============================================

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignora requests que não são GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignora requests para extensões do Chrome
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // ========================================
  // ESTRATÉGIA POR TIPO DE RECURSO
  // ========================================
  
  // Fontes do Google: Cache Only (raramente mudam)
  if (FONT_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(cacheOnly(event.request));
    return;
  }
  
  // API calls: Network Only (sempre fresco)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({
          error: 'Offline',
          message: 'API indisponível offline'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // HTML: Network First (sempre quer versão recente)
  if (event.request.destination === 'document' || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Assets estáticos (JS, CSS, imagens): Cache First
  if (event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'image' ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Fallback: Network First para todo o resto
  event.respondWith(networkFirst(event.request));
});

// ============================================
// MENSAGENS DO CLIENT
// ============================================

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Recebido SKIP_WAITING, ativando imediatamente...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Limpando todos os caches...');
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(name => caches.delete(name)));
    }).then(() => {
      console.log('[SW] ✅ Todos os caches limpos');
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// ============================================
// BACKGROUND SYNC (para ações offline)
// ============================================

self.addEventListener('sync', event => {
  if (event.tag === 'sync-missions') {
    console.log('[SW] Background sync: sincronizando missões...');
    event.waitUntil(syncMissions());
  }
  
  if (event.tag === 'sync-progress') {
    console.log('[SW] Background sync: sincronizando progresso...');
    event.waitUntil(syncProgress());
  }
});

async function syncMissions() {
  // Implementação futura: sincronizar missões pendentes
  console.log('[SW] Sync de missões não implementado ainda');
}

async function syncProgress() {
  // Implementação futura: sincronizar progresso do jogador
  console.log('[SW] Sync de progresso não implementado ainda');
}

// ============================================
// PUSH NOTIFICATIONS (futuro)
// ============================================

self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Nova notificação do ARCHIVE OS',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ARCHIVE OS', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action) {
    // Handle custom action
    console.log('[SW] Ação de notificação:', event.action);
  }
  
  // Abrir ou focar janela do app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// ============================================
// LOG DE INICIALIZAÇÃO
// ============================================

console.log('[SW] 🚀 ARCHIVE OS Service Worker v3.0 carregado');
console.log('[SW] Cache version:', CACHE_VERSION);
console.log('[SW] Assets to cache:', STATIC_ASSETS.length);