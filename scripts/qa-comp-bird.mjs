// 並走鳥（つかの間の道連れ comp）の見た目確認。一過性で通常は撮れないため __town3dCompShot でカメラ前に置いて撮る。
// 使い方: node scripts/qa-comp-bird.mjs  （PORT=4956 上書き可）。出力は .qa-shots/comp-bird/。
// 注意: __town3dShotAt は生WebGL（CSS水彩グレード無し）＝実機よりやや甘く写る。ここでは「形・比率・シルエット」を見る。
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4956
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'comp-bird')
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })

const sweepKill = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'vite preview' -and $_.CommandLine -match '${PORT}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' }) } catch {} }

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {}; sweepKill() })

const waitReady = async () => { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) return true } catch {} await new Promise((r) => setTimeout(r, 250)) } throw new Error('preview not ready') }

const save = (name, dataUrl) => { const b64 = dataUrl.replace(/^data:image\/png;base64,/, ''); fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')) }

;(async () => {
  await waitReady()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 640, height: 560 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|preload/i.test(m.text())) errs.push(m.text()) })

  await page.goto(BASE + '?dev=1', { waitUntil: 'networkidle' })
  // 昼のtown3d情景を適用（明るく形が見える）
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  // マウント完了（フックが生える）まで待つ
  for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => typeof window.__town3dCompShot === 'function'); if (ok) break; await new Promise((r) => setTimeout(r, 250)) }

  // 高い上空（雲より上・空を背景）。実プレイの三人称視点に近い「やや上・横から」を中心に。鳥はカメラ前・中央・近距離。
  const PI = Math.PI
  // rig: [cx,cy,cz, lx,ly,lz]  bird: [fov,dist,yaw,flap]
  const LEVEL = [0, 152, 60, 0, 152, -30]    // 水平（真横）
  const ABOVE = [0, 156, 58, 0, 150, -30]    // やや見下ろし（上面が見える＝実プレイ）
  const shots = [
    // name, rig, fov, dist, yaw, flap
    ['01-side.png', LEVEL, 40, 3.2, PI / 2, 0.14],        // 真横・滑空: 流線の胴＋頭/くちばし＋M字の輪郭
    ['02-front.png', LEVEL, 40, 3.2, PI, 0.45],           // 正面・翼を上げた瞬間: M字の広がり
    ['03-topside.png', ABOVE, 40, 3.2, PI / 2 + 0.5, 0.16], // やや上・斜め前: 淡灰の上面＋黒い翼端
    ['04-behind.png', ABOVE, 44, 3.8, 0, 0.10],           // 斜め後ろ（並走して先へ）: 翼幅と尾扇
    ['05-flapdown.png', LEVEL, 40, 3.2, PI / 2, -0.22],   // 真横・打ち下ろしの下死点
  ]
  for (const [name, rig, fov, dist, yaw, flap] of shots) {
    const url = await page.evaluate(([r, f, d, y, fl]) => window.__town3dCompShot(r[0], r[1], r[2], r[3], r[4], r[5], f, d, y, fl, 0, 0), [rig, fov, dist, yaw, flap])
    if (url) save(name, url); else console.log('NO URL for', name)
  }

  console.log('errs:', errs.length)
  if (errs.length) console.log(errs.slice(0, 5).join('\n'))
  console.log('OUT:', OUT)
  await browser.close()
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
