// 「季節と天気のアンビエント」オフライン対応サービスワーカー。
// 方針: 外部依存ゼロ・同一オリジンのみ。一度開けば、電波が無くても・将来サーバが消えても眺められる。
// 戦略: ページ遷移=ネット優先(失敗時キャッシュ)／資産=stale-while-revalidate(即表示→裏で更新)。
const VERSION = 'seasons-v2'
const ASSET_CACHE = `${VERSION}-assets`

self.addEventListener('install', () => {
  self.skipWaiting() // 新版は即時有効化（静かな自動更新）
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))) // 旧版の掃除
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 同一オリジンのみ（外部APIに触れない原則）

  // ページ遷移: ネット優先・失敗したらキャッシュ（オフラインでも起動）
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(ASSET_CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(ASSET_CACHE)
          return (
            (await cache.match(req)) ||
            (await cache.match(self.registration.scope)) ||
            (await cache.match(new URL('index.html', self.registration.scope).href)) ||
            Response.error()
          )
        }
      })(),
    )
    return
  }

  // 資産（JS/CSS/音/画像）: stale-while-revalidate
  e.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE)
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone())
          return res
        })
        .catch(() => null)
      return cached || (await network) || Response.error()
    })(),
  )
})
