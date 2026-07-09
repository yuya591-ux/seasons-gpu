// 「季節と天気のアンビエント」オフライン対応サービスワーカー。
// 方針: 外部依存ゼロ・同一オリジンのみ。一度開けば、電波が無くても・将来サーバが消えても眺められる。
// 戦略: ページ遷移=ネット優先(失敗時キャッシュ)／資産=stale-while-revalidate(即表示→裏で更新)。
// 版を上げると activate で旧版キャッシュを全て掃除する＝古い情景レジストリ/チャンクの残留(メニュー破壊の元)を断つ。
// デプロイで中身が変わる時は必ずこの版を上げること。
// 【β版の掟】本家(/seasons/)と同一オリジンでキャッシュ置き場を共有するため、版名は必ず wgpu- で始め、
// 掃除も wgpu- 系統だけに限定する（本家 seasons-v* のキャッシュには絶対に触れない）。
const VERSION = 'wgpu-v2' // v2: 描画エンジンをWebGPURendererへ載せ替え（Phase 2 本移植）
const ASSET_CACHE = `${VERSION}-assets`

// install: シェル（index.html/JS/CSS/manifest/icon）を事前キャッシュ＝一度も情景を開かずオフラインでも起動。
// precache-manifest.json はビルド時にVite pluginが生成（ハッシュ付き資産名を含む）。失敗しても起動は妨げない。
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const res = await fetch(new URL('precache-manifest.json', self.registration.scope).href, { cache: 'no-cache' })
        if (res.ok) {
          const urls = await res.json()
          const cache = await caches.open(ASSET_CACHE)
          // 一つの失敗で全体を諦めない（allSettled）。
          await Promise.allSettled(urls.map((u) => cache.add(u)))
        }
      } catch {
        /* オフライン初回等は無視＝stale-while-revalidateで追って埋まる */
      }
      self.skipWaiting() // 新版は即時有効化（静かな自動更新）
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      // 旧版の掃除は自分の系統(wgpu-)だけ＝同居する本家のキャッシュを消さない
      await Promise.all(keys.filter((k) => k.startsWith('wgpu-') && !k.startsWith(VERSION)).map((k) => caches.delete(k)))
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
          // HTTPキャッシュを経由せず必ずネットに取りに行く＝GitHub Pages/ブラウザの古いindex.htmlを掴み続けて
          // 「古いアプリで起動→新チャンクと混在→メニュー破壊」を防ぐ。失敗時のみキャッシュへフォールバック。
          const fresh = await fetch(req, { cache: 'no-store' })
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
