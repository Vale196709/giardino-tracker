// Service Worker - Giardino di Quintilina
// Gestisce: notifiche native + cache offline dell'app (PWA)

const CACHE_NAME = 'giardino-quintilina-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './mappa.jpg'
];

// ── INSTALL: precarica l'app shell in cache ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fallisce tutto se anche un solo file manca: aggiungiamo uno a uno
      // per non bloccare l'installazione se ad es. mappa.jpg non esiste ancora
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: elimina le cache vecchie ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia network-first per la pagina principale (sempre aggiornata se online,
// fallback alla cache se offline), cache-first per il resto delle risorse statiche ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // non intercettare scritture Firestore/API

  const url = new URL(req.url);

  // Richieste verso Firebase/Groq/OpenWeather/API esterne: lascia passare senza cache
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis') ||
      url.hostname.includes('groq.com') || url.hostname.includes('openweathermap') ||
      url.hostname.includes('callmebot') || url.hostname.includes('github')) {
    return;
  }

  // Navigazione (apertura pagina): network-first con fallback cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', resClone));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Altre risorse statiche (CSS, font, script CDN, immagini): cache-first, aggiorna in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Click su una notifica: porta in primo piano l'app se già aperta, altrimenti la apre
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
