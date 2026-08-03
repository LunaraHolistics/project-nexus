const CACHE_NAME = 'project-nexus-v2';
// Lista apenas os arquivos essenciais que temos certeza que existem
const urlsToCache = [
  '/',
  '/index.html',
  '/api.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto com sucesso');
        // Usamos .catch para garantir que o SW instale mesmo se um arquivo falhar
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[SW] Aviso: Nem todos os arquivos foram cacheados, mas o SW continuará:', err);
        });
      })
  );
  self.skipWaiting(); // Força a ativação imediata do novo SW
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se estiver no cache, retorna do cache
        if (response) {
          return response;
        }
        // Caso contrário, busca da rede
        return fetch(event.request).catch(() => {
          // Fallback silencioso para modo offline
        });
      })
  );
});