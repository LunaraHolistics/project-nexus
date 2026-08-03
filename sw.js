const CACHE_NAME = 'project-nexus-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/api.js',
  '/animations.css',
  '/animations.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto com sucesso');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[SW] Aviso: Nem todos os arquivos foram cacheados:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Se estiver no cache, retorna do cache
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 2. Se não estiver, tenta buscar da rede
      return fetch(event.request).catch(() => {
        // 3. Se falhar (offline), retorna uma resposta vazia válida para não quebrar a Promise
        console.warn('[SW] Offline: Falha ao buscar', event.request.url);
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});