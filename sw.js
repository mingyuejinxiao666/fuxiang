// 浮想 · offline support. The page and icons are refreshed in the background; the fonts are kept once and reused.
const CORE = 'fuxiang-core-b5985cad86';
const FONTS = 'fuxiang-fonts-1';
const CORE_FILES = ['./', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];
const FONT_FILES = ['./fonts/ZCOOLXiaoWei.woff', './fonts/NotoSerifSC-400.woff', './fonts/NotoSerifSC-600.woff'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const core = await caches.open(CORE);
    await core.addAll(CORE_FILES);
    const fonts = await caches.open(FONTS);
    for (const f of FONT_FILES){
      if (!(await fonts.match(f))){ try { await fonts.add(f); } catch(err) {} }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()){
      if (k.startsWith('fuxiang-') && k !== CORE && k !== FONTS) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

const scopePath = new URL(self.registration.scope).pathname;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // the app itself: open instantly from the cache, fetch the newest copy for next time
  if (req.mode === 'navigate' && (url.pathname === scopePath || url.pathname === scopePath + 'index.html')){
    e.respondWith((async () => {
      const core = await caches.open(CORE);
      const cached = await core.match('./');
      const fresh = fetch(req).then(r => { if (r.ok) core.put('./', r.clone()); return r; }).catch(() => null);
      if (cached){ e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response('现在没有网络。联网后打开一次，以后没网也能用。', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // other pages (support, privacy): straight from the network
  if (req.mode === 'navigate') return;

  // everything else: cache first, then network (and keep a copy of what arrives)
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && /\.(woff2?|png|webmanifest)$/.test(url.pathname)){
        const c = await caches.open(/\.woff2?$/.test(url.pathname) ? FONTS : CORE);
        c.put(req, r.clone());
      }
      return r;
    } catch(err){
      return Response.error();
    }
  })());
});
