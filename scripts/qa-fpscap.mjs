// fps上限（案B-C3: 能動40）の検証: 操作を続けて能動状態を保ち、実描画fpsを測る。
// 期待: rAF 60Hz環境=30fps（2tick毎に量子化）／120Hz環境=40fps。上限を超えないこと・エラー0。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 4988
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { cwd: ROOT, shell: true, stdio: 'ignore' })
process.on('exit', () => { try { srv.kill() } catch {} })
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 250)) }

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(8000)
// rAF周波数（この環境のtick）を実測
const raf = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 > 1000) r(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }); return Math.round(n / ((performance.now() - t0) / 1000)) })
// 能動状態を保って実描画fps（2秒毎にひと触り×3回=6秒窓）
const f0 = await page.evaluate(() => ({ f: window.__town3dFrame(), t: performance.now() }))
for (let i = 0; i < 3; i++) { await page.mouse.move(300, 500); await page.mouse.down(); await page.mouse.move(302, 500); await page.mouse.up(); await page.waitForTimeout(2000) }
const f1 = await page.evaluate(() => ({ f: window.__town3dFrame(), t: performance.now() }))
const fps = (f1.f - f0.f) / ((f1.t - f0.t) / 1000)
console.log(`rAF=${raf}Hz 実描画=${fps.toFixed(1)}fps errs=${errs.length}`, errs.slice(0, 3))
// 上限40+マージン以下なら合格（vsyncロックの厳密さは環境依存: iPhone Safari=60Hzで30/120Hzで40に量子化、
// デスクトップChromiumはrAFが揺れて30-40の間になり得る＝上限を超えないことが本質）。
const ok = errs.length === 0 && fps <= 42 && fps >= 24
console.log(ok ? 'OK: 能動fpsは上限(40)以下・下限24以上' : 'NG: 期待レンジ外')
await browser.close()
process.exit(ok ? 0 : 1)
