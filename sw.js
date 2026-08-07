// Service Worker — DCM Gestão de Estoque
// Cacheia o "app shell" (HTML/CSS/JS/ícones + libs de terceiros) para permitir
// abrir o app offline. As chamadas ao Supabase (dados) NUNCA são interceptadas
// aqui — sempre vão direto pra rede, para os dados nunca ficarem desatualizados
// ou serem enviados "no vazio" enquanto offline.

const CACHE_VERSION = 'dcm-estoque-v3';
const CACHE_NAME = CACHE_VERSION;

// Domínios que NUNCA devem ser interceptados (dados ao vivo)
const BYPASS_HOSTS = ['supabase.co', 'supabase.in'];

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/@zxing/library@0.18.6/umd/index.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const same = APP_SHELL.map((url) => fetch(url).then((r) => r.ok && cache.put(url, r)).catch(() => {}));
      const cdn  = CDN_ASSETS.map((url) => fetch(url, { mode: 'no-cors' }).then((r) => cache.put(url, r)).catch(() => {}));
      return Promise.all([...same, ...cdn]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só cuidamos de GET — POST/PUT/PATCH/DELETE (ex: gravações no Supabase) passam direto
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Nunca interceptar chamadas de dados (Supabase)
  if (BYPASS_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // Estratégia: stale-while-revalidate — responde do cache na hora (se existir)
  // e atualiza o cache em segundo plano; se estiver offline, cai no cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
