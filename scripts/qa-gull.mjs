// かもめ品質統一の検証。①道連れ(comp)の近接ショット ②V字のかもめの行列(__town3dBirdFlockで任意発火→窓越しに実写系スクショ)
// ③旋回の鳥（窓の視界に入る高さを旋回。胴NaN修正の確認）。夜版も1枚。
// 使い方: node scripts/qa-gull.mjs （PORT=4957 上書き可）。出力は .qa-shots/gull/。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4957
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'gull')
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) return true } catch {} await new Promise((r) => setTimeout(r, 250)) } throw new Error('preview not ready') }
const save = (name, dataUrl) => { if (!dataUrl) { console.log('NO URL', name); return } fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  await waitReady()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|preload/i.test(m.text())) errs.push(m.text()) })
  await page.goto(BASE + '?dev=1', { waitUntil: 'networkidle' })
  const open = async (id) => {
    await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
    await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
    for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => typeof window.__town3dCompShot === 'function'); if (ok) break; await sleep(250) }
    await page.mouse.click(360, 280); await sleep(1500) // 開始ゲート「画面にふれて始める」を1タップで解除（実写系スクショのため）
  }

  await open('kitaterao-window-3d')
  // ① 道連れの近接（正面斜め・横・後ろ）＝共用ビルダーのリグレッション確認
  save('01-comp-front.png', await page.evaluate(() => window.__town3dCompShot(0, 70, 0, 0, 69.6, -10, 50, 5, Math.PI * 0.85, 0.3)))
  save('02-comp-side.png', await page.evaluate(() => window.__town3dCompShot(0, 70, 0, 0, 69.8, -10, 50, 5, Math.PI / 2, -0.15)))
  save('03-comp-rear-glide.png', await page.evaluate(() => window.__town3dCompShot(0, 70, 0, 0, 69.8, -10, 50, 6, 0, 0.06)))
  // ② V字のかもめの行列: 任意発火→__town3dFlockPosで現在位置を取り、真後ろ上と横から追い撮り（確実に大写し）
  await page.evaluate(() => window.__town3dBirdFlock())
  await sleep(3000)
  let fp = await page.evaluate(() => window.__town3dFlockPos())
  save('04-vflock-a.png', await page.evaluate(([x, y, z]) => window.__town3dShotAt(x, y + 4, z + 26, x, y, z, 55), fp))
  await sleep(1200); fp = await page.evaluate(() => window.__town3dFlockPos())
  save('05-vflock-b.png', await page.evaluate(([x, y, z]) => window.__town3dShotAt(x + 20, y + 2, z + 8, x, y, z, 50), fp))
  // ③ 旋回の鳥: 空中から旋回圏(中心±20, y30-44, z-40..-80)を見る＝胴が見える(NaN修正)確認
  save('06-circling.png', await page.evaluate(() => window.__town3dShotAt(0, 38, 10, 0, 36, -60, 58)))
  // ④ 夜版の色（月明かりの淡青に沈むか）
  await open('kitaterao-window-3d-night')
  save('07-comp-night.png', await page.evaluate(() => window.__town3dCompShot(0, 70, 0, 0, 69.8, -10, 50, 5, Math.PI / 2, -0.15)))
  await page.evaluate(() => window.__town3dBirdFlock())
  await sleep(3000)
  const np = await page.evaluate(() => window.__town3dFlockPos())
  save('08-vflock-night.png', await page.evaluate(([x, y, z]) => window.__town3dShotAt(x, y + 4, z + 26, x, y, z, 55), np))

  console.log('errs:', errs.length); if (errs.length) console.log(errs.slice(0, 5).join('\n'))
  console.log('OUT:', OUT)
  await browser.close(); process.exit(errs.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
