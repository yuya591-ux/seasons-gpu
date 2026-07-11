// 2枚のPNGの画素差を出す単体ツール（変更前後のスクショ比較用）。
// 使い方: node scripts/qa-diff2.mjs before.png after.png
import { chromium } from 'playwright'
import fs from 'node:fs'

const [a, b] = process.argv.slice(2)
if (!a || !b || !fs.existsSync(a) || !fs.existsSync(b)) { console.error('使い方: node scripts/qa-diff2.mjs before.png after.png'); process.exit(2) }
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('about:blank')
const d = await page.evaluate(async ([sa, sb]) => {
  const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s })
  const [ia, ib] = await Promise.all([load(sa), load(sb)])
  const W = 393, H = 852
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true })
  cx.drawImage(ia, 0, 0, W, H); const da = cx.getImageData(0, 0, W, H).data
  cx.clearRect(0, 0, W, H); cx.drawImage(ib, 0, 0, W, H); const db = cx.getImageData(0, 0, W, H).data
  let sum = 0
  const BS = 32, bw = Math.ceil(W / BS)
  const blocks = new Float64Array(bw * Math.ceil(H / BS)), bn = new Float64Array(blocks.length)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const dd = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
    sum += dd
    const bi = ((y / BS) | 0) * bw + ((x / BS) | 0); blocks[bi] += dd; bn[bi]++
  }
  let bmax = 0
  for (let i = 0; i < blocks.length; i++) if (bn[i]) bmax = Math.max(bmax, blocks[i] / bn[i])
  return { mean: +(sum / (W * H * 3) / 2.55).toFixed(3), blockMax: +(bmax / 3 / 2.55).toFixed(2) }
}, [fs.readFileSync(a).toString('base64'), fs.readFileSync(b).toString('base64')])
console.log(`mean=${d.mean}% blockMax=${d.blockMax}%`)
await browser.close()
process.exit(0)
