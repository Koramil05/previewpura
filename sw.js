const CACHE_NAME = 'kas-pura-v1';
const API_CACHE_NAME = 'kas-pura-api-v1';
const OFFLINE_URL = '/PURA05/offline.html';

// Aset yang akan di-cache saat install
const PRECACHE_ASSETS = [
  '/PURA05/',
  '/PURA05/index.html',
  '/PURA05/offline.html',
  '/PURA05/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://raw.githubusercontent.com/Koramil05/PURA05/main/icons/icon-192x192.png',
  'https://raw.githubusercontent.com/Koramil05/PURA05/main/icons/icon-512x512.png'
];

// API endpoints yang akan di-cache (untuk offline)
const API_ENDPOINTS = [
  'https://script.google.com/macros/s/AKfycbzkRyVBF-QDP5kKH3wz28YvN6zDQ1CEY89sX2aO4WMAExW5zmx5Mn-cOUQiG5W8kOs-/exec'
];

// Install event - cache aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Caching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - bersihkan cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategy: Network first, fallback to cache untuk API
// Cache first untuk aset statis
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API requests
  if (url.href.includes('script.google.com')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }
  
  // Handle static assets (CSS, fonts, icons)
  if (event.request.url.match(/\.(css|woff2|png|jpg|jpeg|gif|svg|ico)$/)) {
    event.respondWith(handleStaticAssets(event.request));
    return;
  }
  
  // Handle HTML navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }
  
  // Default: Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Handler untuk API requests
async function handleAPIRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the response for offline use
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('📦 Cached API response:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    console.log('📱 Offline - using cached API:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return offline data
    return new Response(
      JSON.stringify({
        status: 'offline',
        data: [],
        message: 'Anda sedang offline. Menampilkan data terakhir yang tersimpan.'
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handler untuk static assets (Cache First)
async function handleStaticAssets(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset tidak tersedia', { status: 404 });
  }
}

// Handler untuk navigasi (HTML pages)
async function handleNavigation(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the HTML
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cached HTML
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }
    
    // Ultimate fallback
    return new Response('Offline - Halaman tidak tersedia', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Background sync untuk data offline (jika nanti ada fitur input)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Implementasi sync jika diperlukan di masa depan
  console.log('🔄 Syncing transactions...');
}

// Push notifications handler
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: 'https://raw.githubusercontent.com/Koramil05/PURA05/main/icons/icon-192x192.png',
    badge: 'https://raw.githubusercontent.com/Koramil05/PURA05/main/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Kas Pura', options)
  );
});
