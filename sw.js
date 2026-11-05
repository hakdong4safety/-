// 빌드마다 캐시 이름이 바뀌므로, 재배포 시 예전 캐시가 자동으로 폐기됩니다.
const CACHE_NAME = 'hakdong4-safety-202611050200';
const APP_SHELL = [
  './',
  './index.html',
  './map.jpg',
  './siteplan.png',
  './checklist_template.xlsx',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll은 하나라도 실패하면 전체가 취소되므로, 파일별로 따로 담아
      // 아이콘 하나가 빠져도 나머지 오프라인 캐시는 살아있게 합니다.
      .then((cache) => Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      ))
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
//
// 단, 캐시 대상은 "우리 앱 파일(같은 출처)"로 한정합니다.
// 기상청 API·Firebase·CDN 같은 외부 요청까지 캐싱하면
//  (1) 호출할 때마다 URL이 달라져 캐시가 끝없이 불어나고
//  (2) 오프라인일 때 API 응답 자리에 index.html이 돌아와 엉뚱한 오류가 납니다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(req, resClone))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // 페이지 이동 요청일 때만 앱 화면으로 대체합니다.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});

/* ── 푸시 알림 수신 ───────────────────────────────────────────
   관리 탭에서 공지를 발송하면 Worker가 이 기기의 푸시 서비스로 전달하고,
   브라우저가 앱이 닫혀 있어도 이 코드를 깨워 알림을 띄웁니다. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'S.O.S 공지';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'sos-notice',      // 같은 tag면 이전 알림을 대체 (알림 쌓임 방지)
    renotify: true,
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림을 누르면 이미 열린 앱 창이 있으면 그 창을 앞으로, 없으면 새로 엽니다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const same = list.find((c) => c.url.startsWith(self.location.origin));
      if (same) return same.focus();
      return self.clients.openWindow(target);
    })
  );
});
