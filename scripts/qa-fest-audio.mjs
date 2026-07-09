// 夏祭りの囃子（太鼓）の音声グラフを headless で実際に走らせ、runtime エラーが出ないか確認する。
// 音の「良し悪し」は実機の耳で判断するもの。ここで見るのは「笛撤去後の太鼓/鉦/スケジューラが例外なく回るか」だけ。
// 使い方: node scripts/qa-fest-audio.mjs （PORT=4959 上書き可）。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4959
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) return true } catch {} await new Promise((r) => setTimeout(r, 250)) } throw new Error('preview not ready') }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  await waitReady()
  // AudioContext をユーザー操作なしで走らせる（headless で囃子スケジューラを検証するため）
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|preload|Web Audio|AudioContext was not allowed/i.test(m.text())) errs.push('console: ' + m.text()) })
  await page.goto(BASE + '?dev=1', { waitUntil: 'networkidle' })
  // 音を起動（devで window.__audio を公開済み）
  await page.evaluate(async () => { try { await window.__audio.start() } catch (e) { /* 起動は環境依存 */ } })
  await sleep(300)
  // アプリは毎フレーム setAmbience(fest=0) で上書きするので、setFestival(1) を高頻度で強制し続ける＝
  // 90msのスケジューラが必ず amt>0.005 を拾い、太鼓＋鉦の全経路を繰り返し発音させる（runtime例外の検出目的）。
  await page.evaluate(() => { window.__festHold = setInterval(() => { try { window.__audio.setFestival(1, 0) } catch {} }, 20) })
  await sleep(2600) // 1小節(16×0.15=2.4s)以上＝太鼓/鉦を確実に何度も発音
  // 同一評価内で強制直後に読む＝アプリの上書きが挟まらず amt=1 を確認できる（強制経路が効いている証拠）
  const dbg = await page.evaluate(() => { window.__audio.setFestival(1, 0); const d = window.__audio.getDebug(); clearInterval(window.__festHold); return d })
  await page.evaluate(() => window.__audio && window.__audio.setFestival(0, 0)) // 無音へ（setFestival の 0 経路も確認）
  await sleep(400)
  console.log('audio debug:', JSON.stringify(dbg))
  console.log('errs:', errs.length); if (errs.length) console.log(errs.slice(0, 8).join('\n'))
  await browser.close()
  process.exit(errs.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
