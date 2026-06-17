import { defineConfig } from 'vite'

const BASE = '/seasons/'

// ビルド成果物（ハッシュ付きJS/CSS＋index.html＋PWAの核）の一覧を precache-manifest.json に書き出す。
// service worker が install 時にこれを読んでシェルを事前キャッシュ＝「一度も情景を開かずオフラインでも起動」
// （外部API非依存・自分がいなくなっても動く原則）。音/背景画像は大きいので事前キャッシュせず再生時に取得。
function precacheManifest() {
  return {
    name: 'precache-manifest',
    generateBundle(_, bundle) {
      const urls = [
        BASE + 'index.html',
        BASE + 'manifest.webmanifest',
        BASE + 'icon-192.png',
        BASE + 'icon-512.png',
      ]
      for (const f of Object.keys(bundle)) {
        if (/\.(js|css)$/.test(f)) urls.push(BASE + f)
      }
      this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify(urls) })
    },
  }
}

// GitHub Pages はリポジトリ名のサブパス配下で公開されるため base を合わせる。
// 例: https://<ユーザー名>.github.io/seasons/
export default defineConfig({
  base: BASE,
  plugins: [precacheManifest()],
})
