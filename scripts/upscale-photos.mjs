// 開発時専用: 実写の窓の背景を Real-ESRGAN(無料・GPU/ncnn-vulkan) で超解像＋ノイズ除去し、
// 表示に適したサイズの JPEG に整えて public/bg/ に書き戻す。無料Flux枠の0.59MP上限による眠さ・JPEG荒れを補う。
// 本番は保存済み画像を表示するだけ（実行時に外部処理なし）。ツールは scripts/tools/（.gitignore済）。
// 使い方: node scripts/upscale-photos.mjs [name1,name2,...]   省略時は実写の窓4枚すべて
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const EXE = join(__dirname, 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe')
const MODELS = join(__dirname, 'tools', 'realesrgan', 'models')
const BG = join(ROOT, 'public', 'bg')
const SR = join(__dirname, '_sr')

const TARGET_W = 1280 // 書き出し幅（スマホ実機相当。縦は比率維持）。SRの精細さを保ちつつ配信サイズを抑える

const all = ['photo-window-town', 'photo-window-dusk', 'photo-window-sea', 'photo-window-night']
const names = (process.argv[2] || '').split(',').filter(Boolean)
const list = names.length ? names : all

for (const name of list) {
  const src = join(BG, `${name}.jpg`)
  const big = join(SR, `${name}-x4.png`)
  process.stdout.write(`[${name}] 超解像(4x) … `)
  execFileSync(EXE, ['-i', src, '-o', big, '-n', 'realesrgan-x4plus', '-m', MODELS, '-s', '4'], { stdio: ['ignore', 'ignore', 'ignore'] })
  const meta = await sharp(big).metadata()
  await sharp(big)
    .resize({ width: TARGET_W })          // 実機相当へ縮小（Lanczos）＝SRの粒立ちを滑らかに定着
    .sharpen({ sigma: 0.6 })              // ごく軽い輪郭強調
    .jpeg({ quality: 86, mozjpeg: true }) // 配信サイズと画質の両立
    .toFile(src)
  const kb = (await sharp(src).toBuffer()).length / 1024 | 0
  console.log(`${meta.width}x${meta.height} → 幅${TARGET_W}・${kb}KB 保存`)
}
console.log(`完了: ${list.length}枚`)
