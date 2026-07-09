// 歩行中のJSホットスポット特定: CDPサンプリングプロファイラで self-time 上位を出す
import { chromium } from 'playwright'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2000)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dFlyPose(0, 14, 8, 0, 0)); await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(2500)

const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
await cdp.send('Profiler.start')
// 歩行操作（前進＋見回し）で実プレイ相当の負荷をかける
await page.evaluate(() => window.__town3dMove(0, 1))
for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__town3dLook(0.05, 0)); await page.waitForTimeout(500) }
await page.evaluate(() => window.__town3dMove(0, 0))
const { profile } = await cdp.send('Profiler.stop')
// self-time集計（関数名＋行番号）
const hit = new Map()
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
for (const n of profile.nodes) {
  const f = n.callFrame
  if (!/town3dViewer/.test(f.url) && !/three\.module/.test(f.url) && f.functionName !== '(garbage collector)') continue
  const key = `${f.functionName || '(anon)'} @${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`
  hit.set(key, (hit.get(key) || 0) + (n.hitCount || 0))
}
const total = profile.nodes.reduce((s, n) => s + (n.hitCount || 0), 0)
const top = [...hit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)
console.log(`総サンプル=${total}`)
for (const [k, v] of top) console.log(`${((v / total) * 100).toFixed(1)}%  ${k}`)
await browser.close()
console.log('qa-cpuprof done')
