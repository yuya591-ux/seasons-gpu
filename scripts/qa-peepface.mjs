// 歩行者(makePeep)の顔の検証: 黒い点2つ→目鼻のテクスチャに化けたか接写する。
// peepを正面にピン留めし、地面高さを取得して頭の高さから至近で正対撮影。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4951
const BASE = `http://localhost:${PORT}/seasons/`
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) } return false }
if (!(await waitServer())) { console.error('PEEPFACE: preview did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 480 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), SCENE)
await page.waitForTimeout(2800)

// 建物に阻まれず確実に空抜けで顔を撮るため、peepを上空(y=28)へ正面ピン留めし、頭の高さで正対0.9m接写。
const Y = 28
const spots = [['peep_face0', 0, -2], ['peep_face2', 2, 0], ['peep_face4', 4, 2]]
for (const [name, i, x] of spots) {
  const u = await page.evaluate(({ i, x, Y }) => {
    window.__town3dPeepPin(i, x, -10, 0, Y) // yを上空Yへ上書き＝空抜け
    const hy = Y + 1.52 // おおよその頭の高さ（足元y=Y）
    return window.__town3dShotAt(x, hy, -10 + 0.95, x, hy, -10, 26) // 0.95m前から顔を正対
  }, { i, x, Y })
  if (u) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(u.split(',')[1], 'base64'))
}
// 全身（3体を並べて遠目の見え方）
await page.evaluate((Y) => { for (const [i, x] of [[0, -2], [2, 0], [4, 2]]) { window.__town3dPeepPin(i, x, -10, 0, Y) } }, Y)
const body = await page.evaluate((Y) => window.__town3dShotAt(0, Y + 1.0, -10 + 2.6, 0, Y + 0.9, -10, 42), Y)
if (body) writeFileSync('scripts/_shots/peep_bodies.png', Buffer.from(body.split(',')[1], 'base64'))

console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'PEEPFACE OK: エラー無し')
await browser.close(); cleanup(); process.exit(0)
