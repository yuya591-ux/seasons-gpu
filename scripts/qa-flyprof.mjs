// Step4: home低空飛行中(jsMs≈5.5ms=窓辺の5倍)のJSホットスポットをCDPサンプリングプロファイラで特定。
import { chromium } from 'playwright'
const port = process.env.PORT || '4917'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2000)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise && window.__town3dCruise(true)) // 巡航で能動飛行（30fps維持＝間引かない状態）
await page.evaluate(() => window.__town3dFlyPose(0, 14, 8, 0, 0)); await page.waitForTimeout(1500)
const load0 = await page.evaluate(() => window.__town3dLoad())
console.log('飛行中の毎フレ更新配列:', JSON.stringify(load0))

const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 150 })
await cdp.send('Profiler.start')
// home低空を巡航しつつ少し旋回（実飛行相当の負荷）
for (let i = 0; i < 16; i++) {
  await page.evaluate((k) => { window.__town3dFlyPose(Math.sin(k * 0.4) * 30, 14 + Math.sin(k * 0.2) * 4, 8 + k * 2, k * 0.1, 0) }, i)
  await page.waitForTimeout(420)
}
const { profile } = await cdp.send('Profiler.stop')
const hit = new Map()
for (const n of profile.nodes) {
  const f = n.callFrame
  if (!/town3dViewer/.test(f.url) && !/three\.module/.test(f.url) && f.functionName !== '(garbage collector)') continue
  const key = `${f.functionName || '(anon)'} @${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`
  hit.set(key, (hit.get(key) || 0) + (n.hitCount || 0))
}
const total = profile.nodes.reduce((s, n) => s + (n.hitCount || 0), 0)
const top = [...hit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
console.log(`総サンプル=${total}`)
for (const [k, v] of top) console.log(`${((v / total) * 100).toFixed(1)}%  ${k}`)
await browser.close()
console.log('qa-flyprof done')
