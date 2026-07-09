// 暮らしの気配の検証: 夕暮れの街で家の窓が灯る／植木鉢・洗濯物があるか。窓辺ビュー＋街路の俯瞰を撮る。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4949
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) } return false }
if (!(await waitServer())) { console.error('LIFE: preview did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), SCENE)
await page.waitForTimeout(2800)
const dusk = await page.evaluate(() => window.__town3dPalProbe && window.__town3dPalProbe())
console.log('時間帯: ' + JSON.stringify(dusk))

await page.screenshot({ path: 'scripts/_shots/life_window.png' }) // 窓辺ビュー（街の家々）
// 街路の俯瞰（中央通り沿いの家並みを低空から）
const shots = [['life_street', [12, 8, -18, -2, 2.5, -36, 60]], ['life_street2', [-14, 7, -10, 4, 2.0, -28, 62]]]
for (const [name, a] of shots) { const u = await page.evaluate((aa) => window.__town3dShotAt(...aa), a); if (u) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(u.split(',')[1], 'base64')) }
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close(); cleanup(); process.exit(0)
