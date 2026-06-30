// 谷戸（獅子ヶ谷）に田の神の祠を置くための、棚田を避けた縁の開けた陸地の走査＋撮影。
// 使い方: node scripts/qa-yato.mjs   （SHOT=x,z を渡すとその地点を撮る）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PORT || 4945
const BASE = `http://localhost:${PORT}/seasons/`
const SHOT = process.env.SHOT ? process.env.SHOT.split(',').map(Number) : null
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) }
  return false
}
if (!(await waitServer())) { console.error('YATO: preview server did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 560 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('shishigaya-window-3d'))
await page.waitForTimeout(2800)

const cands = await page.evaluate(() => {
  const list = []
  // 谷の縁（里山の裾／棚田の畦）を狙う: |x| 8.5..14（谷底|x|<13の外縁）, z -42..6
  for (let x = -14; x <= 14; x += 1.5) for (let z = -42; z <= 6; z += 3) {
    if (Math.abs(x) < 8.5) continue // 谷底中央(棚田)は避ける
    const h = window.__town3dHeights(x, z); if (!h) continue
    const p = window.__town3dProbe(x, z); if (p && p.blocked) continue
    const c = window.__town3dClear(x, z); if (!c) continue
    const minC = Math.min(...c), open = c.filter((d) => d > 6).length
    if (minC >= 1.6 && open >= 7) list.push({ x: +x.toFixed(1), z, gy: +h.heightAt.toFixed(1), minC: +minC.toFixed(1), open })
  }
  list.sort((a, b) => (b.minC - a.minC) || (b.open - a.open))
  return list.slice(0, 10)
})
console.log('谷戸 縁の候補: ' + JSON.stringify(cands))

if (SHOT) {
  const [X, Z] = SHOT
  const out = await page.evaluate(([X, Z]) => {
    const gy = window.__town3dHeights(X, Z).heightAt
    const near = null // 存在は確認済み。__town3dTransparentは対象を透明化するので撮影前には呼ばない
    const a = window.__town3dShotAt(X - 1.6, gy + 1.1, Z - 1.2, X, gy + 0.7, Z, 40) // 谷側(南西)の至近＝供物の正面
    const b = window.__town3dShotAt(X + 3.5, gy + 2.6, Z + 3.5, X, gy + 0.6, Z, 36) // 引いた俯瞰＝棚田の文脈ごと
    return { gy, near, a, b }
  }, [X, Z])
  console.log('祠まわりのメッシュ: ' + JSON.stringify(out.near))
  if (out.a) writeFileSync('scripts/_shots/yato.png', Buffer.from(out.a.split(',')[1], 'base64'))
  if (out.b) writeFileSync('scripts/_shots/yato_b.png', Buffer.from(out.b.split(',')[1], 'base64'))
  console.log('SHOT(' + X + ',' + Z + ') gy=' + out.gy)
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
