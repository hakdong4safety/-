// 빌드마다 캐시 이름이 바뀌므로, 재배포 시 예전 캐시가 자동으로 폐기됩니다.
const CACHE_NAME = 'hakdong4-safety-202608190341';
const APP_SHELL = [
  './',
  './index.html',
  './map.jpg',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 네트워크 우선: 항상 최신 버전을 먼저 시도하고, 실패(오프라인)할 때만 캐시로 대체합니다.
// (이렇게 해야 재배포 후 예전 파일이 계속 보이는 문제가 생기지 않습니다)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
