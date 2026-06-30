// 街角の野仏（お地蔵さん）が出ているか確認する。home情景をロードし、設置点(6.4,-41)の地面高・
// 当たり判定を問い、近くから1枚撮る。使い方: node scripts/qa-jizo.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4943
const BASE = `http://localhost:${PORT}/seasons/`
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

const res = await page.evaluate(() => {
  const X = 6.4, Z = -41
  const h = window.__town3dHeights ? window.__town3dHeights(X, Z) : null
  const jy = h ? h.heightAt : 0
  const clear = window.__town3dClear ? window.__town3dClear(X, Z) : null // 16方位の通行可能距離（開けているか）
  // 近く・低く・正面寄りから2枚（手前の緑の occlusion を避ける別角度）
  const a = window.__town3dShotAt ? window.__town3dShotAt(X + 2.2, jy + 1.0, Z + 2.4, X, jy + 0.9, Z, 42) : null
  const b = window.__town3dShotAt ? window.__town3dShotAt(X - 2.4, jy + 1.0, Z - 1.2, X, jy + 0.9, Z, 42) : null
  return { jy, clear, a, b }
})
if (res.a) writeFileSync('scripts/_shots/jizo.png', Buffer.from(res.a.split(',')[1], 'base64'))
if (res.b) writeFileSync('scripts/_shots/jizo_b.png', Buffer.from(res.b.split(',')[1], 'base64'))
console.log(JSON.stringify({ jy: res.jy, clear: res.clear }))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
