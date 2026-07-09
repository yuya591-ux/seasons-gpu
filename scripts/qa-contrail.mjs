// 飛行機雲の確認: 高空を速く飛んで後ろに白い蒸気が伸び、振り返ると尾が見えるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 高空(y>40)で水平に速く飛ぶ＝後ろに飛行機雲を撒く
await page.evaluate(() => window.__town3dFlyPose(40, 52, -30, -1.2, 0.0))
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(2600) // しばらく飛んで尾を伸ばす
const d = await page.evaluate(() => window.__town3dDbg())
console.log('高空飛行:', JSON.stringify(d))
await page.screenshot({ path: 'scripts/_shots/trail-0-flying.png' })

// 止まって、尾を横から眺める位置へ（尾の線が見えるよう離れて上から）
await page.evaluate(() => window.__town3dMove(0, 0))
await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dFlyPose(28, 60, 6, 0, -0.5)) // 尾の手前・上空から見下ろす
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/trail-1-lookback.png' })

await browser.close()
console.log('contrail shots done')
