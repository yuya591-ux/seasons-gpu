import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// WebGPU移行の実験リポジトリ（本家 seasons の複製）。公開パスは /seasons-gpu/。
const BASE = '/seasons-gpu/'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
      // シェル＝メインの入口チャンク(index-*.js)＋全CSS のみ事前キャッシュ。
      // three / town3dViewer / splatViewer / 後処理パス等の「遅延import」チャンクは事前キャッシュしない＝
      // 初回訪問で重いJS(計1.4MB+)を前倒しダウンロードしない（④-cの動的importの意図を尊重・初回表示を軽く）。
      // 3D/スプラット情景に入った時にSWの stale-while-revalidate が取得・キャッシュ＝以後はオフラインでも動く
      // （未取得の状態で3Dをオフラインで開いた場合は main.js の try/catch が2D情景へ穏やかにフォールバック）。
      for (const f of Object.keys(bundle)) {
        if (/\.css$/.test(f)) urls.push(BASE + f)
        else if (/(^|\/)index-[\w-]+\.js$/.test(f)) urls.push(BASE + f) // 入口チャンクのみ（遅延チャンクは除外）
      }
      this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify(urls) })
    },
  }
}

// WebGPU移行の要: 素の 'three' 読み込みを WebGPU 版ビルド（three/webgpu）へ付け替える。
// - 'three' と 'three/webgpu' は別モジュール実体（クラスを混ぜると instanceof が壊れる）ため、
//   town3dViewer と three/examples/jsm/*（内部で 'three' を import する）を丸ごと同じ実体に揃える。
// - 例外（従来のWebGL実体のまま）: benchGL（発熱ベンチの従来方式側）と、クラシックWebGL必須の
//   スプラット表示（splatViewer / @mkkellogg/gaussian-splats-3d）。
function threeWebgpuSwap() {
  return {
    name: 'three-webgpu-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source !== 'three') return null
      const from = (importer || '').replace(/\\/g, '/')
      if (/benchGL|splatViewer|gaussian-splats/.test(from)) return null
      return this.resolve('three/webgpu', importer, { skipSelf: true, ...options })
    },
  }
}

// GitHub Pages はリポジトリ名のサブパス配下で公開されるため base を合わせる。
// 例: https://<ユーザー名>.github.io/seasons/
export default defineConfig({
  base: BASE,
  plugins: [threeWebgpuSwap(), precacheManifest()],
  // three.module は意図的に大きい（動的importで分割済み・PWAで事前キャッシュ）。
  // 既定500KBの警告が出続けて保守ノイズになるため許容上限を上げる（評価 技術-L6）。
  build: {
    chunkSizeWarningLimit: 900,
    // bench.html = 発熱ベンチ（WebGL/WebGPUを同一負荷で比べる検証ページ）。キーを index にして
    // 入口チャンク名 index-*.js を保つ（precacheManifest の正規表現が拾えるように）。
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        bench: path.resolve(__dirname, 'bench.html'),
      },
    },
  },
})
