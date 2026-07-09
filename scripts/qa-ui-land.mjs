// 横画面(スマホ横)で操作トレイが収まるか確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 440 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dFlyPose(262, 30, -30, Math.PI / 2, -0.08)); await page.waitForTimeout(600)
await page.mouse.move(440, 220); await page.mouse.move(441, 221); await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shots/ui-land.png' })
console.log('ui land shot done')
await browser.close()
