// Service Worker - si disinstalla automaticamente per forzare aggiornamenti
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});
// Nessuna cache - va sempre in rete
self.addEventListener('fetch', () => {});
