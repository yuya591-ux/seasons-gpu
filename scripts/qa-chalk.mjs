// home の路傍に置いた「けんけんぱの白墨の輪」を、接地高さ確認＋至近撮影で検証する。
// 使い方: node scripts/qa-chalk.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4946
const BASE = `http://localhost:${PORT}/seasons/`
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) }
  return false
}
if (!(await waitServer())) { console.error('CHALK: preview server did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 560 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)

// 窓辺の実見え（グレード込み）
await page.screenshot({ path: 'scripts/_shots/chalk_window.png' })
// 至近（生WebGLだが形の確認用）
const out = await page.evaluate(() => {
  const X = 0, Z = 6, gy = window.__town3dHeights(X, Z).heightAt
  const a = window.__town3dShotAt(X - 0.5, gy + 2.6, Z + 4.2, X, gy + 0.1, Z, 46)
  const b = window.__town3dShotAt(X, gy + 6.0, Z + 0.6, X, gy, Z, 44) // ほぼ真上＝輪の形
  return { gy: +gy.toFixed(2), a, b }
})
console.log('広場けんけんぱ gy=' + out.gy)
if (out.a) writeFileSync('scripts/_shots/chalk.png', Buffer.from(out.a.split(',')[1], 'base64'))
if (out.b) writeFileSync('scripts/_shots/chalk_top.png', Buffer.from(out.b.split(',')[1], 'base64'))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
