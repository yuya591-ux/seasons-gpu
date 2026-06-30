// 痕跡の発見検証: 歩行に入り、痕跡の座標へ寄ると、初回だけ絵日記に一行が静かに増えることを確認する。
// 使い方: node scripts/qa-trace.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 4947
const BASE = `http://localhost:${PORT}/seasons/`
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) }
  return false
}
if (!(await waitServer())) { console.error('TRACE: preview server did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2500)

// 決定的に歩行へ: 空へ飛び立つ→着地して歩く（dev フック）
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true))
await page.waitForTimeout(2500)
await page.evaluate(() => window.__town3dLand && window.__town3dLand(true))
await page.waitForTimeout(3000)
const reached = await page.evaluate(() => (window.__town3dDbg && window.__town3dDbg() ? window.__town3dDbg().mode : '?'))

// 絵日記の総数を localStorage 全文から数える（保存キーに依存せず、痕跡の語が増えたかを見る）
const journalText = () => page.evaluate(() => Object.values(localStorage).join('\n'))
const chimeCount = () => page.evaluate(() => (window.__town3dSoundCounts ? window.__town3dSoundCounts().chime : -1))
const before = await journalText()
const chime0 = await chimeCount()

// 痕跡の座標へ順に寄る（歩行モードを保ったまま flyPos を移す）
const visit = async (x, z) => {
  await page.evaluate(([x, z]) => { const gy = window.__town3dGroundAt ? window.__town3dGroundAt(x, z) : 0; if (window.__town3dFlyPose) window.__town3dFlyPose(x, gy + 1.4, z, 0, 0) }, [x, z])
  await page.waitForTimeout(1200)
}
await visit(0, 6)      // けんけんぱ
await visit(11, -24)   // 虫とり網
await visit(6.4, -41)  // お地蔵さま
const after = await journalText()

const chime1 = await chimeCount()
const hits = ['白い跡', '虫とり網', 'お地蔵'].map((w) => ({ w, found: after.includes(w) }))
console.log('到達mode=「' + reached + '」')
console.log('絵日記の痕跡語: ' + JSON.stringify(hits))
console.log('before長=' + before.length + ' after長=' + after.length)
console.log('鈴: ' + chime0 + '→' + chime1)
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
