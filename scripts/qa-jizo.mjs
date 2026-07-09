// 街角の野仏（お地蔵さん）が出ているか確認する。home情景をロードし、設置点(6.4,-41)の地面高・
// 当たり判定を問い、近くから1枚撮る。使い方: node scripts/qa-jizo.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4943
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) }
  return false
}
if (!(await waitServer())) { console.error('JIZO: preview server did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 640 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)

const shoot = (X, Z, h0, fov = 42) => page.evaluate(([X, Z, h0, fov]) => {
  const h = window.__town3dHeights ? window.__town3dHeights(X, Z) : null
  const gy = h ? h.heightAt : 0
  const clear = window.__town3dClear ? window.__town3dClear(X, Z) : null
  const a = window.__town3dShotAt ? window.__town3dShotAt(X + 2.4, gy + 1.0 + h0, Z + 2.4, X, gy + h0, Z, fov) : null
  const b = window.__town3dShotAt ? window.__town3dShotAt(X - 2.4, gy + 1.0 + h0, Z - 1.4, X, gy + h0, Z, fov) : null
  return { gy, clear, a, b }
}, [X, Z, h0, fov])
const jizo = await shoot(6.4, -41, 0.9)
if (jizo.a) writeFileSync('scripts/_shots/jizo.png', Buffer.from(jizo.a.split(',')[1], 'base64'))
if (jizo.b) writeFileSync('scripts/_shots/jizo_b.png', Buffer.from(jizo.b.split(',')[1], 'base64'))
// 縁台の置き場を探す: home歩行域の候補を走査し、最も開けた地点(最小通行距離が大きい・陸上・非ブロック)を選ぶ
const cands = await page.evaluate(() => {
  const list = []
  for (let x = -12; x <= 12; x += 3) for (let z = -78; z <= 6; z += 6) {
    if (Math.abs(x) < 5.2 && z < 24 && z > -100) continue // 中央通りは空ける
    const h = window.__town3dHeights(x, z); if (!h || h.heightAt < h.SEAlevel + 0.6) continue
    const p = window.__town3dProbe(x, z); if (p && p.blocked) continue
    const c = window.__town3dClear(x, z); if (!c) continue
    const minC = Math.min(...c), open = c.filter((d) => d > 8).length
    if (minC >= 2.0 && open >= 6 && Math.hypot(x - 6.4, z + 41) > 10) list.push({ x, z, minC: +minC.toFixed(1), open, gy: +h.heightAt.toFixed(1) }) // 野仏から離す
  }
  list.sort((a, b) => (b.minC - a.minC) || (b.open - a.open))
  return list.slice(0, 8)
})
console.log('縁台 候補(開けた順): ' + JSON.stringify(cands))
const bench = await shoot(-6.0, -6, 0.5)
if (bench.a) writeFileSync('scripts/_shots/bench.png', Buffer.from(bench.a.split(',')[1], 'base64'))
if (bench.b) writeFileSync('scripts/_shots/bench_b.png', Buffer.from(bench.b.split(',')[1], 'base64'))
console.log(JSON.stringify({ jizo: { gy: jizo.gy }, bench: { gy: bench.gy, clear: bench.clear } }))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
